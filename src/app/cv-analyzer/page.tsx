"use client";

import {
  CitationNote,
  CompetencyScoreList,
  EvidenceValidityPanel,
} from "@/components/competency-framework-ui";
import {
  CITATIONS,
  type CompetencyScore,
} from "@/lib/competency-framework";
import { AppShell, Icon, SvgPath, Card, Button, Label, inputClass, cn } from "@/components/app-shell";
import type { AiAnalysisResult, CompetencyCluster } from "@/lib/cv-analyzer-ai";
import {
  findCandidateByName, createCandidate, saveCvAnalysis, getCandidate,
  type CvAnalysisSnapshot,
} from "@/lib/store";
import { toast } from "@/components/toast";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Recommendation = "Strong Hire" | "Hire" | "Review" | "Reject";
type RiskSeverity = "high" | "medium" | "low";

interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: RiskSeverity;
}

interface AnalysisReport {
  reportId: string;
  generatedAt: string;
  confidence: number;
  overallScore: number;
  recommendation: Recommendation;
  summary: string;
  competencies: CompetencyScore[];
  risks: RiskFlag[];
  questions: { id: number; category: string; question: string; rationale: string }[];
  recommendationDetail: string;
  matchScore: number;
  processingMs: number;
  processingNote?: string;
  frameworkLabel: string;
  cluster: CompetencyCluster;
}

interface HistoryItem {
  id: string;
  savedAt: string;
  candidateName: string;
  position: string;
  department: string;
  recommendation: Recommendation;
  overallScore: number;
  matchScore: number;
  frameworkLabel: string;
  report: AnalysisReport;
}

const DEPARTMENTS = [
  "Penyiaran", "Redaksi", "Engineering", "Product", "Data", "Design", "Sales",
  "Finance", "Security", "Operations", "HR", "Legal",
];

