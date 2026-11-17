/* ═══════════════════════════════════════════════════════════════════════════
   Mengisi berkas template KantorKu ASLI — bukan membuat spreadsheet baru.

   Berkas xlsx dibuka sebagai zip dan hanya sel A–AR baris 6 dst. di sheet
   "Import Employees Template" yang ditulis (sebagai inline string / angka, dengan
   gaya sel bawaan template). Semua yang lain — sheet Instructions, REF, Existing Data,
   dropdown (data validation), rumus Row Status, conditional formatting, lebar kolom —
   ikut utuh byte-per-byte, supaya KantorKu menerima berkasnya persis seperti template
   yang diunduh dari sana.

   Diuji di xlsx.test.ts terhadap template asli (fixture di tes, bukan data karyawan).
   ═══════════════════════════════════════════════════════════════════════════ */

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { KK_COLUMNS, KK_FIRST_DATA_ROW, KK_LAST_DATA_ROW, KK_SHEET_IMPORT, KK_SHEET_UNITS } from "./spec";
import type { KkUnits, KkValue } from "./map";

type Files = Record<string, Uint8Array>;

const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // karakter kontrol tidak sah di XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const xmlUnesc = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Path worksheet (mis. "xl/worksheets/sheet2.xml") untuk nama sheet tertentu. */
function sheetPath(files: Files, name: string): string {
  const wb = strFromU8(files["xl/workbook.xml"] ?? new Uint8Array());
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"] ?? new Uint8Array());
  const sheet = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((tag) => xmlUnesc(tag.match(/\bname="([^"]*)"/)?.[1] ?? "") === name);
  const rid = sheet?.match(/\br:id="([^"]+)"/)?.[1];
  if (!rid) throw new Error(`Sheet "${name}" tidak ada — ini bukan template impor karyawan KantorKu.`);
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((tag) => tag.includes(`Id="${rid}"`));
  const target = rel?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) throw new Error(`Sheet "${name}" rusak di template.`);
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

function sharedStrings(files: Files): string[] {
  const raw = files["xl/sharedStrings.xml"];
  if (!raw) return [];
  const xml = strFromU8(raw);
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => xmlUnesc(t[1])).join(""));
}

const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "";
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
};

/** Branch / Department / Position yang sudah diatur di KantorKu (sheet "Existing Data", baris 3 dst.). */
export function readUnits(xlsx: Uint8Array): KkUnits {
  const files = unzipSync(xlsx);
  const xml = strFromU8(files[sheetPath(files, KK_SHEET_UNITS)]);
  const ss = sharedStrings(files);
  const cols: string[][] = [[], [], []];
  for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    if (+m[1] < 3) continue;
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = c[1].match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
      const i = colIndex(ref) - 1;
      if (i < 0 || i > 2 || !c[2]) continue;
      const t = c[1].match(/\bt="([^"]+)"/)?.[1];
      let val = "";
      if (t === "s") val = ss[+(c[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? -1)] ?? "";
      else if (t === "inlineStr") val = [...c[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => xmlUnesc(x[1])).join("");
      else val = xmlUnesc(c[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? "");
      val = val.trim();
      if (val && !cols[i].includes(val)) cols[i].push(val);
    }
  }
  return { branches: cols[0], departments: cols[1], positions: cols[2] };
}

function cellXml(ref: string, style: string, value: KkValue): string {
  const s = style ? ` s="${style}"` : "";
  if (value == null || value === "") return `<c r="${ref}"${s}></c>`;
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : `<c r="${ref}"${s}></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
}

/** Tulis `rows` (nilai A…AR per baris, urutan KK_COLUMNS) mulai baris 6. Mengembalikan xlsx baru. */
export function fillTemplate(xlsx: Uint8Array, rows: KkValue[][]): Uint8Array {
  const capacity = KK_LAST_DATA_ROW - KK_FIRST_DATA_ROW + 1;
  if (rows.length > capacity) throw new Error(`Template hanya menampung ${capacity} karyawan per berkas — ekspor dibagi beberapa kali.`);
  const files = unzipSync(xlsx);
  const path = sheetPath(files, KK_SHEET_IMPORT);
  let xml = strFromU8(files[path]);
  const letters = KK_COLUMNS.map((c) => c.col);

  rows.forEach((values, i) => {
    if (values.length !== letters.length) throw new Error(`Baris ${i + 1}: ${values.length} nilai, seharusnya ${letters.length}.`);
    const r = KK_FIRST_DATA_ROW + i;
    const start = xml.indexOf(`<row r="${r}"`);
    if (start < 0) throw new Error(`Baris ${r} tidak ada di template.`);
    const end = xml.indexOf("</row>", start);
    let row = xml.slice(start, end);
    letters.forEach((col, j) => {
      const ref = `${col}${r}`;
      const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
      const m = row.match(re);
      const style = m?.[1].match(/\bs="(\d+)"/)?.[1] ?? "";
      const cell = cellXml(ref, style, values[j]);
      if (m) row = row.replace(m[0], cell);
      else {
        // Sel belum ada (template lain) — sisipkan sebelum sel kolom yang lebih kanan.
        const after = [...row.matchAll(/<c r="([A-Z]+)\d+"/g)].find((x) => colIndex(x[1]) > colIndex(col));
        row = after ? row.slice(0, after.index) + cell + row.slice(after.index) : row.replace(/^(<row[^>]*>)/, `$1${cell}`) ;
      }
    });
    xml = xml.slice(0, start) + row + xml.slice(end);
  });
  files[path] = strToU8(xml);

  // Rumus "Row Status" disimpan tanpa nilai cache — minta Excel menghitung ulang saat dibuka.
  const wbPath = "xl/workbook.xml";
  const wb = strFromU8(files[wbPath]);
  files[wbPath] = strToU8(/<calcPr\b/.test(wb)
    ? wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_, attrs: string, slash: string) => `<calcPr${attrs.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${slash}>`)
    : wb.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`));

  const out: Zippable = {};
  for (const [name, data] of Object.entries(files)) out[name] = [data, { level: 6 }];
  return zipSync(out);
}

/** Baca kembali baris data (untuk tes & pratinjau): nilai A…AR mulai baris 6 sampai baris kosong pertama. */
export function readFilledRows(xlsx: Uint8Array): string[][] {
  const files = unzipSync(xlsx);
  const xml = strFromU8(files[sheetPath(files, KK_SHEET_IMPORT)]);
  const ss = sharedStrings(files);
  const out: string[][] = [];
  for (let r = KK_FIRST_DATA_ROW; r <= KK_LAST_DATA_ROW; r++) {
    const start = xml.indexOf(`<row r="${r}"`);
    if (start < 0) break;
    const row = xml.slice(start, xml.indexOf("</row>", start));
    const vals = KK_COLUMNS.map(({ col }) => {
      const m = row.match(new RegExp(`<c r="${col}${r}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`));
      if (!m?.[2]) return "";
      const t = m[1].match(/\bt="([^"]+)"/)?.[1];
      if (t === "inlineStr") return [...m[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => xmlUnesc(x[1])).join("");
      if (t === "s") return ss[+(m[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? -1)] ?? "";
      return xmlUnesc(m[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? "");
    });
    if (vals.every((v) => v === "")) break;
    out.push(vals);
  }
  return out;
}
