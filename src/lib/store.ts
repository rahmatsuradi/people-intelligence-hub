/* ═══════════════════════════════════════════════════════════════════════════
   Hire Intelligence — Persistent Data Store
   localStorage is the local cache; Supabase is the persistent cloud backend.
   On app mount, data is fetched from Supabase and written to localStorage.
   Every write goes to localStorage first (synchronous), then fires an async
   upsert/delete to Supabase in the background (fire-and-forget).
═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase';
import type { CompetencyCluster, AiCompetencyScore, AiRiskFlag, AiInterviewQuestion } from './cv-analyzer-ai';

export type PipelineStage = "applied" | "screened" | "interviewed" | "offered" | "hired" | "rejected";
export type ReqStatus = "draft" | "active" | "paused" | "closed";

export const PIPELINE_STAGES: PipelineStage[] = ["applied", "screened", "interviewed", "offered", "hired"];
export const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: "Applied",
  screened: "Screened",
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
  /** Optional: absent on snapshots saved before this field existed. */
  cluster?: CompetencyCluster;
  competencies?: AiCompetencyScore[];
  risks?: AiRiskFlag[];
  questions?: AiInterviewQuestion[];
}

export interface InterviewResultSnapshot {
  kitId: string;
  avgRating: number;
  recommendation: string;
  durationSec: number;
  completedAt: string;
  questionCount: number;
  ratedCount: number;
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
  type: "hire" | "interview" | "analysis" | "offer" | "move" | "create";
}

const CANDIDATES_KEY = "hi_candidates";
const JOBREQS_KEY = "hi_jobreqs";
const ACTIVITY_KEY = "hi_activity";

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

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
    applied: 0, screened: 0, interviewed: 0, offered: 0, hired: 0, rejected: 0,
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

export function hasDemoData(): boolean {
  return getCandidates().some((c) => c.source === "Demo");
}

export function clearDemoData(): void {
  writeJson(CANDIDATES_KEY, getCandidates().filter((c) => c.source !== "Demo"));
  writeJson(JOBREQS_KEY, getJobReqs().filter((r) => !r.hiringManager.startsWith("Demo:")));
  if (supabase) {
    supabase.from('candidates').delete().eq('source', 'Demo').then(() => {});
    supabase.from('job_reqs').delete().like('hiring_manager', 'Demo:%').then(() => {});
  }
}