// Badge warna per cluster
const CLUSTER_BADGE: Record<CompetencyCluster, { label: string; className: string }> = {
  hr: { label: "Ulrich + SKKNI", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
  tech: { label: "SFIA v8", className: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
  business: { label: "Lominger / Korn Ferry", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  finance: { label: "CGMA / CIMA", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  broadcast: { label: "SKKNI Penyiaran", className: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300" },
  editorial: { label: "SKKNI Redaksi", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300" },
  security: { label: "SKKNI Satpam", className: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
};

function buildReportFromAi(ai: AiAnalysisResult, startMs: number): Omit<AnalysisReport, "reportId" | "generatedAt"> {
  return {
    confidence: ai.confidence,
    overallScore: ai.overallScore,
    recommendation: ai.recommendation,
    matchScore: ai.matchScore,
    processingMs: Date.now() - startMs,
    summary: ai.summary,
    recommendationDetail: ai.recommendationDetail,
    processingNote: ai.processingNote,
    frameworkLabel: ai.frameworkLabel ?? "Multi-Framework Competency",
    cluster: ai.cluster ?? "business",
    competencies: ai.competencies.map((c) => ({
      id: c.id, name: c.name, pillar: c.pillar,
      score: c.score, benchmark: c.benchmark, insight: c.insight, rubric: [],
    })),
    risks: ai.risks.map((r) => ({ id: r.id, label: r.label, detail: r.detail, severity: r.severity })),
    questions: ai.questions.map((q) => ({ id: q.id, category: q.category, question: q.question, rationale: q.rationale })),
  };
}

function recColor(rec: Recommendation): string {
  if (rec === "Strong Hire") return "text-emerald-600 dark:text-emerald-400";
  if (rec === "Hire") return "text-blue-600 dark:text-blue-400";
  if (rec === "Review") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function recommendationStyles(rec: Recommendation) {
  const map: Record<Recommendation, { card: string; badge: string; ring: string }> = {
    "Strong Hire": { card: "from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-500/30", badge: "bg-emerald-600 text-white", ring: "ring-emerald-500/30" },
    Hire: { card: "from-blue-500/10 to-indigo-500/5 border-blue-200 dark:border-blue-500/30", badge: "bg-blue-600 text-white", ring: "ring-blue-500/30" },
    Review: { card: "from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-500/30", badge: "bg-amber-600 text-white", ring: "ring-amber-500/30" },
    Reject: { card: "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-500/30", badge: "bg-red-600 text-white", ring: "ring-red-500/30" },
  };
  return map[rec];
}

function riskSeverityStyles(severity: RiskSeverity) {
  const map = {
    high: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
    medium: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    low: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  };
  return map[severity];
}

function PdfDropzone({ file, dragActive, onFile, onDragActive }: { file: File | null; dragActive: boolean; onFile: (f: File | null) => void; onDragActive: (v: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) onFile(f);
  };
  return (
    <div role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      onDragEnter={(e) => { e.preventDefault(); onDragActive(true); }}
      onDragOver={(e) => { e.preventDefault(); onDragActive(true); }}
      onDragLeave={(e) => { e.preventDefault(); onDragActive(false); }}
      onDrop={(e) => { e.preventDefault(); onDragActive(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={cn("relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragActive ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
          : file ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-500/40 dark:bg-emerald-500/5"
            : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30 dark:border-slate-600 dark:bg-slate-800/30 dark:hover:border-blue-500/50")}
      aria-label="Upload PDF resume">
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
      {file ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
            <Icon className="h-7 w-7 text-emerald-600 dark:text-emerald-400"><SvgPath name="documentPdf" /></Icon>
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
            <p className="mt-0.5 text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB · PDF ready</p>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onFile(null); if (inputRef.current) inputRef.current.value = ""; }}>Remove file</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Icon className="h-7 w-7 text-slate-400"><SvgPath name="upload" /></Icon>
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Drop PDF resume here</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">or click to browse · max 10 MB</p>
          </div>
          <Button variant="secondary" size="sm" type="button">Select PDF file</Button>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  history, onSelect, onDelete, onClear,
}: {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400"><SvgPath name="history" /></Icon>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Analyses</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{history.length}</span>
        </div>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-500 transition-colors dark:hover:text-red-400">Clear all</button>
      </div>
      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {history.map((item) => (
          <div key={item.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <button onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.candidateName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{item.position} · {item.department}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("text-xs font-semibold", recColor(item.recommendation))}>{item.recommendation}</span>
                <span className="text-xs text-slate-400">{item.overallScore} pts · {item.matchScore}% match</span>
              </div>
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-red-400"
              aria-label="Delete"
            >
              <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnalysisReportPanel({ report, candidateName, targetPosition, department, onExportPdf, onScheduleInterview }: {
  report: AnalysisReport; candidateName: string; targetPosition: string; department: string; onExportPdf?: () => void; onScheduleInterview?: () => void;
}) {
  const recStyle = recommendationStyles(report.recommendation);
  const clusterBadge = CLUSTER_BADGE[report.cluster];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-blue-500/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Icon className="h-6 w-6"><SvgPath name="sparkles" /></Icon>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI Analysis Report</h2>
                  {/* Badge framework — dinamis berdasarkan cluster */}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", clusterBadge.className)}>
                    {clusterBadge.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Groq · Llama 3.3
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{report.frameworkLabel}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{candidateName} · {targetPosition} · {department}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">{report.reportId} · {report.generatedAt}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 sm:justify-end">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{report.overallScore}</p>
                <p className="text-xs text-slate-500">Overall</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{report.matchScore}%</p>
                <p className="text-xs text-slate-500">Role match</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{report.confidence}%</p>
                <p className="text-xs text-slate-500">Confidence</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Executive summary: </span>
            {report.summary}
          </p>
          {report.processingNote && (
            <p className="mt-2 text-xs text-slate-400 italic">ℹ {report.processingNote}</p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Processed in {(report.processingMs / 1000).toFixed(1)}s · Groq · Llama 3.3 70B · No PII stored
          </p>
        </div>
      </Card>

      <EvidenceValidityPanel />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Competency Assessment</h3>
          <p className="mt-0.5 text-sm text-slate-500">{report.frameworkLabel} · scored from CV evidence</p>
          <div className="mt-5"><CompetencyScoreList scores={report.competencies} /></div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-500"><SvgPath name="warning" /></Icon>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Risk Flags</h3>
              <p className="mt-0.5 text-sm text-slate-500">{report.risks.length} items flagged for validation</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {report.risks.map((risk) => (
              <li key={risk.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">{risk.label}</p>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset", riskSeverityStyles(risk.severity))}>
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{risk.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {report.questions.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Structured Interview Questions</h3>
              <p className="mt-0.5 text-sm text-slate-500">Generated from CV gaps · STAR format · r ≈ 0.51</p>
            </div>
            <CitationNote className="mt-2 px-0">{CITATIONS.schmidtHunter}</CitationNote>
          </div>
          <ol className="mt-5 space-y-4">
            {report.questions.map((q) => (
              <li key={q.id} className="flex gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">{q.id}</span>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">{q.category}</span>
                  <p className="mt-2 font-medium text-slate-900 dark:text-white">{q.question}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Rationale: </span>{q.rationale}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className={cn("rounded-xl border bg-gradient-to-br p-6 ring-1 ring-inset", recStyle.card, recStyle.ring)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl shadow-sm", recStyle.badge)}>
              <Icon className="h-8 w-8"><SvgPath name="check" /></Icon>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Final recommendation</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">{report.recommendation}</p>
            </div>
          </div>
          <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onExportPdf}>
            <Icon className="h-4 w-4"><SvgPath name="download" /></Icon>
              Export PDF
              </Button>
              <Button variant="primary" size="sm" onClick={onScheduleInterview}>Schedule interview</Button>
            </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.recommendationDetail}</p>
      </div>
    </div>
  );
}

export default function CvAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [targetPosition, setTargetPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cv_analysis_history");
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Prefill from a candidate when opened via "Analyze CV" (/cv-analyzer?candidate=ID)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("candidate");
    if (!id) return;
    const c = getCandidate(id);
    if (c) {
      setCandidateName(c.name);
      setTargetPosition(c.position);
      setDepartment(c.department);
    }
  }, []);

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    setCandidateName(item.candidateName);
    setTargetPosition(item.position);
    setDepartment(item.department);
    setReport(item.report);
    setFile(null);
    setDragActive(false);
    setError(null);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      try { localStorage.setItem("cv_analysis_history", JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem("cv_analysis_history"); } catch { /* ignore */ }
  }, []);

  const canAnalyze = file !== null && candidateName.trim() !== "" && targetPosition.trim() !== "" && department !== "";

  const handleExportPdf = useCallback(() => {
    if (!report) return;

    const competencyRows = report.competencies.map(c => {
      const gap = c.score >= c.benchmark ? "strength" : c.score >= c.benchmark - 10 ? "meets" : "develop";
      const gapLabel = gap === "strength" ? "✅ Strength" : gap === "meets" ? "≈ Meets" : "⚠ Develop";
      const pct = Math.min(100, c.score);
      return `<tr>
        <td><strong>${c.name}</strong><br/><span style="font-size:8pt;color:#64748b">${c.pillar}</span></td>
        <td style="text-align:center"><strong>${c.score}</strong></td>
        <td style="text-align:center">${c.benchmark}</td>
        <td>
          <div style="height:6px;border-radius:3px;background:#e2e8f0;width:100%;">
            <div style="height:100%;border-radius:3px;width:${pct}%;background:${gap === 'strength' ? '#059669' : gap === 'meets' ? '#2563eb' : '#f59e0b'};"></div>
          </div>
        </td>
        <td><span style="font-size:8pt;padding:2px 6px;border-radius:4px;font-weight:500;background:${gap === 'strength' ? '#dcfce7' : gap === 'meets' ? '#dbeafe' : '#fef3c7'};color:${gap === 'strength' ? '#166534' : gap === 'meets' ? '#1e40af' : '#92400e'}">${gapLabel}</span></td>
        <td style="font-size:8.5pt;color:#475569;">${c.insight || "-"}</td>
      </tr>`;
    }).join("");

    const riskRows = report.risks.map(r => {
      const bg = r.severity === "high" ? "#fef2f2" : r.severity === "medium" ? "#fffbeb" : "#f8fafc";
      const border = r.severity === "high" ? "#ef4444" : r.severity === "medium" ? "#f59e0b" : "#94a3b8";
      const badgeBg = r.severity === "high" ? "#fca5a5" : r.severity === "medium" ? "#fcd34d" : "#cbd5e1";
      const badgeColor = r.severity === "high" ? "#7f1d1d" : r.severity === "medium" ? "#78350f" : "#334155";
      return `<div style="padding:10px 12px;border-radius:6px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;background:${bg};border-left:3px solid ${border};">
        <div style="flex:1">
          <strong style="font-size:10pt">${r.label}</strong>
          <p style="font-size:9pt;color:#475569;margin-top:3px">${r.detail}</p>
        </div>
        <span style="font-size:7pt;padding:2px 6px;border-radius:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:${badgeBg};color:${badgeColor};flex-shrink:0">${r.severity}</span>
      </div>`;
    }).join("");

    const questionRows = report.questions.map(q =>
      `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9">
        <div style="width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10pt;flex-shrink:0">${q.id}</div>
        <div>
          <span style="background:#f1f5f9;color:#475569;font-size:7.5pt;padding:2px 6px;border-radius:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${q.category}</span>
          <p style="font-size:10pt;font-weight:500;margin:6px 0 4px;line-height:1.4">${q.question}</p>
          <p style="font-size:8.5pt;color:#64748b"><strong>Rationale:</strong> ${q.rationale}</p>
        </div>
      </div>`
    ).join("");

    const recBg = report.recommendation === "Strong Hire" ? "#f0fdf4" : report.recommendation === "Hire" ? "#eff6ff" : report.recommendation === "Review" ? "#fffbeb" : "#fef2f2";
    const recBorder = report.recommendation === "Strong Hire" ? "#86efac" : report.recommendation === "Hire" ? "#93c5fd" : report.recommendation === "Review" ? "#fcd34d" : "#fca5a5";

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>CV Analysis - ${candidateName} - ${report.reportId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;font-size:11pt;color:#0f172a;background:white;padding:24px}
    @page{margin:18mm;size:A4}
    table{width:100%;border-collapse:collapse;font-size:9.5pt}
    th{background:#f1f5f9;text-align:left;padding:8px 10px;font-weight:600;font-size:8pt;text-transform:uppercase;letter-spacing:0.04em;color:#64748b}
    td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    @media print{button{display:none}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #2563eb;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12pt">HI</div>
      <div>
        <h1 style="font-size:14pt;font-weight:700">People Intelligence</h1>
        <p style="font-size:9pt;color:#64748b">AI-Powered CV Analysis Report</p>
      </div>
    </div>
    <div style="text-align:right">
      <p style="font-family:monospace;font-size:9pt;color:#64748b">${report.reportId}</p>
      <p style="font-size:9pt;color:#64748b">${report.generatedAt}</p>
      <span style="background:#eff6ff;color:#1d4ed8;font-size:8pt;padding:3px 8px;border-radius:12px;font-weight:500">${report.frameworkLabel}</span>
    </div>
  </div>

  <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid #e2e8f0">
    <h2 style="font-size:12pt;font-weight:600;margin-bottom:10px">Candidate Profile</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div><p style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Candidate</p><p style="font-size:10pt;font-weight:500;margin-top:2px">${candidateName}</p></div>
      <div><p style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Target Position</p><p style="font-size:10pt;font-weight:500;margin-top:2px">${targetPosition}</p></div>
      <div><p style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Department</p><p style="font-size:10pt;font-weight:500;margin-top:2px">${department}</p></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <p style="font-size:22pt;font-weight:700;color:#0f172a">${report.overallScore}</p>
      <p style="font-size:8pt;color:#64748b;margin-top:2px">Overall Score</p>
    </div>
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <p style="font-size:22pt;font-weight:700;color:#2563eb">${report.matchScore}%</p>
      <p style="font-size:8pt;color:#64748b;margin-top:2px">Role Match</p>
    </div>
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <p style="font-size:22pt;font-weight:700;color:#059669">${report.confidence}%</p>
      <p style="font-size:8pt;color:#64748b;margin-top:2px">AI Confidence</p>
    </div>
  </div>

  <div style="padding:16px;border-radius:8px;margin-bottom:20px;border:2px solid ${recBorder};background:${recBg}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:9pt;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Final Recommendation</span>
      <span style="font-size:16pt;font-weight:700">${report.recommendation}</span>
    </div>
    <p style="font-size:10pt;color:#475569;line-height:1.5">${report.recommendationDetail}</p>
  </div>

  <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
    <h3 style="font-size:9pt;text-transform:uppercase;letter-spacing:0.05em;color:#2563eb;margin-bottom:6px">Executive Summary</h3>
    <p style="font-size:10pt;color:#475569;line-height:1.6">${report.summary}</p>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-bottom:20px;font-size:8.5pt;color:#64748b;line-height:1.5">
    <strong style="color:#475569">Evidence Validity:</strong> Structured interview (r ≈ 0.51) · CV screening (r ≈ 0.38) · Unstructured interview (r ≈ 0.20) · Multi-method assessment recommended.
    <em>Ref: Schmidt & Hunter (1998). Psychological Bulletin, 124(2), 262–274.</em>
  </div>

  <h2 style="font-size:12pt;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0">Competency Assessment — ${report.frameworkLabel}</h2>
  <table style="margin-bottom:24px">
    <thead><tr><th>Competency</th><th style="text-align:center">Score</th><th style="text-align:center">Benchmark</th><th style="width:80px">Bar</th><th>Gap</th><th>Insight</th></tr></thead>
    <tbody>${competencyRows}</tbody>
  </table>

  <h2 style="font-size:12pt;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0">Risk Flags (${report.risks.length} items)</h2>
  <div style="margin-bottom:24px">${riskRows}</div>

  ${report.questions.length > 0 ? `
  <h2 style="font-size:12pt;font-weight:600;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e2e8f0">Structured Interview Questions (STAR Format)</h2>
  <p style="font-size:8.5pt;color:#64748b;margin-bottom:12px">Generated from CV gaps · r ≈ 0.51 (Schmidt & Hunter, 1998)</p>
  <div style="margin-bottom:24px">${questionRows}</div>
  ` : ""}

  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8">
    <span>People Intelligence · people-intelligence-hub.vercel.app</span>
    <span>Generated: ${report.generatedAt} · Groq Llama 3.3 70B · No PII stored</span>
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup diblokir browser. Izinkan popup untuk export PDF.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 800);
  }, [report, candidateName, targetPosition, department]);

  const handleScheduleInterview = useCallback(() => {
    if (!report) return;
    try {
      sessionStorage.setItem("interview_prefill", JSON.stringify({
        candidateName,
        position: targetPosition,
        department,
        overallScore: report.overallScore,
        matchScore: report.matchScore,
        recommendation: report.recommendation,
        questions: report.questions,
        reportId: report.reportId,
      }));
    } catch { /* ignore */ }
    window.location.href = `/interview?position=${encodeURIComponent(targetPosition)}&name=${encodeURIComponent(candidateName)}`;
  }, [report, candidateName, targetPosition, department]);

  const handleAnalyze = async () => {
    if (!canAnalyze || !file) return;
    setAnalyzing(true);
    setReport(null);
    setError(null);
    const startMs = Date.now();
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("candidateName", candidateName);
      formData.append("targetPosition", targetPosition);
      formData.append("department", department);

      const res = await fetch("/api/analyze-cv", { method: "POST", body: formData });
      const json = await res.json() as {
        success?: boolean;
        result?: AiAnalysisResult;
        error?: string;
      };

      if (!res.ok || json.error) throw new Error(json.error ?? `Server error ${res.status}`);
      if (!json.result) throw new Error("Respons tidak valid dari server");

      const now = new Date();
      const newReport: AnalysisReport = {
        ...buildReportFromAi(json.result, startMs),
        reportId: `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        generatedAt: now.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
      };
      setReport(newReport);
      setHistory(prev => {
        const item: HistoryItem = {
          id: newReport.reportId,
          savedAt: new Date().toISOString(),
          candidateName,
          position: targetPosition,
          department,
          recommendation: newReport.recommendation,
          overallScore: newReport.overallScore,
          matchScore: newReport.matchScore,
          frameworkLabel: newReport.frameworkLabel,
          report: newReport,
        };
        const updated = [item, ...prev.filter(h => h.id !== item.id)].slice(0, 20);
        try { localStorage.setItem("cv_analysis_history", JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });

      // Persist to candidate store
      try {
        let candidate = findCandidateByName(candidateName, targetPosition);
        if (!candidate) {
          candidate = createCandidate({ name: candidateName, position: targetPosition, department, source: "CV Analyzer" });
        }
        const snapshot: CvAnalysisSnapshot = {
          reportId: newReport.reportId,
          overallScore: newReport.overallScore,
          matchScore: newReport.matchScore,
          confidence: newReport.confidence,
          recommendation: newReport.recommendation,
          summary: newReport.summary,
          frameworkLabel: newReport.frameworkLabel,
          analyzedAt: new Date().toISOString(),
          cluster: json.result.cluster,
          competencies: json.result.competencies,
          risks: json.result.risks,
          questions: json.result.questions,
        };
        saveCvAnalysis(candidate.id, snapshot);
      } catch { /* store write failed, non-critical */ }
      toast(`Analysis complete — ${newReport.recommendation} (${newReport.overallScore} pts)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast(msg, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppShell activeNavId="cv-analyzer" title="CV Analyzer" subtitle="Multi-framework AI analysis · Groq · Llama 3.3"
      headerActions={
        <Link href="/cv-analyzer/bulk">
          <Button variant="primary" size="sm">
            <Icon className="h-4 w-4"><SvgPath name="users" /></Icon>
            Bulk analyze
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400"><SvgPath name="upload" /></Icon>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Upload Resume</h2>
                <p className="text-sm text-slate-500">PDF format only</p>
              </div>
            </div>
            <div className="mt-4">
              <PdfDropzone file={file} dragActive={dragActive} onFile={setFile} onDragActive={setDragActive} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Candidate Details</h2>
            <p className="mt-0.5 text-sm text-slate-500">Framework auto-selected by role · Ulrich · SFIA · Lominger · CGMA · SKKNI Penyiaran & Redaksi</p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="candidate-name">Candidate name</Label>
                <input id="candidate-name" type="text" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="e.g. Lionel Messi" className={inputClass} />
              </div>
              <div>
                <Label htmlFor="target-position">Target position</Label>
                <input id="target-position" type="text" value={targetPosition} onChange={(e) => setTargetPosition(e.target.value)} placeholder="e.g. Video Editor / Reporter / MCR Operator / Satpam" className={inputClass} />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className={cn(inputClass, "cursor-pointer")}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Button variant="primary" size="lg" className="w-full" disabled={!canAnalyze || analyzing} onClick={handleAnalyze}>
                {analyzing ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Analyzing…</>
                ) : (
                  <><Icon className="h-5 w-5"><SvgPath name="sparkles" /></Icon>Analyze CV</>
                )}
              </Button>
              {!canAnalyze && !analyzing && (
                <p className="text-center text-xs text-slate-400">Upload PDF dan lengkapi semua field</p>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">⚠ Error analisis</p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
          </Card>
          <HistoryPanel history={history} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} onClear={handleClearHistory} />
        </div>

        <div className="xl:col-span-3">
          {analyzing && (
            <Card className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-500/20">
                <Icon className="h-8 w-8 animate-pulse text-blue-600 dark:text-blue-400"><SvgPath name="sparkles" /></Icon>
              </div>
              <p className="mt-4 font-medium text-slate-900 dark:text-white">AI sedang menganalisis CV…</p>
              <p className="mt-1 text-sm text-slate-500">Mendeteksi framework · Membaca kompetensi · Generating insight</p>
              <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
              </div>
            </Card>
          )}
          {!analyzing && !report && !error && (
            <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
              <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600"><SvgPath name="scan" /></Icon>
              <p className="mt-4 font-medium text-slate-900 dark:text-white">No analysis yet</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Framework dipilih otomatis berdasarkan posisi: HR → Ulrich+SKKNI, Tech → SFIA, Business/MT → Lominger, Finance → CGMA.
              </p>
            </Card>
          )}
          {!analyzing && report && (
            <AnalysisReportPanel report={report} candidateName={candidateName} targetPosition={targetPosition} department={department} onExportPdf={handleExportPdf} onScheduleInterview={handleScheduleInterview} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
