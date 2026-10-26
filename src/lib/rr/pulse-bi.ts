/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Check — analisis tingkat responden (fungsi murni, diuji di pulse-bi.test.ts).

   Ringkasan database (pi_survey_summary/segments) hanya memberi hitungan per pertanyaan, jadi tidak bisa
   menjawab pertanyaan "apa yang berkaitan dengan apa" (mis. SPG yang jarang dikunjungi, apakah lebih
   tidak nyaman?). Fungsi di sini membaca jawaban mentah — karena itu HANYA dipakai di layar HR.

   Aturan baca yang dipegang di semua fungsi:
   • Penyebut selalu = yang MENJAWAB pertanyaan itu, bukan seluruh responden.
   • Kelompok < MIN_GROUP orang tidak diberi persen (null), supaya satu orang tidak tampil sebagai "0%" atau "100%".
   • Hubungan dua jawaban adalah KAITAN, bukan sebab-akibat — teks di layar wajib memakai kata "berkaitan".
   ═══════════════════════════════════════════════════════════════════════════ */

import type { AnswerValue, Survey, SurveyResponse, ThemeDef } from "./pulse";

export const MIN_GROUP = 3;

type R = Pick<SurveyResponse, "answers" | "excluded">;
const counted = <T extends R>(rs: T[]) => rs.filter((r) => !r.excluded);
const str = (v: AnswerValue | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: AnswerValue | undefined): number | null => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null);
const pct = (hits: number, n: number) => (n >= MIN_GROUP ? (hits / n) * 100 : null);

/** Nilai skala ≥ `min` (default 4 pada skala 1–5) = favorable. null bila tidak dijawab. */
export function favorableOf(r: R, key: string, min = 4): boolean | null {
  const v = num(r.answers[key]);
  return v === null ? null : v >= min;
}

