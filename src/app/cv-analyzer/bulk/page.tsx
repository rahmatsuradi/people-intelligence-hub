"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Bulk CV Analysis — upload many PDFs (or a whole folder), analyze them all
   with Groq, and produce a ranked shortlist. Names are extracted by the AI.
   Each analyzed CV is saved as a candidate (synced to Supabase via the store).
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell, Icon, SvgPath, Card, Button, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import {
  upsertAnalyzedCandidate, logBulkAnalysis, getJobReqs,
  type CvAnalysisSnapshot, type JobRequisition,
} from "@/lib/store";
import type { AiAnalysisResult } from "@/lib/cv-analyzer-ai";

const DEPARTMENTS = [
  "Engineering", "Product", "Data", "Design", "Sales",
  "Finance", "Security", "Operations", "HR", "Legal",
];

const MAX_FILES = 200;
const MAX_TRY = 5;          // client-side attempts per CV (waits out a short rate limit)
const PACING_MS = 600;      // small gap between CVs when budget is available
const FALLBACK_WAIT_MS = 20000; // wait when Groq doesn't send a retry-after (≈ TPM reset window)
const LONG_COOLDOWN_SEC = 90;   // if Groq asks to wait longer than this, fail fast → user uses "Retry failed"
const PER_CV_EST = 5000;    // approx tokens one CV needs available to be admitted
const REFILL_PER_SEC = 200; // Groq free tier refills ~12,000 tokens/min = 200/sec

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type ItemStatus = "queued" | "processing" | "done" | "error";

interface BulkItem {
  id: string;
  fileName: string;
  file: File;
  status: ItemStatus;
  name?: string;
  overallScore?: number;
  matchScore?: number;
  recommendation?: AiAnalysisResult["recommendation"];
  frameworkLabel?: string;
  error?: string;
}

function recColor(rec?: string): string {
  if (rec === "Strong Hire") return "text-emerald-600 dark:text-emerald-400";
  if (rec === "Hire") return "text-blue-600 dark:text-blue-400";
  if (rec === "Review") return "text-amber-600 dark:text-amber-400";
  if (rec === "Reject") return "text-red-600 dark:text-red-400";
  return "text-slate-500";
}

/** Fallback display name when the AI couldn't extract one — derived from the file name. */
function prettyNameFromFile(fileName: string): string {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(cv|resume|curriculum vitae|lamaran)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const titled = base
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
  return titled || "Unknown Candidate";
}

function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === "processing") {
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />;
  }
  if (status === "done") {
    return <Icon className="h-4 w-4 shrink-0 text-emerald-500"><SvgPath name="check" /></Icon>;
  }
  if (status === "error") {
    return <Icon className="h-4 w-4 shrink-0 text-red-500"><SvgPath name="xmark" /></Icon>;
  }
  return <Icon className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600"><SvgPath name="clock" /></Icon>;
}

