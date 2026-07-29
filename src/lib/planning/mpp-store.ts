const STORE_PREFIX = "hi_mpp_budget_";

// Target/approved headcount per departemen adalah keputusan perencanaan manusia,
// bukan sesuatu yang bisa dihitung dari data karyawan — disimpan per tenant.
export function getHeadcountBudget(tenantId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(STORE_PREFIX + tenantId);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function setHeadcountBudget(tenantId: string, department: string, value: number): void {
  if (typeof window === "undefined") return;
  const all = getHeadcountBudget(tenantId);
  all[department] = value;
  localStorage.setItem(STORE_PREFIX + tenantId, JSON.stringify(all));
}
