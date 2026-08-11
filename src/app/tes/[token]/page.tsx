/* ═══════════════════════════════════════════════════════════════════════════
   Halaman tes PUBLIK. Tanpa AppShell, tanpa auth — peserta tidak punya akun.
   Server component ini hanya merender kerangka; seluruh data soal diambil
   client-side dari /api/assessment/session (service-role di sisi server).

   noindex: tautan tes tidak boleh terindeks mesin pencari.
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { TestRunner } from "./test-runner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Asesmen Kandidat",
  description: "Halaman pengerjaan asesmen.",
  robots: { index: false, follow: false },
};

export default async function TesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <span className="text-sm font-bold tracking-tight">PI</span>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">Asesmen Kandidat</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Mohon dikerjakan sendiri, tanpa bantuan orang lain</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <TestRunner token={token} />
      </div>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-400 dark:text-slate-500 sm:px-6">
        Data yang Anda isi diproses untuk keperluan seleksi dan dilindungi sesuai UU PDP No. 27/2022.
      </footer>
    </main>
  );
}
