/* ═══════════════════════════════════════════════════════════════════════════
   Masalah utama dari komentar — pemetaan tema SEMUA komentar satu siklus survei.
   Fungsi murni; dipanggil /api/pulse-insight (langkah "tema"), diuji di pulse-themes.test.ts.

   Kenapa bertahap. Insight lama mengirim 140 komentar pertama saja (urut pengisi), jadi
   pada Feedback SPG → SPV Oktober 2026 (±400 komentar berisi dari ±158 SPG) dua pertiga
   SPG tidak pernah terbaca. Semua komentar tidak muat dalam satu permintaan: batas Groq
   paket gratis untuk model ini 8.000 token per menit (console.groq.com/docs/rate-limits,
   dicek 11 Nov 2026). Karena itu komentar dibagi ke beberapa bagian; tiap bagian dibaca
   satu permintaan, dengan jeda sampai jatah token pulih.

   Pembagian kerja AI ↔ server:
   - AI hanya MENANDAI: pengisi #k masuk tema mana, dan mengusulkan tema baru bila
     belum ada yang cocok. Tema dari bagian pertama dipakai ulang di bagian berikutnya
     supaya hitungannya satu daftar.
   - Server MENGHITUNG: jumlah pengisi per tema (orang, bukan komentar), persen dari
     yang menjawab, dan sebaran per kelompok (mis. SPV area). Angka di layar dengan
     begitu bisa dicek ulang dan tidak bergantung pada AI yang pandai menebak angka.

   Penandaan PER KOMENTAR (#12A = pengisi 12, pertanyaan A), bukan per orang, supaya tab
   Komentar bisa menampilkan komentar yang benar-benar membicarakan isu itu (Kesimpulan per
   kategori). Jumlah tetap dihitung per ORANG. Tiap tema juga diberi kategori kesimpulan
   (Company Benefit / Work Environment / Technical Issue / Personal Issue, + Kinerja SPV
   untuk survei yang menilai SPV) — lihat conclusionCategories() di pulse.ts.

   Kerahasiaan sama dengan insight: teks sudah disamarkan (makeScrubber) sebelum masuk
   ke sini; sebaran per kelompok hanya untuk kelompok ≥ 3 pengisi (cermin
   pi_survey_segments); tema yang disebut < 2 orang tidak ditampilkan sebagai "utama".
   ═══════════════════════════════════════════════════════════════════════════ */

import { APPRECIATION_KEYS, isVisible, type Survey } from "./pulse";

/** Isian teks yang isinya identitas (outlet, SPV, nama rekan), bukan pendapat — tidak dikirim ke AI, tidak dihitung sebagai komentar. */
export const NON_OPINION_KEYS = ["store", "joined_since", "spv", "work_hours", "training_doc", "rater", ...APPRECIATION_KEYS];

export type Pemilik = "spv" | "perusahaan" | "operasional";
export const PEMILIK: Pemilik[] = ["spv", "perusahaan", "operasional"];
export const PEMILIK_LABEL: Record<Pemilik, string> = {
  spv: "Perilaku SPV",
  perusahaan: "Kebijakan perusahaan / HR",
  operasional: "Operasional outlet & gudang",
};

/** Satu pengisi = satu unit: semua komentar masalahnya digabung (rid = id jawaban). */
export interface ProblemUnit { rid: string; group: string | null; parts: { tag: string; key: string; text: string }[] }
export interface ThemeDef { id: string; nama: string; definisi: string; pemilik: Pemilik; kategori: string }
/** Hasil sementara antar-bagian. tags: `${id jawaban}:${key pertanyaan}` → id tema. */
export interface ThemeState { themes: ThemeDef[]; tags: Record<string, string[]> }
export const tagKey = (rid: string, key: string) => `${rid}:${key}`;
const ridOf = (k: string) => k.slice(0, k.lastIndexOf(":"));

/** Kategori bawaan bila AI memberi kategori di luar daftar. */
export function defaultKategori(pemilik: Pemilik, categories: readonly string[]): string {
  const want = pemilik === "spv" ? categories.find((c) => /spv|atasan/i.test(c)) : pemilik === "operasional" ? "Technical Issue" : "Company Benefit";
  return want && categories.includes(want) ? want : categories[0] ?? "Lainnya";
}

