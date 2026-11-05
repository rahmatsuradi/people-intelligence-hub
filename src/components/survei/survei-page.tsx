/* Kerangka halaman survei PUBLIK (tanpa AppShell, tanpa login) yang dipakai kedua bentuk link:
   /survei/<token> (lama) dan /survei/<nama-form>/<token> (nama link yang terbaca). */

import { BrandMark } from "@/components/brand-logo";
import { INSTANCE } from "@/lib/instance";
import { SurveyForm } from "./survey-form";

export async function SurveiPage({ token, invite }: { token: string; invite?: string }) {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandMark size={40} />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">{INSTANCE.brandName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Survei karyawan</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <SurveyForm token={token} invite={invite} />
      </div>
    </main>
  );
}
