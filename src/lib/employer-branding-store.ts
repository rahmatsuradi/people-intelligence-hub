/* ═══════════════════════════════════════════════════════════════════════════
   Employer Branding Store — localStorage persistence for saved ideas
   Follows the same readJson/writeJson pattern as store.ts.
═══════════════════════════════════════════════════════════════════════════ */

import { generateId } from "./store";
import type {
  ContentIdea,
  BrandingIdeasResult,
  ContentPillar,
  Platform,
} from "./employer-branding-ai";

/* ─── Types ─── */

export interface SavedContentIdea {
  id: string;
  savedAt: string;
  idea: ContentIdea;
  companyName: string;
  status: "saved" | "in-progress" | "published";
  notes: string;
}

export interface EbHistoryItem {
  id: string;
  savedAt: string;
  companyName: string;
  industry: string;
  campaignGoal: string;
  pillars: ContentPillar[];
  platforms: Platform[];
  ideaCount: number;
  result: BrandingIdeasResult;
}

/* ─── Storage keys ─── */

const EB_IDEAS_KEY = "eb_saved_ideas";
const EB_HISTORY_KEY = "eb_generation_history";
const MAX_HISTORY = 20;
const MAX_SAVED = 50;

/* ─── Helpers ─── */

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

/* ─── Saved Ideas CRUD ─── */

export function getSavedIdeas(): SavedContentIdea[] {
  return readJson<SavedContentIdea>(EB_IDEAS_KEY);
}

export function saveIdea(
  idea: ContentIdea,
  companyName: string,
): SavedContentIdea {
  const items = getSavedIdeas();
  const entry: SavedContentIdea = {
    id: generateId("EB"),
    savedAt: new Date().toISOString(),
    idea,
    companyName,
    status: "saved",
    notes: "",
  };
  items.unshift(entry);
  writeJson(EB_IDEAS_KEY, items.slice(0, MAX_SAVED));
  return entry;
}

export function updateIdeaStatus(
  id: string,
  status: SavedContentIdea["status"],
): void {
  const items = getSavedIdeas();
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) {
    items[idx].status = status;
    writeJson(EB_IDEAS_KEY, items);
  }
}

export function updateIdeaNotes(id: string, notes: string): void {
  const items = getSavedIdeas();
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) {
    items[idx].notes = notes;
    writeJson(EB_IDEAS_KEY, items);
  }
}

export function deleteIdea(id: string): void {
  const items = getSavedIdeas().filter((i) => i.id !== id);
  writeJson(EB_IDEAS_KEY, items);
}

/* ─── Generation History ─── */

export function getEbHistory(): EbHistoryItem[] {
  return readJson<EbHistoryItem>(EB_HISTORY_KEY);
}

export function addEbHistory(
  companyName: string,
  industry: string,
  campaignGoal: string,
  pillars: ContentPillar[],
  platforms: Platform[],
  result: BrandingIdeasResult,
): EbHistoryItem {
  const items = getEbHistory();
  const entry: EbHistoryItem = {
    id: generateId("EBH"),
    savedAt: new Date().toISOString(),
    companyName,
    industry,
    campaignGoal,
    pillars,
    platforms,
    ideaCount: result.ideas.length,
    result,
  };
  items.unshift(entry);
  writeJson(EB_HISTORY_KEY, items.slice(0, MAX_HISTORY));
  return entry;
}

export function deleteEbHistory(id: string): void {
  const items = getEbHistory().filter((i) => i.id !== id);
  writeJson(EB_HISTORY_KEY, items);
}