export interface MasalahTheme {
  id: string;
  judul: string;
  pemilik: Pemilik;
  inti: string;
  contoh: string[];
  usulan: string;
  /** Kategori kesimpulan (Company Benefit, Kinerja SPV, …). Kosong di insight sebelum fitur kategori. */
  kategori?: string;
  /** Sudah ada di tindak lanjut terbuka (keluhan lama yang belum dijawab). */
  berulang: boolean;
  /** Dihitung server: jumlah pengisi yang menyebut. */
  jumlah: number;
  /** Persen dari seluruh pengisi siklus ini. */
  persen: number;
  /** Kelompok ≥ 3 pengisi yang menyebut tema ini, urut persen tertinggi. */
  per_kelompok: { grup: string; jumlah: number; n: number; persen: number }[];
}

/** Peta lengkap (semua tema, termasuk yang < 2 orang) untuk tab Komentar — khusus dibaca HR. */
export interface MasalahPeta {
  tema: { id: string; nama: string; kategori: string; pemilik: Pemilik; jumlah: number }[];
  /** `${id jawaban}:${key pertanyaan}` → id tema. */
  tags: Record<string, string[]>;
}

export interface MasalahDasar {
  responden: number;
  responden_berkomentar: number;
  komentar: number;
  tanpa_tema: number;
  kelompok_label: string | null;
}

export const UNIT_TEXT_MAX = 240;
export const MIN_THEME_PEOPLE = 2;
export const MAX_THEMES = 10;
export const MIN_GROUP = 3;
/** Anggaran karakter komentar per bagian. ≈ 4.000 token (Bahasa Indonesia campur singkatan ≈ 3 karakter/token),
    ditambah instruksi, daftar tema, dan jawaban 1.600 token = di bawah 8.000 token per menit. */
export const BATCH_CHARS = 12_000;

/* ─── Komentar yang tidak berisi apa-apa ─── */

const TRIVIAL = new RegExp(
  "^(?:" + [
    "(?:tidak|tdk|gak|ga|nggak|ngga|enggak|belum|blm)\\s*(?:ada|adaa+)?(?:\\s*(?:sih|kak|pak|bu|kok|untuk saat ini|sejauh ini|kayaknya))*",
    "(?:sejauh ini|untuk saat ini|so far)\\s*(?:tidak ada|aman|baik|cukup|oke|ok)?",
    "(?:sudah|udah|sdh|udh)?\\s*(?:sangat |cukup |semua |semuanya )?(?:baik|bagus|oke|ok|aman|mantap|puas|cukup)(?:\\s*(?:semua|semuanya|sekali|banget|selama ini|kok))*",
    "nihil|none|no|nothing|ada|cukup|terima ?kasih|makasih|thanks?",
    "-+|\\.+|x+|0",
  ].join("|") + ")$",
  "i",
);

