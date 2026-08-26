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

// Kunci localStorage di-namespace per tenant. Instance ini hanya punya satu perusahaan,
// tetapi namespace-nya dipertahankan supaya data lama milik dua tenant demo yang sudah
// dihapus (Valora TV / Zus Textile) tidak ikut terbaca oleh perusahaan yang sekarang.
function getTenantKey(key: string): string {
  if (typeof window === "undefined") return key;
  return `${key}_${getActiveCompanyId()}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(getTenantKey(key));
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


// Data demo sudah DIHAPUS SELURUHNYA.
//
// Sebelumnya file ini menyimpan dua set data contoh: 10 kandidat + 6 lowongan + 48 talent
// pool bernama pesepakbola untuk tenant "Valora TV", dan 4 kandidat + 4 lowongan + 15
// talent pool bertema konveksi untuk tenant "Zus Textile". Keduanya dibuang karena
// instance ini dipakai untuk perusahaan sungguhan, bukan demo portofolio (CLAUDE.md §6).
//
// Jangan menambahkan seed contoh baru ke sini. Kandidat palsu yang bercampur dengan
// kandidat asli sulit dipisahkan lagi setelah ikut tersinkron ke database, dan metrik
// rekrutmen jadi salah tanpa ada tanda bahwa angkanya tercemar.
//
// Baris demo yang mungkin masih tertinggal di database dari versi sebelumnya dibersihkan
// dengan supabase/cleanup-demo-tenants.sql (dijalankan sekali di Supabase SQL Editor).

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
