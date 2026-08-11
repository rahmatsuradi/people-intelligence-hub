// Menghasilkan supabase/assessment-module-seed.sql DARI definisi TypeScript.
//
// Kenapa di-generate, bukan diketik manual: norma dan profil jabatan ada di dua
// tempat (kode sebagai default bila DB belum di-seed, dan DB sebagai data yang
// bisa disunting HR). Kalau seed diketik tangan, keduanya pasti berbeda cepat
// atau lambat. Dengan generator ini, sumber kebenarannya satu.
//
// Jalankan: node node_modules/tsx/dist/cli.mjs scripts/generate-assessment-seed.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_NORM_GROUPS } from "../src/lib/assessment/norms";
import { DEFAULT_JOB_PROFILES } from "../src/lib/assessment/job-profiles";

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sqlJson = (v: unknown) => `${sqlStr(JSON.stringify(v))}::jsonb`;

const header = `-- ============================================================
-- People Intelligence — Modul ASSESSMENT: SEED (norma + profil jabatan)
--
-- FILE INI DI-GENERATE. Jangan disunting langsung.
-- Sumber: src/lib/assessment/norms.ts dan src/lib/assessment/job-profiles.ts
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/generate-assessment-seed.ts
--
-- Aman dijalankan ulang: memakai on conflict do update, jadi menjalankan
-- kembali file ini menyelaraskan baris yang ada, bukan menggandakannya.
--
-- ── PERINGATAN NORMA ────────────────────────────────────────
-- Baris norma di bawah ber-provenance 'synthetic_demo' dengan sample_size = 0.
-- Angka mean/SD-nya TIDAK berasal dari sampel pekerja Indonesia mana pun; itu
-- nilai tengah yang masuk akal supaya demo bisa berjalan. Selama norma masih
-- sintetis, persentil yang dihasilkan sah untuk MEMBANDINGKAN kandidat dalam
-- satu lowongan (semua diukur dengan penggaris yang sama), dan TIDAK sah
-- sebagai ambang kelulusan absolut.
-- Norma nyata dibangun setelah terkumpul >= 100 peserta pada populasi yang
-- sebanding, lalu dimasukkan sebagai BARIS BARU dengan effective_date baru —
-- bukan menimpa baris ini (laporan lama harus tetap reproducible).
--
-- ── CATATAN PROFIL JABATAN ──────────────────────────────────
-- Profil di bawah adalah TEMPLATE hasil penalaran praktik, bukan hasil job
-- analysis pada jabatan di perusahaan tertentu, dan bukan hasil studi validasi
-- terhadap data kinerja. tenant_id sengaja NULL = template bawaan lintas-tenant.
-- Perusahaan menyalinnya menjadi profil custom (source='custom', tenant_id
-- terisi) lewat halaman Profil Jabatan bila ingin menyesuaikan rentang target.
-- ============================================================

`;

const normRows = DEFAULT_NORM_GROUPS.map(
  (g) => `insert into pi_assessment_norms (id, tenant_id, label, provenance, sample_size, effective_date, entries, notes)
values (
  ${sqlStr(g.id)},
  null,
  ${sqlStr(g.label)},
  ${sqlStr(g.provenance)},
  ${g.sampleSize},
  ${sqlStr(g.effectiveDate)},
  ${sqlJson(g.entries)},
  ${g.notes ? sqlStr(g.notes) : "null"}
)
on conflict (id) do update set
  label          = excluded.label,
  provenance     = excluded.provenance,
  sample_size    = excluded.sample_size,
  effective_date = excluded.effective_date,
  entries        = excluded.entries,
  notes          = excluded.notes;`,
).join("\n\n");

const profileRows = DEFAULT_JOB_PROFILES.map(
  (p) => `-- ${p.name} (${p.level})
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  ${sqlStr(p.id)},
  null,
  ${sqlStr(p.name)},
  ${sqlStr(p.family)},
  ${sqlStr(p.level)},
  ${sqlStr(p.description)},
  ${sqlJson(p.requirements)},
  ${p.recommendThreshold},
  ${p.considerThreshold},
  ${sqlStr(p.source)}
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();`,
).join("\n\n");

const sql = `${header}-- ── Kelompok norma ──────────────────────────────────────────

${normRows}

-- ── Profil jabatan (template bawaan) ────────────────────────

${profileRows}
`;

const outPath = join(process.cwd(), "supabase", "assessment-module-seed.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`Seed ditulis ke ${outPath}`);
console.log(`  ${DEFAULT_NORM_GROUPS.length} kelompok norma, ${DEFAULT_JOB_PROFILES.length} profil jabatan.`);
