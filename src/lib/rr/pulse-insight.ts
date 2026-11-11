/* ═══════════════════════════════════════════════════════════════════════════
   Insight AI untuk Pulse Check — fungsi murni (prompt, penyamaran nama, parser).
   Dipanggil oleh /api/pulse-insight (server, khusus HR); diuji di pulse-insight.test.ts.

   Yang dikirim ke penyedia AI (Groq): angka ringkasan, rincian per kelompok ≥ 3 orang,
   judul tindak lanjut yang masih terbuka, dan komentar tertulis YANG SUDAH DISAMARKAN
   (nama karyawan, email, nomor telepon diganti [nama]/[kontak]). Nama pengisi tidak
   pernah ikut. Hasil AI disamarkan sekali lagi sebelum disimpan, karena model bisa
   saja menyusun ulang nama dari konteks.

   Pelajaran dari Konsultan HR (CLAUDE.md §9b) dipakai di sini: konteks pekerjaan nyata
   ditulis di prompt, setiap temuan wajib menyebut angka/jumlah komentar, dan contoh
   jawaban tidak diberikan (model menyalinnya mentah).
   ═══════════════════════════════════════════════════════════════════════════ */

import { INSTANCE } from "../instance";
import { MAX_FOCUS, distribution, hasKpi, isVisible, kpi, periodLabel, type PeriodSummary, type SegmentPeriod, type Survey, type SurveyAction } from "./pulse";
import type { MasalahDasar, MasalahPeta, MasalahTheme } from "./pulse-themes";

export interface InsightContent {
  ringkasan: string;
  temuan: { judul: string; bukti: string; dampak: string }[];
  tema_komentar: { tema: string; jumlah: number; sentimen: "negatif" | "campuran" | "positif"; inti: string }[];
  rekomendasi: { judul: string; alasan: string; langkah: string[]; pic: string; tema: string; fokus: boolean }[];
  catatan_data: string[];
  /** Masalah utama dari SEMUA komentar (pulse-themes.ts): jumlah dihitung server, kalimat dari AI. Tidak ada di insight lama. */
  masalah_utama?: MasalahTheme[];
  masalah_dasar?: MasalahDasar;
  /** Semua tema + kode komentar per tema, untuk Kesimpulan per kategori di tab Komentar (khusus HR). */
  masalah_peta?: MasalahPeta;
  /** Ditambahkan server secara pasti (bukan AI): rekan paling sering diapresiasi. */
  apresiasi?: { name: string; count: number }[];
  dasar?: { period: string; responden: number; komentar: number };
}

const STOP = new Set(["muhammad", "muhamad", "mohammad", "mochammad", "moh", "abdul", "siti", "nur", "binti", "bin", "dan", "the"]);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bangun penyamar nama sekali, pakai berkali-kali (ratusan nama × ratusan komentar). */
export function makeScrubber(names: string[]): (text: string) => string {
  const tokens = new Set<string>();
  for (const n of names) {
    const parts = n.toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length > 1) tokens.add(parts.join(" "));
    for (const p of parts) if (p.length >= 3 && !STOP.has(p)) tokens.add(p);
  }
  const list = [...tokens].sort((a, b) => b.length - a.length).map((t) => escapeRe(t).replace(/ /g, "\\s+"));
  const re = list.length ? new RegExp(`\\b(?:${list.join("|")})\\b`, "gi") : null;
  return (text: string) => {
    let s = text
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[kontak]")
      .replace(/(?:\+?62|0)\d[\d\s-]{7,}\d/g, "[kontak]");
    if (re) s = s.replace(re, "[nama]");
    return s.replace(/(\[nama\][\s,]*){2,}/g, "[nama] ");
  };
}

export interface InsightInput {
  survey: Pick<Survey, "title" | "audience" | "questions" | "headline">;
  period: string;
  summaries: PeriodSummary[];
  segments: { label: string; data: SegmentPeriod | null } | null;
  openActions: Pick<SurveyAction, "title" | "theme" | "status" | "period">[];
  comments: { question: string; text: string }[];
  targetCount: number | null;
  /** Blok tema masalah (masalahPromptBlock). Bila ada, komentar mentah TIDAK dikirim lagi —
      tema sudah dibaca dari semua komentar, dan jatah token per menit tidak cukup untuk keduanya. */
  masalah?: string | null;
  /** Komentar hal baik (sudah disamarkan), contoh saja — untuk tema "yang sudah berjalan baik". */
  positives?: string[];
}

const POSITIVE_MAX = 15;
const POSITIVE_LEN = 100;

