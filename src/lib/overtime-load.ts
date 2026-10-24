/* ═══════════════════════════════════════════════════════════════════════════
   Overtime load — aggregate quarterly overtime cost for the dashboard.

   The Rupiah figure is NOT a hardcoded demo number: overtime hours are
   seeded per employee (pay-data.ts, weighted by division — field/studio
   crews carry far more than corporate functions), and the cost is computed
   by computeOvertime() from src/lib/payroll/overtime.ts — the same
   unit-tested engine the Payroll module uses, applying the PP 35/2021
   Pasal 31-32 multiplier table and the 1/173 hourly divisor.

   The quarterly budget target is HR-entered per tenant (same pattern as
   the recruitment SLA target and division training budgets) — there is no
   authoritative external benchmark for what a broadcaster "should" spend
   on overtime, so it must not be presented as a fixed standard.
═══════════════════════════════════════════════════════════════════════════ */

import { computeOvertime } from "./payroll/overtime";
import type { OvertimeMultiplierTier } from "./payroll/types";

/** PP 35/2021 Pasal 31-32 — hari kerja biasa: jam ke-1 = 1.5x, seterusnya 2x.
 *  Mirrors the `overtime.weekday` block seeded in pay-module-seed.sql. */
const WEEKDAY_TIERS: OvertimeMultiplierTier[] = [
  { maxHour: 1, multiplier: 1.5 },
  { maxHour: null, multiplier: 2 },
];
const HOURLY_DIVISOR = 173; // PP 35/2021 Pasal 32

const BUDGET_PREFIX = "hi_overtime_budget_";

export interface EmployeeOvertimeInput {
  department?: string | null;
  upah_pokok?: number;
  overtime_hours_monthly?: number;
  employment_status?: string;
}

export interface OvertimeLoad {
  /** false = tidak ada data jam lembur untuk entitas ini */
  available: boolean;
  monthlyCost: number;
  quarterlyCost: number;
  totalMonthlyHours: number;
  avgHoursPerEmployee: number;
  /** Divisi dengan beban lembur tertinggi */
  topDepartment: { name: string; cost: number; hours: number } | null;
  budgetQuarterly: number;
  variancePct: number; // + = over budget
}

export function getOvertimeBudget(tenantId: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(BUDGET_PREFIX + tenantId);
    const n = raw ? Number(JSON.parse(raw)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function setOvertimeBudget(tenantId: string, amount: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_PREFIX + tenantId, JSON.stringify(Math.max(0, Math.round(amount))));
}

export function computeOvertimeLoad(employees: EmployeeOvertimeInput[], tenantId: string): OvertimeLoad {
  const active = employees.filter((e) => !e.employment_status || e.employment_status === "active");
  const withHours = active.filter((e) => (e.overtime_hours_monthly ?? 0) > 0);

  if (withHours.length === 0) {
    return {
      available: false,
      monthlyCost: 0,
      quarterlyCost: 0,
      totalMonthlyHours: 0,
      avgHoursPerEmployee: 0,
      topDepartment: null,
      budgetQuarterly: 0,
      variancePct: 0,
    };
  }

  const byDept = new Map<string, { cost: number; hours: number }>();
  let monthlyCost = 0;
  let totalMonthlyHours = 0;

  for (const e of withHours) {
    const hours = e.overtime_hours_monthly ?? 0;
    const cost = computeOvertime(e.upah_pokok ?? 0, hours, WEEKDAY_TIERS, HOURLY_DIVISOR);
    monthlyCost += cost;
    totalMonthlyHours += hours;

    const dept = e.department || "Lainnya";
    const entry = byDept.get(dept) ?? { cost: 0, hours: 0 };
    entry.cost += cost;
    entry.hours += hours;
    byDept.set(dept, entry);
  }

  const quarterlyCost = monthlyCost * 3;
  const top = Array.from(byDept.entries()).sort((a, b) => b[1].cost - a[1].cost)[0];

  // Default budget target = 87% of current quarterly actual, i.e. the demo
  // opens in a realistic "over budget" state. HR overrides this per tenant.
  const budgetQuarterly = getOvertimeBudget(tenantId, Math.round((quarterlyCost * 0.87) / 1_000_000) * 1_000_000);
  const variancePct = budgetQuarterly > 0 ? Math.round(((quarterlyCost - budgetQuarterly) / budgetQuarterly) * 1000) / 10 : 0;

  return {
    available: true,
    monthlyCost,
    quarterlyCost,
    totalMonthlyHours,
    avgHoursPerEmployee: Math.round((totalMonthlyHours / withHours.length) * 10) / 10,
    topDepartment: top ? { name: top[0], cost: top[1].cost, hours: top[1].hours } : null,
    budgetQuarterly,
    variancePct,
  };
}

export function formatRupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)} Jt`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
