import React from "react";
import { AppShell } from "@/components/app-shell";

export default function PlaceholderPage({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <AppShell activeNavId={id} title={title}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-blue-100 p-4 dark:bg-blue-900/30">
          <svg className="h-12 w-12 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="max-w-md text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Modul ini sedang dalam tahap pengembangan (WIP).</p>
        </div>
      </div>
    </AppShell>
  );
}