const COMMENT_MAX = 300;
const COMMENTS_MAX = 140;

const taskLegacy = () => `
TUGAS
Kamu analis people analytics senior yang membaca hasil pulse check ini untuk HR dan owner ${INSTANCE.shortName}. Tulis dalam Bahasa Indonesia yang lugas, untuk orang non-teknis.
Aturan:
1. Setiap temuan WAJIB menyebut angka dari data di atas (persen, jumlah orang, atau jumlah komentar). Tanpa angka = jangan ditulis.
2. Kelompokkan komentar menjadi tema; hitung berapa komentar per tema. Tulis intinya dengan parafrase — jangan mengutip kalimat asli lebih dari 6 kata, dan jangan menyebut nama atau petunjuk yang bisa mengungkap siapa penulisnya (outlet tertentu, jabatan tunggal).
3. Rekomendasi harus spesifik untuk bakery ritel dengan banyak outlet kecil dan anggaran terbatas: siapa melakukan apa, kapan, dan bagaimana mengukur berhasilnya. Hindari kalimat umum yang bisa ditempel ke perusahaan mana saja ("tingkatkan komunikasi", "adakan pelatihan", "ciptakan lingkungan kondusif") kecuali disertai bentuk konkretnya.
4. Bila sebuah keluhan sudah ada di daftar tindak lanjut terbuka, sebutkan bahwa itu keluhan berulang yang belum dijawab dan usulkan langkah yang membuatnya bergerak — jangan membuat butir baru yang sama.
5. Tandai paling banyak ${MAX_FOCUS} rekomendasi sebagai "fokus": yang dampaknya terbesar dan bisa mulai bulan ini.
6. Tulis di catatan_data keterbatasan yang nyata (jumlah responden kecil, kelompok tidak tampil, pertanyaan yang sedikit dijawab).

Kembalikan JSON dengan bentuk persis:
{"ringkasan": "2–3 kalimat", "temuan": [{"judul": "", "bukti": "", "dampak": ""}], "tema_komentar": [{"tema": "", "jumlah": 0, "sentimen": "negatif|campuran|positif", "inti": ""}], "rekomendasi": [{"judul": "", "alasan": "", "langkah": [""], "pic": "", "tema": "", "fokus": false}], "catatan_data": [""]}
Maksimal 5 temuan, 6 tema, 5 rekomendasi.`;

/** Tugas bila tema masalah sudah dipetakan: angka tema tidak boleh diubah, AI menulis kalimatnya. */
const taskWithThemes = () => `
TUGAS
Kamu analis people analytics senior yang membaca hasil survei ini untuk HR dan owner ${INSTANCE.shortName}. Tulis dalam Bahasa Indonesia yang lugas, untuk orang non-teknis. Hasilnya akan DIPRESENTASIKAN di rapat.
Aturan:
1. Setiap temuan WAJIB menyebut angka dari data di atas. Jumlah orang per tema masalah sudah dihitung pasti — pakai apa adanya, jangan menghitung ulang atau membulatkan berbeda.
2. masalah_utama: tulis untuk SETIAP id tema di daftar tema masalah (urutan sama). judul = kalimat pendek yang menyatakan masalahnya (maks 10 kata). inti = 1–2 kalimat: apa persisnya yang dikeluhkan dan kenapa penting, berdasarkan contoh. contoh = 1–2 parafrase pendek gaya ucapan pengisi (maks 15 kata, tanpa nama, tanpa nama outlet). usulan = satu langkah konkret: siapa, melakukan apa, kapan. berulang = true bila masalah itu sudah ada di daftar tindak lanjut terbuka.
3. Jangan menyebut nama atau petunjuk yang bisa mengungkap siapa penulis komentar. Nama SPV/kelompok boleh disebut hanya sebagai area, seperti di data.
4. Rekomendasi spesifik untuk bakery ritel dengan banyak outlet kecil dan anggaran terbatas. Hindari kalimat umum ("tingkatkan komunikasi", "adakan pelatihan") kecuali disertai bentuk konkretnya. Bila keluhan sudah ada di tindak lanjut terbuka, usulkan langkah yang membuatnya bergerak — jangan membuat butir baru yang sama.
5. Tandai paling banyak ${MAX_FOCUS} rekomendasi sebagai "fokus": dampak terbesar dan bisa mulai bulan ini.
6. tema_komentar: HANYA hal yang sudah berjalan baik menurut pengisi (dari contoh komentar hal baik), maks 3, sentimen "positif".
7. catatan_data: keterbatasan yang nyata saja.

Kembalikan JSON dengan bentuk persis:
{"ringkasan": "2–3 kalimat", "temuan": [{"judul": "", "bukti": "", "dampak": ""}], "masalah_utama": [{"id": "T1", "judul": "", "inti": "", "contoh": [""], "usulan": "", "berulang": false}], "tema_komentar": [{"tema": "", "jumlah": 0, "sentimen": "positif", "inti": ""}], "rekomendasi": [{"judul": "", "alasan": "", "langkah": [""], "pic": "", "tema": "", "fokus": false}], "catatan_data": [""]}
Maksimal 4 temuan, 3 tema_komentar, 4 rekomendasi (langkah maks 3), kalimat ringkas.`;

