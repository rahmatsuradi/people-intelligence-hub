/* ═══════════════════════════════════════════════════════════════════════════
   Executive Insight cache — per-tenant. Avoids calling the AI on every
   dashboard visit: we cache the last generated summary alongside a snapshot
   of the metrics it was built from, and only regenerate when the underlying
   numbers actually change (or the user hits refresh).
═══════════════════════════════════════════════════════════════════════════ */

export interface CachedInsight {
  summary: string;
  source: "ai" | "fallback";
  metricsSnapshot: string; // JSON.stringify of the metrics used to generate this
  generatedAt: string;
}

const STORE_PREFIX = "hi_executive_insight_";

export function getCachedInsight(tenantId: string): CachedInsight | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORE_PREFIX + tenantId);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setCachedInsight(tenantId: string, insight: Omit<CachedInsight, "generatedAt">): CachedInsight {
  const record: CachedInsight = { ...insight, generatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORE_PREFIX + tenantId, JSON.stringify(record));
  }
  return record;
}
