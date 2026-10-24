/* ═══════════════════════════════════════════════════════════════════════════
   Recruitment SLA Store — per-tenant Time-to-Fill target, in days.

   There is no single authoritative "time to fill" benchmark to hardcode —
   it varies by industry, role seniority, and hiring maturity. HR sets their
   own target here (same pattern as job grades / division training budgets);
   the default is just a starting point, not a claimed industry standard.
═══════════════════════════════════════════════════════════════════════════ */

const STORE_PREFIX = "hi_recruitment_sla_";
const DEFAULT_TARGET_DAYS = 45;

export function getSlaTargetDays(tenantId: string): number {
  if (typeof window === "undefined") return DEFAULT_TARGET_DAYS;
  try {
    const data = localStorage.getItem(STORE_PREFIX + tenantId);
    const n = data ? Number(JSON.parse(data)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TARGET_DAYS;
  } catch {
    return DEFAULT_TARGET_DAYS;
  }
}

export function setSlaTargetDays(tenantId: string, days: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_PREFIX + tenantId, JSON.stringify(Math.max(1, Math.round(days))));
}
