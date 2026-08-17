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
import { useRouter } from "next/navigation";
import { AppShell, Button, Card } from "@/components/app-shell";
import { AssessmentReportView } from "@/components/assessment-report-view";
import { supabase } from "@/lib/supabase";
import { SESSION_STATUS_LABELS, type PiAssessmentSessionRow } from "@/lib/assessment/assessment-data";
import { toast } from "@/components/toast";
import { ASSESSMENT_HANDOFF_KEY, selectProbes, type AssessmentHandoff } from "@/lib/recruiting/interview-kit";
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

  const router = useRouter();
  const print = useCallback(() => window.print(), []);

  /* Jembatan ke wawancara. Skor asesmen adalah HIPOTESIS; tempat mengujinya
     adalah wawancara. Tanpa tombol ini, pertanyaan pendalaman yang sudah
     dihasilkan laporan berhenti di halaman ini dan tidak pernah terpakai. */
  const sendToInterview = useCallback(() => {
    if (!row?.report) return;
    const probes = selectProbes(row.report.interpretations);
    if (probes.length === 0) {
      toast("Tidak ada skala yang cukup menonjol untuk didalami — hasilnya berada di kisaran rata-rata.", "info");
      return;
    }
    const handoff: AssessmentHandoff = {
      sessionId: row.id,
      candidateName: row.candidate_name,
      position: row.position,
      normLabel: row.report.normLabel,
      probes,
    };
    sessionStorage.setItem(ASSESSMENT_HANDOFF_KEY, JSON.stringify(handoff));
    toast(`${probes.length} pertanyaan pendalaman dikirim ke Interview Workspace.`);
    router.push("/interview");
  }, [row, router]);
  const report: AssessmentReport | null = row?.report ?? null;

  return (
    <AppShell
      activeNavId="assessment"
      title="Laporan Asesmen"
      subtitle={row ? `${row.candidate_name} — ${row.position || "tanpa posisi"}` : sessionId}
      headerActions={
        <>
          <Link href="/assessment"><Button variant="secondary">Kembali</Button></Link>
          {report && <Button variant="secondary" onClick={sendToInterview}>Pakai untuk Wawancara</Button>}
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
