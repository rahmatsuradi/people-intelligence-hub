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

/* ─── Cloud sync error reporting ───
   Supabase writes are fire-and-forget (localStorage is the source of truth for
   the UI), but we must not swallow failures silently. Log them so a broken sync
   is diagnosable instead of invisible. */
type SyncResult = { error: { message?: string } | null } | null | undefined;
function logSync(op: string, res: SyncResult): void {
  if (res?.error) console.warn(`[store] ${op} sync failed:`, res.error.message ?? res.error);
}

/* ─── Current user id ───
   Rows are owned per-user (composite primary key (user_id, id)). We cache the
   logged-in user's id so writes can stamp user_id explicitly, making upserts
   deterministic against the composite key. When it's unknown (not yet loaded
   or localStorage-only mode) we omit it and let the DB default (auth.uid())
   fill it on insert. */
let currentUserId: string | null = null;
if (supabase) {
  supabase.auth.getSession().then(({ data }) => { currentUserId = data.session?.user.id ?? null; });
  supabase.auth.onAuthStateChange((_event, session) => { currentUserId = session?.user.id ?? null; });
}
function ownerFields(): { user_id?: string } {
  return currentUserId ? { user_id: currentUserId } : {};
}

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
  avgRating: number;
  recommendation: string;
  durationSec: number;
  completedAt: string;
  questionCount: number;
  ratedCount: number;
  questionScores?: InterviewQuestionScore[];
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
    ...ownerFields(),
    id: c.id, name: c.name, email: c.email, phone: c.phone, stage: c.stage,
    job_req_id: c.jobReqId, department: c.department, position: c.position,
    source: c.source, notes: c.notes, cv_analysis: c.cvAnalysis,
    interview_results: c.interviewResults, created_at: c.createdAt, updated_at: c.updatedAt,
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
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function reqToRow(r: JobRequisition) {
  return {
    ...ownerFields(),
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
  return { ...ownerFields(), id: a.id, action: a.action, target: a.target, user: a.user, time: a.time, type: a.type };
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

// Bump whenever loadDemoData()'s Valora TV dataset shape changes materially
// (v2 = broadcast-domain overhaul: 28 broadcast requisitions, 145-candidate
// pipeline, 120-person contributor pool). A browser that already cached the
// older dataset otherwise never sees the new shape, since the seed-on-first-
// read below only fires when the key is completely absent.
const DEMO_SEED_VERSION = 2;
const SEED_VERSION_KEY = "hi_demo_seed_version";
const VALORA_TV_ID = "11111111-1111-4111-8111-111111111111";

let isSeedingDemo = false;
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const tKey = getTenantKey(key);
    let raw = localStorage.getItem(tKey);
    // First-ever read of these 4 Hire-module keys for whichever company is
    // currently active auto-seeds that company's demo dataset — previously
    // this only happened for Zus Textile, so a fresh visitor on Valora TV
    // (or anyone who cleared storage) saw Candidates/Talent Pool/Open Roles/
    // Activity as permanently empty instead of ever getting the Valora demo
    // data that loadDemoData() already knows how to build.
    const isDemoSeedKey = key === "hi_candidates" || key === "hi_jobreqs" || key === "hi_talent_pool" || key === "hi_activity";
    if (isDemoSeedKey && !isSeedingDemo) {
      const compId = getActiveCompanyId();
      const isValora = compId === VALORA_TV_ID || compId === "valora_tv";
      // Zus Textile's generator wasn't touched by the broadcast-domain rework
      // (and uses Math.random() for talent ratings), so it keeps the plain
      // "seed only if truly empty" behavior — only Valora TV gets the
      // version-gated forced reseed.
      const versionKey = getTenantKey(SEED_VERSION_KEY);
      const needsVersionReseed = isValora && Number(localStorage.getItem(versionKey) ?? "0") < DEMO_SEED_VERSION;
      if (!raw || needsVersionReseed) {
        isSeedingDemo = true;
        try { loadDemoData(); } finally { isSeedingDemo = false; }
        if (isValora) localStorage.setItem(versionKey, String(DEMO_SEED_VERSION));
        raw = localStorage.getItem(tKey);
      }
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
  supabase?.from('candidates').upsert(candidateToRow(candidate), { onConflict: 'user_id,id' }).then((r) => logSync('candidate upsert', r));
}

export function deleteCandidate(id: string): void {
  writeJson(CANDIDATES_KEY, getCandidates().filter((c) => c.id !== id));
  supabase?.from('candidates').delete().eq('id', id).then((r) => logSync('candidate delete', r));
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
  c.stage = stage;
  c.updatedAt = new Date().toISOString();
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
    supabase?.from('candidates').upsert(all.slice(0, added).map(candidateToRow), { onConflict: 'user_id,id' }).then((r) => logSync('candidates import', r));
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
  c.interviewResults = [result, ...c.interviewResults.filter((r) => r.kitId !== result.kitId)];
  if (c.stage === "screened" || c.stage === "applied") c.stage = "interviewed";
  c.updatedAt = new Date().toISOString();
  saveCandidate(c);
  addActivity({
    action: "Interview completed:",
    target: `${c.name} — ${result.recommendation} (${result.avgRating.toFixed(1)}/5)`,
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
  supabase?.from('job_reqs').upsert(reqToRow(req), { onConflict: 'user_id,id' }).then((r) => logSync('job_req upsert', r));
}

export function deleteJobReq(id: string): void {
  writeJson(JOBREQS_KEY, getJobReqs().filter((r) => r.id !== id));
  supabase?.from('job_reqs').delete().eq('id', id).then((r) => logSync('job_req delete', r));
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
  supabase?.from('activities').insert(activityToRow(entry)).then((r) => logSync('activity insert', r));
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

function loadZusTextileDemoData(): void {
  // Anchored to seed time, not a fixed calendar date: requisition aging and
  // time-to-hire are computed from these timestamps, so a fixed base makes
  // every number drift upward forever (a req would read "300 days open" a
  // year from now). Anchoring to now keeps the demo believable whenever a
  // visitor first loads it.
  const base = new Date();
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
  writeJson("hi_candidates", candidates);
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
    supabase.from('candidates').delete().eq('source', 'Demo').then((r) => logSync('demo candidates delete', r));
    supabase.from('job_reqs').delete().like('hiring_manager', 'Demo:%').then((r) => logSync('demo job_reqs delete', r));
  }
}

/** Permanently delete ALL of the user's data — localStorage AND the cloud copy.
 *  Awaits the cloud deletes so callers can safely navigate away afterwards.
 *  Under per-user RLS, the unfiltered deletes only affect the caller's own rows. */
export async function clearAllData(): Promise<void> {
  writeJson(CANDIDATES_KEY, []);
  writeJson(JOBREQS_KEY, []);
  writeJson(ACTIVITY_KEY, []);
  if (typeof window !== "undefined") {
    [CANDIDATES_KEY, JOBREQS_KEY, ACTIVITY_KEY].forEach((k) => localStorage.removeItem(k));
  }
  if (!supabase) return;
  // PostgREST requires a filter on delete; `id <> ''` matches every row (all ids
  // are non-empty), scoped to the current user by RLS.
  const results = await Promise.all([
    supabase.from('candidates').delete().neq('id', ''),
    supabase.from('job_reqs').delete().neq('id', ''),
    supabase.from('activities').delete().neq('id', ''),
  ]);
  const labels = ['candidates clear', 'job_reqs clear', 'activities clear'];
  results.forEach((r, i) => logSync(labels[i], r));
}

export function loadDemoData(): void {
  if (typeof window !== "undefined" && (getActiveCompanyId() === "22222222-2222-4222-8222-222222222222" || getActiveCompanyId() === "zus_textile")) {
    return loadZusTextileDemoData();
  }
  // Anchored to seed time, not a fixed calendar date: requisition aging and
  // time-to-hire are computed from these timestamps, so a fixed base makes
  // every number drift upward forever (a req would read "300 days open" a
  // year from now). Anchoring to now keeps the demo believable whenever a
  // visitor first loads it.
  const base = new Date();
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
      id: "REQ-DEMO-PRD01", title: "Executive Producer - News", department: "News & Editorial",
      level: "Manager", status: "active", description: "Executive Producer for prime-time news bulletins, breaking news special broadcasts, and investigative journalism programs.",
      requirements: "8+ yrs broadcast production management, live studio directing, rundown optimization, and budget supervision.", salaryMin: 28000000,
      salaryMax: 45000000, currency: "IDR", location: "Jakarta (Studio Valora)", targetDate: "2026-07-20",
      headcount: 1, hiringManager: "Demo:Arsène Wenger", createdAt: daysAgo(112), updatedAt: daysAgo(5),
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

  // A national TV station runs a permanently hot field-crew pipeline: VJs,
  // reporters, MCR shifts and graphics turn over far faster than corporate
  // roles. These fill out the requisition board to broadcast-realistic scale.
  // Deterministic (index-derived, no Math.random) so every visitor sees the
  // same demo.
  const bulkReqSpecs: { title: string; department: string; level: string; headcount: number; ageDays: number; salaryMin: number; salaryMax: number; manager: string }[] = [
    { title: "Video Journalist (VJ)", department: "News & Editorial", level: "Mid-Level", headcount: 8, ageDays: 96, salaryMin: 7000000, salaryMax: 11000000, manager: "Demo:Karni Ilyas" },
    { title: "Field Reporter - Biro Jakarta", department: "News & Editorial", level: "Mid-Level", headcount: 6, ageDays: 88, salaryMin: 7500000, salaryMax: 12000000, manager: "Demo:Najwa Shihab" },
    { title: "Field Reporter - Biro Surabaya", department: "News & Editorial", level: "Mid-Level", headcount: 3, ageDays: 74, salaryMin: 6500000, salaryMax: 10000000, manager: "Demo:Najwa Shihab" },
    { title: "Master Control Room (MCR) Operator", department: "Engineering & IT", level: "Mid-Level", headcount: 6, ageDays: 81, salaryMin: 7000000, salaryMax: 11500000, manager: "Demo:Carlo Ancelotti" },
    { title: "Motion Graphic Designer", department: "Production & Creative", level: "Mid-Level", headcount: 4, ageDays: 69, salaryMin: 8000000, salaryMax: 14000000, manager: "Demo:Arsène Wenger" },
    { title: "Video Editor & Colorist", department: "Production & Creative", level: "Mid-Level", headcount: 5, ageDays: 63, salaryMin: 7500000, salaryMax: 13000000, manager: "Demo:Arsène Wenger" },
    { title: "ENG Cameraman", department: "Production & Creative", level: "Mid-Level", headcount: 7, ageDays: 58, salaryMin: 6500000, salaryMax: 11000000, manager: "Demo:Roberto Mancini" },
    { title: "Audio Mixer & Sound Engineer", department: "Production & Creative", level: "Mid-Level", headcount: 3, ageDays: 54, salaryMin: 7000000, salaryMax: 12000000, manager: "Demo:Roberto Mancini" },
    { title: "Lighting Specialist & Switcher", department: "Production & Creative", level: "Mid-Level", headcount: 3, ageDays: 51, salaryMin: 6500000, salaryMax: 10500000, manager: "Demo:Roberto Mancini" },
    { title: "News Desk & Scriptwriter", department: "News & Editorial", level: "Mid-Level", headcount: 5, ageDays: 47, salaryMin: 7000000, salaryMax: 11000000, manager: "Demo:Karni Ilyas" },
    { title: "Produser Berita Pagi", department: "News & Editorial", level: "Senior", headcount: 2, ageDays: 44, salaryMin: 15000000, salaryMax: 24000000, manager: "Demo:Karni Ilyas" },
    { title: "Koordinator Liputan (Korlip) Daerah", department: "News & Editorial", level: "Senior", headcount: 2, ageDays: 41, salaryMin: 14000000, salaryMax: 22000000, manager: "Demo:Najwa Shihab" },
    { title: "Social Media & Digital Content Officer", department: "Commercial & Traffic", level: "Entry Level", headcount: 4, ageDays: 38, salaryMin: 6000000, salaryMax: 9500000, manager: "Demo:Jose Mourinho" },
    { title: "Creative Scriptwriter & Rundown Planner", department: "Production & Creative", level: "Mid-Level", headcount: 3, ageDays: 35, salaryMin: 7500000, salaryMax: 12500000, manager: "Demo:Arsène Wenger" },
    { title: "Transmisi RF & Satellite Uplink Engineer", department: "Engineering & IT", level: "Senior", headcount: 2, ageDays: 33, salaryMin: 14000000, salaryMax: 22000000, manager: "Demo:Carlo Ancelotti" },
    { title: "IT Network & Cybersecurity Specialist", department: "Engineering & IT", level: "Senior", headcount: 2, ageDays: 29, salaryMin: 15000000, salaryMax: 25000000, manager: "Demo:Carlo Ancelotti" },
    { title: "Talent Coordinator & Guest Relation", department: "Production & Creative", level: "Entry Level", headcount: 3, ageDays: 26, salaryMin: 5500000, salaryMax: 9000000, manager: "Demo:Arsène Wenger" },
    { title: "Studio Prompter & CG Operator", department: "Engineering & IT", level: "Entry Level", headcount: 4, ageDays: 23, salaryMin: 5500000, salaryMax: 8500000, manager: "Demo:Carlo Ancelotti" },
    { title: "Sports Programming & Broadcast Specialist", department: "Production & Creative", level: "Mid-Level", headcount: 2, ageDays: 19, salaryMin: 8000000, salaryMax: 13500000, manager: "Demo:Roberto Mancini" },
    { title: "HRBP - Redaksi & Produksi", department: "Human Capital & GA", level: "Senior", headcount: 1, ageDays: 16, salaryMin: 16000000, salaryMax: 26000000, manager: "Demo:Thibaut Courtois" },
    { title: "Payroll & Compensation Specialist", department: "Human Capital & GA", level: "Mid-Level", headcount: 1, ageDays: 13, salaryMin: 10000000, salaryMax: 16000000, manager: "Demo:Thibaut Courtois" },
    { title: "Ad Traffic & Sponsorship Analyst", department: "Commercial & Traffic", level: "Mid-Level", headcount: 2, ageDays: 8, salaryMin: 9000000, salaryMax: 15000000, manager: "Demo:Jose Mourinho" },
  ];

  for (const [i, s] of bulkReqSpecs.entries()) {
    reqs.push({
      id: `REQ-DEMO-BC${(i + 1).toString().padStart(2, "0")}`,
      title: s.title,
      department: s.department,
      level: s.level,
      status: "active",
      description: `Posisi ${s.title} untuk mendukung operasional siaran 24/7 Valora TV di ${s.department}.`,
      requirements: `Pengalaman relevan di industri penyiaran, siap kerja sistem shift dan liputan lapangan sesuai kebutuhan rundown.`,
      salaryMin: s.salaryMin,
      salaryMax: s.salaryMax,
      currency: "IDR",
      location: "Jakarta (Studio Valora)",
      targetDate: new Date(base.getTime() + 45 * 86400000).toISOString().slice(0, 10),
      headcount: s.headcount,
      hiringManager: s.manager,
      createdAt: daysAgo(s.ageDays),
      updatedAt: daysAgo(Math.max(1, Math.round(s.ageDays / 8))),
    });
  }

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

  // Bulk pipeline — field-crew hiring at a national TV station runs at a very
  // different volume than the handful of hand-written executive candidates
  // above. Deterministic (index-derived) so the demo is identical for every
  // visitor. These carry no cvAnalysis/interviewResults: they're pipeline
  // volume, not analyzed candidates, so nothing here fabricates an AI score.
  const bulkFirst = ["Rizky", "Dimas", "Anisa", "Bayu", "Citra", "Damar", "Elang", "Fajar", "Gita", "Hanif", "Intan", "Joko", "Kirana", "Lukman", "Maya", "Naufal", "Okta", "Prita", "Rangga", "Sinta", "Tegar", "Utari", "Vino", "Wulan", "Yoga", "Zahra"];
  const bulkLast = ["Pratama", "Wijaya", "Hidayat", "Nugroho", "Saputra", "Lestari", "Ramadhan", "Kusuma", "Anggraini", "Purnama", "Setiawan", "Maulana", "Handayani", "Firmansyah", "Wibowo", "Susanti"];
  const bulkSources = ["Jobstreet Portal", "LinkedIn Jobs", "Career Site (Web)", "Internal Referral", "Kampus / Job Fair", "Instagram Recruitment"];
  const bulkStages: PipelineStage[] = ["applied", "screened", "interviewed", "offered"];
  const bulkReqPool = reqs.filter((r) => r.id.startsWith("REQ-DEMO-BC"));

  const bulkCandidates: CandidateRecord[] = Array.from({ length: 137 }).map((_, i) => {
    const req = bulkReqPool[i % bulkReqPool.length];
    // Weighted toward the top of the funnel, like a real pipeline.
    const stage = bulkStages[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : i % 11 === 0 ? 3 : 0];
    const ageDays = 3 + ((i * 7) % 70);
    return {
      id: `C-DEMO-BC-${(i + 1).toString().padStart(3, "0")}`,
      name: `${bulkFirst[i % bulkFirst.length]} ${bulkLast[(i * 3) % bulkLast.length]}`,
      email: `kandidat${i + 1}@email.com`,
      phone: `08${(1200000000 + i * 7919).toString().slice(0, 10)}`,
      stage,
      jobReqId: req.id,
      department: req.department,
      position: req.title,
      source: bulkSources[i % bulkSources.length],
      notes: "",
      cvAnalysis: null,
      interviewResults: [],
      createdAt: daysAgo(ageDays),
      updatedAt: daysAgo(Math.max(1, Math.round(ageDays / 3))),
    };
  });

  candidates.push(...bulkCandidates);

  const existingCandidates = getCandidates().filter((c) => c.source !== "Demo");
  const existingReqs = getJobReqs().filter((r) => !r.hiringManager.startsWith("Demo:"));
  const existingActivities = getActivities().filter((a) => !a.id.startsWith("A-DEMO"));
  const existingTalent = getTalentPool().filter((t) => t.source !== "Demo");

  // 120 freelance & kontributor daerah — the operational backbone of a
  // national TV station: stringers, freelance VJs, and regional contributors
  // who cover live events and daerah news without being on the payroll.
  // Deterministic (index-derived, no Math.random) so every visitor sees the
  // same pool and the Readiness Rate on the dashboard is reproducible.
  const locations = ["Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Bogor", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan", "Makassar", "Denpasar", "Palembang"];
  const allSkills = ["Video Journalist (VJ)", "Live Reporting", "ENG Camera", "Video Editing", "Audio Engineering", "Motion Graphic", "Studio Lighting", "MCR Operations", "Scriptwriting", "Investigative Reporting", "Drone Operator", "Rundown Management"];
  const talentFirst = ["Adit", "Bimo", "Cahya", "Dewi", "Eka", "Farhan", "Galih", "Hesti", "Ilham", "Jihan", "Krisna", "Laras", "Mahesa", "Nadia", "Oki", "Putra", "Qori", "Rahma", "Satria", "Tirta", "Umar", "Vika", "Wahyu", "Yanti"];
  const talentLast = ["Nugraha", "Santoso", "Permana", "Rahayu", "Wibisono", "Halim", "Mahendra", "Safitri", "Kurniawan", "Utami", "Baskoro", "Anindya", "Prasetyo", "Melati", "Gunawan"];

  const mockTalent: TalentProfile[] = Array.from({ length: 120 }).map((_, i) => {
    const uniqueSkills = Array.from(new Set([
      allSkills[i % allSkills.length],
      allSkills[(i * 5 + 3) % allSkills.length],
    ]));

    // Freelance-heavy, as a broadcaster's contributor network actually is.
    const category: TalentProfile["category"] = i % 5 === 0 ? "Mitra Borongan" : "Freelance";

    // Readiness: ~62% siap ditugaskan, ~30% sedang bertugas, ~8% non-aktif.
    const bucket = i % 50;
    const status: TalentProfile["status"] = bucket < 31 ? "Available" : bucket < 46 ? "Active" : "Inactive";

    return {
      id: `T-DEMO-${(i + 1).toString().padStart(3, "0")}`,
      name: `${talentFirst[i % talentFirst.length]} ${talentLast[(i * 7) % talentLast.length]}`,
      phone: `08${(1300000000 + i * 6421).toString().slice(0, 10)}`,
      location: locations[i % locations.length],
      skills: uniqueSkills,
      category,
      capacity: 20 + ((i * 3) % 30), // jam siap tugas / minggu
      status,
      rating: Number((3.5 + ((i * 7) % 15) / 10).toFixed(1)), // 3.5 - 4.9, deterministik
      source: "Demo",
      createdAt: daysAgo(30 + ((i * 11) % 90)),
      updatedAt: daysAgo(1 + ((i * 3) % 20)),
    };
  });

  writeJson(CANDIDATES_KEY, [...candidates, ...existingCandidates]);
  writeJson(JOBREQS_KEY, [...reqs, ...existingReqs]);
  writeJson(ACTIVITY_KEY, [...activities, ...existingActivities].slice(0, 50));
  writeJson(TALENT_POOL_KEY, [...mockTalent, ...existingTalent]);
  if (supabase) {
    supabase.from('candidates').upsert(candidates.map(candidateToRow), { onConflict: 'user_id,id' }).then((r) => logSync('demo candidates upsert', r));
    supabase.from('job_reqs').upsert(reqs.map(reqToRow), { onConflict: 'user_id,id' }).then((r) => logSync('demo job_reqs upsert', r));
    supabase.from('activities').upsert(activities.map(activityToRow), { onConflict: 'user_id,id' }).then((r) => logSync('demo activities upsert', r));
  }
}

/* ─── Cloud sync ─── */

export async function syncFromSupabase(): Promise<void> {
  if (!supabase) return;
  // The candidates/job_reqs/activities tables have no tenant_id column (unlike
  // pi_employees) — RLS scopes them to the logged-in user, not to which demo
  // company is currently selected. Syncing while a non-base tenant (Zus
  // Textile) is active would write the base tenant's cloud rows into Zus's
  // suffixed local keys, contaminating one tenant's view with the other's
  // data. Zus is a local-only demo sandbox by design (see getTenantKey), so
  // only sync cloud data while the base/default tenant is active.
  const compId = getActiveCompanyId();
  if (compId !== "11111111-1111-4111-8111-111111111111" && compId !== "valora_tv") return;
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
    if (local.length) await supabase.from('candidates').upsert(local.map(candidateToRow), { onConflict: 'user_id,id' });
  }

  // Job reqs
  if (reqsRes.data?.length) {
    writeJson(JOBREQS_KEY, reqsRes.data.map(rowToReq));
  } else {
    const local = getJobReqs();
    if (local.length) await supabase.from('job_reqs').upsert(local.map(reqToRow), { onConflict: 'user_id,id' });
  }

  // Activities
  if (activitiesRes.data?.length) {
    writeJson(ACTIVITY_KEY, activitiesRes.data.map(rowToActivity));
  } else {
    const local = getActivities();
    if (local.length) await supabase.from('activities').upsert(local.map(activityToRow), { onConflict: 'user_id,id' });
  }
}
