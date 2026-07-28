"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppShell, Button, Card, Icon, SvgPath, ICON_PATHS, cn, Label, inputClass,
} from "@/components/app-shell";
import {
  type CandidateRecord, type PipelineStage, type JobRequisition, type ImportRow, type TalentProfile,
  PIPELINE_STAGES, STAGE_LABELS,
  getCandidates, getJobReqs, getTalentPool, saveCandidate, deleteCandidate,
  moveCandidateStage, createCandidate, importCandidates, addActivity, convertCandidateToTalent,
} from "@/lib/store";
import { getActiveCompanyId, ALL_COMPANIES } from "@/lib/payroll/company-profile";
import { toast } from "@/components/toast";
import {
  type EmailTemplateKey, TEMPLATE_ORDER, getTemplates, composeEmail, buildMailto,
} from "@/lib/email-templates";

/* ─── Stage colors ─── */

const STAGE_COLORS: Record<PipelineStage, { bg: string; text: string; dot: string; border: string }> = {
  applied: { bg: "bg-slate-50 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400", border: "border-slate-200 dark:border-slate-700" },
  screened: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", border: "border-blue-200 dark:border-blue-800" },
  work_sample: { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500", border: "border-cyan-200 dark:border-cyan-800" },
  interviewed: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-800" },
  offered: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500", border: "border-purple-200 dark:border-purple-800" },
  hired: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", border: "border-emerald-200 dark:border-emerald-800" },
  rejected: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", border: "border-red-200 dark:border-red-800" },
};

/* ─── Quick utils ─── */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-purple-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const SOURCE_BADGES: Record<string, { bg: string; text: string; icon: string }> = {
  "Career Site (Web)": { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", icon: "🌐" },
  "Direct Web": { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", icon: "🌐" },
  "LinkedIn Jobs": { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: "💼" },
  "LinkedIn": { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: "💼" },
  "Jobstreet Portal": { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", icon: "🔍" },
  "Jobstreet": { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", icon: "🔍" },
  "Internal Referral": { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: "🤝" },
  "Referral": { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: "🤝" },
  "Executive Headhunting": { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", icon: "🎯" },
  "Headhunting": { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", icon: "🎯" },
  "WhatsApp Apply": { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", icon: "💬" },
  "WhatsApp": { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", icon: "💬" },
  "Telegram Apply": { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", icon: "✈️" },
  "Instagram": { bg: "bg-pink-50 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", icon: "📸" },
  "Glints": { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", icon: "🚀" },
  "Kalibrr": { bg: "bg-teal-50 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", icon: "🎯" },
  "Campus Hiring": { bg: "bg-yellow-50 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", icon: "🎓" },
};

function getSourceBadge(src: string) {
  if (!src) return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", icon: "📌" };
  if (SOURCE_BADGES[src]) return SOURCE_BADGES[src];
  const lower = src.toLowerCase();
  if (lower.includes("whatsapp") || lower.includes("wa")) return { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", icon: "💬" };
  if (lower.includes("linkedin")) return { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: "💼" };
  if (lower.includes("jobstreet") || lower.includes("glints")) return { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", icon: "🔍" };
  if (lower.includes("referral") || lower.includes("rekomendasi")) return { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: "🤝" };
  if (lower.includes("headhunt") || lower.includes("exec")) return { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", icon: "🎯" };
  if (lower.includes("web") || lower.includes("site") || lower.includes("career")) return { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", icon: "🌐" };
  return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", icon: "📌" };
}

/* ─── Candidate Card ─── */

function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: CandidateRecord;
  onClick: () => void;
}) {
  const score = candidate.cvAnalysis?.overallScore;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-600"
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white", avatarColor(candidate.name))}>
          {initials(candidate.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{candidate.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{candidate.position}</p>
        </div>
        {score !== undefined && (
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" 
                className={cn("transition-all duration-1000 ease-out", 
                  score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500"
                )} 
                strokeWidth="3" 
                strokeDasharray="100" 
                strokeDashoffset={100 - score} 
                strokeLinecap="round" 
              />
            </svg>
            <span className={cn("text-[10px] font-bold", 
              score >= 80 ? "text-emerald-700 dark:text-emerald-400" : score >= 60 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
            )}>{score}</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate font-medium">{candidate.department || "—"}</span>
        <span className="shrink-0">{timeAgo(candidate.updatedAt)}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800/80">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-tight shadow-2xs", getSourceBadge(candidate.source).bg, getSourceBadge(candidate.source).text)}>
          <span>{getSourceBadge(candidate.source).icon}</span>
          <span className="truncate max-w-[130px]">{candidate.source || "Direct Web"}</span>
        </span>
        {candidate.interviewResults.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Icon className="h-3 w-3 text-amber-500"><SvgPath name="sparkles" /></Icon>
            <span>{candidate.interviewResults[0].avgRating.toFixed(1)}/5</span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── Column ─── */

function KanbanColumn({
  stage,
  candidates,
  onCardClick,
  onDrop,
}: {
  stage: PipelineStage;
  candidates: CandidateRecord[];
  onCardClick: (c: CandidateRecord) => void;
  onDrop: (candidateId: string, stage: PipelineStage) => void;
}) {
  const colors = STAGE_COLORS[stage];
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn("flex min-w-[280px] flex-col rounded-xl border transition-colors", colors.border, dragOver && "ring-2 ring-blue-400/50")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id, stage);
      }}
    >
      <div className={cn("flex items-center gap-2 rounded-t-xl px-4 py-3", colors.bg)}>
        <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
        <span className={cn("text-sm font-semibold", colors.text)}>{STAGE_LABELS[stage]}</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", colors.bg, colors.text)}>
          {candidates.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 300px)" }}>
        {candidates.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">No candidates</p>
        )}
        {candidates.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
          >
            <CandidateCard candidate={c} onClick={() => onCardClick(c)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Detail Panel ─── */

/* ─── Email compose modal (mailto, zero backend) ─── */

function EmailComposeModal({
  candidate, templateKey, onClose,
}: {
  candidate: CandidateRecord;
  templateKey: EmailTemplateKey;
  onClose: () => void;
}) {
  const composed = useMemo(() => composeEmail(templateKey, candidate), [templateKey, candidate]);
  const label = getTemplates()[templateKey].label;
  const [subject, setSubject] = useState(composed.subject);
  const [body, setBody] = useState(composed.body);
  const hasEmail = Boolean(candidate.email && candidate.email.trim());

  const openInMail = () => {
    if (!hasEmail) { toast("Kandidat ini belum punya alamat email.", "error"); return; }
    window.location.href = buildMailto(candidate.email, subject, body);
    addActivity({ action: "Email disiapkan:", target: `${candidate.name} — ${label}`, type: "create" });
    toast("Membuka aplikasi email…");
    onClose();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(`Kepada: ${candidate.email || "-"}\nSubjek: ${subject}\n\n${body}`);
      toast("Teks email disalin.");
    } catch { toast("Gagal menyalin.", "error"); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400"><SvgPath name="envelope" /></Icon>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{label}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <div>
            <Label htmlFor="em-to">Kepada</Label>
            <input id="em-to" className={cn(inputClass, !hasEmail && "border-red-400")} value={candidate.email || ""} readOnly placeholder="(belum ada email)" />
            {!hasEmail && <p className="mt-1 text-xs text-red-500">Tambah email kandidat dulu (tombol Edit) agar bisa kirim.</p>}
          </div>
          <div>
            <Label htmlFor="em-subject">Subjek</Label>
            <input id="em-subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="em-body">Isi email</Label>
            <textarea id="em-body" className={cn(inputClass, "min-h-[220px]")} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="text-xs text-slate-400">Edit bebas sebelum kirim. Nama perusahaan diatur di Settings.</p>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <Button variant="primary" onClick={openInMail} disabled={!hasEmail}>
            <Icon className="h-4 w-4"><SvgPath name="envelope" /></Icon> Buka di aplikasi email
          </Button>
          {candidate.phone && (
            <Button variant="secondary" onClick={() => {
              const text = encodeURIComponent(`Halo ${candidate.name},\n${body}`);
              window.open(`https://wa.me/${candidate.phone}?text=${text}`, '_blank');
              addActivity({ action: "WA disiapkan:", target: `${candidate.name} — ${label}`, type: "create" });
            }} className="text-emerald-600 dark:text-emerald-500 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
              Kirim via WA
            </Button>
          )}
          <Button variant="secondary" onClick={copyText}>Salin teks</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  candidate,
  reqs,
  onClose,
  onUpdate,
  onDelete,
  onMove,
}: {
  candidate: CandidateRecord;
  reqs: JobRequisition[];
  onClose: () => void;
  onUpdate: (c: CandidateRecord) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, stage: PipelineStage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(candidate);
  const [composeKey, setComposeKey] = useState<EmailTemplateKey | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  useEffect(() => { setForm(candidate); setEditing(false); setComposeKey(null); setActiveTab("overview"); }, [candidate]);

  const handleSave = () => {
    const updated = { ...form, updatedAt: new Date().toISOString() };
    saveCandidate(updated);
    onUpdate(updated);
    setEditing(false);
  };

  const stagesWithRejected: PipelineStage[] = [...PIPELINE_STAGES, "rejected"];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white", avatarColor(candidate.name))}>
          {initials(candidate.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{candidate.name}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-tight shadow-2xs border", getSourceBadge(candidate.source).bg, getSourceBadge(candidate.source).text, "border-current/10")}>
              <span>{getSourceBadge(candidate.source).icon}</span>
              <span className="truncate max-w-[120px]">{candidate.source || "Direct Web"}</span>
            </span>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{candidate.position} &middot; {candidate.department}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
          <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
        </button>
      </div>

      {/* Detail Modal Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn("border-b-2 py-2.5 px-3 transition-colors flex items-center gap-1.5", activeTab === "overview" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}
        >
          <Icon className="h-3.5 w-3.5"><SvgPath name="users" /></Icon>
          <span>Overview & Stage</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn("border-b-2 py-2.5 px-3 transition-colors flex items-center gap-1.5", activeTab === "history" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}
        >
          <Icon className="h-3.5 w-3.5"><SvgPath name="clock" /></Icon>
          <span>Activity Log & Origin</span>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px]">Source</span>
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {activeTab === "overview" ? (
          <>
            {/* Pipeline stage controls */}
        <div>
          <Label>Pipeline Stage</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {stagesWithRejected.map((s) => {
              const sc = STAGE_COLORS[s];
              const active = candidate.stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (active) return;
                    onMove(candidate.id, s);
                    // Nudge the matching email at key comms moments (only if we have an address)
                    if (candidate.email && s === "rejected") setComposeKey("reject");
                    else if (candidate.email && s === "offered") setComposeKey("offer");
                  }}
                  className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition-colors", active ? cn(sc.bg, sc.text, "ring-1", sc.border) : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}
                >
                  {STAGE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email actions */}
        <div>
          <Label>Kirim Email</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TEMPLATE_ORDER.map((k) => {
              const t = getTemplates()[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setComposeKey(k)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <Icon className="h-3.5 w-3.5"><SvgPath name="envelope" /></Icon>
                  {t.label}
                </button>
              );
            })}
          </div>
          {!candidate.email && (
            <p className="mt-1 text-xs text-slate-400">Kandidat belum punya email — tambahkan via Edit.</p>
          )}
        </div>

        {/* CV analysis summary */}
        {candidate.cvAnalysis && (
          <Card className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-blue-500"><SvgPath name="scan" /></Icon>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">CV Analysis</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{candidate.cvAnalysis.overallScore}</p>
                <p className="text-[10px] text-slate-500">Score</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{candidate.cvAnalysis.matchScore}%</p>
                <p className="text-[10px] text-slate-500">Match</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.round(candidate.cvAnalysis.confidence)}%</p>
                <p className="text-[10px] text-slate-500">Confidence</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{candidate.cvAnalysis.summary}</p>
            <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
              ["Strong Hire", "Hire", "Strongly Recommended", "Recommended"].includes(candidate.cvAnalysis.recommendation)
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                : ["Review", "Consider with Reservations"].includes(candidate.cvAnalysis.recommendation)
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  : candidate.cvAnalysis.recommendation === "Reject"
                    ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300"
            )}>
              {candidate.cvAnalysis.recommendation}
            </span>
          </Card>
        )}

        {/* Interview results */}
        {candidate.interviewResults.length > 0 && (
          <Card className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-amber-500"><SvgPath name="sparkles" /></Icon>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Interview Results</span>
            </div>
            {candidate.interviewResults.map((r) => (
              <div key={r.kitId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{r.recommendation}</p>
                  <p className="text-[11px] text-slate-500">{r.ratedCount}/{r.questionCount} questions &middot; {Math.floor(r.durationSec / 60)}m</p>
                </div>
                <span className={cn("text-lg font-bold tabular-nums",
                  r.avgRating >= 4 ? "text-emerald-600 dark:text-emerald-400"
                    : r.avgRating >= 3 ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                )}>
                  {r.avgRating.toFixed(1)}
                </span>
              </div>
            ))}
          </Card>
        )}

        {/* Editable fields */}
        {editing ? (
          <Card className="space-y-3">
            <Label htmlFor="edit-name">Name</Label>
            <input id="edit-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Label htmlFor="edit-email">Email</Label>
            <input id="edit-email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Label htmlFor="edit-phone">Phone</Label>
            <input id="edit-phone" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Label htmlFor="edit-position">Position</Label>
            <input id="edit-position" className={inputClass} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            <Label htmlFor="edit-department">Department</Label>
            <input id="edit-department" className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <Label htmlFor="edit-source">Source</Label>
            <input id="edit-source" className={inputClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <Label htmlFor="edit-req">Job Requisition</Label>
            <select id="edit-req" className={inputClass} value={form.jobReqId} onChange={(e) => setForm({ ...form, jobReqId: e.target.value })}>
              <option value="">None</option>
              {reqs.map((r) => <option key={r.id} value={r.id}>{r.title} ({r.department})</option>)}
            </select>
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea id="edit-notes" className={cn(inputClass, "min-h-[80px]")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button variant="primary" onClick={handleSave}>Save</Button>
              <Button onClick={() => { setForm(candidate); setEditing(false); }}>Cancel</Button>
            </div>
          </Card>
        ) : (
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Details</span>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Icon className="h-3.5 w-3.5"><SvgPath name="pencil" /></Icon> Edit
              </Button>
            </div>
            {[
              ["Email", candidate.email],
              ["Phone", candidate.phone],
              ["Source", candidate.source],
              ["Created", new Date(candidate.createdAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="font-medium text-slate-900 dark:text-white">{value || "—"}</span>
              </div>
            ))}
            {candidate.notes && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {candidate.notes}
              </div>
            )}
          </Card>
        )}
          </>
        ) : (
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Sourcing Channel Attribution Box */}
            <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800 dark:to-blue-950/20 border-blue-200/60 dark:border-blue-800/40">
              <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400"><SvgPath name="sparkles" /></Icon>
                  <span>Sourcing Channel Attribution</span>
                </span>
                {candidate.source ? (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">Tercatat via UTM</span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Sumber tidak tercatat</span>
                )}
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm ring-1 ring-inset", getSourceBadge(candidate.source).bg, getSourceBadge(candidate.source).text, "ring-blue-200/50 dark:ring-blue-700/30")}>
                  <span className="text-lg">{getSourceBadge(candidate.source).icon}</span>
                  <span>{candidate.source || "Manual Entry"}</span>
                </span>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                  <p>Date Entered: <strong>{new Date(candidate.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong></p>
                </div>
              </div>
            </Card>

            {/* Audit Trail / Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5"><SvgPath name="clock" /></Icon>
                <span>Recruitment Audit Trail & Activity Log</span>
              </h4>
              <div className="relative border-l-2 border-blue-200 dark:border-blue-800 ml-2.5 space-y-5 pl-4 pt-1 pb-2">
                <div className="relative">
                  <span className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{candidate.source ? `Melamar melalui Jalur ${candidate.source}` : "Masuk ke pipeline rekrutmen"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{new Date(candidate.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} — Kandidat tercatat untuk posisi {candidate.position} di database ATS.</p>
                </div>
                {candidate.cvAnalysis && (
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-purple-500 ring-4 ring-white dark:ring-slate-900" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Disaring otomatis oleh AI CV Analyzer</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Match Score: <strong className="text-purple-600 dark:text-purple-400 font-semibold">{candidate.cvAnalysis.matchScore}%</strong> • Rekomendasi AI: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{candidate.cvAnalysis.recommendation}</strong></p>
                  </div>
                )}
                {candidate.interviewResults.length > 0 && (
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-slate-900" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Wawancara Terstruktur (Interview Workspace)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Skor Wawancara: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{candidate.interviewResults[0].avgRating.toFixed(1)} / 5.0</strong> ({candidate.interviewResults[0].recommendation})</p>
                  </div>
                )}
                <div className="relative">
                  <span className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Status Tahapan Saat Ini: {STAGE_LABELS[candidate.stage]}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Terakhir diperbarui: {timeAgo(candidate.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
        <Button variant="ghost" size="sm" onClick={() => {
          window.open(`/interview?candidate=${candidate.id}`, "_self");
        }}>
          <Icon className="h-4 w-4"><SvgPath name="workspace" /></Icon> Interview
        </Button>
        <Button variant="ghost" size="sm" onClick={() => {
          window.open(`/cv-analyzer?candidate=${candidate.id}`, "_self");
        }}>
          <Icon className="h-4 w-4"><SvgPath name="scan" /></Icon> Analyze CV
        </Button>
        <div className="flex-1" />
        <Button variant="danger" size="sm" onClick={() => {
          if (confirm(`Delete ${candidate.name}?`)) onDelete(candidate.id);
        }}>
          <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
        </Button>
        {candidate.stage !== "hired" && (
          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
            if (confirm(`Save ${candidate.name} to Talent Pool?`)) {
              convertCandidateToTalent(candidate.id);
              toast(`${candidate.name} saved to Talent Pool`, "success");
            }
          }}>
            <Icon className="h-4 w-4"><SvgPath name="briefcase" /></Icon> Save to Pool
          </Button>
        )}
      </div>

      {composeKey && (
        <EmailComposeModal candidate={candidate} templateKey={composeKey} onClose={() => setComposeKey(null)} />
      )}
    </div>
  );
}

/* ─── Add Candidate Modal ─── */

function AddCandidateModal({
  reqs,
  onClose,
  onAdd,
}: {
  reqs: JobRequisition[];
  onClose: () => void;
  onAdd: (c: CandidateRecord) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "", department: "", source: "Manual", jobReqId: "" });

  const emailValid = form.email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = form.name.trim() !== "" && form.position.trim() !== "" && emailValid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const c = createCandidate(form);
    onAdd(c);
    toast(`${c.name} added to pipeline`);
  };

  const handleReqChange = (reqId: string) => {
    const req = reqs.find((r) => r.id === reqId);
    setForm({
      ...form,
      jobReqId: reqId,
      position: req ? req.title : form.position,
      department: req ? req.department : form.department,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Candidate</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="add-req">Link to Job Requisition</Label>
            <select id="add-req" className={inputClass} value={form.jobReqId} onChange={(e) => handleReqChange(e.target.value)}>
              <option value="">None</option>
              {reqs.filter((r) => r.status === "active").map((r) => <option key={r.id} value={r.id}>{r.title} ({r.department})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-name">Full Name *</Label>
              <input id="add-name" className={inputClass} placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <input id="add-email" type="email" className={cn(inputClass, !emailValid && "border-red-400 focus:border-red-500 focus:ring-red-500/25")} placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {!emailValid && <p className="mt-1 text-xs text-red-500">Invalid email format</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-position">Position *</Label>
              <input id="add-position" className={inputClass} placeholder="Software Engineer" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="add-dept">Department</Label>
              <input id="add-dept" className={inputClass} placeholder="Engineering" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="add-phone">Phone</Label>
              <input id="add-phone" className={inputClass} placeholder="+62..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="add-source">Source</Label>
              <select id="add-source" className={inputClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {["Manual", "LinkedIn", "Referral", "Job Board", "Career Site", "Agency", "CV Analyzer"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon> Add Candidate
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── CSV Import ─── */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = idx(["name", "nama", "full name", "candidate"]);
  const iEmail = idx(["email", "e-mail"]);
  const iPhone = idx(["phone", "telepon", "hp", "telp", "mobile"]);
  const iPos = idx(["position", "posisi", "role", "job", "jabatan"]);
  const iDept = idx(["department", "departemen", "dept", "divisi"]);
  const iSrc = idx(["source", "sumber"]);
  const hasHeader = iName !== -1 || iPos !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const get = (cols: string[], i: number) => (i >= 0 && i < cols.length ? cols[i] : "");
  return dataLines.map((line) => {
    const cols = splitCsvLine(line);
    if (hasHeader) {
      return {
        name: get(cols, iName), email: get(cols, iEmail), phone: get(cols, iPhone),
        position: get(cols, iPos), department: get(cols, iDept), source: get(cols, iSrc),
      };
    }
    return { name: cols[0] ?? "", email: cols[1] ?? "", phone: cols[2] ?? "", position: cols[3] ?? "", department: cols[4] ?? "", source: cols[5] ?? "" };
  });
}

const CSV_TEMPLATE = "name,email,phone,position,department,source\nJohn Doe,john@example.com,+62812000111,Software Engineer,Engineering,LinkedIn\nJane Smith,jane@example.com,+62813000222,Product Manager,Product,Referral";

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportCsvModal({ onClose, onImported }: { onClose: () => void; onImported: (n: number) => void }) {
  const [raw, setRaw] = useState("");
  const rows = useMemo(() => parseCsv(raw), [raw]);
  const valid = useMemo(() => rows.filter((r) => r.name?.trim() && r.position?.trim()), [rows]);
  const invalid = rows.length - valid.length;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 py-10 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import Candidates from CSV</h2>
            <p className="mt-0.5 text-sm text-slate-500">Upload a .csv file or paste rows below. Columns: name, email, phone, position, department, source.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon className="h-4 w-4"><SvgPath name="upload" /></Icon>
            Choose .csv file
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          </label>
          <button type="button" onClick={() => triggerDownload(CSV_TEMPLATE, "candidates-template.csv")} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            Download template
          </button>
        </div>

        <div className="mt-3">
          <Label htmlFor="csv-paste">Or paste CSV</Label>
          <textarea
            id="csv-paste"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={CSV_TEMPLATE}
            className={cn(inputClass, "min-h-[120px] font-mono text-xs")}
          />
        </div>

        {rows.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
              <span className="font-medium text-slate-700 dark:text-slate-300">Preview</span>
              <span className="text-slate-500">
                {valid.length} valid{invalid > 0 ? ` · ${invalid} skipped (missing name/position)` : ""}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                  <tr className="text-slate-500">
                    <th className="px-3 py-1.5 font-medium">Name</th>
                    <th className="px-3 py-1.5 font-medium">Position</th>
                    <th className="px-3 py-1.5 font-medium">Department</th>
                    <th className="px-3 py-1.5 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.slice(0, 50).map((r, i) => {
                    const ok = r.name?.trim() && r.position?.trim();
                    return (
                      <tr key={i} className={cn(!ok && "opacity-40")}>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{r.name || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{r.position || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.department || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.email || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onImported(importCandidates(valid))} disabled={valid.length === 0}>
            <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
            Import {valid.length > 0 ? valid.length : ""} candidate{valid.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Career Portal & Shareable UTM Link Builder Modal ─── */

function CareerPortalModal({
  reqs,
  candidates,
  onClose,
  onSimulate,
}: {
  reqs: JobRequisition[];
  candidates: CandidateRecord[];
  onClose: () => void;
  onSimulate?: (req: JobRequisition, src: string) => void;
}) {
  const [selectedSource, setSelectedSource] = useState("WhatsApp Apply");
  const [copiedReqId, setCopiedReqId] = useState<string | null>(null);

  const activeReqs = reqs.filter((r) => r.status === "active");

  const channels = [
    { label: "💬 WhatsApp Apply", value: "WhatsApp Apply" },
    { label: "💼 LinkedIn Jobs", value: "LinkedIn Jobs" },
    { label: "🤝 Internal Referral", value: "Internal Referral" },
    { label: "🌐 Direct Web / QR", value: "Direct Web" },
    { label: "🎯 Headhunting", value: "Executive Headhunting" },
    { label: "🔍 Jobstreet Portal", value: "Jobstreet Portal" },
  ];

  const handleCopy = (reqId: string) => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000";
    const url = `${origin}/apply/${reqId}?src=${encodeURIComponent(selectedSource)}`;
    navigator.clipboard.writeText(url);
    setCopiedReqId(reqId);
    toast(`Tautan tracking [${selectedSource}] berhasil disalin!`, "success");
    setTimeout(() => setCopiedReqId(null), 3000);
  };

  const handlePreview = (reqId: string) => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000";
    window.open(`${origin}/apply/${reqId}?src=${encodeURIComponent(selectedSource)}`, "_blank");
  };

  const handleOpenAll = () => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000";
    window.open(`${origin}/apply`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-bold tracking-wider text-white">HRBP PORTAL</span>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">UTM Origin Tracking</span>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">📢 Portal Karir & Shareable Link Tracking</h2>
            <p className="text-xs text-blue-100">
              Lihat posisi aktif ("mana yang lagi buka"), pilih saluran sebar link (WhatsApp, LinkedIn, dll), dan pantau lamaran masuk secara otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Top banner: open public portal */}
          <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 sm:flex-row sm:items-center dark:border-blue-900/40 dark:from-blue-950/30 dark:to-indigo-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-md shadow-blue-500/20">
                🌐
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Portal Karir Publik (/apply)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Halaman publik tempat pelamar melihat seluruh lowongan aktif. Anda dapat membagikan link portal ini atau link spesifik per lowongan di bawah.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAll}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <span>Lihat Portal Publik</span>
              <span aria-hidden>↗</span>
            </button>
          </div>

          {/* Channel Selector */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Pilih Kanal Penyebaran Link (UTM Origin Target):
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {channels.map((ch) => {
                const active = selectedSource === ch.value;
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setSelectedSource(ch.value)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all",
                      active
                        ? "border-blue-600 bg-white ring-2 ring-blue-600/20 shadow-sm dark:border-blue-500 dark:bg-slate-800"
                        : "border-slate-200 bg-white/60 hover:bg-white dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{ch.label}</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">{ch.value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of active requisitions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                2. Daftar Lowongan Aktif ("Mana Yang Lagi Buka") & Link Generator
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {activeReqs.length} Posisi Aktif
              </span>
            </div>

            {activeReqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                Tidak ada lowongan berstatus aktif saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {activeReqs.map((req) => {
                  const reqCandidates = candidates.filter((c) => c.jobReqId === req.id || (c.position && c.position.toLowerCase() === req.title.toLowerCase()));
                  const isCopied = copiedReqId === req.id;
                  const isSpecial = req.id.includes("SPE");

                  return (
                    <div
                      key={req.id}
                      className={cn(
                        "flex flex-col justify-between rounded-xl border p-4 transition-all hover:shadow-md",
                        isSpecial
                          ? "border-amber-300 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 dark:border-amber-700/50 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/10"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              {isSpecial && (
                                <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                  Program Khusus
                                </span>
                              )}
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {req.department}
                              </span>
                            </div>
                            <h4 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{req.title}</h4>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            {reqCandidates.length} Pelamar
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {req.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>📍 {req.location}</span>
                          <span>•</span>
                          <span>⏳ Deadline: {req.targetDate ? new Date(req.targetDate).toLocaleDateString("id-ID") : "—"}</span>
                          <span>•</span>
                          <span>👤 {req.hiringManager}</span>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div className="mb-2 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-500">Link untuk: <strong className="text-blue-600 dark:text-blue-400">{selectedSource}</strong></span>
                          <span className="text-slate-400 font-mono text-[10px]">?src={selectedSource}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(req.id)}
                            className={cn(
                              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all shadow-sm",
                              isCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            )}
                          >
                            <span>{isCopied ? "✔ Tersalin!" : "📋 Salin Link Tracking"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreview(req.id)}
                            title="Buka dan tes form lamaran di tab baru"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <span>🚀 Tes Form</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onSimulate) {
                                onSimulate(req, selectedSource);
                                onClose();
                              } else {
                                toast(`⚡ Simulasi dari ${selectedSource} diproses...`, "info");
                              }
                            }}
                            title="Simulasi pelamar baru masuk otomatis dari kanal ini"
                            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                          >
                            <span>⚡ Simulasi Masuk</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            💡 <strong className="text-slate-700 dark:text-slate-300">Tips HRBP:</strong> Setiap kali Anda membagikan link ke grup WhatsApp atau LinkedIn, gunakan parameter kanal di atas agar laporan ROI rekrutmen di analitik akurat.
          </p>
          <Button onClick={onClose} variant="secondary">Tutup</Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function CandidatesPage() {
  const [allCandidates, setAllCandidates] = useState<CandidateRecord[]>([]);
  const [reqs, setReqs] = useState<JobRequisition[]>([]);
  const [talentPool, setTalentPool] = useState<TalentProfile[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<"pipeline" | "portal" | "archive">("pipeline");
  const [portalSource, setPortalSource] = useState("WhatsApp Apply");
  const [selected, setSelected] = useState<CandidateRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [showImport, setShowImport] = useState(false);

  const reload = useCallback(() => {
    setAllCandidates(getCandidates());
    setReqs(getJobReqs());
    setTalentPool(getTalentPool());
  }, []);

  useEffect(() => {
    reload();
    const handleComp = () => reload();
    window.addEventListener("pi-company-change", handleComp);
    return () => window.removeEventListener("pi-company-change", handleComp);
  }, [reload]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dept = params.get("dept");
    if (dept) setFilterDept(dept);
  }, []);

  const departments = useMemo(() => {
    const s = new Set(allCandidates.map((c) => c.department).filter(Boolean));
    return Array.from(s).sort();
  }, [allCandidates]);

  const sources = useMemo(() => {
    const s = new Set(allCandidates.map((c) => c.source).filter(Boolean));
    return Array.from(s).sort();
  }, [allCandidates]);

  const filtered = useMemo(() => {
    let list = allCandidates;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    if (filterDept) list = list.filter((c) => c.department === filterDept);
    if (filterSource) list = list.filter((c) => c.source === filterSource);
    return list;
  }, [allCandidates, search, filterDept, filterSource]);

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, CandidateRecord[]> = {
      applied: [], screened: [], work_sample: [], interviewed: [], offered: [], hired: [], rejected: [],
    };
    for (const c of filtered) map[c.stage].push(c);
    return map;
  }, [filtered]);

  const handleMove = useCallback((id: string, stage: PipelineStage) => {
    moveCandidateStage(id, stage);
    reload();
    if (selected?.id === id) setSelected(getCandidates().find((c) => c.id === id) ?? null);
    toast(`Moved to ${STAGE_LABELS[stage]}`, "info");
  }, [reload, selected]);

  const handleDelete = useCallback((id: string) => {
    const name = getCandidates().find((c) => c.id === id)?.name ?? "Candidate";
    deleteCandidate(id);
    if (selected?.id === id) setSelected(null);
    reload();
    toast(`${name} deleted`, "info");
  }, [reload, selected]);

  const handleImported = useCallback((n: number) => {
    setShowImport(false);
    reload();
    toast(n > 0 ? `Imported ${n} candidate${n === 1 ? "" : "s"}` : "No valid rows to import", n > 0 ? "success" : "error");
  }, [reload]);

  const handleExportCsv = useCallback(() => {
    if (allCandidates.length === 0) { toast("No candidates to export", "error"); return; }
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["name", "email", "phone", "position", "department", "source", "stage", "cvScore", "recommendation"];
    const lines = [header.join(",")];
    for (const c of allCandidates) {
      lines.push([
        c.name, c.email, c.phone, c.position, c.department, c.source,
        STAGE_LABELS[c.stage], c.cvAnalysis?.overallScore ?? "", c.cvAnalysis?.recommendation ?? "",
      ].map(esc).join(","));
    }
    triggerDownload(lines.join("\n"), `candidates-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${allCandidates.length} candidates to CSV`);
  }, [allCandidates]);

  const simulateNewApplication = useCallback((req: JobRequisition, src?: string) => {
    const targetSource = src || portalSource || "WhatsApp Apply";
    const names = [
      "Rizky Ramadhan", "Annisa Putri", "Farhan Maulana", "Fauzan Akbar",
      "Nadia Saphira", "Bagas Pratama", "Jessica Tan", "Bayu Saputra",
      "Citra Kirana", "Dian Sastrowardoyo", "Muhammad Iqbal", "Sarah Wijaya"
    ];
    const name = names[Math.floor(Math.random() * names.length)];
    const id = `C-SIM-${Date.now().toString().slice(-4)}`;
    const score = Math.floor(Math.random() * 18) + 78;
    const newCand: CandidateRecord = {
      id, name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.id`,
      phone: `081${Math.floor(Math.random() * 900000000) + 100000000}`,
      stage: "applied",
      jobReqId: req.id,
      department: req.department,
      position: req.title,
      source: targetSource,
      notes: `Simulasi lamaran masuk dari jalur ${targetSource}`,
      cvAnalysis: {
        reportId: `RPT-SIM-${id}`, overallScore: score, matchScore: score - 2, confidence: 92,
        recommendation: score >= 85 ? "Strong Hire" : "Hire",
        summary: `Pelamar dengan latar belakang yang relevan untuk posisi ${req.title}. Melamar via ${targetSource}.`,
        frameworkLabel: "Simulasi Demo (bukan analisis AI)", analyzedAt: new Date().toISOString(),
        criteriaBreakdown: [
          { name: "Technical Fit", score: score, weight: 60, evidence: "Pengalaman 4+ tahun sesuai spesifikasi." },
          { name: "Culture & Leadership", score: score - 4, weight: 40, evidence: "Skor tes kepribadian positif." }
        ],
        strengths: ["Kualifikasi cocok", "Melamar dari jalur prioritas"], gaps: ["Perlu wawancara teknis lanjutan"],
        riskAssessment: { level: "Low", factors: ["Tidak ada red flag"] }
      },
      interviewResults: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    saveCandidate(newCand);
    addActivity({ action: `Lamaran Baru (${targetSource})`, target: `${name} — ${req.title}`, type: "candidate" });
    reload();
    toast(`⚡ Simulasi berhasil: ${name} melamar posisi ${req.title} via ${targetSource}!`, "success");
    setActiveMainTab("pipeline");
  }, [portalSource, reload]);

  const handleReactivateCandidate = useCallback((cand: CandidateRecord) => {
    moveCandidateStage(cand.id, "screened");
    addActivity({ action: "Re-activated candidate from Archive", target: `${cand.name} (${cand.position})`, type: "candidate" });
    reload();
    toast(`🔄 ${cand.name} berhasil diaktifkan kembali ke tahap Screened!`, "success");
    setActiveMainTab("pipeline");
  }, [reload]);

  const handleInviteTalent = useCallback((talent: TalentProfile) => {
    const activeReqs = reqs.filter(r => r.status === "active");
    const targetReq = activeReqs[0] || reqs[0];
    if (!targetReq) {
      toast("Tidak ada lowongan aktif untuk mengundang talent ini.", "error");
      return;
    }
    const id = `C-TAL-${Date.now().toString().slice(-4)}`;
    const score = Math.min(98, Math.floor(talent.rating * 18) + 5);
    const newCand: CandidateRecord = {
      id, name: talent.name, email: `${talent.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@talent.id`,
      phone: talent.phone, stage: "screened", jobReqId: targetReq.id, department: targetReq.department,
      position: targetReq.title, source: `Talent Bank (${talent.source})`,
      notes: `Diundang dari Talent Pool: ${talent.skills.join(", ")}`,
      cvAnalysis: {
        reportId: `RPT-TAL-${id}`, overallScore: score, matchScore: score - 2, confidence: 95,
        recommendation: "Strong Hire", summary: `Kandidat terverifikasi dari Talent Bank (${talent.category}). Keahlian: ${talent.skills.join(", ")}.`,
        frameworkLabel: "Talent Pool Verified", analyzedAt: new Date().toISOString(),
        criteriaBreakdown: [{ name: "Skill Match", score: score, weight: 100, evidence: talent.skills.join(", ") }],
        strengths: talent.skills, gaps: ["Belum interview teknis terbaru"],
        riskAssessment: { level: "Low", factors: ["Talent terverifikasi internal"] }
      },
      interviewResults: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    saveCandidate(newCand);
    addActivity({ action: "Invited from Talent Bank", target: `${talent.name} -> ${targetReq.title}`, type: "candidate" });
    reload();
    toast(`➕ ${talent.name} berhasil diundang dan masuk ke Pipeline Aktif!`, "success");
    setActiveMainTab("pipeline");
  }, [reqs, reload]);

  const totalActive = allCandidates.filter((c) => c.stage !== "hired" && c.stage !== "rejected").length;

  const stagesToShow: PipelineStage[] = showRejected ? [...PIPELINE_STAGES, "rejected"] : PIPELINE_STAGES;

  return (
    <AppShell activeNavId="candidates" title="Candidates" subtitle={`${allCandidates.length} total · ${totalActive} active in pipeline`}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setActiveMainTab("portal")} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <span aria-hidden>📢</span>
            <span className="hidden sm:inline font-semibold">Portal Karir & Link Tracking</span>
          </Button>
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Icon className="h-4 w-4"><SvgPath name="upload" /></Icon>
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="secondary" onClick={handleExportCsv}>
            <Icon className="h-4 w-4"><SvgPath name="download" /></Icon>
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
            <span className="hidden sm:inline">Add Candidate</span>
          </Button>
        </div>
      }>

      {/* CRM Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Icon className="h-6 w-6"><SvgPath name="users" /></Icon>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Candidates</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalActive}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <Icon className="h-6 w-6"><SvgPath name="calendar" /></Icon>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">In Interview Stage</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{allCandidates.filter(c => c.stage === 'interviewed').length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Icon className="h-6 w-6"><SvgPath name="check" /></Icon>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Offered / Hired</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{allCandidates.filter(c => c.stage === 'offered' || c.stage === 'hired').length}</p>
          </div>
        </div>
      </div>

      {/* 3-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center border-b border-slate-200 dark:border-slate-800 mb-6 bg-slate-50/70 dark:bg-slate-800/40 rounded-t-xl px-4 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveMainTab("pipeline")}
          className={cn("border-b-2 py-3 px-4 transition-all flex items-center gap-2", activeMainTab === "pipeline" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold bg-white/50 dark:bg-slate-800/60" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}
        >
          <span>📋 Pipeline Rekrutmen Aktif</span>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">{totalActive}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("portal")}
          className={cn("border-b-2 py-3 px-4 transition-all flex items-center gap-2", activeMainTab === "portal" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold bg-white/50 dark:bg-slate-800/60" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}
        >
          <span>📢 Portal Karir & UTM Links</span>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">Live</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("archive")}
          className={cn("border-b-2 py-3 px-4 transition-all flex items-center gap-2", activeMainTab === "archive" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold bg-white/50 dark:bg-slate-800/60" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}
        >
          <span>🗄️ Arsip ATS & Bank Talent</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
            {allCandidates.filter(c => c.stage === "rejected" || c.stage === "hired").length + talentPool.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pipeline Rekrutmen Aktif */}
      {activeMainTab === "pipeline" && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"><SvgPath name="search" /></Icon>
              <input className={cn(inputClass, "pl-9")} placeholder="Search candidates..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className={cn(inputClass, "w-auto min-w-[150px]")} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={cn(inputClass, "w-auto min-w-[140px]")} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600" />
              Rejected
            </label>
            <div className="ml-auto flex rounded-lg border border-slate-200 dark:border-slate-700">
              {(["kanban", "table"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg",
                    viewMode === m ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800")}
                >
                  {m === "kanban" ? "Kanban" : "Table"}
                </button>
              ))}
            </div>
          </div>

          {/* Kanban View */}
          {viewMode === "kanban" ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stagesToShow.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  candidates={byStage[stage]}
                  onCardClick={setSelected}
                  onDrop={handleMove}
                />
              ))}
            </div>
          ) : (
            /* Table View */
            <Card padding={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      {["Name", "Position", "Department", "Source", "Stage", "Score", "Updated"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.filter((c) => showRejected || c.stage !== "rejected").map((c) => {
                      const sc = STAGE_COLORS[c.stage];
                      return (
                        <tr key={c.id} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelected(c)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white", avatarColor(c.name))}>
                                {initials(c.name)}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                                <p className="text-xs text-slate-500">{c.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.position}</td>
                          <td className="px-4 py-3 text-slate-500">{c.department || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-2xs", getSourceBadge(c.source).bg, getSourceBadge(c.source).text)}>
                              <span>{getSourceBadge(c.source).icon}</span>
                              <span>{c.source || "Direct Web"}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", sc.bg, sc.text)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                              {STAGE_LABELS[c.stage]}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{c.cvAnalysis?.overallScore ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{timeAgo(c.updatedAt)}</td>
                        </tr>
                      );
                    })}
                    {filtered.filter((c) => showRejected || c.stage !== "rejected").length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                          No candidates found. <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowAdd(true)}>Add one</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Portal Karir & UTM Shareable Links */}
      {activeMainTab === "portal" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white">PORTAL REKRUTMEN</span>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">UTM Origin Tracking Live</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">📢 Generator Link Lamaran & Pelacak Saluran (Sourcing Tracker)</h2>
            <p className="mt-1 max-w-3xl text-sm text-blue-100">
              Setiap link yang Anda sebarkan (misal melalui WhatsApp, LinkedIn, atau Referral Kampus) dibekali parameter UTM khusus. Ketika kandidat melamar melalui link tersebut, sistem secara otomatis melabeli sumber lamaran di kartu ATS.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              1. Pilih Saluran Target Penyebaran Link (UTM Channel):
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {[
                { label: "💬 WhatsApp Apply", value: "WhatsApp Apply", desc: "Share grup / chat WA" },
                { label: "💼 LinkedIn Jobs", value: "LinkedIn Jobs", desc: "Posting di LinkedIn" },
                { label: "🔍 Jobstreet Portal", value: "Jobstreet Portal", desc: "Daftar di Jobstreet" },
                { label: "🤝 Internal Referral", value: "Internal Referral", desc: "Rekomendasi Karyawan" },
                { label: "🎯 Headhunting", value: "Executive Headhunting", desc: "Pencarian Eksekutif" },
                { label: "🌐 Direct Web / QR", value: "Direct Web", desc: "Website Resmi / Flyer" },
              ].map((ch) => {
                const active = portalSource === ch.value;
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setPortalSource(ch.value)}
                    className={cn(
                      "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/30 shadow-sm dark:border-blue-500 dark:bg-blue-950/30"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{ch.label}</span>
                    <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{ch.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
              2. Daftar Lowongan Aktif — Salin Link & Simulasi Lamaran ({portalSource}):
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reqs.filter(r => r.status === "active").map((req) => {
                const origin = typeof window !== "undefined" ? window.location.origin : "https://app.valora.tv";
                const utmUrl = `${origin}/apply?req=${req.id}&utm_source=${encodeURIComponent(portalSource)}`;
                const waText = encodeURIComponent(`Dibutuhkan segera: *${req.title}* di ${req.location}!\nDaftar langsung di sini: ${utmUrl}`);
                return (
                  <div key={req.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/50">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {req.department}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Target: {req.headcount} pax
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{req.title}</h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{req.description}</p>
                      
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 truncate">
                        {utmUrl}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard?.writeText(utmUrl);
                          toast(`📋 Link dengan tag [${portalSource}] berhasil disalin!`, "success");
                        }}
                      >
                        <span aria-hidden>📋</span> Salin Link
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          window.open(`https://wa.me/?text=${waText}`, "_blank");
                        }}
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                      >
                        📲 Share WA
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => simulateNewApplication(req)}
                        className="ml-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold"
                      >
                        ⚡ Simulasi Masuk
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Arsip ATS & Talent Bank */}
      {activeMainTab === "archive" && (
        <div className="space-y-8">
          {/* Section 1: Arsip Lamaran Masa Lalu */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🗄️ Arsip Lamaran Masa Lalu (Rejected / Hired)</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    {allCandidates.filter(c => c.stage === "rejected" || c.stage === "hired").length} arsip
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kandidat yang sebelumnya ditolak (rejected) atau sudah direkrut (hired). Anda dapat mengaktifkan kembali (re-activate) ke tahap awal pipeline.
                </p>
              </div>
            </div>

            {allCandidates.filter(c => c.stage === "rejected" || c.stage === "hired").length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl dark:border-slate-800">
                <p className="text-sm text-slate-500">Belum ada kandidat di dalam arsip penolakan / penerimaan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCandidates.filter(c => c.stage === "rejected" || c.stage === "hired").map((cand) => (
                  <div key={cand.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", cand.stage === "hired" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300")}>
                          {cand.stage === "hired" ? "✅ Hired" : "❌ Rejected"}
                        </span>
                        <span className="text-xs font-bold text-slate-500">Skor CV: {cand.cvAnalysis?.overallScore || "—"}</span>
                      </div>
                      <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{cand.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cand.position} &middot; {cand.department}</p>
                      
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold", getSourceBadge(cand.source).bg, getSourceBadge(cand.source).text)}>
                          <span>{getSourceBadge(cand.source).icon}</span>
                          <span>{cand.source || "Direct Web"}</span>
                        </span>
                      </div>
                      {cand.notes && <p className="mt-2 text-xs italic text-slate-500 line-clamp-2">"{cand.notes}"</p>}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleReactivateCandidate(cand)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        🔄 Re-activate ke Screened
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Bank Talent */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💡 Bank Talent Internal & Pipa Eksternal (Talent Pool Database)</span>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-xs text-blue-700 dark:text-blue-300 font-semibold">
                    {talentPool.length} talenta
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Database talenta terverifikasi dari berbagai kanal rekrutmen masa lalu yang siap diundang sewaktu-waktu jika ada lowongan baru yang sesuai.
                </p>
              </div>
            </div>

            {talentPool.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl dark:border-slate-800">
                <p className="text-sm text-slate-500">Belum ada profil di dalam Talent Pool perusahaan ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {talentPool.map((t) => (
                  <div key={t.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {t.category}
                        </span>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⭐ {t.rating.toFixed(1)}/5</span>
                      </div>
                      <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{t.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">📍 {t.location}</p>
                      
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {t.skills.map(sk => (
                          <span key={sk} className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {sk}
                          </span>
                        ))}
                      </div>
                      
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold", getSourceBadge(t.source).bg, getSourceBadge(t.source).text)}>
                          <span>{getSourceBadge(t.source).icon}</span>
                          <span>{t.source}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleInviteTalent(t)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        ➕ Undang ke Pipeline Aktif
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Side Panel */}
      {selected && (
        <DetailPanel
          candidate={selected}
          reqs={reqs}
          onClose={() => setSelected(null)}
          onUpdate={(c) => { setSelected(c); reload(); }}
          onDelete={handleDelete}
          onMove={handleMove}
        />
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddCandidateModal
          reqs={reqs}
          onClose={() => setShowAdd(false)}
          onAdd={(c) => { setShowAdd(false); reload(); setSelected(c); }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportCsvModal onClose={() => setShowImport(false)} onImported={handleImported} />
      )}

      {/* Career Portal & UTM Link Builder Modal */}
      {showPortal && (
        <CareerPortalModal
          reqs={reqs}
          candidates={allCandidates}
          onClose={() => setShowPortal(false)}
          onSimulate={simulateNewApplication}
        />
      )}
    </AppShell>
  );
}
