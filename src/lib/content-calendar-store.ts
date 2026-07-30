/* ═══════════════════════════════════════════════════════════════════════════
   Content Calendar Store — localStorage persistence for the editorial calendar
   Follows the same readJson/writeJson pattern as employer-branding-store.ts.
═══════════════════════════════════════════════════════════════════════════ */

import { generateId } from "./store";
import type { ContentFormat, ContentPillar, Platform } from "./employer-branding-ai";

/* ─── Types ─── */

export type CalendarStatus = "draft" | "in-production" | "ready" | "published";

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  draft: "Draft",
  "in-production": "Sedang Diproduksi",
  ready: "Siap Upload",
  published: "Sudah Terbit",
};

export const CALENDAR_STATUSES: CalendarStatus[] = [
  "draft",
  "in-production",
  "ready",
  "published",
];

/** Manually entered — there is no automated pipeline pulling real analytics
 *  from TikTok/Instagram/YouTube (that needs each platform's own API + OAuth,
 *  which is out of scope here). The user reads these off their own platform
 *  insights and enters them so the tool can compare real numbers honestly. */
export interface ContentMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  updatedAt: string;
}

export interface CalendarEntry {
  id: string;
  date: string; // ISO date, "YYYY-MM-DD"
  platform: Platform;
  title: string;
  notes: string;
  status: CalendarStatus;
  pillar: ContentPillar | "";
  contentType: ContentFormat | "";
  /** Snapshot of the generated idea's title this entry came from, if any — not a live reference. */
  ideaTitle: string;
  publishedUrl: string;
  metrics: ContentMetrics | null;
  createdAt: string;
  updatedAt: string;
}

export type NewCalendarEntry = Omit<
  CalendarEntry,
  "id" | "createdAt" | "updatedAt" | "metrics"
>;

/* ─── Storage ─── */

const CALENDAR_KEY = "eb_content_calendar";
const MAX_ENTRIES = 500;

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

/* ─── CRUD ─── */

export function getCalendarEntries(): CalendarEntry[] {
  return readJson<CalendarEntry>(CALENDAR_KEY);
}

export function addCalendarEntry(entry: NewCalendarEntry): CalendarEntry {
  const items = getCalendarEntries();
  const now = new Date().toISOString();
  const full: CalendarEntry = {
    ...entry,
    id: generateId("CAL"),
    metrics: null,
    createdAt: now,
    updatedAt: now,
  };
  items.push(full);
  writeJson(CALENDAR_KEY, items.slice(-MAX_ENTRIES));
  return full;
}

export function updateCalendarEntry(
  id: string,
  patch: Partial<Omit<CalendarEntry, "id" | "createdAt">>,
): void {
  const items = getCalendarEntries();
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
    writeJson(CALENDAR_KEY, items);
  }
}

export function updateCalendarMetrics(
  id: string,
  metrics: Omit<ContentMetrics, "updatedAt">,
): void {
  updateCalendarEntry(id, {
    metrics: { ...metrics, updatedAt: new Date().toISOString() },
  });
}

export function deleteCalendarEntry(id: string): void {
  const items = getCalendarEntries().filter((i) => i.id !== id);
  writeJson(CALENDAR_KEY, items);
}