/** true = jawaban kosong makna ("tidak ada", "sudah baik", "-"). Tidak dikirim ke AI dan tidak dihitung. */
export function isTrivialComment(text: string): boolean {
  const t = text.normalize("NFKC").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/[!?,;:"'()]+/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 2) return true;
  return TRIVIAL.test(t.replace(/[.\s]+$/, "").trim());
}

/** Pertanyaan yang memang meminta hal baik (mis. "Apa yang sudah dilakukan SPV dengan baik?") — bukan sumber masalah. */
export function isPositiveQuestion(label: string): boolean {
  return /dengan baik|sudah baik|hal (?:baik|positif)|apresiasi|yang (?:kamu |anda )?suka|terima kasih kepada/i.test(label);
}

/** Kode pendek pertanyaan (A, B, …) supaya label panjang tidak diulang di setiap baris. */
export function questionLegend(survey: Pick<Survey, "questions">, skipKeys: string[]): { key: string; tag: string; label: string }[] {
  const out: { key: string; tag: string; label: string }[] = [];
  for (const q of survey.questions) {
    if (q.type !== "text" || skipKeys.includes(q.key) || isPositiveQuestion(q.label)) continue;
    out.push({ key: q.key, tag: String.fromCharCode(65 + out.length), label: q.label.replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** Unit per pengisi, urut id jawaban (stabil antar-permintaan). Pengisi tanpa komentar berisi tidak ikut. */
export function buildProblemUnits(
  survey: Pick<Survey, "questions">,
  responses: { id: string; answers: Record<string, unknown> }[],
  scrub: (s: string) => string,
  skipKeys: string[],
  segKey: string | null,
): ProblemUnit[] {
  const legend = questionLegend(survey, skipKeys);
  const byKey = new Map(survey.questions.map((q) => [q.key, q]));
  const units: ProblemUnit[] = [];
  for (const r of [...responses].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const parts: ProblemUnit["parts"] = [];
    for (const l of legend) {
      const q = byKey.get(l.key);
      if (!q || !isVisible(q, r.answers as Record<string, string>)) continue;
      const v = r.answers[l.key];
      if (typeof v !== "string" || isTrivialComment(v)) continue;
      parts.push({ tag: l.tag, key: l.key, text: scrub(v.replace(/\s+/g, " ").trim()).slice(0, UNIT_TEXT_MAX) });
    }
    if (!parts.length) continue;
    const g = segKey ? String(r.answers[segKey] ?? "").trim() : "";
    units.push({ rid: r.id, group: segKey ? g || "Tidak diisi" : null, parts });
  }
  return units;
}

const unitChars = (u: ProblemUnit) => u.parts.reduce((a, p) => a + p.text.length + 6, 6);

/** Bagi unit ke beberapa bagian ≤ anggaran karakter. Urutan dipertahankan; unit tidak pernah dipecah. */
export function planBatches(units: ProblemUnit[], budget = BATCH_CHARS): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  units.forEach((u, i) => {
    const c = unitChars(u);
    if (cur.length && used + c > budget) { out.push(cur); cur = []; used = 0; }
    cur.push(i);
    used += c;
  });
  if (cur.length) out.push(cur);
  return out;
}

/* ─── Prompt penandaan ─── */

export interface ClassifyInput {
  surveyTitle: string;
  audience: string | null;
  legend: { tag: string; label: string }[];
  units: ProblemUnit[];
  /** Indeks unit (dalam daftar penuh) yang dibaca di bagian ini; ditulis #(indeks+1). */
  batch: number[];
  batchNo: number;
  batches: number;
  themes: ThemeDef[];
  openActions: string[];
  categories: readonly string[];
}

export function buildClassifyPrompt(i: ClassifyInput): string {
  const L: string[] = [];
  L.push(`SURVEI: ${i.surveyTitle}. Pengisi: ${i.audience ?? "-"}.`);
  L.push(`Ini bagian ${i.batchNo} dari ${i.batches}. Tiap baris = komentar keluhan/usulan dari SATU pengisi; tiap komentar diberi kode pertanyaan [A], [B], …. Nama dan kontak sudah disamarkan.`);
  L.push("\nKODE PERTANYAAN:");
  for (const l of i.legend) L.push(`[${l.tag}] ${l.label}`);
  if (i.themes.length) {
    L.push("\nTEMA YANG SUDAH ADA (dari bagian sebelumnya — PAKAI ULANG id-nya bila cocok):");
    for (const t of i.themes) L.push(`${t.id} | ${t.pemilik} | ${t.kategori} | ${t.nama}: ${t.definisi}`);
  }
  if (i.openActions.length) {
    L.push("\nKELUHAN YANG SUDAH ADA DI DAFTAR TINDAK LANJUT (untuk konteks saja):");
    for (const a of i.openActions.slice(0, 20)) L.push(`- ${a}`);
  }
  L.push("\nKOMENTAR:");
  for (const idx of i.batch) {
    const u = i.units[idx];
    L.push(`#${idx + 1} ` + u.parts.map((p) => `[${p.tag}] ${p.text}`).join(" "));
  }
  const room = Math.max(0, MAX_THEMES - i.themes.length);
  L.push(`
TUGAS
Kelompokkan MASALAH yang disebut pengisi (keluhan, kendala, permintaan perbaikan) ke dalam tema, PER KOMENTAR.
1. Satu tema = satu masalah yang bisa ditindaklanjuti satu pihak, mis. "Jatah libur ingin 4x sebulan", "SPV jarang membalas chat", "Stok kiriman sering kurang". Jangan membuat tema umum seperti "Masalah kerja" atau "Lainnya".
2. pemilik = siapa yang bisa memperbaikinya: "spv" (perilaku/cara kerja SPV/atasan), "perusahaan" (gaji, libur, jam kerja, BPJS, aturan HR), "operasional" (stok, kiriman, gudang, fasilitas outlet, kemasan).
3. kategori = salah satu dari: ${i.categories.map((c) => `"${c}"`).join(", ")}. Company Benefit = gaji, libur/cuti, BPJS, tunjangan, bonus. Work Environment = jam kerja/shift, beban kerja, hubungan dengan rekan/atasan, suasana kerja. Technical Issue = stok, kiriman, peralatan, fasilitas outlet, sistem, kemasan/produk. Personal Issue = keadaan pribadi pengisi.${i.categories.some((c) => /spv|atasan/i.test(c)) ? " Masalah tentang perilaku atau cara kerja SPV masuk kategori SPV, bukan Work Environment." : ""}
4. Tandai tiap KOMENTAR dengan kode pengisi + kode pertanyaan, mis. "#12A". Satu komentar boleh masuk beberapa tema. Komentar yang tidak menyebut masalah apa pun (pujian/harapan umum) JANGAN ditandai.
5. ${i.themes.length ? `Pakai tema yang sudah ada bila cocok. Tema baru hanya bila benar-benar berbeda (sisa ruang: ${room} tema baru).` : `Paling banyak ${MAX_THEMES} tema; gabungkan yang mirip.`}
6. Tandai hanya berdasarkan isi komentar. Jangan menebak.

Kembalikan JSON persis (ringkas, tanpa spasi berlebih):
{"tema_baru": [{"id": "B1", "nama": "maks 8 kata", "definisi": "1 kalimat: komentar seperti apa yang masuk", "pemilik": "spv|perusahaan|operasional", "kategori": "${i.categories[0] ?? ""}"}], "tag": {"#12A": ["T1", "B1"], "#12C": ["T2"]}}
Id tema baru tulis B1, B2, … (server memberi id tetap). Hanya cantumkan komentar yang masuk minimal satu tema.`);
  return L.join("\n");
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** JSON dari AI; bila jawabannya terpotong (batas token), coba selamatkan bagian yang sudah lengkap. */
function parseLooseJson(raw: string): Record<string, unknown> {
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(json); } catch { /* lanjut */ }
  const m = json.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* lanjut */ } }
  // Terpotong di tengah "tag": buang entri terakhir yang belum selesai lalu tutup kurung.
  const cut = json.lastIndexOf("]");
  if (json.startsWith("{") && cut > 0) {
    for (const tail of ["}}", "]}", "}"]) {
      try { return JSON.parse(json.slice(0, cut + 1) + tail); } catch { /* coba berikutnya */ }
    }
  }
  throw new Error("Jawaban AI bukan JSON.");
}

/** Gabungkan jawaban AI satu bagian ke state. Kode komentar di luar bagian ini dan id tema yang tidak dikenal dibuang. */
export function mergeClassification(raw: string, state: ThemeState, units: ProblemUnit[], batch: number[], categories: readonly string[], scrub: (s: string) => string = (s) => s): ThemeState {
  const o = parseLooseJson(raw);
  const themes = state.themes.map((t) => ({ ...t }));
  const known = new Set(themes.map((t) => t.id));
  const alias = new Map<string, string>();
  let next = themes.reduce((m, t) => Math.max(m, Number(t.id.slice(1)) || 0), 0);
  for (const t of Array.isArray(o.tema_baru) ? o.tema_baru : []) {
    const r = t as Record<string, unknown>;
    const nama = scrub(str(r?.nama, 80));
    if (!nama || themes.length >= MAX_THEMES) continue;
    const dup = themes.find((x) => x.nama.toLowerCase() === nama.toLowerCase());
    const aiId = str(r?.id, 12);
    if (dup) { if (aiId) alias.set(aiId, dup.id); continue; }
    const id = `T${++next}`;
    const pemilik = (PEMILIK.includes(r?.pemilik as Pemilik) ? r?.pemilik : "perusahaan") as Pemilik;
    const kat = str(r?.kategori, 40);
    themes.push({ id, nama, definisi: scrub(str(r?.definisi, 200)), pemilik, kategori: categories.includes(kat) ? kat : defaultKategori(pemilik, categories) });
    known.add(id);
    if (aiId) alias.set(aiId, id);
  }
  // "#12A" → komentar pertanyaan A milik pengisi #12; "#12" saja → semua komentar pengisi itu.
  const allowed = new Map<string, string[]>();
  for (const idx of batch) {
    const u = units[idx];
    allowed.set(`#${idx + 1}`, u.parts.map((p) => tagKey(u.rid, p.key)));
    for (const p of u.parts) allowed.set(`#${idx + 1}${p.tag}`, [tagKey(u.rid, p.key)]);
  }
  const tags = { ...state.tags };
  const tagObj = (o.tag && typeof o.tag === "object" && !Array.isArray(o.tag) ? o.tag : {}) as Record<string, unknown>;
  for (const [ref, ids] of Object.entries(tagObj)) {
    const r = ref.trim().toUpperCase().replace(/\s+/g, "");
    const keys = allowed.get(r.startsWith("#") ? r : `#${r}`);
    if (!keys || !Array.isArray(ids)) continue;
    const clean = [...new Set(ids.map((x) => { const s = String(x).trim(); return alias.get(s) ?? s; }).filter((s) => known.has(s)))];
    if (!clean.length) continue;
    for (const k of keys) tags[k] = [...new Set([...(tags[k] ?? []), ...clean])];
  }
  return { themes, tags };
}

/* ─── Hitungan pasti ─── */

export interface ThemeTally { theme: ThemeDef; jumlah: number; persen: number; per_kelompok: MasalahTheme["per_kelompok"] }

/**
 * Jumlah pengisi per tema dari tanda AI. persen = dari SELURUH pengisi siklus (bukan dari yang berkomentar),
 * supaya sebanding dengan tabel "Keluhan & usulan" di dashboard. groupN = jumlah pengisi per kelompok.
 */
export function tallyThemes(state: ThemeState, units: ProblemUnit[], respondents: number, groupN: Map<string, number>): { tally: ThemeTally[]; dasar: Omit<MasalahDasar, "kelompok_label"> } {
  const live = new Set(units.map((u) => u.rid));
  const groupOf = new Map(units.map((u) => [u.rid, u.group]));
  const out: ThemeTally[] = [];
  for (const t of state.themes) {
    const rids = [...new Set(Object.entries(state.tags).filter(([, ids]) => ids.includes(t.id)).map(([k]) => ridOf(k)))].filter((rid) => live.has(rid));
    if (rids.length < MIN_THEME_PEOPLE) continue;
    const byG = new Map<string, number>();
    for (const rid of rids) { const g = groupOf.get(rid); if (g) byG.set(g, (byG.get(g) ?? 0) + 1); }
    const per_kelompok = [...byG].map(([grup, jumlah]) => ({ grup, jumlah, n: groupN.get(grup) ?? 0 }))
      .filter((g) => g.n >= MIN_GROUP)
      .map((g) => ({ ...g, persen: Math.round((g.jumlah / g.n) * 100) }))
      .sort((a, b) => b.persen - a.persen || b.jumlah - a.jumlah);
    out.push({ theme: t, jumlah: rids.length, persen: respondents ? Math.round((rids.length / respondents) * 100) : 0, per_kelompok });
  }
  out.sort((a, b) => b.jumlah - a.jumlah || a.theme.id.localeCompare(b.theme.id));
  const tagged = units.filter((u) => u.parts.some((p) => state.tags[tagKey(u.rid, p.key)]?.length)).length;
  return {
    tally: out,
    dasar: { responden: respondents, responden_berkomentar: units.length, komentar: units.reduce((a, u) => a + u.parts.length, 0), tanpa_tema: units.length - tagged },
  };
}

/** Contoh komentar per tema untuk prompt akhir: dari kelompok berbeda bila bisa, yang paling berisi lebih dulu. */
export function themeSamples(state: ThemeState, units: ProblemUnit[], themeId: string, k = 2, max = 140): string[] {
  const pick = units.flatMap((u) => u.parts.filter((p) => state.tags[tagKey(u.rid, p.key)]?.includes(themeId)).map((p) => ({ g: u.group, text: p.text })))
    .sort((a, b) => b.text.length - a.text.length);
  const out: string[] = [];
  const seenG = new Set<string | null>();
  for (const p of pick) { if (out.length >= k) break; if (seenG.has(p.g) && pick.length > k) continue; seenG.add(p.g); out.push(p.text.slice(0, max)); }
  for (const p of pick) { if (out.length >= k) break; const t = p.text.slice(0, max); if (!out.includes(t)) out.push(t); }
  return out;
}

/** Blok prompt untuk insight akhir. Angka sudah pasti; AI hanya diminta merangkai kalimat. */
export function masalahPromptBlock(tally: ThemeTally[], state: ThemeState, units: ProblemUnit[], dasar: Omit<MasalahDasar, "kelompok_label">, groupLabel: string | null): string {
  const L: string[] = [];
  L.push(`\nTEMA MASALAH DARI SEMUA KOMENTAR (${dasar.responden_berkomentar} dari ${dasar.responden} pengisi menulis keluhan/usulan; jumlah = orang, DIHITUNG PASTI — jangan diubah):`);
  for (const t of tally.slice(0, 8)) {
    const spread = t.per_kelompok.slice(0, 3).map((g) => `${g.grup} ${g.jumlah}/${g.n}`).join(", ");
    L.push(`${t.theme.id} | ${t.theme.pemilik} | ${t.theme.kategori} | ${t.theme.nama} — ${t.jumlah} orang (${t.persen}%)${spread && groupLabel ? `; terbanyak di ${groupLabel}: ${spread}` : ""}`);
    for (const s of themeSamples(state, units, t.theme.id)) L.push(`   contoh: ${s}`);
  }
  if (dasar.tanpa_tema) L.push(`(${dasar.tanpa_tema} pengisi berkomentar tapi tidak masuk tema mana pun.)`);
  return L.join("\n");
}

/** Gabungkan narasi AI (per id tema) dengan hitungan server. Tema tanpa narasi tetap tampil dengan nama & definisinya. */
export function composeMasalah(tally: ThemeTally[], narr: { id: string; judul: string; inti: string; contoh: string[]; usulan: string; berulang: boolean }[]): MasalahTheme[] {
  const byId = new Map(narr.map((n) => [n.id, n]));
  return tally.slice(0, 8).map((t) => {
    const n = byId.get(t.theme.id);
    return {
      id: t.theme.id,
      judul: n?.judul || t.theme.nama,
      pemilik: t.theme.pemilik,
      kategori: t.theme.kategori,
      inti: n?.inti || t.theme.definisi,
      contoh: n?.contoh ?? [],
      usulan: n?.usulan ?? "",
      berulang: n?.berulang ?? false,
      jumlah: t.jumlah,
      persen: t.persen,
      per_kelompok: t.per_kelompok,
    };
  });
}

/** Teks siap tempel ke slide/WA. Nama kelompok (mis. SPV) ikut — sama dengan yang tampil di rapor. */
export function masalahAsText(periodName: string, tema: MasalahTheme[], dasar: MasalahDasar | undefined): string {
  const L: string[] = [`Masalah utama dari komentar — ${periodName}`];
  if (dasar) L.push(`Dasar: ${dasar.responden_berkomentar} dari ${dasar.responden} pengisi menulis keluhan/usulan.`);
  tema.forEach((t, i) => {
    L.push("");
    L.push(`${i + 1}. ${t.judul} — ${t.jumlah} orang (${t.persen}%) · ${PEMILIK_LABEL[t.pemilik]}${t.berulang ? " · keluhan berulang" : ""}`);
    if (t.inti) L.push(`   ${t.inti}`);
    if (t.per_kelompok.length && dasar?.kelompok_label) L.push(`   Terbanyak di ${dasar.kelompok_label}: ${t.per_kelompok.slice(0, 3).map((g) => `${g.grup} ${g.persen}% (${g.jumlah}/${g.n})`).join(", ")}`);
    if (t.contoh.length) L.push(`   Contoh (parafrase): ${t.contoh.join(" · ")}`);
    if (t.usulan) L.push(`   Usulan: ${t.usulan}`);
  });
  return L.join("\n");
}

/** State dari browser hanya dipercaya setelah dibersihkan: id tema harus T<angka>, kode komentar harus ada di siklus ini. */
export function sanitizeState(raw: unknown, units: ProblemUnit[], categories: readonly string[]): ThemeState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const themes: ThemeDef[] = [];
  for (const t of Array.isArray(o.themes) ? o.themes : []) {
    const r = t as Record<string, unknown>;
    const id = str(r?.id, 6);
    const nama = str(r?.nama, 80);
    if (!/^T\d{1,3}$/.test(id) || !nama || themes.some((x) => x.id === id) || themes.length >= MAX_THEMES) continue;
    const pemilik = (PEMILIK.includes(r?.pemilik as Pemilik) ? r?.pemilik : "perusahaan") as Pemilik;
    const kat = str(r?.kategori, 40);
    themes.push({ id, nama, definisi: str(r?.definisi, 200), pemilik, kategori: categories.includes(kat) ? kat : defaultKategori(pemilik, categories) });
  }
  const ids = new Set(themes.map((t) => t.id));
  const keys = new Set(units.flatMap((u) => u.parts.map((p) => tagKey(u.rid, p.key))));
  const tags: ThemeState["tags"] = {};
  const rawTags = (o.tags && typeof o.tags === "object" && !Array.isArray(o.tags) ? o.tags : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawTags)) {
    if (!keys.has(k) || !Array.isArray(v)) continue;
    const clean = [...new Set(v.map(String).filter((x) => ids.has(x)))];
    if (clean.length) tags[k] = clean;
  }
  return { themes, tags };
}

