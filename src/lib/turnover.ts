/* ═══════════════════════════════════════════════════════════════════════════
   Turnover Rate — pure computation over employee lifecycle fields.

   Not a store: there's nothing to persist here. join_date/employment_status/
   exit_date/exit_type/exit_reason live directly on the employee record
   (seeded in pay-data.ts's generateValorisTv754Employees for now — see the
   comment there). This mirrors the payroll engine's house style: pure
   functions, input -> output, no side effects (see CLAUDE.md section 3).

   These lifecycle fields exist only in the local demo arrays for now, NOT
   in the real pi_employees Supabase schema — adding them there is a
   separate decision (would need an additive migration in
   supabase/pay-module-schema.sql), out of scope for this dashboard widget.
═══════════════════════════════════════════════════════════════════════════ */

export type EmploymentStatus = "active" | "resigned" | "terminated";
export type ExitType = "voluntary" | "involuntary";

export interface EmployeeLifecycle {
  join_date?: string; // yyyy-mm-dd
  employment_status?: EmploymentStatus;
  exit_date?: string | null; // yyyy-mm-dd
  exit_type?: ExitType | null;
  exit_reason?: string | null;
}

export interface TurnoverMetrics {
  /** false = tidak ada employee dengan data lifecycle (mis. tenant lain yang belum diseed) */
  available: boolean;
  periodLabel: string;
  headcountStart: number;
  totalExits: number;
  voluntaryExits: number;
  involuntaryExits: number;
  turnoverRatePct: number;
  voluntaryRatePct: number;
  involuntaryRatePct: number;
}

const EMPTY_METRICS: Omit<TurnoverMetrics, "available" | "periodLabel"> = {
  headcountStart: 0,
  totalExits: 0,
  voluntaryExits: 0,
  involuntaryExits: 0,
  turnoverRatePct: 0,
  voluntaryRatePct: 0,
  involuntaryRatePct: 0,
};

/** Turnover rate = jumlah keluar (periode) / headcount awal periode * 100.
 *  Formula standar SHRM: exits / average headcount. Kita pakai headcount di
 *  awal periode sebagai proxy average headcount karena tidak ada snapshot
 *  bulanan tersimpan. */
export function computeTurnoverMetrics(
  employees: EmployeeLifecycle[],
  periodStart: string,
  periodEnd: string,
  periodLabel: string,
): TurnoverMetrics {
  const withLifecycle = employees.filter((e) => e.employment_status);
  if (withLifecycle.length === 0) {
    return { available: false, periodLabel, ...EMPTY_METRICS };
  }

  const exits = withLifecycle.filter((e) => e.exit_date && e.exit_date >= periodStart && e.exit_date <= periodEnd);
  const voluntaryExits = exits.filter((e) => e.exit_type === "voluntary").length;
  const involuntaryExits = exits.filter((e) => e.exit_type === "involuntary").length;
  const totalExits = exits.length;

  const headcountStart = withLifecycle.filter(
    (e) => (e.join_date ?? "") <= periodStart && (!e.exit_date || e.exit_date >= periodStart),
  ).length;
  const denom = headcountStart || withLifecycle.length;

  const pct = (n: number) => (denom > 0 ? Math.round((n / denom) * 1000) / 10 : 0);

  return {
    available: true,
    periodLabel,
    headcountStart,
    totalExits,
    voluntaryExits,
    involuntaryExits,
    turnoverRatePct: pct(totalExits),
    voluntaryRatePct: pct(voluntaryExits),
    involuntaryRatePct: pct(involuntaryExits),
  };
}

/** Turnover tahun berjalan (1 Jan tahun ini s/d hari ini). */
export function computeYtdTurnover(employees: EmployeeLifecycle[]): TurnoverMetrics {
  const now = new Date();
  const year = now.getFullYear();
  const periodStart = `${year}-01-01`;
  const periodEnd = now.toISOString().slice(0, 10);
  return computeTurnoverMetrics(employees, periodStart, periodEnd, `YTD ${year}`);
}
