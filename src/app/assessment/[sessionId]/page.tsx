"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Laporan hasil asesmen — halaman untuk HR.

   Laporan dibaca dari SNAPSHOT yang tersimpan di kolom `report`, bukan dihitung
   ulang. Bank item, norma, dan profil jabatan bisa berubah; laporan yang sudah
   diterbitkan tidak boleh berubah sendiri di kemudian hari.

   Tampilannya sendiri ada di <AssessmentReportView>, dipakai bersama halaman
   demo supaya yang dilihat di demo persis sama dengan yang keluar untuk
   kandidat sungguhan.
═══════════════════════════════════════════════════════════════════════════ */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card } from "@/components/app-shell";
import { AssessmentReportView } from "@/components/assessment-report-view";
import { supabase } from "@/lib/supabase";
import { SESSION_STATUS_LABELS, type PiAssessmentSessionRow } from "@/lib/assessment/assessment-data";
import type { AssessmentReport } from "@/lib/assessment/types";

export default function AssessmentReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [row, setRow] = useState<PiAssessmentSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setError("Supabase belum dikonfigurasi.");
        setLoading(false);
        return;
      }
      const { data, error: err } = await supabase
        .from("pi_assessment_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle<PiAssessmentSessionRow>();
      if (err) setError(`Gagal memuat laporan: ${err.message}`);
      else if (!data) setError("Sesi asesmen tidak ditemukan.");
      else setRow(data);
      setLoading(false);
    })();
  }, [sessionId]);

  const print = useCallback(() => window.print(), []);
  const report: AssessmentReport | null = row?.report ?? null;

  return (
    <AppShell
      activeNavId="assessment"
      title="Laporan Asesmen"
      subtitle={row ? `${row.candidate_name} — ${row.position || "tanpa posisi"}` : sessionId}
      headerActions={
        <>
          <Link href="/assessment"><Button variant="secondary">Kembali</Button></Link>
          {report && <Button variant="primary" onClick={print}>Cetak / PDF</Button>}
        </>
      }
    >
      {loading && <Card><p className="text-sm text-slate-500">Memuat…</p></Card>}

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {row && !report && (
        <Card>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Sesi ini berstatus <span className="font-medium">{SESSION_STATUS_LABELS[row.status]}</span> — laporan baru
            tersedia setelah kandidat menyelesaikan seluruh bagian tes.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {Object.keys(row.responses ?? {}).length} jawaban tersimpan · {(row.timings ?? []).length} bagian terkirim.
          </p>
        </Card>
      )}

      {report && <AssessmentReportView report={report} />}
    </AppShell>
  );
}
