"use client";

/* Mode Presentasi Pulse Check — halaman tambahan; tidak mengubah /pulse. Memuat data yang sama dengan dashboard. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, Card } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { PresentDeck, type DeckData } from "@/components/pulse/present-deck";
import { useRole } from "@/lib/roles";
import { loadActions, loadCampaigns, loadResponses, loadSegments, loadSpgCountBySpv, loadSummary, loadSurveys, loadThemes } from "@/lib/rr/pulse";

export default function PresentasiPage() {
  const { role, loading: roleLoading } = useRole();
  const isHr = role === "hr";
  const [data, setData] = useState<DeckData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    let alive = true;
    (async () => {
      try {
        const surveys = await loadSurveys();
        const s = surveys.find((x) => x.config.kind === "spv_report");
        const k = surveys.find((x) => x.config.kind === "360");
        const [spg, responses, spgResponses] = await Promise.all([
          s ? Promise.all([
            loadSummary(s.id), s.segments.includes("spv") ? loadSegments(s.id, "spv") : Promise.resolve([]),
            s.config.themes?.length ? loadThemes(s.id) : Promise.resolve([]), loadActions(s.id), loadSpgCountBySpv(), loadCampaigns(s.id),
          ]) : Promise.resolve(null),
          isHr && k ? loadResponses(k.id) : Promise.resolve([]),
          // Jawaban mentah SPG hanya untuk HR: dipakai analisis kaitan (kunjungan, corong kendala, tema per SPV).
          isHr && s ? loadResponses(s.id) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setData({
          spg: s && spg ? { survey: s, summary: spg[0], segments: spg[1], themes: spg[2], actions: spg[3], roster: spg[4], campaigns: spg[5], responses: spgResponses } : null,
          koor: k ? { survey: k, responses } : null,
          isHr,
        });
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        toast(`Gagal memuat: ${(e as Error).message}`, "error");
      }
    })();
    return () => { alive = false; };
  }, [roleLoading, isHr]);

  return (
    <AppShell activeNavId="pulse" title="Mode Presentasi" subtitle="Pulse Check: SPG → SPV dan SPV → Koordinator SPV, satu langkah per layar">
      <div className="flex items-center justify-between">
        <Link href="/pulse" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Kembali ke dashboard Pulse</Link>
      </div>
      {error && <Card><p className="text-sm text-red-600">Gagal memuat data: {error}</p></Card>}
      {!data && !error && <Card><p className="text-sm text-slate-500">Memuat data presentasi…</p></Card>}
      {data && !data.spg && !data.koor && <Card><p className="text-sm text-slate-500">Belum ada survei SPG → SPV maupun 360 SPV yang tersimpan.</p></Card>}
      {data && (data.spg || data.koor) && <PresentDeck data={data} />}
    </AppShell>
  );
}