/** Peta lengkap untuk tab Komentar: semua tema (termasuk yang disebut 1 orang) + kode komentar per tema. */
export function buildPeta(state: ThemeState, units: ProblemUnit[]): MasalahPeta {
  const live = new Set(units.flatMap((u) => u.parts.map((p) => tagKey(u.rid, p.key))));
  const tags = Object.fromEntries(Object.entries(state.tags).filter(([k]) => live.has(k)));
  const tema = state.themes.map((t) => ({
    id: t.id, nama: t.nama, kategori: t.kategori, pemilik: t.pemilik,
    jumlah: new Set(Object.entries(tags).filter(([, ids]) => ids.includes(t.id)).map(([k]) => ridOf(k))).size,
  })).filter((t) => t.jumlah > 0).sort((a, b) => b.jumlah - a.jumlah);
  return { tema, tags };
}

/** Usulan teks kesimpulan untuk satu kategori, disusun pasti dari tema (tanpa panggilan AI tambahan). */
export function conclusionDraft(kategori: string, peta: MasalahPeta, utama: MasalahTheme[], responden: number, groupLabel: string | null): string {
  const byId = new Map(utama.map((m) => [m.id, m]));
  return peta.tema.filter((t) => t.kategori === kategori).map((t) => {
    const m = byId.get(t.id);
    const pct = responden ? Math.round((t.jumlah / responden) * 100) : 0;
    const lines = [`• ${m?.judul ?? t.nama} — ${t.jumlah} orang (${pct}%)`];
    if (m?.per_kelompok.length && groupLabel) lines.push(`  Terbanyak di ${groupLabel}: ${m.per_kelompok.slice(0, 3).map((g) => `${g.grup} ${g.persen}%`).join(", ")}`);
    if (m?.inti) lines.push(`  ${m.inti}`);
    if (m?.usulan) lines.push(`  Usulan: ${m.usulan}`);
    return lines.join("\n");
  }).join("\n");
}

/** Berapa detik menunggu sebelum panggilan berikutnya, dari sisa jatah token yang dilaporkan Groq. */
export function waitBeforeNext(remainingTokens: number | null, resetSeconds: number | null, needTokens = 7000): number {
  if (remainingTokens == null || remainingTokens >= needTokens) return 0;
  return Math.min(75, Math.ceil(resetSeconds ?? 60) + 2);
}