export function buildInsightPrompt(i: InsightInput): string {
  const idx = i.summaries.findIndex((p) => p.period === i.period);
  const cur = i.summaries[idx];
  const prev = i.summaries.slice(0, Math.max(0, idx)).reverse().find((p) => !p.suppressed);
  const kpiQs = i.survey.headline.map((k) => i.survey.questions.find((q) => q.key === k)).filter((q) => q && hasKpi(q));
  const lines: string[] = [];

  lines.push(`KONTEKS PERUSAHAAN
${INSTANCE.aiBusinessContext}`);

  lines.push(`\nSURVEI: ${i.survey.title} — bulan yang dinilai ${periodLabel(i.period)}. Pengisi: ${i.survey.audience ?? "-"}. Responden: ${cur?.n ?? 0}${i.targetCount ? ` dari target ${i.targetCount}` : ""}.`);

  lines.push("\nANGKA UTAMA (persen dari yang menjawab pertanyaan itu):");
  for (const q of kpiQs) {
    if (!q) continue;
    const a = cur ? kpi(q, cur.questions[q.key]) : null;
    const b = prev ? kpi(q, prev.questions[q.key]) : null;
    const name = q.kpiLabel ?? q.label;
    lines.push(`- ${name} (${q.kpiHint ?? ""}): ${a?.pct != null ? `${Math.round(a.pct)}% (${a.hits}/${a.n})` : "-"}${b?.pct != null ? `; bulan sebelumnya ${Math.round(b.pct)}%` : ""}${a?.kind === "risk" ? " — makin rendah makin baik" : ""}`);
  }
  const trendRows = i.summaries.filter((p) => !p.suppressed).slice(-6);
  if (trendRows.length > 1) {
    lines.push("\nTREN 6 BULAN TERAKHIR:");
    for (const p of trendRows) {
      lines.push(`- ${periodLabel(p.period)} (n=${p.n}): ` + kpiQs.map((q) => q ? `${q.kpiLabel ?? q.label} ${(() => { const k = kpi(q, p.questions[q.key]); return k?.pct != null ? `${Math.round(k.pct)}%` : "-"; })()}` : "").join(", "));
    }
  }

  if (cur && !cur.suppressed) {
    lines.push("\nSEBARAN JAWABAN PILIHAN BULAN INI:");
    for (const q of i.survey.questions) {
      if (q.type === "text" || i.survey.headline.includes(q.key)) continue;
      const rows = distribution(q, cur.questions[q.key]).filter((r) => r.count > 0);
      if (!rows.length) continue;
      lines.push(`- ${q.label}: ` + rows.map((r) => `${r.label} ${r.count}`).join(", "));
    }
  }

  if (i.segments?.data && Object.keys(i.segments.data.groups).length) {
    lines.push(`\nPER ${i.segments.label.toUpperCase()} (kelompok < 3 orang tidak ditampilkan):`);
    for (const [g, d] of Object.entries(i.segments.data.groups)) {
      lines.push(`- ${g} (n=${d.n}): ` + kpiQs.map((q) => { if (!q) return ""; const k = kpi(q, d.questions[q.key]); return `${q.kpiLabel ?? q.label} ${k?.pct != null ? `${Math.round(k.pct)}%` : "-"}`; }).join(", "));
    }
  }

  if (i.openActions.length) {
    lines.push(`\nTINDAK LANJUT YANG MASIH TERBUKA (${i.openActions.length} butir; belum ada yang selesai berarti keluhan lama belum dijawab):`);
    for (const a of i.openActions.slice(0, 40)) lines.push(`- [${periodLabel(a.period)} · ${a.theme ?? "lainnya"} · ${a.status}] ${a.title}`);
  }

  if (i.masalah) {
    lines.push(i.masalah);
    const pos = (i.positives ?? []).filter((t) => t.trim()).slice(0, POSITIVE_MAX);
    if (pos.length) {
      lines.push(`\nCONTOH KOMENTAR HAL BAIK (${pos.length}; nama sudah disamarkan):`);
      for (const t of pos) lines.push(`- ${t.replace(/\s+/g, " ").slice(0, POSITIVE_LEN)}`);
    }
  } else {
    const comments = i.comments.filter((c) => c.text.trim()).slice(0, COMMENTS_MAX);
    lines.push(`\nKOMENTAR TERTULIS BULAN INI (${comments.length}; nama sudah disamarkan):`);
    for (const c of comments) lines.push(`- (${c.question}) ${c.text.replace(/\s+/g, " ").slice(0, COMMENT_MAX)}`);
  }

  lines.push(i.masalah ? taskWithThemes() : taskLegacy());

  return lines.join("\n");
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

function parseLoose(raw: string): Record<string, unknown> {
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(json);
  } catch {
    const m = json.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Jawaban AI bukan JSON.");
    return JSON.parse(m[0]);
  }
}