/** Rata-rata beberapa skala untuk satu responden (mis. skor SPV dari enam penilaian). */
export function personScore(r: R, keys: string[]): number | null {
  const vals = keys.map((k) => num(r.answers[k])).filter((x): x is number => x !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/* ─── Kaitan satu jawaban dengan satu hasil ─── */

export interface CrossRow { value: string; n: number; hits: number; pct: number | null }

/**
 * Persen `outcome` benar per pilihan jawaban `key`. `buckets` (opsional) menggabungkan pilihan, mis.
 * {"≤ 2 kali": ["Tidak Pernah","1 kali","2 kali"]} — berguna saat kelompok aslinya terlalu kecil.
 * Urutan baris mengikuti `order` / urutan bucket; responden yang tidak menjawab salah satunya dilewati.
 */
export function crossTab(responses: R[], key: string, outcome: (r: R) => boolean | null, opts: { order?: string[]; buckets?: Record<string, string[]> } = {}): CrossRow[] {
  const bucketOf = (v: string) => (opts.buckets ? Object.entries(opts.buckets).find(([, vs]) => vs.includes(v))?.[0] ?? null : v);
  const acc = new Map<string, { n: number; hits: number }>();
  for (const r of counted(responses)) {
    const v = str(r.answers[key]);
    const o = outcome(r);
    if (v === null || o === null) continue;
    const b = bucketOf(v);
    if (b === null) continue;
    const a = acc.get(b) ?? { n: 0, hits: 0 };
    a.n++; if (o) a.hits++;
    acc.set(b, a);
  }
  const order = opts.buckets ? Object.keys(opts.buckets) : opts.order ?? [...acc.keys()].sort();
  return order.filter((v) => acc.has(v)).map((v) => ({ value: v, ...acc.get(v)!, pct: pct(acc.get(v)!.hits, acc.get(v)!.n) }));
}

/** Selisih persen antara kelompok pertama dan terakhir yang punya persen (poin). null bila salah satunya tidak ada. */
export function gap(rows: CrossRow[]): number | null {
  const ok = rows.filter((r) => r.pct !== null);
  return ok.length >= 2 ? (ok[0].pct as number) - (ok.at(-1)!.pct as number) : null;
}

/* ─── Rentang kendali SPV ─── */

export interface SpanRow { spv: string; n: number; share: number; dist: Record<string, number>; top: number | null; low: number | null }

/**
 * Berapa SPG dibina tiap SPV dan seberapa sering mereka dikunjungi. `top` = % dikunjungi pada pilihan
 * tertinggi (mis. "Lebih dari 3 kali"); `low` = % pada pilihan yang dianggap kurang (`lowValues`).
 */
export function spanOfControl(responses: R[], spvKey: string, visitKey: string, visitOrder: string[], lowValues: string[]): SpanRow[] {
  const rs = counted(responses);
  const total = rs.filter((r) => str(r.answers[spvKey]) !== null).length;
  const by = new Map<string, R[]>();
  for (const r of rs) { const s = str(r.answers[spvKey]); if (s) by.set(s, [...(by.get(s) ?? []), r]); }
  return [...by.entries()].map(([spv, list]) => {
    const answered = list.filter((r) => str(r.answers[visitKey]) !== null);
    const dist = Object.fromEntries(visitOrder.map((v) => [v, answered.length ? (answered.filter((r) => str(r.answers[visitKey]) === v).length / answered.length) * 100 : 0]));
    const topV = visitOrder.at(-1)!;
    return {
      spv, n: list.length, share: total ? (list.length / total) * 100 : 0, dist,
      top: pct(answered.filter((r) => str(r.answers[visitKey]) === topV).length, answered.length),
      low: pct(answered.filter((r) => lowValues.includes(str(r.answers[visitKey]) ?? "")).length, answered.length),
    };
  }).sort((a, b) => b.n - a.n || a.spv.localeCompare(b.spv, "id"));
}

/* ─── Corong kendala ─── */

export interface IssueFunnel { total: number; reported: number; solved: number; inProgress: number; notFollowed: number; unresolved: number }

/** Dari semua SPG → yang melapor kendala → nasib laporannya → yang masih punya kendala tanpa solusi. */
export function issueFunnel(responses: R[]): IssueFunnel {
  const rs = counted(responses);
  const reported = rs.filter((r) => str(r.answers.reported) === "Ya");
  const f = (v: string) => reported.filter((r) => str(r.answers.followed) === v).length;
  return {
    total: rs.length, reported: reported.length,
    solved: f("Ya, diselesaikan"), inProgress: f("Ya, sedang diproses"), notFollowed: f("Belum ada tindak lanjut"),
    unresolved: rs.filter((r) => str(r.answers.unresolved) === "Ya").length,
  };
}

/* ─── Pertanyaan yang tidak lagi membedakan ─── */

export interface CeilingItem { key: string; label: string; value: string; pct: number; n: number }

/** Pertanyaan pilihan yang ≥ `threshold`% jawabannya sama — tidak memberi informasi lagi (efek plafon). */
export function ceilingItems(survey: Pick<Survey, "questions">, responses: R[], threshold = 95): CeilingItem[] {
  const rs = counted(responses);
  const out: CeilingItem[] = [];
  for (const q of survey.questions) {
    if (q.type !== "choice" || q.hidden) continue;
    const vals = rs.map((r) => str(r.answers[q.key])).filter((v): v is string => v !== null);
    if (vals.length < 10) continue;
    const counts = vals.reduce<Record<string, number>>((m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }), {});
    const [value, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const p = (c / vals.length) * 100;
    if (p >= threshold) out.push({ key: q.key, label: q.label, value, pct: p, n: vals.length });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/* ─── Tema keluhan per responden ─── */

export interface CompiledTheme { key: string; label: string; group: string; fields: string[]; re: RegExp | null }

/**
 * Pola tema ditulis dalam regex PostgreSQL (dipakai pi_survey_themes). Padanan JavaScript: \y, \m, \M → \b,
 * tanpa beda huruf besar/kecil. Pola yang gagal dikompilasi menjadi null (dilewati), bukan melempar.
 */
export function compileThemes(defs: ThemeDef[]): CompiledTheme[] {
  return defs.map((d) => {
    let re: RegExp | null = null;
    try { re = new RegExp(d.pattern.replace(/\\[yMm]/g, "\\b"), "i"); } catch { re = null; }
    return { key: d.key, label: d.label, group: d.group ?? "Lainnya", fields: d.fields, re };
  });
}

/** Tema yang disebut satu responden (di salah satu kolom komentar tema itu). */
export function themesOf(r: R, themes: CompiledTheme[]): string[] {
  return themes.filter((t) => t.re && t.fields.some((f) => { const v = str(r.answers[f]); return v !== null && t.re!.test(v); })).map((t) => t.key);
}

export interface ThemeGroupRow { group: string; n: number; pct: number; themes: { key: string; label: string; n: number }[] }

/** Persen responden yang menyebut ≥ 1 tema di tiap kelompok tema (orang dihitung sekali per kelompok). */
export function themeGroups(responses: R[], themes: CompiledTheme[]): { total: number; any: number; groups: ThemeGroupRow[] } {
  const rs = counted(responses);
  const hits = rs.map((r) => new Set(themesOf(r, themes)));
  const groups = [...new Set(themes.map((t) => t.group))].map((g) => {
    const ts = themes.filter((t) => t.group === g);
    const n = hits.filter((h) => ts.some((t) => h.has(t.key))).length;
    return { group: g, n, pct: rs.length ? (n / rs.length) * 100 : 0, themes: ts.map((t) => ({ key: t.key, label: t.label, n: hits.filter((h) => h.has(t.key)).length })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n) };
  }).sort((a, b) => b.n - a.n);
  return { total: rs.length, any: hits.filter((h) => h.size > 0).length, groups };
}

export interface ThemeSegmentRow { segment: string; n: number; values: Record<string, number | null> }

/** Tema × kelompok (mis. per SPV): persen responden kelompok itu yang menyebut tema. Kelompok < MIN_GROUP = null. */
export function themeBySegment(responses: R[], themes: CompiledTheme[], segKey: string, themeKeys: string[]): ThemeSegmentRow[] {
  const by = new Map<string, R[]>();
  for (const r of counted(responses)) { const s = str(r.answers[segKey]); if (s) by.set(s, [...(by.get(s) ?? []), r]); }
  return [...by.entries()].map(([segment, list]) => {
    const hs = list.map((r) => new Set(themesOf(r, themes)));
    return { segment, n: list.length, values: Object.fromEntries(themeKeys.map((k) => [k, pct(hs.filter((h) => h.has(k)).length, list.length)])) };
  }).sort((a, b) => b.n - a.n || a.segment.localeCompare(b.segment, "id"));
}

/* ─── Riwayat satu orang ─── */

/** Kunci orang yang sama dengan aturan isian ganda: nama (huruf saja) + outlet bila ada. */
export function personKey(r: Pick<SurveyResponse, "respondent_name" | "answers">, storeKey = "store"): string | null {
  const nm = (r.respondent_name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!nm) return null;
  const st = str(r.answers[storeKey])?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return `${nm}|${st}`;
}
