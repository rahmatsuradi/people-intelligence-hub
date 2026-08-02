"use client";

import { AppShell, Card, Button, Label, Icon, SvgPath, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getJobReqs } from "@/lib/store";
import {
  type BrandingIdeasResult,
  type ContentIdea,
  type ContentPillar,
  type Platform,
  type ContentFormat,
  type EditorialWeek,
  type EditorialPost,
  PILLAR_LABELS,
  PLATFORM_LABELS,
  FORMAT_LABELS,
  CAMPAIGN_GOALS,
  INDUSTRIES,
  EMPLOYEE_COUNTS,
  TARGET_AUDIENCES,
  VIRALITY_PRINCIPLES,
  VIRALITY_SOURCES,
} from "@/lib/employer-branding-ai";
import {
  getSavedIdeas,
  saveIdea,
  deleteIdea,
  updateIdeaStatus,
  getEbHistory,
  addEbHistory,
  deleteEbHistory,
  type SavedContentIdea,
  type EbHistoryItem,
} from "@/lib/employer-branding-store";
import { addCalendarEntry, type NewCalendarEntry } from "@/lib/content-calendar-store";
import CalendarEntryModal from "./editorial/calendar-entry-modal";
import { getActiveCompanyProfile } from "@/lib/payroll/company-profile";
import { useCallback, useState, type ChangeEvent } from "react";

// Maps the active tenant's industry to this form's dropdown label, so the
// company already selected in the header doesn't have to be re-typed here.
// Still fully editable — this only sets the default, e.g. for one-off
// research on a company other than the active tenant.
const TENANT_INDUSTRY_LABEL: Record<string, string> = {
  broadcast: "Media & Penyiaran",
  garment: "Garmen & Tekstil",
};

/* ─── Platform badge colors ─── */

