/* ═══════════════════════════════════════════════════════════════════════════
   People Intelligence Hub — Persistent Data Store
   localStorage is the local cache; Supabase is the persistent cloud backend.
   On app mount, data is fetched from Supabase and written to localStorage.
   Every write goes to localStorage first (synchronous), then fires an async
   upsert/delete to Supabase in the background (fire-and-forget).
═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase';
import { getActiveCompanyId } from './payroll/company-profile';
import type { CompetencyCluster, AiCompetencyScore, AiRiskFlag, AiInterviewQuestion } from './cv-analyzer-ai';

export type PipelineStage = "applied" | "screened" | "work_sample" | "interviewed" | "offered" | "hired" | "rejected";
export type ReqStatus = "draft" | "active" | "paused" | "closed";

export const PIPELINE_STAGES: PipelineStage[] = ["applied", "screened", "work_sample", "interviewed", "offered", "hired"];
export const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: "Applied",
  screened: "Screened",
  work_sample: "Tes Praktik / Sample",
  interviewed: "Interviewed",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
};

export interface CvAnalysisSnapshot {
  reportId: string;
  overallScore: number;
  matchScore: number;
  confidence: number;
  recommendation: string;
  summary: string;
  frameworkLabel: string;
  analyzedAt: string;
  cluster?: CompetencyCluster;
  competencies?: AiCompetencyScore[];
  risks?: AiRiskFlag[];
  questions?: AiInterviewQuestion[];
  criteriaBreakdown?: { name: string; score: number; weight: number; evidence: string }[];
  strengths?: string[];
  gaps?: string[];
  riskAssessment?: { level: string; factors: string[] };
}

/** One scored interview question. Carries competencyId so interview scores can be
 *  joined to CV scores per competency — without it the Hiring Report's
 *  "CV vs Interview" table has nothing real to render. */
export interface InterviewQuestionScore {
  questionId: string;
  competencyId: string;
  competencyName: string;
  type: string;
  rating: number | null;
  /** true = sengaja tidak ditanyakan (waktu habis / tidak relevan). Berbeda
   *  dari rating null yang berarti "belum dinilai", dan berbeda jauh dari
   *  nilai 1 — pertanyaan yang tidak ditanyakan bukan performa terburuk. */
  notAsked?: boolean;
  notes: string;
}

export interface InterviewResultSnapshot {
  id?: string;
  candidateId?: string;
  jobReqId?: string;
  position?: string;
  department?: string;
  stage?: string;
  interviewer?: string;
  date?: string;
  duration?: number;
  status?: string;
  overallRating?: number;
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  nextSteps?: string;
  kitId: string;
  /** Nama pewawancara. Wajib diisi sejak panel didukung: tanpa ini, dua
   *  penilaian tidak bisa dibedakan pemiliknya dan panel mustahil dibentuk. */
  interviewerName?: string;
  /** Kompetensi yang ditandai wajib saat kit dibuat — disimpan bersama hasil
   *  agar laporan lama tetap dinilai dengan aturan yang berlaku saat itu. */
  criticalCompetencyIds?: string[];
  /** % pertanyaan terencana yang benar-benar dinilai. */
  coveragePct?: number;
  avgRating: number;
  recommendation: string;
  durationSec: number;
  completedAt: string;
  questionCount: number;
  ratedCount: number;
  questionScores?: InterviewQuestionScore[];
}

/** Satu perpindahan tahap. Tanpa ini, `createdAt`/`updatedAt` hanya menyimpan
 *  titik awal dan titik terakhir — sehingga lama kandidat tertahan di tiap tahap,
 *  konversi antar-tahap, dan deteksi kandidat mandek semuanya mustahil dihitung. */
export interface StageEvent {
  stage: PipelineStage;
  /** null pada entri pertama (kandidat baru masuk pipeline). */
  from: PipelineStage | null;
  at: string;
}

export interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: PipelineStage;
  jobReqId: string;
  department: string;
  position: string;
  source: string;
  notes: string;
  cvAnalysis: CvAnalysisSnapshot | null;
  interviewResults: InterviewResultSnapshot[];
  /** OPSIONAL dengan sengaja: kandidat yang dibuat sebelum fitur ini ada memang
   *  tidak punya riwayat, dan itu berbeda artinya dari "riwayat kosong".
   *  Keduanya diperlakukan sebagai TIDAK DIKETAHUI oleh mesin metrik, bukan
   *  nol hari — mengarang durasi dari data yang tidak ada akan membuat metrik
   *  kecepatan terlihat paling bagus justru pada kandidat yang paling lama
   *  tidak tersentuh. */
  stageHistory?: StageEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface JobRequisition {
  id: string;
  title: string;
  department: string;
  level: string;
  status: ReqStatus;
  description: string;
  requirements: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  location: string;
  targetDate: string;
  headcount: number;
  hiringManager: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  target: string;
  user: string;
  time: string;
  type: "hire" | "interview" | "analysis" | "offer" | "move" | "create" | "candidate" | "hired" | "req_created" | "reject";
}

export interface TalentProfile {
  id: string;
  name: string;
  phone: string;
  location: string;
  skills: string[];
  category: "Mitra Borongan" | "Karyawan Inti" | "Freelance" | "Vendor";
  capacity: number; // pcs per week, etc.
  status: "Available" | "Active" | "Inactive";
  rating: number; // 1.0 to 5.0
  source: string;
  createdAt: string;
  updatedAt: string;
}

const CANDIDATES_KEY = "hi_candidates";
const JOBREQS_KEY = "hi_jobreqs";
const ACTIVITY_KEY = "hi_activity";
const TALENT_POOL_KEY = "hi_talent_pool";

export function generateId(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

/* ─── Supabase row mappers (camelCase ↔ snake_case) ─── */

function candidateToRow(c: CandidateRecord) {
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, stage: c.stage,
    job_req_id: c.jobReqId, department: c.department, position: c.position,
    source: c.source, notes: c.notes, cv_analysis: c.cvAnalysis,
    interview_results: c.interviewResults, stage_history: c.stageHistory ?? [],
    created_at: c.createdAt, updated_at: c.updatedAt,
  };
}

