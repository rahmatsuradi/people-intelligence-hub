"use client";

import { useCallback, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import {
  getCalendarEntries,
  addCalendarEntry,
  updateCalendarEntry,
  updateCalendarMetrics,
  deleteCalendarEntry,
  type CalendarEntry,
  type NewCalendarEntry,
} from "@/lib/content-calendar-store";
import { PLATFORM_LABELS, type Platform } from "@/lib/employer-branding-ai";
import CalendarEntryModal from "./calendar-entry-modal";

/* Decorative dots in the calendar grid — reuses the app's existing platform
   brand-ish colors (same associations as the badges on /employer-branding). */
const PLATFORM_DOT: Record<Platform, string> = {
  linkedin: "bg-blue-500",
  instagram: "bg-pink-500",
  tiktok: "bg-slate-700 dark:bg-slate-300",
  "career-page": "bg-emerald-500",
  twitter: "bg-sky-500",
  youtube: "bg-red-500",
};

/* Data-encoded chart colors — the dataviz skill's validated categorical
   palette (6 slots, run through scripts/validate_palette.js for both light
   and dark surfaces), NOT the brand-ish dots above. Intentionally separate:
   a chart's series colors must be CVD-safe, decorative UI dots don't need
   the same rigor. Written as literal strings (not built via template
   interpolation) so Tailwind's JIT scanner picks up the arbitrary values. */
const PLATFORM_BAR_COLOR: Record<Platform, string> = {
  linkedin: "bg-[#2a78d6] dark:bg-[#3987e5]",
  instagram: "bg-[#eb6834] dark:bg-[#d95926]",
  tiktok: "bg-[#1baf7a] dark:bg-[#199e70]",
  "career-page": "bg-[#eda100] dark:bg-[#c98500]",
  twitter: "bg-[#e87ba4] dark:bg-[#d55181]",
  youtube: "bg-[#008300] dark:bg-[#008300]",
};

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Always 42 cells (6 full weeks), Monday-first, so the grid never reflows height month to month. */
function getMonthGrid(viewDate: Date): Date[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const jsDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const offset = (jsDay + 6) % 7; // days back to the preceding Monday
  const start = new Date(year, month, 1 - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

type ModalState = { entry?: CalendarEntry; defaultDate?: string };

export default function EditorialPlanPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>(() => getCalendarEntries());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<"calendar" | "analytics">("calendar");
  const [modal, setModal] = useState<ModalState | null>(null);

  const refresh = useCallback(() => setEntries(getCalendarEntries()), []);

  const monthDays = useMemo(() => getMonthGrid(viewDate), [viewDate]);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.platform.localeCompare(b.platform));
    return map;
  }, [entries]);

  const monthLabel = viewDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const todayIso = toISO(new Date());

  const handleSave = useCallback((data: NewCalendarEntry) => {
    if (modal?.entry) {
      updateCalendarEntry(modal.entry.id, data);
      toast("Konten diperbarui.", "success");
    } else {
      addCalendarEntry(data);
      toast("Ditambahkan ke plan konten.", "success");
    }
    refresh();
    setModal(null);
  }, [modal, refresh]);

  const handleSaveMetrics = useCallback((metrics: { views: number; likes: number; comments: number; shares: number; saves: number }) => {
    if (!modal?.entry) return;
    updateCalendarMetrics(modal.entry.id, metrics);
    toast("Performa disimpan.", "success");
    refresh();
    setModal((m) => (m ? { ...m, entry: getCalendarEntries().find((e) => e.id === m.entry?.id) } : m));
  }, [modal, refresh]);

  const handleDelete = useCallback(() => {
    if (!modal?.entry) return;
    deleteCalendarEntry(modal.entry.id);
    toast("Konten dihapus.", "info");
    refresh();
    setModal(null);
  }, [modal, refresh]);

  return (
    <AppShell activeNavId="editorial-plan" title="Editorial Plan" subtitle="Kalender Konten Employer Branding">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", activeTab === "calendar" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}
            >
              Kalender
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", activeTab === "analytics" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}
            >
              Analitik Performa
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={() => setModal({ defaultDate: todayIso })}>
            <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
            Tambah Manual
          </Button>
        </div>

        {activeTab === "calendar" && (
          <Card padding={false}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Bulan sebelumnya"
              >
                <Icon className="h-4 w-4"><SvgPath name="chevronLeft" /></Icon>
              </button>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{monthLabel}</h3>
                <button type="button" onClick={() => setViewDate(new Date())} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                  Hari ini
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Bulan berikutnya"
              >
                <Icon className="h-4 w-4"><SvgPath name="chevron" /></Icon>
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-slate-400">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const iso = toISO(day);
                const inMonth = day.getMonth() === viewDate.getMonth();
                const dayEntries = entriesByDate.get(iso) ?? [];
                const isToday = iso === todayIso;
                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setModal({ defaultDate: iso })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setModal({ defaultDate: iso }); }}
                    className={cn(
                      "min-h-[92px] cursor-pointer border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors last:border-r-0 dark:border-slate-800",
                      "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                      !inMonth && "bg-slate-50/50 dark:bg-slate-900/40",
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-blue-600 font-semibold text-white" : inMonth ? "text-slate-700 dark:text-slate-300" : "text-slate-300 dark:text-slate-600",
                    )}>
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEntries.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setModal({ entry: e }); }}
                          className="flex items-center gap-1 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PLATFORM_DOT[e.platform])} />
                          <span className="truncate">{e.title}</span>
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <p className="px-1.5 text-[10px] text-slate-400">+{dayEntries.length - 3} lagi</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {activeTab === "analytics" && <AnalyticsPanel entries={entries} />}
      </div>

      {modal && (
        <CalendarEntryModal
          entry={modal.entry}
          defaultDate={modal.defaultDate}
          onSave={handleSave}
          onSaveMetrics={handleSaveMetrics}
          onDelete={modal.entry ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </AppShell>
  );
}

/* ═══ Analytics Panel ═══ */

function AnalyticsPanel({ entries }: { entries: CalendarEntry[] }) {
  const published = useMemo(
    () => entries.filter((e) => e.status === "published" && e.metrics),
    [entries],
  );

  if (published.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-12">
          <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
          <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada data performa</h3>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
            Tandai konten sebagai &quot;Sudah Terbit&quot;, isi link postingan, lalu masukkan angka performa (views, likes, dst) dari halaman insight platform masing-masing untuk melihat perbandingan di sini.
          </p>
        </div>
      </Card>
    );
  }

  const sorted = [...published].sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0));
  const totalViews = published.reduce((s, e) => s + (e.metrics?.views ?? 0), 0);
  const totalEngagement = published.reduce(
    (s, e) => s + (e.metrics ? e.metrics.likes + e.metrics.comments + e.metrics.shares + e.metrics.saves : 0),
    0,
  );
  const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
  const best = sorted[0];
  const maxViews = Math.max(...published.map((e) => e.metrics?.views ?? 0), 1);
  const platformsPresent = Array.from(new Set(published.map((e) => e.platform)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-slate-500">Total Views</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalViews.toLocaleString("id-ID")}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Rata-rata Engagement Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{avgEngagementRate.toFixed(1)}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Konten Terbaik</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{best.title}</p>
          <p className="text-xs text-slate-400">{(best.metrics?.views ?? 0).toLocaleString("id-ID")} views</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Views per Konten</h3>
        <div className="space-y-3">
          {sorted.map((e) => {
            const pct = Math.max(4, ((e.metrics?.views ?? 0) / maxViews) * 100);
            return (
              <div key={e.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-700 dark:text-slate-300">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", PLATFORM_BAR_COLOR[e.platform])} />
                    <span className="truncate">{e.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{(e.metrics?.views ?? 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={cn("h-full rounded-full", PLATFORM_BAR_COLOR[e.platform])} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          {platformsPresent.map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn("h-2 w-2 rounded-full", PLATFORM_BAR_COLOR[p])} />
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Konten</th>
                <th className="px-4 py-2.5 font-medium">Platform</th>
                <th className="px-4 py-2.5 text-right font-medium">Views</th>
                <th className="px-4 py-2.5 text-right font-medium">Likes</th>
                <th className="px-4 py-2.5 text-right font-medium">Komentar</th>
                <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                <th className="px-4 py-2.5 text-right font-medium">Saves</th>
                <th className="px-4 py-2.5 text-right font-medium">Engagement Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((e) => {
                const m = e.metrics!;
                const er = m.views > 0 ? ((m.likes + m.comments + m.shares + m.saves) / m.views) * 100 : 0;
                return (
                  <tr key={e.id}>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{e.title}</td>
                    <td className="px-4 py-2.5 text-slate-500">{PLATFORM_LABELS[e.platform]}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{m.views.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{m.likes.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{m.comments.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{m.shares.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{m.saves.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300">{er.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