export function loadDemoData(): void {
  const base = new Date("2026-05-15T08:00:00.000Z");
  const daysAgo = (d: number) => new Date(base.getTime() - d * 86400000).toISOString();

  const reqs: JobRequisition[] = [
    {
      id: "REQ-DEMO-ENG01", title: "Senior Software Engineer", department: "Engineering",
      level: "Senior", status: "active", description: "Backend-focused engineer for payments platform.",
      requirements: "5+ yrs Go/Java, distributed systems, PostgreSQL.", salaryMin: 25000000,
      salaryMax: 40000000, currency: "IDR", location: "Jakarta / Remote", targetDate: "2026-07-01",
      headcount: 2, hiringManager: "Demo:Andi Prasetyo", createdAt: daysAgo(45), updatedAt: daysAgo(10),
    },
    {
      id: "REQ-DEMO-PRD01", title: "Product Manager", department: "Product",
      level: "Mid-Level", status: "active", description: "PM for growth & monetization squad.",
      requirements: "3+ yrs PM, data-driven, B2C product experience.", salaryMin: 20000000,
      salaryMax: 32000000, currency: "IDR", location: "Jakarta", targetDate: "2026-06-15",
      headcount: 1, hiringManager: "Demo:Santi Lestari", createdAt: daysAgo(30), updatedAt: daysAgo(5),
    },
    {
      id: "REQ-DEMO-DES01", title: "UX Designer", department: "Design",
      level: "Mid-Level", status: "active", description: "End-to-end product designer for mobile apps.",
      requirements: "3+ yrs UX, Figma, usability research.", salaryMin: 15000000,
      salaryMax: 25000000, currency: "IDR", location: "Jakarta / Remote", targetDate: "2026-07-15",
      headcount: 1, hiringManager: "Demo:Rina Susanti", createdAt: daysAgo(20), updatedAt: daysAgo(3),
    },
    {
      id: "REQ-DEMO-DAT01", title: "Data Analyst", department: "Data",
      level: "Junior", status: "active", description: "Analyst to support business intelligence team.",
      requirements: "SQL, Python (pandas), Tableau or Looker.", salaryMin: 10000000,
      salaryMax: 18000000, currency: "IDR", location: "Jakarta", targetDate: "2026-06-30",
      headcount: 1, hiringManager: "Demo:Budi Hartono", createdAt: daysAgo(15), updatedAt: daysAgo(2),
    },
  ];

  const candidates: CandidateRecord[] = [
    {
      id: "C-DEMO-001", name: "Rina Wijaya", email: "rina.wijaya@email.com", phone: "081234567890",
      stage: "hired", jobReqId: "REQ-DEMO-ENG01", department: "Engineering",
      position: "Senior Software Engineer", source: "Demo", notes: "Excellent cultural fit.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051501", overallScore: 91, matchScore: 88, confidence: 94,
        recommendation: "Strong Hire", summary: "7 years Go & distributed systems. Led migration of monolith to microservices serving 8M users.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(30),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-001", avgRating: 4.4, recommendation: "Strong Hire",
        durationSec: 3240, completedAt: daysAgo(22), questionCount: 8, ratedCount: 8,
      }],
      createdAt: daysAgo(35), updatedAt: daysAgo(5),
    },
    {
      id: "C-DEMO-002", name: "Budi Santoso", email: "budi.santoso@email.com", phone: "082345678901",
      stage: "offered", jobReqId: "REQ-DEMO-PRD01", department: "Product",
      position: "Product Manager", source: "Demo", notes: "Strong strategic thinking.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051502", overallScore: 85, matchScore: 82, confidence: 89,
        recommendation: "Hire", summary: "4 years PM at fintech. Launched 3 products with >100K MAU each. Data-driven decision maker.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(25),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-002", avgRating: 4.1, recommendation: "Hire",
        durationSec: 2880, completedAt: daysAgo(18), questionCount: 7, ratedCount: 7,
      }],
      createdAt: daysAgo(28), updatedAt: daysAgo(3),
    },
    {
      id: "C-DEMO-003", name: "Sari Dewi", email: "sari.dewi@email.com", phone: "083456789012",
      stage: "interviewed", jobReqId: "REQ-DEMO-DES01", department: "Design",
      position: "UX Designer", source: "Demo", notes: "Portfolio very strong on mobile.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051503", overallScore: 79, matchScore: 76, confidence: 85,
        recommendation: "Hire", summary: "3 years UX at e-commerce. Research-led design process. Figma expert.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(15),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-003", avgRating: 3.6, recommendation: "Hire",
        durationSec: 2400, completedAt: daysAgo(8), questionCount: 6, ratedCount: 6,
      }],
      createdAt: daysAgo(18), updatedAt: daysAgo(2),
    },
    {
      id: "C-DEMO-004", name: "Ahmad Fauzi", email: "ahmad.fauzi@email.com", phone: "084567890123",
      stage: "interviewed", jobReqId: "REQ-DEMO-DAT01", department: "Data",
      position: "Data Analyst", source: "Demo", notes: "Good SQL, Python needs depth.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051504", overallScore: 72, matchScore: 69, confidence: 78,
        recommendation: "Review", summary: "2 years data work. SQL proficient, basic Python. Tableau certified.",
        frameworkLabel: "CGMA / CIMA", analyzedAt: daysAgo(10),
      },
      interviewResults: [{
        kitId: "KIT-DEMO-004", avgRating: 3.2, recommendation: "Review",
        durationSec: 2100, completedAt: daysAgo(5), questionCount: 6, ratedCount: 5,
      }],
      createdAt: daysAgo(14), updatedAt: daysAgo(1),
    },
    {
      id: "C-DEMO-005", name: "Lina Pratama", email: "lina.pratama@email.com", phone: "085678901234",
      stage: "screened", jobReqId: "REQ-DEMO-ENG01", department: "Engineering",
      position: "Senior Software Engineer", source: "Demo", notes: "Strong Java background.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051505", overallScore: 83, matchScore: 80, confidence: 87,
        recommendation: "Hire", summary: "6 years Java/Spring. Built high-throughput payment processing system.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(8),
      },
      interviewResults: [], createdAt: daysAgo(12), updatedAt: daysAgo(1),
    },
    {
      id: "C-DEMO-006", name: "Reza Kusuma", email: "reza.kusuma@email.com", phone: "086789012345",
      stage: "screened", jobReqId: "REQ-DEMO-PRD01", department: "Product",
      position: "Product Manager", source: "Demo", notes: "B2B background, needs B2C assessment.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051506", overallScore: 68, matchScore: 65, confidence: 72,
        recommendation: "Review", summary: "3 years PM in B2B SaaS. Limited consumer product experience.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(6),
      },
      interviewResults: [], createdAt: daysAgo(9), updatedAt: daysAgo(1),
    },
    {
      id: "C-DEMO-007", name: "Dian Purnama", email: "dian.purnama@email.com", phone: "087890123456",
      stage: "applied", jobReqId: "REQ-DEMO-DAT01", department: "Data",
      position: "Data Analyst", source: "Demo", notes: "",
      cvAnalysis: null, interviewResults: [], createdAt: daysAgo(5), updatedAt: daysAgo(5),
    },
    {
      id: "C-DEMO-008", name: "Eko Susanto", email: "eko.susanto@email.com", phone: "088901234567",
      stage: "applied", jobReqId: "REQ-DEMO-ENG01", department: "Engineering",
      position: "Senior Software Engineer", source: "Demo", notes: "",
      cvAnalysis: null, interviewResults: [], createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
    {
      id: "C-DEMO-009", name: "Maya Indah", email: "maya.indah@email.com", phone: "089012345678",
      stage: "rejected", jobReqId: "REQ-DEMO-ENG01", department: "Engineering",
      position: "Senior Software Engineer", source: "Demo", notes: "Below technical bar.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051509", overallScore: 48, matchScore: 44, confidence: 65,
        recommendation: "Reject", summary: "2 years experience, mostly frontend. Does not meet senior backend requirements.",
        frameworkLabel: "SFIA v8", analyzedAt: daysAgo(20),
      },
      interviewResults: [], createdAt: daysAgo(25), updatedAt: daysAgo(18),
    },
    {
      id: "C-DEMO-010", name: "Kevin Tandarto", email: "kevin.tandarto@email.com", phone: "081123456789",
      stage: "screened", jobReqId: "REQ-DEMO-PRD01", department: "Product",
      position: "Product Manager", source: "Demo", notes: "Strong analytics, good culture add.",
      cvAnalysis: {
        reportId: "RPT-DEMO-2026051510", overallScore: 77, matchScore: 74, confidence: 82,
        recommendation: "Hire", summary: "3 years PM at edtech startup. Strong analytics muscle. Led 2 product launches.",
        frameworkLabel: "Lominger / Korn Ferry", analyzedAt: daysAgo(4),
      },
      interviewResults: [], createdAt: daysAgo(7), updatedAt: daysAgo(1),
    },
  ];

  const activities: import("./store").ActivityEntry[] = [
    { id: "A-DEMO-01", action: "Hired:", target: "Rina Wijaya — Senior Software Engineer", user: "You", time: daysAgo(5), type: "hire" },
    { id: "A-DEMO-02", action: "Offer extended to:", target: "Budi Santoso — Product Manager", user: "You", time: daysAgo(3), type: "offer" },
    { id: "A-DEMO-03", action: "Interview completed:", target: "Sari Dewi — Hire (3.6/5)", user: "You", time: daysAgo(8), type: "interview" },
    { id: "A-DEMO-04", action: "CV analyzed:", target: "Kevin Tandarto — Hire (77 pts)", user: "You", time: daysAgo(4), type: "analysis" },
    { id: "A-DEMO-05", action: "Added new candidate:", target: "Dian Purnama — Data Analyst", user: "You", time: daysAgo(5), type: "create" },
    { id: "A-DEMO-06", action: "Moved from Applied to Screened:", target: "Lina Pratama", user: "You", time: daysAgo(11), type: "move" },
  ];

  const existingCandidates = getCandidates().filter((c) => c.source !== "Demo");
  const existingReqs = getJobReqs().filter((r) => !r.hiringManager.startsWith("Demo:"));
  const existingActivities = getActivities().filter((a) => !a.id.startsWith("A-DEMO"));

  writeJson(CANDIDATES_KEY, [...candidates, ...existingCandidates]);
  writeJson(JOBREQS_KEY, [...reqs, ...existingReqs]);
  writeJson(ACTIVITY_KEY, [...activities, ...existingActivities].slice(0, 50));
  if (supabase) {
    supabase.from('candidates').upsert(candidates.map(candidateToRow)).then(() => {});
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