function rowToCandidate(r: Record<string, unknown>): CandidateRecord {
  return {
    id: r.id as string, name: r.name as string,
    email: (r.email as string) ?? '', phone: (r.phone as string) ?? '',
    stage: (r.stage as PipelineStage) ?? 'applied',
    jobReqId: (r.job_req_id as string) ?? '',
    department: (r.department as string) ?? '',
    position: r.position as string,
    source: (r.source as string) ?? 'Manual',
    notes: (r.notes as string) ?? '',
    cvAnalysis: (r.cv_analysis as CvAnalysisSnapshot | null) ?? null,
    interviewResults: (r.interview_results as InterviewResultSnapshot[]) ?? [],
    stageHistory: (r.stage_history as StageEvent[]) ?? [],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function reqToRow(r: JobRequisition) {
  return {
    id: r.id, title: r.title, department: r.department, level: r.level, status: r.status,
    description: r.description, requirements: r.requirements,
    salary_min: r.salaryMin, salary_max: r.salaryMax, currency: r.currency,
    location: r.location, target_date: r.targetDate, headcount: r.headcount,
    hiring_manager: r.hiringManager, created_at: r.createdAt, updated_at: r.updatedAt,
  };
}

function rowToReq(r: Record<string, unknown>): JobRequisition {
  return {
    id: r.id as string, title: r.title as string,
    department: (r.department as string) ?? '',
    level: (r.level as string) ?? '',
    status: (r.status as ReqStatus) ?? 'draft',
    description: (r.description as string) ?? '',
    requirements: (r.requirements as string) ?? '',
    salaryMin: (r.salary_min as number) ?? 0,
    salaryMax: (r.salary_max as number) ?? 0,
    currency: (r.currency as string) ?? 'IDR',
    location: (r.location as string) ?? '',
    targetDate: (r.target_date as string) ?? '',
    headcount: (r.headcount as number) ?? 1,
    hiringManager: (r.hiring_manager as string) ?? '',
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function activityToRow(a: ActivityEntry) {
  return { id: a.id, action: a.action, target: a.target, user: a.user, time: a.time, type: a.type };
}

function rowToActivity(r: Record<string, unknown>): ActivityEntry {
  return {
    id: r.id as string, action: r.action as string,
    target: (r.target as string) ?? '',
    user: (r.user as string) ?? 'You',
    time: r.time as string,
    type: r.type as ActivityEntry['type'],
  };
}

function getTenantKey(key: string): string {
  if (typeof window === "undefined") return key;
  const compId = getActiveCompanyId();
  if (compId === "11111111-1111-4111-8111-111111111111" || compId === "valora_tv") return key; // Base key for Valora TV to preserve existing 754-employee demo data
  return `${key}_${compId}`;
}

let isSeedingZus = false;
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const tKey = getTenantKey(key);
    let raw = localStorage.getItem(tKey);
    if (!raw && !isSeedingZus && (getActiveCompanyId() === "22222222-2222-4222-8222-222222222222" || getActiveCompanyId() === "zus_textile") && (key === "hi_candidates" || key === "hi_jobreqs" || key === "hi_talent_pool" || key === "hi_activity")) {
      isSeedingZus = true;
      try { loadZusTextileDemoData(); } finally { isSeedingZus = false; }
      raw = localStorage.getItem(tKey);
    }
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getTenantKey(key), JSON.stringify(value));
  } catch { /* quota exceeded — silently fail */ }
}

/* ─── Candidates ─── */

export function getCandidates(): CandidateRecord[] {
  return readJson<CandidateRecord[]>(CANDIDATES_KEY, []);
}

export function getCandidate(id: string): CandidateRecord | null {
  return getCandidates().find((c) => c.id === id) ?? null;
}

export function saveCandidate(candidate: CandidateRecord): void {
  const all = getCandidates();
  const idx = all.findIndex((c) => c.id === candidate.id);
  if (idx >= 0) all[idx] = candidate;
  else all.unshift(candidate);
  writeJson(CANDIDATES_KEY, all);
  supabase?.from('candidates').upsert(candidateToRow(candidate)).then(() => {});
}

export function deleteCandidate(id: string): void {
  writeJson(CANDIDATES_KEY, getCandidates().filter((c) => c.id !== id));
  supabase?.from('candidates').delete().eq('id', id).then(() => {});
}

/* ─── Talent Pool ─── */

export function getTalentPool(): TalentProfile[] {
  return readJson<TalentProfile[]>(TALENT_POOL_KEY, []);
}

export function saveTalentProfile(profile: TalentProfile): void {
  const all = getTalentPool();
  const idx = all.findIndex((t) => t.id === profile.id);
  if (idx >= 0) all[idx] = profile;
  else all.unshift(profile);
  writeJson(TALENT_POOL_KEY, all);
}

export function deleteTalentProfile(id: string): void {
  writeJson(TALENT_POOL_KEY, getTalentPool().filter((t) => t.id !== id));
}

export function convertCandidateToTalent(candidateId: string): void {
  const c = getCandidate(candidateId);
  if (!c) return;

  const newTalent: TalentProfile = {
    id: `T-${c.id.replace('C-', '')}`,
    name: c.name,
    phone: c.phone,
    location: "Unknown", // Can be updated by user later
    skills: [], // Candidates don't have direct skills array yet, can map from competencies if needed
    category: "Freelance", // Defaulting to freelance for pipeline fallbacks
    capacity: 0,
    status: "Available",
    rating: c.cvAnalysis?.overallScore ? Number((c.cvAnalysis.overallScore / 20).toFixed(1)) : 0, // Convert 0-100 to 0-5
    source: "Transferred from CRM",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveTalentProfile(newTalent);
  
  // Log the activity
  addActivity({
    action: "Moved to Talent Pool",
    target: c.name,
    type: "move"
  });
}

export function moveCandidateStage(id: string, stage: PipelineStage): void {
  const c = getCandidate(id);
  if (!c) return;
  const prev = c.stage;
  if (prev === stage) return; // bukan perpindahan -- jangan mengotori riwayat
  const now = new Date().toISOString();
  c.stage = stage;
  c.updatedAt = now;
  c.stageHistory = [...(c.stageHistory ?? []), { stage, from: prev, at: now }];
  saveCandidate(c);
  addActivity({
    action: `Moved from ${STAGE_LABELS[prev]} to ${STAGE_LABELS[stage]}:`,
    target: c.name,
    type: stage === "hired" ? "hire" : "move",
  });
}

export function createCandidate(data: {
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  jobReqId?: string;
  source?: string;
}): CandidateRecord {
  const now = new Date().toISOString();
  const candidate: CandidateRecord = {
    id: generateId("C"),
    name: data.name,
    email: data.email ?? "",
    phone: data.phone ?? "",
    stage: "applied",
    jobReqId: data.jobReqId ?? "",
    department: data.department,
    position: data.position,
    source: data.source ?? "Manual",
    notes: "",
    cvAnalysis: null,
    interviewResults: [],
    stageHistory: [{ stage: "applied", from: null, at: now }],
    createdAt: now,
    updatedAt: now,
  };
  saveCandidate(candidate);
  addActivity({
    action: "Added new candidate:",
    target: `${candidate.name} — ${candidate.position}`,
    type: "create",
  });
  return candidate;
}

export interface ImportRow {
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department?: string;
  source?: string;
}

/** Bulk-create candidates from parsed rows. Skips rows missing name or position.
 *  Writes once and logs a single summary activity. Returns count added. */
export function importCandidates(rows: ImportRow[]): number {
  const all = getCandidates();
  const now = new Date().toISOString();
  let added = 0;
  for (const r of rows) {
    const name = r.name?.trim();
    const position = r.position?.trim();
    if (!name || !position) continue;
    all.unshift({
      id: generateId("C"),
      name,
      email: r.email?.trim() ?? "",
      phone: r.phone?.trim() ?? "",
      stage: "applied",
      jobReqId: "",
      department: r.department?.trim() ?? "",
      position,
      source: r.source?.trim() || "CSV Import",
      notes: "",
      cvAnalysis: null,
      interviewResults: [],
      createdAt: now,
      updatedAt: now,
    });
    added++;
  }
  if (added > 0) {
    writeJson(CANDIDATES_KEY, all);
    addActivity({
      action: "Imported candidates:",
      target: `${added} candidate${added === 1 ? "" : "s"} via CSV`,
      type: "create",
    });
    supabase?.from('candidates').upsert(all.slice(0, added).map(candidateToRow)).then(() => {});
  }
  return added;
}

export function findCandidateByName(name: string, position: string): CandidateRecord | null {
  const n = name.toLowerCase().trim();
  const p = position.toLowerCase().trim();
  return getCandidates().find(
    (c) => c.name.toLowerCase().trim() === n && c.position.toLowerCase().trim() === p,
  ) ?? null;
}

export function saveCvAnalysis(
  candidateId: string,
  analysis: CvAnalysisSnapshot,
): void {
  const c = getCandidate(candidateId);
  if (!c) return;
  c.cvAnalysis = analysis;
  if (c.stage === "applied") c.stage = "screened";
  c.updatedAt = new Date().toISOString();
  saveCandidate(c);
  addActivity({
    action: "CV analyzed:",
    target: `${c.name} — ${analysis.recommendation} (${analysis.overallScore} pts)`,
    type: "analysis",
  });
}

/** Bulk analysis: create-or-update a candidate with a CV analysis snapshot.
 *  Does NOT log a per-candidate activity (the batch logs one summary instead).
 *  Matches existing candidates by name + position so re-runs update in place.
 *  Syncs to Supabase via saveCandidate. */
export function upsertAnalyzedCandidate(data: {
  name: string;
  position: string;
  department: string;
  jobReqId?: string;
  source?: string;
  snapshot: CvAnalysisSnapshot;
}): CandidateRecord {
  const now = new Date().toISOString();
  const existing = findCandidateByName(data.name, data.position);
  const candidate: CandidateRecord = existing ?? {
    id: generateId("C"),
    name: data.name,
    email: "",
    phone: "",
    stage: "applied",
    jobReqId: data.jobReqId ?? "",
    department: data.department,
    position: data.position,
    source: data.source ?? "Bulk CV",
    notes: "",
    cvAnalysis: null,
    interviewResults: [],
    createdAt: now,
    updatedAt: now,
  };
  candidate.cvAnalysis = data.snapshot;
  if (candidate.stage === "applied") candidate.stage = "screened";
  if (data.jobReqId && !candidate.jobReqId) candidate.jobReqId = data.jobReqId;
  candidate.updatedAt = now;
  saveCandidate(candidate);
  return candidate;
}

/** Log one summary activity for a completed bulk analysis run. */
export function logBulkAnalysis(count: number, position: string): void {
  if (count <= 0) return;
  addActivity({
    action: "Bulk CV analysis:",
    target: `${count} CV${count === 1 ? "" : "s"} analyzed for ${position}`,
    type: "analysis",
  });
}

export function saveInterviewResult(
  candidateId: string,
  result: InterviewResultSnapshot,
): void {
  const c = getCandidate(candidateId);
  if (!c) return;
  // Kunci duplikat adalah PASANGAN kit + pewawancara. Sebelumnya hanya kitId,
  // sehingga penilaian pewawancara kedua menimpa penilaian pewawancara pertama
  // pada kit yang sama -- panel mustahil terbentuk tanpa disadari siapa pun.
  const sameSlot = (r: InterviewResultSnapshot) =>
    r.kitId === result.kitId &&
    (r.interviewerName ?? r.interviewer ?? "") === (result.interviewerName ?? result.interviewer ?? "");
  c.interviewResults = [result, ...c.interviewResults.filter((r) => !sameSlot(r))];
  if (c.stage === "screened" || c.stage === "applied") c.stage = "interviewed";
  c.updatedAt = new Date().toISOString();
  saveCandidate(c);
  addActivity({
    action: "Interview completed:",
    target: `${c.name} — ${result.recommendation} (${result.avgRating.toFixed(1)}/5)${result.interviewerName ? ` oleh ${result.interviewerName}` : ""}`,
    type: "interview",
  });
}

/* ─── Job Requisitions ─── */

export function getJobReqs(): JobRequisition[] {
  return readJson<JobRequisition[]>(JOBREQS_KEY, []);
}

export function getJobReq(id: string): JobRequisition | null {
  return getJobReqs().find((r) => r.id === id) ?? null;
}

export function saveJobReq(req: JobRequisition): void {
  const all = getJobReqs();
  const idx = all.findIndex((r) => r.id === req.id);
  if (idx >= 0) all[idx] = req;
  else all.unshift(req);
  writeJson(JOBREQS_KEY, all);
  supabase?.from('job_reqs').upsert(reqToRow(req)).then(() => {});
}

export function deleteJobReq(id: string): void {
  writeJson(JOBREQS_KEY, getJobReqs().filter((r) => r.id !== id));
  supabase?.from('job_reqs').delete().eq('id', id).then(() => {});
}

export function createJobReq(data: {
  title: string;
  department: string;
  level: string;
  description?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  location?: string;
  targetDate?: string;
  headcount?: number;
  hiringManager?: string;
}): JobRequisition {
  const now = new Date().toISOString();
  const req: JobRequisition = {
    id: generateId("REQ"),
    title: data.title,
    department: data.department,
    level: data.level,
    status: "draft",
    description: data.description ?? "",
    requirements: data.requirements ?? "",
    salaryMin: data.salaryMin ?? 0,
    salaryMax: data.salaryMax ?? 0,
    currency: data.currency ?? "IDR",
    location: data.location ?? "Jakarta",
    targetDate: data.targetDate ?? "",
    headcount: data.headcount ?? 1,
    hiringManager: data.hiringManager ?? "",
    createdAt: now,
    updatedAt: now,
  };
  saveJobReq(req);
  addActivity({
    action: "Created job requisition:",
    target: `${req.title} — ${req.department}`,
    type: "create",
  });
  return req;
}

/* ─── Activity Feed ─── */

export function getActivities(): ActivityEntry[] {
  return readJson<ActivityEntry[]>(ACTIVITY_KEY, []);
}

export function addActivity(data: {
  action: string;
  target: string;
  type: ActivityEntry["type"];
  user?: string;
}): void {
  const all = getActivities();
  const entry: ActivityEntry = {
    id: generateId("A"),
    action: data.action,
    target: data.target,
    user: data.user ?? "You",
    time: new Date().toISOString(),
    type: data.type,
  };
  all.unshift(entry);
  writeJson(ACTIVITY_KEY, all.slice(0, 50));
  supabase?.from('activities').insert(activityToRow(entry)).then(() => {});
}

/* ─── Dashboard Stats ─── */

export interface DashboardStats {
  totalCandidates: number;
  activePipeline: number;
  openReqs: number;
  activeReqs: number;
  avgScore: number;
  offerAcceptRate: number;
  stageBreakdown: Record<PipelineStage, number>;
  recentActivity: ActivityEntry[];
  departmentCounts: { name: string; candidates: number; reqs: number }[];
}

export function getDashboardStats(): DashboardStats {
  const candidates = getCandidates();
  const reqs = getJobReqs();
  const activities = getActivities();

  const activeStages: PipelineStage[] = ["applied", "screened", "interviewed", "offered"];
  const active = candidates.filter((c) => activeStages.includes(c.stage));

  const stageBreakdown: Record<PipelineStage, number> = {
    applied: 0, screened: 0, work_sample: 0, interviewed: 0, offered: 0, hired: 0, rejected: 0,
  };
  for (const c of candidates) stageBreakdown[c.stage]++;

  const withScores = candidates.filter((c) => c.cvAnalysis);
  const avgScore = withScores.length > 0
    ? Math.round(withScores.reduce((s, c) => s + (c.cvAnalysis?.overallScore ?? 0), 0) / withScores.length)
    : 0;

  const offered = candidates.filter((c) => c.stage === "offered" || c.stage === "hired");
  const hired = candidates.filter((c) => c.stage === "hired");
  const offerAcceptRate = offered.length > 0 ? Math.round((hired.length / offered.length) * 100) : 0;

  const deptMap = new Map<string, { candidates: number; reqs: number }>();
  for (const c of candidates) {
    const d = c.department || "Other";
    const entry = deptMap.get(d) ?? { candidates: 0, reqs: 0 };
    entry.candidates++;
    deptMap.set(d, entry);
  }
  for (const r of reqs) {
    const d = r.department || "Other";
    const entry = deptMap.get(d) ?? { candidates: 0, reqs: 0 };
    entry.reqs++;
    deptMap.set(d, entry);
  }

  return {
    totalCandidates: candidates.length,
    activePipeline: active.length,
    openReqs: reqs.filter((r) => r.status === "active").length,
    activeReqs: reqs.filter((r) => r.status !== "closed").length,
    avgScore,
    offerAcceptRate,
    stageBreakdown,
    recentActivity: activities.slice(0, 8),
    departmentCounts: Array.from(deptMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.candidates - a.candidates),
  };
}

export function getCandidatesForReq(reqId: string): CandidateRecord[] {
  return getCandidates().filter((c) => c.jobReqId === reqId);
}

/* ─── Demo Data ─── */

/** Menyusun riwayat tahap yang masuk akal untuk DATA DEMO saja.
 *  Data demo hanya punya createdAt dan updatedAt, sementara halaman Hiring
 *  Analytics butuh perpindahan antar-tahap agar ada yang bisa ditampilkan.
 *  Timestamp disebar merata di antara keduanya mengikuti jalur tahap yang wajar.
 *  TIDAK dipakai untuk kandidat nyata — di sana riwayat dicatat saat kejadian,
 *  bukan direkonstruksi. */
function withDemoStageHistory(c: CandidateRecord): CandidateRecord {
  if (c.stageHistory && c.stageHistory.length > 0) return c;

  const order: PipelineStage[] = ["applied", "screened", "work_sample", "interviewed", "offered", "hired"];
  // Kandidat ditolak: jalurnya berhenti sebelum 'hired' lalu masuk 'rejected'.
  const path: PipelineStage[] =
    c.stage === "rejected"
      ? ["applied", "screened", "rejected"]
      : order.slice(0, Math.max(1, order.indexOf(c.stage) + 1));

  const start = new Date(c.createdAt).getTime();
  const end = new Date(c.updatedAt).getTime();
  const span = Math.max(end - start, 86_400_000); // minimal 1 hari agar durasi tidak nol

  return {
    ...c,
    stageHistory: path.map((stage, i) => ({
      stage,
      from: i === 0 ? null : path[i - 1],
      at: new Date(start + (span * i) / Math.max(1, path.length - 1)).toISOString(),
    })),
  };
}


function loadZusTextileDemoData(): void {
  const base = new Date("2026-05-15T08:00:00.000Z");
  const daysAgo = (d: number) => new Date(base.getTime() - d * 86400000).toISOString();

  const reqs: JobRequisition[] = [
    {
      id: "REQ-ZUS-PRD01", title: "Kepala Pabrik / Plant Manager Garment", department: "Sewing Production",
      level: "Manager", status: "active", description: "Memimpin operasional lini jahit 245 operator, efisiensi waktu siklus (SMV), dan kontrol kualitas garment ekspor.",
      requirements: "8+ tahun pengalaman manajemen pabrik tekstil/garment, menguasai Lean Manufacturing dan manajemen tenaga kerja massal.", salaryMin: 15000000,
      salaryMax: 25000000, currency: "IDR", location: "Pabrik Cikarang (Zus Textile)", targetDate: "2026-08-15",
      headcount: 1, hiringManager: "Demo:Hendra Kusuma", createdAt: daysAgo(40), updatedAt: daysAgo(5),
    },
    {
      id: "REQ-ZUS-CUT01", title: "Senior Pattern Maker & CAD Grading", department: "Cutting & Pattern",
      level: "Senior", status: "active", description: "Bertanggung jawab atas pola potongan pakaian, optimasi marker CAD untuk meminimalkan sisa kain (waste fabric).",
      requirements: "5+ tahun pengalaman di Optitex/Gerber CAD, memahami karakteristik kain woven dan knit.", salaryMin: 7000000,
      salaryMax: 10500000, currency: "IDR", location: "Pabrik Cikarang (Zus Textile)", targetDate: "2026-07-30",
      headcount: 2, hiringManager: "Demo:Siti Hartati", createdAt: daysAgo(25), updatedAt: daysAgo(3),
    },
    {
      id: "REQ-ZUS-QC01", title: "Supervisor Quality Control (QC) Finishing", department: "Quality Control",
      level: "Mid-Level", status: "active", description: "Mengawasi standar mutu jahitan AQL 2.5 pada tahap akhir sebelum pengepakan ekspor dan distribusi ritel.",
      requirements: "3+ tahun sebagai QC Supervisor di industri apparel/konveksi, sertifikasi pemahaman ISO mutu pakaian.", salaryMin: 6000000,
      salaryMax: 8500000, currency: "IDR", location: "Pabrik Cikarang (Zus Textile)", targetDate: "2026-08-05",
      headcount: 2, hiringManager: "Demo:Bambang Setyo", createdAt: daysAgo(20), updatedAt: daysAgo(2),
    },
    {
      id: "REQ-ZUS-HR01", title: "Manager Industrial Relations (IR) & GA Pabrik", department: "Human Resources",
      level: "Manager", status: "active", description: "Menangani hubungan industrial serikat pekerja pabrik, kepatuhan Disnaker, K3 lingkungan pabrik, dan pengelolaan GA 245 karyawan.",
      requirements: "7+ tahun HR/IR di pabrik manufaktur padat karya, memahami UU Ketenagakerjaan dan mediasi bipartit/tripartit.", salaryMin: 12000000,
      salaryMax: 18000000, currency: "IDR", location: "Pabrik Cikarang (Zus Textile)", targetDate: "2026-07-25",
      headcount: 1, hiringManager: "Demo:Zus Textile HRBP", createdAt: daysAgo(35), updatedAt: daysAgo(8),
    },
  ];

  const candidates: CandidateRecord[] = [
    {
      id: "C-ZUS-001", name: "Siti Aminah", email: "siti.aminah@garment-pro.id", phone: "081298765431",
      stage: "offered", jobReqId: "REQ-ZUS-CUT01", department: "Cutting & Pattern",
      position: "Senior Pattern Maker & CAD Grading", source: "WhatsApp Apply", notes: "Sangat terampil menggunakan Gerber CAD, efisiensi marker kain mencapai 89%.",
      cvAnalysis: {
        reportId: "RPT-ZUS-001", overallScore: 92, matchScore: 90, confidence: 95,
        recommendation: "Strong Hire", summary: "6 tahun pengalaman pattern maker di pabrik apparel ekspor. Sertifikasi Optitex CAD expert.",
        frameworkLabel: "Garment Skills", analyzedAt: daysAgo(10),
        criteriaBreakdown: [
          { name: "CAD Pattern Making", score: 95, weight: 40, evidence: "6 thn Optitex & Gerber CAD" },
          { name: "Fabric Waste Reduction", score: 90, weight: 30, evidence: "Marker efficiency 89%" },
          { name: "Garment Spec Knowledge", score: 90, weight: 30, evidence: "Paham standard fit woven & knit" }
        ],
        strengths: ["Keahlian tinggi di software CAD pola", "Rekam jejak minim waste kain"],
        gaps: ["Belum pernah memimpin tim besar (>10 orang)"],
        riskAssessment: { level: "Low", factors: ["Kandidat stabil di 2 pabrik sebelumnya"] }
      },
      interviewResults: [
        {
          id: "INT-ZUS-001", candidateId: "C-ZUS-001", jobReqId: "REQ-ZUS-CUT01", position: "Senior Pattern Maker & CAD Grading",
          department: "Cutting & Pattern", stage: "Technical Interview", interviewer: "Siti Hartati (Head of Pattern)",
          date: daysAgo(5), duration: 45, status: "completed", recommendation: "Strong Hire", overallRating: 4.8,
          notes: "Tes praktek potong pola sangat cepat dan presisi.", strengths: "Akurasi millimeter", weaknesses: "None",
          nextSteps: "Lanjutkan ke offering", questionCount: 5, ratedCount: 5,
          kitId: "KIT-ZUS-01", avgRating: 4.8, durationSec: 2700, completedAt: daysAgo(5)
        }
      ],
      createdAt: daysAgo(20), updatedAt: daysAgo(4),
    },
    {
      id: "C-ZUS-002", name: "Budi Santoso", email: "budi.santoso@qc-apparel.id", phone: "081387654321",
      stage: "interviewed", jobReqId: "REQ-ZUS-QC01", department: "Quality Control",
      position: "Supervisor Quality Control (QC) Finishing", source: "LinkedIn Jobs", notes: "Pengalaman ketat dalam standar inspeksi AQL 2.5 buyer Amerika & Eropa.",
      cvAnalysis: {
        reportId: "RPT-ZUS-002", overallScore: 88, matchScore: 86, confidence: 92,
        recommendation: "Hire", summary: "5 tahun di bidang QC finishing garment ekspor. Paham regulasi jarum patah dan compliance keamanan.",
        frameworkLabel: "ISO 9001 Garment", analyzedAt: daysAgo(12),
        criteriaBreakdown: [
          { name: "AQL Inspection Standard", score: 90, weight: 50, evidence: "AQL 2.5 & 1.5 specialist" },
          { name: "Team Supervision", score: 85, weight: 50, evidence: "Memimpin 15 inspektor QC lini" }
        ],
        strengths: ["Sangat teliti terhadap cacat jahitan dan noda kain"], gaps: ["Bahasa Inggris pasif"],
        riskAssessment: { level: "Low", factors: ["Referensi dari eks-atasan sangat baik"] }
      },
      interviewResults: [], createdAt: daysAgo(18), updatedAt: daysAgo(6),
    },
    {
      id: "C-ZUS-003", name: "Hendra Kurniawan", email: "hendra.k@mfg-leader.id", phone: "081123456789",
      stage: "hired", jobReqId: "REQ-ZUS-PRD01", department: "Sewing Production",
      position: "Kepala Pabrik / Plant Manager Garment", source: "Executive Headhunting", notes: "Kepemimpinan sangat matang, mampu mengelola 300+ operator jahit tanpa konflik.",
      cvAnalysis: {
        reportId: "RPT-ZUS-003", overallScore: 95, matchScore: 94, confidence: 98,
        recommendation: "Strong Hire", summary: "12 tahun Plant Manager di perusahaan tekstil berskala 500+ karyawan. Ahli Lean Manufacturing & SMV balancing.",
        frameworkLabel: "Lean Garment Pro", analyzedAt: daysAgo(30),
        criteriaBreakdown: [
          { name: "Plant Leadership & Output", score: 96, weight: 50, evidence: "Kapasitas produksi 50k pcs/bulan" },
          { name: "Industrial Relations & K3", score: 94, weight: 50, evidence: "Zero strike record dalam 5 tahun terakhir" }
        ],
        strengths: ["Kepemimpinan kuat", "Paham teknis mesin jahit industri dan alur potong-jahit-pack"], gaps: ["Ex-salary cukup tinggi"],
        riskAssessment: { level: "Low", factors: ["Kesiapan join segera"] }
      },
      interviewResults: [], createdAt: daysAgo(35), updatedAt: daysAgo(10),
    },
    {
      id: "C-ZUS-004", name: "Rina Wulandari", email: "rina.wulandari@hr-ir.id", phone: "081567890123",
      stage: "screened", jobReqId: "REQ-ZUS-HR01", department: "Human Resources",
      position: "Manager Industrial Relations (IR) & GA Pabrik", source: "Internal Referral", notes: "Kandidat rekomendasi dari serikat pekerja pembina, negosiator yang tenang.",
      cvAnalysis: {
        reportId: "RPT-ZUS-004", overallScore: 85, matchScore: 84, confidence: 90,
        recommendation: "Hire", summary: "7 tahun menangani hubungan industrial dan GA pabrik konveksi di Jawa Barat.",
        frameworkLabel: "UU Ketenagakerjaan", analyzedAt: daysAgo(14),
        criteriaBreakdown: [
          { name: "Labor Law & IR Mediation", score: 88, weight: 60, evidence: "Berpengalaman mediasi di Disnaker" },
          { name: "GA & Factory Facilities", score: 80, weight: 40, evidence: "Mengelola kantin, dormitori, & armada jemputan" }
        ],
        strengths: ["Komunikasi komunikatif dengan serikat buruh"], gaps: ["Belum terbiasa sistem HRIS otomatisasi cloud"],
        riskAssessment: { level: "Low", factors: ["Stabil dan profesional"] }
      },
      interviewResults: [], createdAt: daysAgo(15), updatedAt: daysAgo(5),
    },
  ];

  const garmentSkills = ["Pattern Making", "Garment Sewing", "Fabric QC", "Textile Dying", "CAD Grading", "Industrial Relations", "AQL Inspection", "Marker CAD", "Sewing Machine Repair", "Lean Manufacturing"];
  const garmentNames = ["Agus Pranoto", "Wawan Sugiarto", "Ratna Galih", "Sri Mulyani", "Bambang Pamungkas", "Dewi Lestari", "Sugeng Raharjo", "Eko Prasetyo", "Neneng Hasanah", "Ujang Suherman", "Yuni Shara", "Iwan Fals", "Asep Sunandar", "Endang Sukamti", "Hartono Widodo"];
  const mockTalent: TalentProfile[] = garmentNames.map((name, i) => {
    return {
      id: `T-ZUS-${(i+1).toString().padStart(3, '0')}`,
      name: `${name} (${i % 2 === 0 ? "Sewing Pro" : "Textile Specialist"})`,
      phone: `08${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      location: i % 2 === 0 ? "Cikarang (Pabrik)" : "Bandung (Textile Center)",
      skills: [garmentSkills[i % garmentSkills.length], garmentSkills[(i + 2) % garmentSkills.length]],
      category: i < 10 ? "Karyawan Inti" : "Freelance",
      capacity: i < 10 ? 0 : 30,
      status: "Available",
      rating: Number((Math.random() * 1.0 + 4.0).toFixed(1)),
      source: i % 3 === 0 ? "WhatsApp Apply" : "LinkedIn Jobs",
      createdAt: daysAgo(20 + i),
      updatedAt: daysAgo(2 + i),
    };
  });

  const activities: ActivityEntry[] = [
    { id: "A-ZUS-1", action: "Hired candidate for Plant Manager", target: "Hendra Kurniawan", user: "Zus HRBP", time: daysAgo(10), type: "hired" },
    { id: "A-ZUS-2", action: "Completed Technical Interview", target: "Siti Aminah (Pattern Maker)", user: "Siti Hartati", time: daysAgo(5), type: "interview" },
    { id: "A-ZUS-3", action: "Created new Requisition", target: "REQ-ZUS-CUT01 (CAD Grading)", user: "Zus HRBP", time: daysAgo(25), type: "req_created" },
  ];

  writeJson("hi_jobreqs", reqs);
  writeJson("hi_candidates", candidates.map(withDemoStageHistory));
  writeJson("hi_talent_pool", mockTalent);
  writeJson("hi_activity", activities);
}

export function hasDemoData(): boolean {
  return getCandidates().some((c) => c.source === "Demo" || c.id.startsWith("C-ZUS-") || c.id.startsWith("C-DEMO-"));
}

export function clearDemoData(): void {
  writeJson("hi_activity", getActivities().filter((a) => !a.id.startsWith("A-DEMO") && !a.id.startsWith("A-ZUS-")));
  writeJson("hi_candidates", getCandidates().filter((c) => c.source !== "Demo" && !c.id.startsWith("C-ZUS-") && !c.id.startsWith("C-DEMO-")));
  writeJson("hi_jobreqs", getJobReqs().filter((r) => !r.hiringManager.startsWith("Demo:") && !r.id.startsWith("REQ-ZUS-")));
  writeJson("hi_talent_pool", getTalentPool().filter((t) => t.source !== "Demo" && !t.id.startsWith("T-ZUS-")));
  if (supabase) {
    supabase.from('candidates').delete().eq('source', 'Demo').then(() => {});
    supabase.from('job_reqs').delete().like('hiring_manager', 'Demo:%').then(() => {});
  }
}

export function loadDemoData(): void {
  if (typeof window !== "undefined" && (getActiveCompanyId() === "22222222-2222-4222-8222-222222222222" || getActiveCompanyId() === "zus_textile")) {
    return loadZusTextileDemoData();
  }
  const base = new Date("2026-05-15T08:00:00.000Z");
  const daysAgo = (d: number) => new Date(base.getTime() - d * 86400000).toISOString();

  const reqs: JobRequisition[] = [
    {
      id: "REQ-DEMO-ENG01", title: "Senior Broadcast IT Engineer", department: "Engineering & IT",
      level: "Senior", status: "active", description: "Lead broadcast IT transmission, MCR automation, and satellite uplink routing systems for 24/7 news operations.",
      requirements: "5+ yrs Broadcast IT, IP audio/video routing (SMPTE 2110), satellite transmission, and newsroom automation systems.", salaryMin: 25000000,
      salaryMax: 40000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-08-01",
      headcount: 2, hiringManager: "Demo:Carlo Ancelotti", createdAt: daysAgo(45), updatedAt: daysAgo(10),
    },
    {
      id: "REQ-DEMO-PRD01", title: "Executive Producer", department: "Production & Creative",
      level: "Manager", status: "active", description: "Executive Producer for prime-time talk shows, breaking news special broadcasts, and investigative journalism programs.",
      requirements: "8+ yrs broadcast production management, live studio directing, rundown optimization, and budget supervision.", salaryMin: 28000000,
      salaryMax: 45000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-07-20",
      headcount: 1, hiringManager: "Demo:Arsène Wenger", createdAt: daysAgo(30), updatedAt: daysAgo(5),
    },
    {
      id: "REQ-DEMO-DES01", title: "Senior News Anchor", department: "News & Editorial",
      level: "Senior", status: "active", description: "Lead on-screen presenter for prime-time live news bulletins and political interviews.",
      requirements: "5+ yrs live television news presentation, excellent on-camera charisma, journalistic integrity, and crisis reporting.", salaryMin: 20000000,
      salaryMax: 35000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-07-31",
      headcount: 1, hiringManager: "Demo:Zinedine Zidane", createdAt: daysAgo(20), updatedAt: daysAgo(3),
    },
    {
      id: "REQ-DEMO-DAT01", title: "Ad Traffic Scheduler", department: "Commercial & Traffic",
      level: "Mid-Level", status: "active", description: "Schedule and manage commercial advertising logs, sponsor integrations, and promo placement across broadcast streams.",
      requirements: "3+ yrs TV broadcast traffic scheduling, ad sales software, and regulatory compliance.", salaryMin: 12000000,
      salaryMax: 20000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-07-15",
      headcount: 2, hiringManager: "Demo:Jose Mourinho", createdAt: daysAgo(15), updatedAt: daysAgo(2),
    },
    {
      id: "REQ-DEMO-SPE01", title: "Valora Journalism Fellowship 2026 (Program Khusus)", department: "News & Editorial",
      level: "Intern", status: "active", description: "Program inkubasi dan fellowship intensif 6 bulan bagi jurnalis muda berbakat untuk liputan investigasi dan digital broadcasting Valora TV.",
      requirements: "Mahasiswa tingkat akhir atau lulusan baru semua jurusan, passion tinggi di jurnalisme broadcast, melampirkan portofolio penulisan/video liputan.", salaryMin: 6500000,
      salaryMax: 8500000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-08-31",
      headcount: 10, hiringManager: "Demo:Karni Ilyas", createdAt: daysAgo(10), updatedAt: daysAgo(1),
    },
    {
      id: "REQ-DEMO-SPE02", title: "Management Trainee (MT) Broadcast Media Leaders", department: "Corporate Services",
      level: "Entry Level", status: "active", description: "Program percepatan karir kepemimpinan untuk mencetak calon eksekutif masa depan di Valora Media Television (VALORA TV).",
      requirements: "S1/S2 universitas terkemuka IPB >= 3.50, kemampuan analitis dan kepemimpinan organisasi yang kuat, bersedia rotasi di seluruh pilar transmisi & redaksi.", salaryMin: 12000000,
      salaryMax: 15000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-09-15",
      headcount: 5, hiringManager: "Demo:Anindya Bakrie", createdAt: daysAgo(12), updatedAt: daysAgo(2),
    },
  ];

  const candidates: CandidateRecord[] = [
    {
      id: "C-DEMO-001", name: "David Beckham", email: "david.beckham@email.com", phone: "081234567890",
      stage: "hired", jobReqId: "REQ-DEMO-ENG01", department: "Engineering & IT",
      position: "Senior Broadcast IT Engineer", source: "Executive Headhunting", notes: "Excellent cultural fit for live transmission IT.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051501", overallScore: 91, matchScore: 88, confidence: 94,
        recommendation: "Strong Hire", summary: "7 years Broadcast IT & satellite transmission systems. Led migration of MCR digital automation serving 24/7 news live feeds.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(30),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-001", avgRating: 4.4, recommendation: "Strong Hire",
        durationSec: 3240, completedAt: daysAgo(22), questionCount: 8, ratedCount: 8,
      }],
      createdAt: daysAgo(35), updatedAt: daysAgo(5),
    },
    {
      id: "C-DEMO-002", name: "Ronaldinho", email: "ronaldinho@email.com", phone: "082345678901",
      stage: "offered", jobReqId: "REQ-DEMO-PRD01", department: "Production & Creative",
      position: "Executive Producer", source: "LinkedIn Jobs", notes: "Strong creative direction for prime-time talk shows.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051502", overallScore: 85, matchScore: 82, confidence: 89,
        recommendation: "Hire", summary: "10 years producing news talk shows & investigative documentaries. High ratings track record.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(25),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-002", avgRating: 4.1, recommendation: "Hire",
        durationSec: 2880, completedAt: daysAgo(18), questionCount: 7, ratedCount: 7,
      }],
      createdAt: daysAgo(28), updatedAt: daysAgo(3),
    },
    {
      id: "C-DEMO-003", name: "Thierry Henry", email: "thierry.henry@email.com", phone: "083456789012",
      stage: "interviewed", jobReqId: "REQ-DEMO-DES01", department: "News & Editorial",
      position: "Senior News Anchor", source: "Internal Referral", notes: "Charismatic on-screen presence, flawless diction.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051503", overallScore: 79, matchScore: 76, confidence: 85,
        recommendation: "Hire", summary: "5 years live news broadcasting at major national TV. Exceptional crisis reporting skills.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(15),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-003", avgRating: 3.6, recommendation: "Hire",
        durationSec: 2400, completedAt: daysAgo(8), questionCount: 6, ratedCount: 6,
      }],
      createdAt: daysAgo(18), updatedAt: daysAgo(2),
    },
    {
      id: "C-DEMO-004", name: "Xavi Hernández", email: "xavi.hernandez@email.com", phone: "084567890123",
      stage: "interviewed", jobReqId: "REQ-DEMO-ENG01", department: "Engineering & IT",
      position: "Technical Director (TD)", source: "Career Site (Web)", notes: "Solid studio switching and automation expertise.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051504", overallScore: 81, matchScore: 79, confidence: 91,
        recommendation: "Hire", summary: "8 years studio technical direction. Experienced in multi-camera live election broadcasts.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(14),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-004", avgRating: 3.8, recommendation: "Hire",
        durationSec: 3000, completedAt: daysAgo(6), questionCount: 8, ratedCount: 8,
      }],
      createdAt: daysAgo(20), updatedAt: daysAgo(2),
    },
    {
      id: "C-DEMO-005", name: "Andrés Iniesta", email: "andres.iniesta@email.com", phone: "085678901234",
      stage: "screened", jobReqId: "REQ-DEMO-PRD01", department: "Production & Creative",
      position: "Program Director (PD)", source: "Jobstreet Portal", notes: "Calm under pressure in control room.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051505", overallScore: 74, matchScore: 71, confidence: 80,
        recommendation: "Consider", summary: "4 years directing live sports and news bulletins. Well-organized rundown execution.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(10),
      },
      interviewResults: [], createdAt: daysAgo(14), updatedAt: daysAgo(4),
    },
    {
      id: "C-DEMO-006", name: "Frank Lampard", email: "frank.lampard@email.com", phone: "086789012345",
      stage: "screened", jobReqId: "REQ-DEMO-DES01", department: "News & Editorial",
      position: "Investigative Journalist", source: "LinkedIn Jobs", notes: "",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051506", overallScore: 68, matchScore: 65, confidence: 78,
        recommendation: "Consider", summary: "Print journalism background transitioning to TV broadcast. Deep network of political sources.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(8),
      },
      interviewResults: [], createdAt: daysAgo(12), updatedAt: daysAgo(6),
    },
    {
      id: "C-DEMO-007", name: "Steven Gerrard", email: "steven.gerrard@email.com", phone: "087890123456",
      stage: "applied", jobReqId: "REQ-DEMO-DAT01", department: "Commercial & Traffic",
      position: "Ad Traffic Scheduler", source: "Career Site (Web)", notes: "",
      cvAnalysis: null, interviewResults: [], createdAt: daysAgo(5), updatedAt: daysAgo(5),
    },
    {
      id: "C-DEMO-008", name: "Andrea Pirlo", email: "andrea.pirlo@email.com", phone: "088901234567",
      stage: "applied", jobReqId: "REQ-DEMO-ENG01", department: "Corporate Services",
      position: "HRBP Operations Specialist", source: "Executive Headhunting", notes: "",
      cvAnalysis: null, interviewResults: [], createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
    {
      id: "C-DEMO-009", name: "Paul Scholes", email: "paul.scholes@email.com", phone: "089012345678",
      stage: "rejected", jobReqId: "REQ-DEMO-ENG01", department: "Engineering & IT",
      position: "MCR Operator", source: "Jobstreet Portal", notes: "Did not pass technical transmission test.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051509", overallScore: 48, matchScore: 44, confidence: 65,
        recommendation: "Reject", summary: "Lacks familiarity with modern IP-based broadcast routing and satellite uplink protocols.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(20),
      },
      interviewResults: [], createdAt: daysAgo(25), updatedAt: daysAgo(18),
    },
    {
      id: "C-DEMO-010", name: "Gianluigi Buffon", email: "gianluigi.buffon@email.com", phone: "081123456789",
      stage: "screened", jobReqId: "REQ-DEMO-PRD01", department: "Production & Creative",
      position: "Showrunner", source: "Internal Referral", notes: "20 years industry veteran, exceptional team leadership.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051510", overallScore: 77, matchScore: 74, confidence: 82,
        recommendation: "Hire", summary: "Senior broadcast producer with track record of managing large production crews and tight budgets.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(4),
      },
      interviewResults: [], createdAt: daysAgo(7), updatedAt: daysAgo(1),
    },
  ];

  const activities: import("./store").ActivityEntry[] = [
    { id: "A-DEMO-01", action: "Hired:", target: "David Beckham — Senior Software Engineer", user: "You", time: daysAgo(5), type: "hire" },
    { id: "A-DEMO-02", action: "Offer extended to:", target: "Ronaldinho — Product Manager", user: "You", time: daysAgo(3), type: "offer" },
    { id: "A-DEMO-03", action: "Interview completed:", target: "Thierry Henry — Hire (3.6/5)", user: "You", time: daysAgo(8), type: "interview" },
    { id: "A-DEMO-04", action: "CV analyzed:", target: "Gianluigi Buffon — Hire (77 pts)", user: "You", time: daysAgo(4), type: "analysis" },
    { id: "A-DEMO-05", action: "Added new candidate:", target: "Steven Gerrard — Data Analyst", user: "You", time: daysAgo(5), type: "create" },
    { id: "A-DEMO-06", action: "Moved from Applied to Screened:", target: "Andrea Pirlo", user: "You", time: daysAgo(11), type: "move" },
  ];

  const existingCandidates = getCandidates().filter((c) => c.source !== "Demo");
  const existingReqs = getJobReqs().filter((r) => !r.hiringManager.startsWith("Demo:"));
  const existingActivities = getActivities().filter((a) => !a.id.startsWith("A-DEMO"));
  const existingTalent = getTalentPool().filter((t) => t.source !== "Demo");

  // Generate 48 Talent Pool Mock Data (Broadcasting & Media Specialists)
  const locations = ["Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Surabaya", "Bandung", "Yogyakarta", "Medan", "Makassar"];
  const allSkills = ["News Anchor", "Video Editing", "Camera Operating", "Live Broadcasting", "Scriptwriting", "Audio Engineering", "Graphic Design", "Investigative Reporting", "Digital Marketing", "Studio Lighting", "MCR Operations", "Rundown Management"];
  const mockTalent: TalentProfile[] = Array.from({ length: 48 }).map((_, i) => {
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const numSkills = Math.floor(Math.random() * 3) + 1;
    const skills = Array.from({ length: numSkills }).map(() => allSkills[Math.floor(Math.random() * allSkills.length)]);
    const uniqueSkills = Array.from(new Set(skills));
    
    const category = Math.random() > 0.3 ? "Karyawan Inti" : "Freelance";
    const capacity = category === "Freelance" ? Math.floor(Math.random() * 30) + 20 : 0; // 20-50 hours/week
    
    let status: "Available" | "Active" | "Inactive" = "Available";
    const r = Math.random();
    if (r > 0.6) status = "Active";
    else if (r < 0.1) status = "Inactive";

    const names = ["Lionel", "Cristiano", "Erling", "Kylian", "Kevin", "Luka", "Harry", "Son", "Virgil", "Alisson", "Ederson", "Thibaut", "Jude", "Martin", "Bruno", "Bernardo", "Rodri", "Federico", "Paulo", "Lautaro"];
    const lastNames = ["Messi", "Ronaldo", "Haaland", "Mbappé", "De Bruyne", "Modrić", "Kane", "Heung-min", "van Dijk", "Becker", "Moraes", "Courtois", "Bellingham", "Ødegaard", "Fernandes", "Silva", "Hernández", "Valverde", "Dybala", "Martínez"];
    const name = `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

    return {
      id: `T-DEMO-${(i+1).toString().padStart(3, '0')}`,
      name,
      phone: `08${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      location: loc,
      skills: uniqueSkills,
      category: category as any,
      capacity,
      status,
      rating: Number((Math.random() * 1.5 + 3.5).toFixed(1)), // 3.5 - 5.0
      source: "Demo",
      createdAt: daysAgo(Math.floor(Math.random() * 90) + 30),
      updatedAt: daysAgo(Math.floor(Math.random() * 20)),
    };
  });

  writeJson(CANDIDATES_KEY, [...candidates.map(withDemoStageHistory), ...existingCandidates]);
  writeJson(JOBREQS_KEY, [...reqs, ...existingReqs]);
  writeJson(ACTIVITY_KEY, [...activities, ...existingActivities].slice(0, 50));
  writeJson(TALENT_POOL_KEY, [...mockTalent, ...existingTalent]);
  if (supabase) {
    supabase.from('candidates').upsert(candidates.map(withDemoStageHistory).map(candidateToRow)).then(() => {});
    supabase.from('job_reqs').upsert(reqs.map(reqToRow)).then(() => {});
    supabase.from('activities').upsert(activities.map(activityToRow)).then(() => {});
  }
}

/* ─── Cloud sync ─── */

export async function syncFromSupabase(): Promise<void> {
  if (!supabase) return;
  const [candidatesRes, reqsRes, activitiesRes] = await Promise.all([
    supabase.from('candidates').select('*').order('created_at', { ascending: false }),
    supabase.from('job_reqs').select('*').order('created_at', { ascending: false }),
    supabase.from('activities').select('*').order('time', { ascending: false }).limit(50),
  ]);

  // Candidates: cloud wins if it has data; otherwise push local up (first-time migration).
  if (candidatesRes.data?.length) {
    writeJson(CANDIDATES_KEY, candidatesRes.data.map(rowToCandidate));
  } else {
    const local = getCandidates();
    if (local.length) await supabase.from('candidates').upsert(local.map(candidateToRow));
  }

  // Job reqs
  if (reqsRes.data?.length) {
    writeJson(JOBREQS_KEY, reqsRes.data.map(rowToReq));
  } else {
    const local = getJobReqs();
    if (local.length) await supabase.from('job_reqs').upsert(local.map(reqToRow));
  }

  // Activities
  if (activitiesRes.data?.length) {
    writeJson(ACTIVITY_KEY, activitiesRes.data.map(rowToActivity));
  } else {
    const local = getActivities();
    if (local.length) await supabase.from('activities').upsert(local.map(activityToRow));
  }
}
