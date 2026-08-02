/* ═══════════════════════════════════════════════════════════════════════════
   Employee Engagement Store — per-tenant eNPS survey rounds + qualitative
   feedback log. There is no in-app survey distribution mechanism, so eNPS
   rounds are HR-entered aggregate results (e.g. tallied from a paper/Google
   Form survey) rather than collected live from employees inside this app.
═══════════════════════════════════════════════════════════════════════════ */

export interface EnpsRound {
  id: string;
  period: string; // yyyy-mm
  respondentCount: number;
  promoters: number; // skor 9-10
  passives: number; // skor 7-8
  detractors: number; // skor 0-6
  keyThemes: string;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCategory = "budaya" | "beban-kerja" | "kompensasi" | "manajemen" | "pengembangan-karir" | "lainnya";
export type FeedbackSentiment = "positif" | "netral" | "negatif";

export interface FeedbackEntry {
  id: string;
  date: string; // yyyy-mm-dd
  department: string;
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  note: string;
  anonymous: boolean;
  createdAt: string;
}

const ENPS_PREFIX = "hi_engagement_enps_";
const FEEDBACK_PREFIX = "hi_engagement_feedback_";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** eNPS = %promoter - %detractor, standar Net Promoter Score (Reichheld, 2003)
 *  diadaptasi untuk employee engagement. Rentang -100 s/d 100. */
export function computeEnps(round: Pick<EnpsRound, "respondentCount" | "promoters" | "detractors">): number {
  if (round.respondentCount <= 0) return 0;
  const pctPromoter = (round.promoters / round.respondentCount) * 100;
  const pctDetractor = (round.detractors / round.respondentCount) * 100;
  return Math.round(pctPromoter - pctDetractor);
}

export function getEnpsRounds(tenantId: string): EnpsRound[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(ENPS_PREFIX + tenantId);
    const rounds: EnpsRound[] = data ? JSON.parse(data) : [];
    return rounds.sort((a, b) => a.period.localeCompare(b.period));
  } catch {
    return [];
  }
}

function saveEnpsRounds(tenantId: string, rounds: EnpsRound[]): void {
  localStorage.setItem(ENPS_PREFIX + tenantId, JSON.stringify(rounds));
}

export function upsertEnpsRound(tenantId: string, input: Omit<EnpsRound, "id" | "createdAt" | "updatedAt"> & { id?: string }): EnpsRound {
  const all = getEnpsRounds(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const updated: EnpsRound = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveEnpsRounds(tenantId, all);
      return updated;
    }
  }
  const created: EnpsRound = { ...input, id: genId("enps"), createdAt: now, updatedAt: now };
  all.push(created);
  saveEnpsRounds(tenantId, all);
  return created;
}

export function deleteEnpsRound(tenantId: string, id: string): void {
  saveEnpsRounds(tenantId, getEnpsRounds(tenantId).filter((r) => r.id !== id));
}

export function getFeedbackEntries(tenantId: string): FeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(FEEDBACK_PREFIX + tenantId);
    const entries: FeedbackEntry[] = data ? JSON.parse(data) : [];
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

function saveFeedbackEntries(tenantId: string, entries: FeedbackEntry[]): void {
  localStorage.setItem(FEEDBACK_PREFIX + tenantId, JSON.stringify(entries));
}

export function addFeedbackEntry(tenantId: string, input: Omit<FeedbackEntry, "id" | "createdAt">): FeedbackEntry {
  const all = getFeedbackEntries(tenantId);
  const created: FeedbackEntry = { ...input, id: genId("fb"), createdAt: new Date().toISOString() };
  all.unshift(created);
  saveFeedbackEntries(tenantId, all);
  return created;
}

export function deleteFeedbackEntry(tenantId: string, id: string): void {
  saveFeedbackEntries(tenantId, getFeedbackEntries(tenantId).filter((e) => e.id !== id));
}
