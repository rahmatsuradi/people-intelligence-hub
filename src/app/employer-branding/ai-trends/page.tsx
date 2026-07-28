"use client";

import React, { useState } from "react";
import { AppShell, Card, Button, SvgPath } from "@/components/app-shell";

export default function AITrendsPage() {
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);

  const handleGenerate = () => {
    if (!topic) return;
    setGenerating(true);
    setTimeout(() => {
      setIdeas([
        {
          platform: "TikTok",
          type: "A Day in The Life (Vlog)",
          title: `Keseharian Tim ${topic} - Behind The Scenes`,
          hook: `"Kalian pikir kerja di ${topic} itu gampang? Sini aku kasih liat..."`,
          description: `Video POV singkat 15-30 detik menunjukkan suasana kerja tim ${topic}, mulai dari stand-up meeting pagi, ngopi bareng, sampai momen fokus kerja. Cocok untuk Gen-Z yang mencari culture kerja asik.`,
          metrics: "Est. 50k+ Views | High Engagement",
        },
        {
          platform: "Instagram Reels",
          type: "Mini Interview / Q&A",
          title: `3 Alasan Kenapa Kamu Harus Join Tim ${topic}`,
          hook: `"Mitos atau fakta: Tim ${topic} sering lembur? Tonton sampai habis!"`,
          description: `Wawancara santai (rapid fire) dengan 2-3 anggota tim tentang benefit dan tantangan kerja. Membangun kredibilitas dan transparansi employer brand.`,
          metrics: "Est. 20k+ Views | High Share",
        },
        {
          platform: "LinkedIn",
          type: "Thought Leadership",
          title: `Bagaimana Tim ${topic} Berinovasi di Kuartal Ini`,
          hook: `"Membangun produk hebat butuh tim yang solid. Inilah cara kami..."`,
          description: `Postingan profesional berisi foto tim dengan caption panjang menceritakan studi kasus keberhasilan proyek terbaru. Sangat cocok menarik kandidat senior/profesional.`,
          metrics: "Est. 10k+ Impressions | High Conversion",
        },
      ]);
      setGenerating(false);
    }, 1500);
  };

  return (
    <AppShell activeNavId="ai-trends" title="AI Trend & Ideas">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Employer Branding AI</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Generate ide konten sosial media berdasarkan tren terkini di Indonesia.
            </p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="topic" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Topik Pekerjaan / Divisi (contoh: Tim Kreatif, Engineer, HR)
              </label>
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masukkan divisi atau topik campaign..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>
            <Button variant="primary" size="lg" onClick={handleGenerate} disabled={generating || !topic}>
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  Generate Content
                </>
              )}
            </Button>
          </div>
        </Card>

        {ideas.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {ideas.map((idea, i) => (
              <Card key={i} className="flex flex-col h-full border-slate-200 shadow-sm hover:shadow-md transition-shadow dark:border-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    {idea.platform}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{idea.type}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{idea.title}</h3>
                <blockquote className="mb-4 border-l-4 border-indigo-500 pl-3 italic text-sm text-slate-600 dark:text-slate-400">
                  {idea.hook}
                </blockquote>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-1">
                  {idea.description}
                </p>
                <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    {idea.metrics}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