export interface MasalahNarration { id: string; judul: string; inti: string; contoh: string[]; usulan: string; berulang: boolean }

/** Kalimat per tema masalah dari jawaban AI (hitungannya tidak diambil dari sini). */
export function parseMasalahNarration(raw: string, scrub: (s: string) => string = (s) => s): MasalahNarration[] {
  const o = parseLoose(raw);
  const S = (v: unknown, max?: number) => scrub(str(v, max));
  return arr(o.masalah_utama).map((m: Record<string, unknown>) => ({
    id: str(m?.id, 12), judul: S(m?.judul, 120), inti: S(m?.inti, 400),
    contoh: arr(m?.contoh).map((x) => S(x, 160)).filter(Boolean).slice(0, 2),
    usulan: S(m?.usulan, 300), berulang: m?.berulang === true,
  })).filter((m) => m.id);
}

/** Parser toleran: buang pagar kode, paksa tipe, potong panjang, dan batasi fokus. */
export function parseInsight(raw: string, scrub: (s: string) => string = (s) => s): InsightContent {
  const o = parseLoose(raw);
  const S = (v: unknown, max?: number) => scrub(str(v, max));
  let focus = 0;
  const out: InsightContent = {
    ringkasan: S(o.ringkasan, 900),
    temuan: arr(o.temuan).map((t: Record<string, unknown>) => ({ judul: S(t?.judul, 160), bukti: S(t?.bukti), dampak: S(t?.dampak) })).filter((t) => t.judul && t.bukti).slice(0, 5),
    tema_komentar: arr(o.tema_komentar).map((t: Record<string, unknown>) => ({
      tema: S(t?.tema, 80), jumlah: Math.max(0, Math.round(Number(t?.jumlah) || 0)),
      sentimen: (["negatif", "campuran", "positif"].includes(String(t?.sentimen)) ? t?.sentimen : "campuran") as InsightContent["tema_komentar"][number]["sentimen"],
      inti: S(t?.inti),
    })).filter((t) => t.tema).slice(0, 6),
    rekomendasi: arr(o.rekomendasi).map((r: Record<string, unknown>) => ({
      judul: S(r?.judul, 200), alasan: S(r?.alasan), langkah: arr(r?.langkah).map((x) => S(x, 300)).filter(Boolean).slice(0, 6),
      pic: S(r?.pic, 80), tema: S(r?.tema, 60), fokus: r?.fokus === true,
    })).filter((r) => r.judul).slice(0, 5).map((r) => ({ ...r, fokus: r.fokus && ++focus <= MAX_FOCUS })),
    catatan_data: arr(o.catatan_data).map((x) => S(x, 300)).filter(Boolean).slice(0, 5),
  };
  if (!out.ringkasan && !out.temuan.length) throw new Error("Jawaban AI kosong.");
  return out;
}

/** Komentar tertulis satu periode, hanya pertanyaan 'text' yang tampil, sudah disamarkan. */
export function collectComments(survey: Pick<Survey, "questions">, answersList: Record<string, unknown>[], scrub: (s: string) => string, skipKeys: string[] = []): { question: string; text: string }[] {
  const out: { question: string; text: string }[] = [];
  for (const a of answersList) {
    for (const q of survey.questions) {
      if (q.type !== "text" || skipKeys.includes(q.key)) continue;
      if (!isVisible(q, a as Record<string, string>)) continue;
      const v = a[q.key];
      if (typeof v === "string" && v.trim()) out.push({ question: q.label, text: scrub(v) });
    }
  }
  return out;
}
