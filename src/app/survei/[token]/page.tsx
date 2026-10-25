/* ═══════════════════════════════════════════════════════════════════════════
   Formulir survei PUBLIK (pengganti Google Form). Tanpa AppShell, tanpa login —
   karyawan membuka link dari WhatsApp di HP. Data diambil & dikirim lewat /api/survei.
   noindex: link survei tidak boleh terindeks mesin pencari.
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { RicaRicoMark } from "@/components/rica-rico-logo";
import { SurveyForm } from "./survey-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Survei Karyawan — Rica Rico Bakery",
  description: "Formulir survei karyawan Rica Rico Bakery.",
  robots: { index: false, follow: false },
};

export default async function SurveiPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <RicaRicoMark size={40} />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">Rica Rico Bakery</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Survei karyawan</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <SurveyForm token={token} />
      </div>
    </main>
  );
}
