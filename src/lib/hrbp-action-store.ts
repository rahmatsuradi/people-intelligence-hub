/* ═══════════════════════════════════════════════════════════════════════════
   HRBP recommendation actions — per-tenant record of which "one-click
   execution" recommendations (deploy interns, schedule a health talk,
   explore an AI vendor) an HR user has actually acted on in the Simulator
   Beban Siaran tab. There is no downstream system to actually dispatch these
   (no newsroom scheduling API, no vendor CRM) — recording the decision here
   is the honest scope for a demo/portfolio app: a real, persisted user
   action, not a button that silently does nothing.
═══════════════════════════════════════════════════════════════════════════ */

export type HrbpActionKey = "deploy_magang" | "jadwalkan_health_talk" | "eksplorasi_ai_vendor";

export interface HrbpActionRecord {
  key: HrbpActionKey;
  executedAt: string;
  contextHours: number; // posisi slider breakingNewsHours saat aksi diambil
}

const PREFIX = "hi_hrbp_action_";

function storageKey(tenantId: string, key: HrbpActionKey): string {
  return `${PREFIX}${tenantId}_${key}`;
}

export function getHrbpAction(tenantId: string, key: HrbpActionKey): HrbpActionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(tenantId, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function recordHrbpAction(tenantId: string, key: HrbpActionKey, contextHours: number): HrbpActionRecord {
  const record: HrbpActionRecord = { key, executedAt: new Date().toISOString(), contextHours };
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(tenantId, key), JSON.stringify(record));
  }
  return record;
}

export function clearHrbpAction(tenantId: string, key: HrbpActionKey): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(storageKey(tenantId, key));
  }
}
