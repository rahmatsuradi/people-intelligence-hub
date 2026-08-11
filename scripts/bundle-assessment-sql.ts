// Menggabungkan schema + seed + RLS modul Assessment menjadi SATU file yang
// bisa ditempel sekali jalan di Supabase SQL Editor.
//
// Kenapa ada: urutan tiga file itu wajib (tabel -> data -> policy) dan mudah
// tertukar, terutama saat dikerjakan dari ponsel. File gabungan menghilangkan
// peluang salah urutan sekaligus memangkas tiga kali salin-tempel jadi satu.
// Tiga file aslinya tetap sumber kebenaran dan tetap bisa dijalankan terpisah.
//
// Jalankan: node node_modules/tsx/dist/cli.mjs scripts/bundle-assessment-sql.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase");

// Urutan TIDAK boleh diubah:
//   schema -> tabel harus ada sebelum diisi
//   seed   -> data harus masuk selagi service-role SQL Editor belum dibatasi policy
//   rls    -> policy dipasang terakhir
const PARTS = [
  "assessment-module-schema.sql",
  "assessment-module-seed.sql",
  "assessment-module-rls.sql",
] as const;

const banner = `-- ============================================================
-- People Intelligence — Modul ASSESSMENT: PEMASANGAN SEKALI JALAN
--
-- FILE INI DI-GENERATE dengan menggabungkan tiga file di bawah, apa adanya:
${PARTS.map((p) => `--   ${p}`).join("\n")}
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/bundle-assessment-sql.ts
--
-- Cara pakai: buka Supabase SQL Editor -> New query -> tempel seluruh isi file
-- ini -> Run. Aman dijalankan ulang (create table if not exists, on conflict do
-- update, drop policy if exists) dan tidak meng-ALTER/DROP tabel modul lain.
--
-- Verifikasi setelahnya:
--   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/verify-assessment-setup.ts
-- ============================================================

`;

const body = PARTS.map((name) => {
  const content = readFileSync(join(dir, name), "utf8").trimEnd();
  return `-- ════════════════════════════════════════════════════════════\n-- BAGIAN: ${name}\n-- ════════════════════════════════════════════════════════════\n\n${content}\n`;
}).join("\n\n");

const sql = banner + body;

const outPath = join(dir, "assessment-module-ALL.sql");
writeFileSync(outPath, sql, "utf8");

// Salinan kedua di public/ supaya kartu setup di /assessment bisa mengambilnya
// dan menyalinkannya ke clipboard dengan satu tombol — jauh lebih praktis
// daripada meminta orang membuka repo dan menyalin 400+ baris dari ponsel.
// Isinya DDL skema, sama dengan yang sudah ada di repo publik; tidak ada
// kredensial maupun data di dalamnya.
const publicDir = join(process.cwd(), "public", "setup");
mkdirSync(publicDir, { recursive: true });
const publicPath = join(publicDir, "assessment-module-ALL.sql");
writeFileSync(publicPath, sql, "utf8");

console.log(`Ditulis: ${outPath}`);
console.log(`Ditulis: ${publicPath} (untuk tombol "Salin SQL" di /assessment)`);
console.log(`Gabungan dari ${PARTS.length} file, ${sql.split("\n").length} baris.`);