export default function BulkCvAnalyzerPage() {
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [jobReqId, setJobReqId] = useState("");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const reqs = useMemo<JobRequisition[]>(() => {
    try { return getJobReqs().filter((r) => r.status !== "closed"); } catch { return []; }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.fileName + ":" + i.file.size));
      const next = [...prev];
      for (const f of pdfs) {
        const key = f.name + ":" + f.size;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: f.name, file: f, status: "queued",
        });
      }
      return next.slice(0, MAX_FILES);
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearAll = () => setItems([]);

  const onSelectReq = (id: string) => {
    setJobReqId(id);
    const r = reqs.find((x) => x.id === id);
    if (r) { setPosition(r.title); setDepartment(r.department); }
  };

  const canRun = items.length > 0 && position.trim() !== "" && department !== "" && !running;

  const ranked = useMemo(
    () => items
      .filter((i) => i.status === "done" && typeof i.overallScore === "number")
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)),
    [items],
  );

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const processedCount = doneCount + errorCount;

  // Analyze ONE CV with client-side retries. Returns true on success.
  // Sends noRetry=true so each serverless call is a single fast attempt.
  const analyzeAndSave = useCallback(async (
    target: { id: string; file: File; fileName: string },
    pos: string,
  ): Promise<{ ok: boolean; remainingTokens?: number | null }> => {
    for (let attempt = 1; attempt <= MAX_TRY; attempt++) {
      updateItem(target.id, {
        status: "processing",
        error: attempt > 1 ? `Mengulang… (${attempt}/${MAX_TRY})` : undefined,
      });
      try {
        const fd = new FormData();
        fd.append("file", target.file);
        fd.append("targetPosition", pos);
        fd.append("department", department);
        fd.append("noRetry", "true");

        const res = await fetch("/api/analyze-cv", { method: "POST", body: fd });
        const raw = await res.text();
        type ApiResp = { result?: AiAnalysisResult; error?: string; retryAfter?: number; meta?: { remainingTokens?: number | null; resetSeconds?: number | null } };
        let json: ApiResp | null = null;
        try { json = JSON.parse(raw) as ApiResp; }
        catch { /* non-JSON = server overloaded / timed out */ }

        if (!json) {
          if (attempt < MAX_TRY) {
            updateItem(target.id, { status: "processing", error: `Server sibuk — tunggu 8s (${attempt}/${MAX_TRY})` });
            await sleep(8000); continue;
          }
          throw new Error('Server sibuk (timeout). Pakai "Retry failed".');
        }
        if (!res.ok || json.error) {
          const msg = json.error ?? `Server error ${res.status}`;
          const retryable = res.status === 429 || res.status >= 500;
          if (retryable && attempt < MAX_TRY) {
            const retrySec = res.status === 429
              ? (json.retryAfter && json.retryAfter > 0 ? json.retryAfter : FALLBACK_WAIT_MS / 1000)
              : attempt * 4;
            // Long cooldown: don't burn minutes per CV — fail fast so the user waits once, then "Retry failed".
            if (retrySec > LONG_COOLDOWN_SEC) {
              throw new Error(`Limit Groq aktif (~${Math.ceil(retrySec / 60)} mnt). Tunggu, lalu klik "Retry failed".`);
            }
            const waitMs = Math.ceil(retrySec * 1000) + 1000;
            updateItem(target.id, { status: "processing", error: `Limit Groq — tunggu ${Math.ceil(waitMs / 1000)}s (${attempt}/${MAX_TRY})` });
            await sleep(waitMs); continue;
          }
          throw new Error(msg);
        }
        const result = json.result;
        if (!result) throw new Error("Respons AI tidak valid");

        const name = (result.candidateName && result.candidateName.trim()) || prettyNameFromFile(target.fileName);
        const now = new Date();
        const snapshot: CvAnalysisSnapshot = {
          reportId: `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          overallScore: result.overallScore, matchScore: result.matchScore,
          confidence: result.confidence, recommendation: result.recommendation,
          summary: result.summary, frameworkLabel: result.frameworkLabel ?? "Multi-Framework",
          analyzedAt: now.toISOString(),
          cluster: result.cluster,
          competencies: result.competencies,
          risks: result.risks,
          questions: result.questions,
        };
        upsertAnalyzedCandidate({ name, position: pos, department, jobReqId: jobReqId || undefined, source: "Bulk CV", snapshot });
        updateItem(target.id, {
          status: "done", name, error: undefined,
          overallScore: result.overallScore, matchScore: result.matchScore,
          recommendation: result.recommendation, frameworkLabel: result.frameworkLabel,
        });
        return { ok: true, remainingTokens: json.meta?.remainingTokens ?? null };
      } catch (err) {
        if (attempt >= MAX_TRY) {
          updateItem(target.id, { status: "error", error: (err as Error).message });
          return { ok: false };
        }
        await sleep(attempt * 3000);
      }
    }
    return { ok: false };
  }, [department, jobReqId, updateItem]);

  // Process a list of CVs sequentially (gentle on the rate limit).
  const processList = useCallback(async (targets: { id: string; file: File; fileName: string }[]) => {
    const pos = position.trim();
    if (targets.length === 0 || !pos || !department) return;
    setRunning(true);
    const ids = new Set(targets.map((t) => t.id));
    setItems((prev) => prev.map((i) => ids.has(i.id)
      ? { ...i, status: "queued", error: undefined, overallScore: undefined, matchScore: undefined, recommendation: undefined }
      : i));

    let success = 0;
    let budget: number | null = null; // tokens remaining reported by the last successful call
    for (const t of targets) {
      // Adaptive pacing: if the Groq budget is too low for another CV, wait for it to refill
      // (≈200 tokens/sec) BEFORE firing — this avoids hitting the limit and triggering a cooldown.
      if (budget !== null && budget < PER_CV_EST) {
        const waitSec = Math.min(60, Math.ceil((PER_CV_EST - budget) / REFILL_PER_SEC) + 2);
        updateItem(t.id, { status: "processing", error: `Menjaga ritme — tunggu kuota ${waitSec}s…` });
        await sleep(waitSec * 1000);
        budget = PER_CV_EST; // assume enough refilled for one CV
      }
      const r = await analyzeAndSave(t, pos);
      if (r.ok) success++;
      budget = r.ok && typeof r.remainingTokens === "number" ? r.remainingTokens : null;
      await sleep(PACING_MS);
    }

    logBulkAnalysis(success, pos);
    setRunning(false);
    const failed = targets.length - success;
    toast(
      `Selesai — ${success} berhasil${failed ? `, ${failed} gagal (pakai "Retry failed")` : ""}`,
      failed && !success ? "error" : "success",
    );
  }, [position, department, analyzeAndSave, updateItem]);

  const runBulk = useCallback(() => {
    processList(items.map((i) => ({ id: i.id, file: i.file, fileName: i.fileName })));
  }, [items, processList]);

  const retryFailed = useCallback(() => {
    processList(items.filter((i) => i.status === "error").map((i) => ({ id: i.id, file: i.file, fileName: i.fileName })));
  }, [items, processList]);

  const exportCsv = useCallback(() => {
    if (ranked.length === 0) return;
    const rows: string[][] = [["Rank", "Name", "Recommendation", "Overall", "Match%", "Framework"]];
    ranked.forEach((it, i) => rows.push([
      String(i + 1), it.name ?? "", it.recommendation ?? "",
      String(it.overallScore ?? ""), String(it.matchScore ?? ""), it.frameworkLabel ?? "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cv-ranking-${position.trim().replace(/\s+/g, "-") || "shortlist"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ranked, position]);

  return (
    <AppShell
      activeNavId="cv-analyzer"
      title="Bulk CV Analysis"
      subtitle="Upload many CVs · AI ranks them all · Groq · Llama 3.3"
      headerActions={
        <Link href="/cv-analyzer">
          <Button variant="secondary" size="sm">
            <Icon className="h-4 w-4"><SvgPath name="scan" /></Icon>
            Single CV
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Role context */}
        <Card>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">1 · Target role</h2>
          <p className="mt-0.5 text-sm text-slate-500">Applies to every CV in this batch. Framework auto-selected by role.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {reqs.length > 0 && (
              <div className="sm:col-span-3">
                <Label htmlFor="jobreq">Link to open role (optional)</Label>
                <select id="jobreq" value={jobReqId} onChange={(e) => onSelectReq(e.target.value)} className={cn(inputClass, "cursor-pointer")}>
                  <option value="">— Manual entry —</option>
                  {reqs.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.department}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor="position">Target position</Label>
              <input id="position" type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Software Engineer" className={inputClass} />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className={cn(inputClass, "cursor-pointer")}>
                <option value="">Select…</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Upload */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">2 · Upload CVs</h2>
              <p className="mt-0.5 text-sm text-slate-500">PDF only · up to {MAX_FILES} files · pick multiple or a whole folder</p>
            </div>
            {items.length > 0 && !running && (
              <button onClick={clearAll} className="text-xs text-slate-400 transition-colors hover:text-red-500 dark:hover:text-red-400">Clear all</button>
            )}
          </div>

          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
            className={cn(
              "mt-4 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              dragActive ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10" : "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/30",
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Icon className="h-6 w-6 text-slate-400"><SvgPath name="upload" /></Icon>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Drag &amp; drop PDF resumes here, or</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={running}>Select PDFs</Button>
                <Button variant="secondary" size="sm" onClick={() => folderInputRef.current?.click()} disabled={running}>Select folder</Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input
                ref={(el) => { folderInputRef.current = el; if (el) el.setAttribute("webkitdirectory", ""); }}
                type="file" multiple className="sr-only"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
          </div>

          {items.length > 0 && (
            <div className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <StatusBadge status={it.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-700 dark:text-slate-300">{it.name ?? it.fileName}</p>
                    {it.status === "error" && <p className="truncate text-xs text-red-500">{it.error}</p>}
                    {it.status === "done" && (
                      <p className="text-xs text-slate-400">
                        <span className={cn("font-medium", recColor(it.recommendation))}>{it.recommendation}</span>
                        {" · "}{it.overallScore} pts · {it.matchScore}% match
                      </p>
                    )}
                  </div>
                  {!running && (
                    <button onClick={() => removeItem(it.id)} aria-label="Remove" className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:text-red-400 dark:text-slate-600">
                      <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Run */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">3 · Analyze &amp; rank</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {running
                  ? `Analyzing… ${processedCount}/${items.length} done`
                  : `${items.length} CV${items.length === 1 ? "" : "s"} ready${errorCount ? ` · ${errorCount} failed last run` : ""}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {errorCount > 0 && !running && (
                <Button variant="secondary" size="lg" onClick={retryFailed}>
                  <Icon className="h-4 w-4"><SvgPath name="history" /></Icon>
                  Retry failed ({errorCount})
                </Button>
              )}
              <Button variant="primary" size="lg" disabled={!canRun} onClick={runBulk}>
                {running ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Analyzing…</>
                ) : (
                  <><Icon className="h-5 w-5"><SvgPath name="sparkles" /></Icon>Analyze {items.length || ""} CV{items.length === 1 ? "" : "s"}</>
                )}
              </Button>
            </div>
          </div>
          {(running || processedCount > 0) && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${items.length ? (processedCount / items.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {doneCount} analyzed{errorCount ? ` · ${errorCount} failed` : ""} of {items.length}
                {running && " · one at a time with auto-retry (gentle on the free-tier rate limit)"}
              </p>
            </div>
          )}
          {!canRun && !running && items.length > 0 && (position.trim() === "" || department === "") && (
            <p className="mt-3 text-xs text-amber-500">Set the target position and department first.</p>
          )}
        </Card>

        {/* Ranked results */}
        {ranked.length > 0 && (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ranked shortlist</h2>
                <p className="mt-0.5 text-sm text-slate-500">{ranked.length} candidates · highest overall score first · saved to your pipeline</p>
              </div>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                <Icon className="h-4 w-4"><SvgPath name="download" /></Icon>
                Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                    <th className="px-5 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Candidate</th>
                    <th className="px-3 py-2.5 font-semibold">Recommendation</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Overall</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Match</th>
                    <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Framework</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ranked.map((it, i) => (
                    <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3">
                        <span className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                            : i === 1 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              : i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                                : "text-slate-400",
                        )}>{i + 1}</span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{it.name}</td>
                      <td className={cn("px-3 py-3 font-semibold", recColor(it.recommendation))}>{it.recommendation}</td>
                      <td className="px-3 py-3 text-center font-bold tabular-nums text-slate-900 dark:text-white">{it.overallScore}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-blue-600 dark:text-blue-400">{it.matchScore}%</td>
                      <td className="hidden px-3 py-3 text-xs text-slate-400 md:table-cell">{it.frameworkLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">
              All {ranked.length} candidates saved to <Link href="/candidates" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Candidates</Link> and synced to the cloud.
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
