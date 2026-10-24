"use client";

import { useState } from "react";
import { Icon, SvgPath, Button, Label, inputClass, cn } from "@/components/app-shell";
import {
  PILLAR_LABELS,
  PLATFORM_LABELS,
  FORMAT_LABELS,
  type ContentPillar,
  type ContentFormat,
  type Platform,
} from "@/lib/employer-branding-ai";
import {
  CALENDAR_STATUS_LABELS,
  CALENDAR_STATUSES,
  type CalendarEntry,
  type CalendarStatus,
  type NewCalendarEntry,
} from "@/lib/content-calendar-store";

export default function CalendarEntryModal({
  entry,
  defaultDate,
  prefill,
  onSave,
  onSaveMetrics,
  onDelete,
  onClose,
}: {
  /** Editing an existing entry — omit to create a new one. */
  entry?: CalendarEntry;
  /** Pre-fill the date field (e.g. the day the user clicked). */
  defaultDate?: string;
  /** Pre-fill other fields for a NEW entry — e.g. carrying over a generated idea's title/platform/pillar. Ignored when editing. */
  prefill?: Partial<NewCalendarEntry>;
  onSave: (data: NewCalendarEntry) => void;
  onSaveMetrics?: (metrics: { views: number; likes: number; comments: number; shares: number; saves: number }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(entry?.date ?? prefill?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<Platform>(entry?.platform ?? prefill?.platform ?? "instagram");
  const [title, setTitle] = useState(entry?.title ?? prefill?.title ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? prefill?.notes ?? "");
  const [status, setStatus] = useState<CalendarStatus>(entry?.status ?? prefill?.status ?? "draft");
  const [pillar, setPillar] = useState<ContentPillar | "">(entry?.pillar ?? prefill?.pillar ?? "");
  const [contentType, setContentType] = useState<ContentFormat | "">(entry?.contentType ?? prefill?.contentType ?? "");
  const [publishedUrl, setPublishedUrl] = useState(entry?.publishedUrl ?? "");

  const [views, setViews] = useState(String(entry?.metrics?.views ?? ""));
  const [likes, setLikes] = useState(String(entry?.metrics?.likes ?? ""));
  const [comments, setComments] = useState(String(entry?.metrics?.comments ?? ""));
  const [shares, setShares] = useState(String(entry?.metrics?.shares ?? ""));
  const [saves, setSaves] = useState(String(entry?.metrics?.saves ?? ""));

  const canSave = date.trim() && title.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      date,
      platform,
      title: title.trim(),
      notes: notes.trim(),
      status,
      pillar,
      contentType,
      ideaTitle: entry?.ideaTitle ?? prefill?.ideaTitle ?? "",
      publishedUrl: publishedUrl.trim(),
    });
  };

  const handleSaveMetrics = () => {
    onSaveMetrics?.({
      views: Number(views) || 0,
      likes: Number(likes) || 0,
      comments: Number(comments) || 0,
      shares: Number(shares) || 0,
      saves: Number(saves) || 0,
    });
  };

  const showMetrics = !!entry && (status === "published" || !!publishedUrl.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {entry ? "Edit Konten" : "Tambah ke Plan Konten"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {(entry?.ideaTitle || prefill?.ideaTitle) && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Dari ide: <span className="font-medium">{entry?.ideaTitle || prefill?.ideaTitle}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cal-date">Tanggal *</Label>
              <input id="cal-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cal-platform">Platform</Label>
              <select id="cal-platform" className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="cal-title">Judul konten *</Label>
            <input id="cal-title" className={inputClass} placeholder="Judul / topik konten" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="cal-notes">Catatan / caption</Label>
            <textarea id="cal-notes" className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="Brief, caption, atau catatan produksi..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cal-pillar">Pilar</Label>
              <select id="cal-pillar" className={inputClass} value={pillar} onChange={(e) => setPillar(e.target.value as ContentPillar | "")}>
                <option value="">-</option>
                {(Object.entries(PILLAR_LABELS) as [ContentPillar, string][]).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cal-format">Format</Label>
              <select id="cal-format" className={inputClass} value={contentType} onChange={(e) => setContentType(e.target.value as ContentFormat | "")}>
                <option value="">-</option>
                {(Object.entries(FORMAT_LABELS) as [ContentFormat, string][]).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="cal-status">Status</Label>
            <select id="cal-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as CalendarStatus)}>
              {CALENDAR_STATUSES.map((s) => (
                <option key={s} value={s}>{CALENDAR_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cal-url">Link postingan {status === "published" && <span className="font-normal text-slate-400">(sudah terbit)</span>}</Label>
            <input id="cal-url" className={inputClass} placeholder="https://... (isi setelah konten diupload)" value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} />
          </div>

          {showMetrics && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Performa (isi manual)</p>
              <p className="mb-3 text-[11px] text-slate-400">
                Belum ada integrasi otomatis ke TikTok/Instagram/YouTube (butuh API resmi + verifikasi per platform). Salin angkanya dari halaman insight/analytics platform masing-masing.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="m-views">Views</Label>
                  <input id="m-views" type="number" min="0" className={inputClass} value={views} onChange={(e) => setViews(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="m-likes">Likes</Label>
                  <input id="m-likes" type="number" min="0" className={inputClass} value={likes} onChange={(e) => setLikes(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="m-comments">Komentar</Label>
                  <input id="m-comments" type="number" min="0" className={inputClass} value={comments} onChange={(e) => setComments(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="m-shares">Shares</Label>
                  <input id="m-shares" type="number" min="0" className={inputClass} value={shares} onChange={(e) => setShares(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="m-saves">Saves</Label>
                  <input id="m-saves" type="number" min="0" className={inputClass} value={saves} onChange={(e) => setSaves(e.target.value)} />
                </div>
              </div>
              <Button size="sm" variant="secondary" className="mt-3" onClick={handleSaveMetrics}>Simpan Performa</Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          {entry && onDelete ? (
            <Button variant="ghost" onClick={onDelete} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
              <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
              Hapus
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