const PLATFORM_BADGE: Record<Platform, { label: string; className: string }> = {
  linkedin: { label: "LinkedIn", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
  instagram: { label: "Instagram", className: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300" },
  tiktok: { label: "TikTok", className: "bg-slate-200 text-slate-800 dark:bg-slate-600/30 dark:text-slate-300" },
  "career-page": { label: "Career Page", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  twitter: { label: "Twitter/X", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  youtube: { label: "YouTube", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
};

const ENGAGEMENT_BADGE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

const PILLAR_BADGE_COLORS: Record<ContentPillar, string> = {
  culture: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "career-growth": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  benefits: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "behind-the-scenes": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "employee-stories": "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  achievements: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  csr: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  leadership: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
};

const STATUS_OPTIONS: { value: SavedContentIdea["status"]; label: string; color: string }[] = [
  { value: "saved", label: "Tersimpan", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
  { value: "in-progress", label: "In Progress", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  { value: "published", label: "Published", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
];

/* ─── Main Page ─── */

export default function EmployerBrandingPage() {
  // Form state — company name/industry default from the active tenant
  // (already selected in the header) but stay fully editable for one-off
  // research on a different company.
  const [companyName, setCompanyName] = useState(() => getActiveCompanyProfile().name);
  const [industry, setIndustry] = useState(() => TENANT_INDUSTRY_LABEL[getActiveCompanyProfile().industry] ?? "");
  const [employeeCount, setEmployeeCount] = useState("");
  const [companyValues, setCompanyValues] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [campaignGoal, setCampaignGoal] = useState("all");
  const [pillars, setPillars] = useState<ContentPillar[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [openRoles, setOpenRoles] = useState("");
  const [manualTrends, setManualTrends] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [referenceContentUrl, setReferenceContentUrl] = useState("");
  const [referenceContentNotes, setReferenceContentNotes] = useState("");
  const [referenceVideoMeta, setReferenceVideoMeta] = useState("");

  // Result state
  const [result, setResult] = useState<BrandingIdeasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedIdeas, setExpandedIdeas] = useState<Set<number>>(new Set());
  const [savedIdeas, setSavedIdeas] = useState<SavedContentIdea[]>(() => getSavedIdeas());
  const [history, setHistory] = useState<EbHistoryItem[]>(() => getEbHistory());
  const [activeTab, setActiveTab] = useState<"results" | "saved" | "history">("results");
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [calendarPrefill, setCalendarPrefill] = useState<Partial<NewCalendarEntry> | null>(null);

  const canGenerate = companyName.trim() && industry && pillars.length > 0 && platforms.length > 0;

  const togglePillar = useCallback((p: ContentPillar) => {
    setPillars((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  const togglePlatform = useCallback((p: Platform) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIdeas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleVideoFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReferenceVideoMeta("");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const mins = Math.floor(video.duration / 60);
      const secs = Math.round(video.duration % 60);
      const durationStr = mins > 0 ? `${mins}m ${secs}d` : `${secs} detik`;
      setReferenceVideoMeta(`${file.name} · durasi ${durationStr}`);
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      setReferenceVideoMeta(`${file.name} (durasi tidak terbaca)`);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  }, []);

  const pullOpenRoles = useCallback(() => {
    const reqs = getJobReqs().filter((r) => r.status === "active");
    if (reqs.length === 0) {
      toast("Tidak ada posisi aktif.", "info");
      return;
    }
    const text = reqs.map((r) => `${r.title} (${r.department})`).join(", ");
    setOpenRoles(text);
    toast(`${reqs.length} posisi aktif ditarik.`, "success");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setActiveTab("results");
    // Note: previous `result` is intentionally NOT cleared here — if this
    // generation fails (e.g. rate limit), the last successful ideas stay
    // visible instead of vanishing.

    try {
      // Avoid repeating ideas already generated for this company — pulled
      // from local history (and the currently displayed result, if any) so
      // regenerating doesn't just reproduce the same handful of concepts.
      const priorTitles = [
        ...(result?.ideas.map((i) => i.title) ?? []),
        ...history
          .filter((h) => h.companyName.trim().toLowerCase() === companyName.trim().toLowerCase())
          .flatMap((h) => h.result.ideas.map((i) => i.title)),
      ];
      const avoidTitles = Array.from(new Set(priorTitles)).slice(0, 20);

      const res = await fetch("/api/employer-branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName, industry, employeeCount, companyValues,
          openRoles, targetAudience, pillars, platforms,
          additionalContext, manualTrends, campaignGoal,
          referenceContentUrl, referenceContentNotes, referenceVideoMeta,
          avoidTitles,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }

      if (data.success && data.result) {
        setResult(data.result);
        setExpandedIdeas(new Set());
        const entry = addEbHistory(companyName, industry, campaignGoal, pillars, platforms, data.result);
        setHistory((prev) => [entry, ...prev].slice(0, 20));
        toast(`${data.result.ideas?.length ?? 0} ide konten berhasil di-generate!`, "success");
      } else {
        setError("Gagal generate ide konten. Coba lagi.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [canGenerate, companyName, industry, employeeCount, companyValues, openRoles, targetAudience, pillars, platforms, additionalContext, manualTrends, campaignGoal, referenceContentUrl, referenceContentNotes, referenceVideoMeta, result, history]);

  const handleSaveIdea = useCallback((idea: ContentIdea) => {
    const entry = saveIdea(idea, companyName);
    setSavedIdeas((prev) => [entry, ...prev].slice(0, 50));
    toast("Ide disimpan!", "success");
  }, [companyName]);

  const handleAddIdeaToCalendar = useCallback((idea: ContentIdea) => {
    setCalendarPrefill({
      platform: idea.platform,
      title: idea.title,
      notes: idea.description,
      status: "draft",
      pillar: idea.pillar,
      contentType: idea.contentType,
      ideaTitle: idea.title,
    });
  }, []);

  const handleAddPostToCalendar = useCallback((post: EditorialPost, linkedIdea?: ContentIdea) => {
    setCalendarPrefill({
      platform: post.platform,
      title: linkedIdea?.title ?? `Konten ${PLATFORM_LABELS[post.platform]}`,
      notes: post.caption,
      status: "draft",
      pillar: linkedIdea?.pillar ?? "",
      contentType: linkedIdea?.contentType ?? "",
      ideaTitle: linkedIdea?.title ?? "",
    });
  }, []);

  const handleSaveCalendarPrefill = useCallback((data: NewCalendarEntry) => {
    addCalendarEntry(data);
    toast("Ditambahkan ke plan konten. Cek di halaman Editorial Plan.", "success");
    setCalendarPrefill(null);
  }, []);

  const handleDeleteSaved = useCallback((id: string) => {
    deleteIdea(id);
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleStatusChange = useCallback((id: string, status: SavedContentIdea["status"]) => {
    updateIdeaStatus(id, status);
    setSavedIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    deleteEbHistory(id);
    setHistory((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleLoadHistory = useCallback((item: EbHistoryItem) => {
    setResult(item.result);
    setActiveTab("results");
    toast("Hasil sebelumnya dimuat.", "info");
  }, []);

  const isIdeaSaved = useCallback((ideaId: number) => {
    return savedIdeas.some((s) => s.idea.id === ideaId && s.idea.title === result?.ideas.find((i) => i.id === ideaId)?.title);
  }, [savedIdeas, result]);

  return (
    <AppShell
      activeNavId="employer-branding"
      title="Employer Branding"
      subtitle="AI Content Idea Generator — Groq Llama 3.3"
    >
      <div className="grid gap-6 xl:grid-cols-5">
        {/* ═══ LEFT PANEL — INPUT FORM ═══ */}
        <div className="space-y-4 xl:col-span-2">
          {/* Card 1: Profil Perusahaan */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Profil Perusahaan</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="companyName">Nama perusahaan *</Label>
                <input id="companyName" className={inputClass} placeholder="PT. Contoh Indonesia" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <p className="mt-1 text-[11px] text-slate-400">Saat generate, AI otomatis mencari berita terkini tentang nama ini (kalau ada) supaya idenya nyambung ke situasi nyata perusahaan — bukan cuma nebak dari nama.</p>
              </div>
              <div>
                <Label htmlFor="industry">Industri *</Label>
                <select id="industry" className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">Pilih industri...</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="employeeCount">Jumlah karyawan</Label>
                <select id="employeeCount" className={inputClass} value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)}>
                  <option value="">Pilih...</option>
                  {EMPLOYEE_COUNTS.map((c) => <option key={c} value={c}>{c} karyawan</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="companyValues">Budaya & nilai perusahaan</Label>
                <textarea id="companyValues" className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="Deskripsikan budaya, misi, visi, atau nilai inti perusahaan..." value={companyValues} onChange={(e) => setCompanyValues(e.target.value)} rows={2} />
              </div>
              <div>
                <Label htmlFor="targetAudience">Target audiens</Label>
                <select id="targetAudience" className={inputClass} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}>
                  {TARGET_AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="campaignGoal">Tujuan campaign</Label>
                <select id="campaignGoal" className={inputClass} value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)}>
                  {CAMPAIGN_GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {/* Card 2: Konten & Tren */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Konten & Tren</h3>
            <div className="space-y-4">
              {/* Pilar Konten */}
              <div>
                <Label>Pilar konten * <span className="font-normal text-slate-400">(pilih minimal 1)</span></Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(Object.entries(PILLAR_LABELS) as [ContentPillar, string][]).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => togglePillar(key)}
                      className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        pillars.includes(key)
                          ? PILLAR_BADGE_COLORS[key]
                          : "border border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                      )}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Target */}
              <div>
                <Label>Platform target * <span className="font-normal text-slate-400">(pilih minimal 1)</span></Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => togglePlatform(key)}
                      className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        platforms.includes(key)
                          ? PLATFORM_BADGE[key].className
                          : "border border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                      )}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Open Roles */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="openRoles">Posisi terbuka</Label>
                  <Button size="sm" variant="ghost" onClick={pullOpenRoles}>
                    <Icon className="h-3.5 w-3.5"><SvgPath name="download" /></Icon>
                    Tarik dari Open Roles
                  </Button>
                </div>
                <textarea id="openRoles" className={cn(inputClass, "min-h-[48px] resize-y")} placeholder="Posisi yang sedang dibuka (opsional)..." value={openRoles} onChange={(e) => setOpenRoles(e.target.value)} rows={2} />
              </div>

              {/* Manual Trends */}
              <div>
                <Label htmlFor="manualTrends">Tren tambahan <span className="font-normal text-slate-400">(opsional)</span></Label>
                <p className="mb-1 text-[11px] text-slate-400">AI otomatis riset tren viral & trending duluan — isi ini kalau Anda ingin menambahkan pengamatan sendiri. Semakin spesifik (nama orang/meme/momen viral), semakin kuat dipakai jadi ide konkret — bukan sekadar disinggung sepintas.</p>
                <textarea id="manualTrends" className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="Mis. 'Erling Haaland lagi viral karena selebrasi golnya' — makin spesifik, makin nyambung ke ide... (opsional)" value={manualTrends} onChange={(e) => setManualTrends(e.target.value)} rows={2} />
              </div>

              {/* Reference Content — Amati-Tiru-Modifikasi */}
              <div className="rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
                <Label>Referensi konten viral <span className="font-normal text-slate-400">(opsional — metode Amati-Tiru-Modifikasi)</span></Label>
                <div className="mt-2 space-y-2.5">
                  <input
                    className={inputClass}
                    placeholder="Link TikTok/Reels/Shorts yang ingin ditiru gayanya..."
                    value={referenceContentUrl}
                    onChange={(e) => setReferenceContentUrl(e.target.value)}
                  />
                  <div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-700 dark:file:text-slate-300"
                    />
                    {referenceVideoMeta && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ {referenceVideoMeta}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">
                      Video hanya dibaca durasinya di browser — belum ada analisis isi video oleh AI. Jelaskan di catatan di bawah apa yang membuatnya menarik; AI akan meniru pola tersebut lalu memodifikasinya untuk konten Anda.
                    </p>
                  </div>
                  <textarea
                    className={cn(inputClass, "min-h-[48px] resize-y")}
                    placeholder="Apa yang membuat konten ini menarik? Hook, format, gaya editing, kenapa menurut Anda viral..."
                    value={referenceContentNotes}
                    onChange={(e) => setReferenceContentNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Additional Context */}
              <div>
                <Label htmlFor="additionalContext">Konteks tambahan</Label>
                <textarea id="additionalContext" className={cn(inputClass, "min-h-[48px] resize-y")} placeholder="Info lain yang relevan (opsional)..." value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={2} />
              </div>

              {/* Generate Button */}
              <Button variant="primary" size="lg" className="w-full" disabled={!canGenerate || loading} onClick={handleGenerate}>
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    AI sedang membuat ide konten...
                  </>
                ) : (
                  <>
                    <Icon className="h-4 w-4"><SvgPath name="sparkles" /></Icon>
                    Generate Ide Konten
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Saved Ideas & History (below form) */}
          <Card padding={false}>
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setActiveTab("saved")}
                className={cn("flex-1 px-4 py-2.5 text-xs font-semibold transition-colors",
                  activeTab === "saved" ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                Tersimpan ({savedIdeas.length})
              </button>
              <button type="button" onClick={() => setActiveTab("history")}
                className={cn("flex-1 px-4 py-2.5 text-xs font-semibold transition-colors",
                  activeTab === "history" ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
                Riwayat ({history.length})
              </button>
            </div>

            {activeTab === "saved" && (
              <div className="max-h-80 overflow-y-auto">
                {savedIdeas.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada ide tersimpan. Klik bintang untuk menyimpan.</p>
                ) : savedIdeas.map((s) => (
                  <div key={s.id} className="border-b border-slate-100 px-5 py-3 last:border-b-0 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{s.idea.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", PLATFORM_BADGE[s.idea.platform].className)}>{PLATFORM_BADGE[s.idea.platform].label}</span>
                          <select value={s.status} onChange={(e) => handleStatusChange(s.id, e.target.value as SavedContentIdea["status"])}
                            className="rounded border-0 bg-transparent px-1 py-0.5 text-[10px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-400">
                            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDeleteSaved(s.id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" title="Hapus">
                        <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "history" && (
              <div className="max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada riwayat generate.</p>
                ) : history.map((h) => (
                  <div key={h.id} className="border-b border-slate-100 px-5 py-3 last:border-b-0 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => handleLoadHistory(h)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">{h.companyName}</p>
                        <p className="text-xs text-slate-500">{h.industry} &middot; {h.ideaCount} ide &middot; {new Date(h.savedAt).toLocaleDateString("id-ID")}</p>
                      </button>
                      <button type="button" onClick={() => handleDeleteHistory(h.id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" title="Hapus">
                        <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ═══ RIGHT PANEL — RESULTS ═══ */}
        <div className="space-y-4 xl:col-span-3">
          {/* Kunci Viral & Engagement — always available reference */}
          <Card padding={false}>
            <button type="button" onClick={() => setShowPlaybook((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-amber-500"><SvgPath name="sparkles" /></Icon>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Kunci Viral & Engagement (hasil riset)</span>
              </div>
              <Icon className={cn("h-4 w-4 text-slate-400 transition-transform", showPlaybook && "rotate-180")}>
                <SvgPath name="chevronDown" />
              </Icon>
            </button>
            {showPlaybook && (
              <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                <ul className="space-y-3">
                  {VIRALITY_PRINCIPLES.map((p, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.description}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-slate-400">
                  Sumber:{" "}
                  {VIRALITY_SOURCES.map((s, i) => (
                    <span key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600 dark:hover:text-slate-300">{s.label}</a>
                      {i < VIRALITY_SOURCES.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">Setiap ide di bawah menerapkan sebagian prinsip ini — lihat badge &quot;Kunci Viral Diterapkan&quot; di masing-masing ide.</p>
              </div>
            )}
          </Card>

          {/* Error */}
          {error && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-500"><SvgPath name="warning" /></Icon>
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">Gagal generate</p>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Loading — full card only when there's nothing to show yet.
              If a previous result exists, show a slim inline banner instead
              so old ideas stay visible (rate limits shouldn't wipe out work). */}
          {loading && !result && (
            <Card>
              <div className="flex flex-col items-center py-8">
                <Icon className="h-8 w-8 animate-pulse text-blue-500"><SvgPath name="sparkles" /></Icon>
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">AI sedang membuat ide konten...</p>
                <p className="mt-1 text-xs text-slate-500">Mencari tren terkini & menyusun strategi</p>
                <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full animate-[loading_2s_ease-in-out_infinite] rounded-full bg-blue-500" style={{ width: "60%" }} />
                </div>
              </div>
            </Card>
          )}
          {loading && result && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                <p className="text-sm text-blue-700 dark:text-blue-300">AI sedang membuat ide baru — hasil sebelumnya tetap tampil di bawah.</p>
              </div>
            </Card>
          )}

          {/* Empty state */}
          {!loading && !result && !error && (
            <Card>
              <div className="flex flex-col items-center py-12">
                <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600"><SvgPath name="sparkles" /></Icon>
                <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">AI Employer Branding</h3>
                <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
                  Isi profil perusahaan, pilih pilar & platform, lalu klik Generate untuk mendapatkan ide konten employer branding yang kreatif dan berbasis tren.
                </p>
              </div>
            </Card>
          )}

          {/* Results — stays visible even while a new generation is loading
              in the background (see slim banner above), so a failed/rate-
              limited regenerate never wipes out previously built ideas. */}
          {result && (
            <>
              {/* Company Context — AI's own stated understanding of the company,
                  shown first so it's obvious right away if it misread who this
                  company is, before scrolling into the generated ideas. */}
              {result.companyContext && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400"><SvgPath name="briefcase" /></Icon>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pemahaman AI Tentang Perusahaan Anda</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{result.companyContext}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Kalau ini kurang tepat, perbaiki di &quot;Budaya &amp; nilai perusahaan&quot; atau &quot;Konteks tambahan&quot; lalu generate ulang.</p>
                </Card>
              )}

              {/* Trend Analysis */}
              {result.trendAnalysis && (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-blue-500"><SvgPath name="arrowTrend" /></Icon>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Analisis Tren</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{result.trendAnalysis}</p>
                </Card>
              )}

              {/* Strategy Note + Tips */}
              {(result.strategyNote || result.generalTips.length > 0) && (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-indigo-500"><SvgPath name="flag" /></Icon>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Strategi & Tips</h3>
                  </div>
                  {result.strategyNote && (
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{result.strategyNote}</p>
                  )}
                  {result.generalTips.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {result.generalTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"><SvgPath name="check" /></Icon>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {/* Content Ideas */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{result.ideas.length} Ide Konten</h3>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedIdeas(expandedIdeas.size === result.ideas.length ? new Set() : new Set(result.ideas.map((i) => i.id)))}>
                    {expandedIdeas.size === result.ideas.length ? "Tutup Semua" : "Buka Semua"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {result.ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      expanded={expandedIdeas.has(idea.id)}
                      saved={isIdeaSaved(idea.id)}
                      onToggle={() => toggleExpanded(idea.id)}
                      onSave={() => handleSaveIdea(idea)}
                      onAddToCalendar={() => handleAddIdeaToCalendar(idea)}
                    />
                  ))}
                </div>
              </div>

              {/* Editorial Plan */}
              {result.editorialPlan.length > 0 && (
                <EditorialPlanSection weeks={result.editorialPlan} ideas={result.ideas} onAddToCalendar={handleAddPostToCalendar} />
              )}
            </>
          )}
        </div>
      </div>

      {calendarPrefill && (
        <CalendarEntryModal
          prefill={calendarPrefill}
          onSave={handleSaveCalendarPrefill}
          onClose={() => setCalendarPrefill(null)}
        />
      )}
    </AppShell>
  );
}

/* ═══ Idea Card Component ═══ */

function IdeaCard({ idea, expanded, saved, onToggle, onSave, onAddToCalendar }: {
  idea: ContentIdea;
  expanded: boolean;
  saved: boolean;
  onToggle: () => void;
  onSave: () => void;
  onAddToCalendar: () => void;
}) {
  return (
    <Card padding={false}>
      {/* Header — always visible */}
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{idea.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", PLATFORM_BADGE[idea.platform].className)}>
              {PLATFORM_BADGE[idea.platform].label}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
              {FORMAT_LABELS[idea.contentType]}
            </span>
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", PILLAR_BADGE_COLORS[idea.pillar])}>
              {PILLAR_LABELS[idea.pillar]}
            </span>
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", ENGAGEMENT_BADGE[idea.estimatedEngagement])}>
              {idea.estimatedEngagement === "high" ? "High" : idea.estimatedEngagement === "medium" ? "Medium" : "Low"} engagement
            </span>
          </div>
          {idea.trendReference && (
            <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">Terinspirasi: {idea.trendReference}</p>
          )}
          {idea.formatUsed && (
            <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">Format: {idea.formatUsed}</p>
          )}
        </div>
        <Icon className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}>
          <SvgPath name="chevronDown" />
        </Icon>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {/* Description */}
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{idea.description}</p>

          {/* Talking Points */}
          {idea.talkingPoints.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Talking Points</p>
              <ul className="space-y-1">
                {idea.talkingPoints.map((tp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {tp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Content Breakdown — beat-by-beat timeline / slide-by-slide */}
          {idea.contentBreakdown.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Alur Konten (Beat-per-Beat)</p>
              <ol className="space-y-2.5 border-l-2 border-amber-200 pl-3.5 dark:border-amber-900/50">
                {idea.contentBreakdown.map((beat, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-amber-400" />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">{beat.label}</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{beat.beat}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{beat.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Hashtags */}
          {idea.hashtags.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Hashtag</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.hashtags.map((tag, i) => (
                  <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Production Brief */}
          {(idea.visualDirection || idea.copyGuideline || idea.productionNotes) && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Production Brief</p>
              <div className="space-y-2.5">
                {idea.visualDirection && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Arahan Visual</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{idea.visualDirection}</p>
                  </div>
                )}
                {idea.copyGuideline && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Panduan Copy</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{idea.copyGuideline}</p>
                  </div>
                )}
                {idea.productionNotes && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Catatan Produksi</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{idea.productionNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source — real article URL if this idea draws on one of the fetched trends.
              Honest fallback when there isn't one: the AI can't browse TikTok/Instagram
              directly, so a citation only exists when Google News actually covered it. */}
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            {idea.sourceUrl ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sumber:{" "}
                <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  {idea.sourceUrl.length > 60 ? `${idea.sourceUrl.slice(0, 60)}…` : idea.sourceUrl}
                </a>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Tidak ada link sumber spesifik — AI belum bisa browsing TikTok/Instagram langsung, jadi hanya mengutip kalau tren tsb tercakup di Google News. Kalau Anda punya link videonya, tempel di &quot;Referensi konten viral&quot; di form supaya bisa dijadikan acuan langsung.
              </p>
            )}
          </div>

          {/* Viral Principles Applied */}
          {idea.viralPrinciples.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Kunci Viral Diterapkan</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.viralPrinciples.map((v, i) => (
                  <span key={i} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Performance Pattern */}
          {idea.performancePattern && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Pola Performa (Referensi)</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{idea.performancePattern}</p>
            </div>
          )}

          {/* Variations */}
          {idea.variations.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Variasi Eksekusi Lain</p>
              <ul className="space-y-1">
                {idea.variations.map((v, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Calendar + Actions */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon className="h-3.5 w-3.5"><SvgPath name="calendarDays" /></Icon>
              {idea.calendarSuggestion}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onAddToCalendar}>
                <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon>
                Plan Konten
              </Button>
              <Button size="sm" variant={saved ? "secondary" : "ghost"} onClick={onSave} disabled={saved}>
                <Icon className="h-3.5 w-3.5"><SvgPath name="star" /></Icon>
                {saved ? "Tersimpan" : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ═══ Editorial Plan Section ═══ */

function EditorialPlanSection({ weeks, ideas, onAddToCalendar }: {
  weeks: EditorialWeek[];
  ideas: ContentIdea[];
  onAddToCalendar: (post: EditorialPost, linkedIdea?: ContentIdea) => void;
}) {
  const [openWeek, setOpenWeek] = useState<number | null>(1);

  return (
    <Card padding={false}>
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-emerald-500"><SvgPath name="calendarDays" /></Icon>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Editorial Plan — 4 Minggu</h3>
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {weeks.map((week) => (
          <div key={week.week}>
            <button type="button" onClick={() => setOpenWeek(openWeek === week.week ? null : week.week)}
              className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Minggu {week.week}</span>
                <span className="ml-2 text-xs text-slate-500">{week.theme}</span>
              </div>
              <Icon className={cn("h-4 w-4 text-slate-400 transition-transform", openWeek === week.week && "rotate-180")}>
                <SvgPath name="chevronDown" />
              </Icon>
            </button>
            {openWeek === week.week && week.posts.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Hari</th>
                        <th className="pb-2 pr-4 font-medium">Jam</th>
                        <th className="pb-2 pr-4 font-medium">Platform</th>
                        <th className="pb-2 pr-4 font-medium">Caption</th>
                        <th className="pb-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {week.posts.map((post, i) => {
                        const linkedIdea = ideas.find((id) => id.id === post.ideaRef);
                        return (
                          <tr key={i}>
                            <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300">{post.day}</td>
                            <td className="py-2 pr-4 tabular-nums text-slate-600 dark:text-slate-400">{post.time}</td>
                            <td className="py-2 pr-4">
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", PLATFORM_BADGE[post.platform]?.className ?? "bg-slate-100 text-slate-600")}>
                                {PLATFORM_LABELS[post.platform] ?? post.platform}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <p className="text-slate-600 dark:text-slate-400">{post.caption}</p>
                              {linkedIdea && (
                                <p className="mt-0.5 text-[10px] text-slate-400">Ref: {linkedIdea.title}</p>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              <Button size="sm" variant="ghost" onClick={() => onAddToCalendar(post, linkedIdea)}>
                                <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon>
                                Plan
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
