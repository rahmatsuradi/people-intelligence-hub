// Mengisi seed modul Assessment (norma + profil jabatan) langsung ke database
// lewat service-role, tanpa perlu menempel SQL.
//
// Jalankan:
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/apply-assessment-seed.ts
//
// Kenapa script ini bisa ada sementara schema tidak: `create table` adalah DDL
// dan tidak bisa dijalankan lewat PostgREST. Seed hanyalah INSERT ke tabel yang
// sudah ada — itu bisa. Jadi urutannya tetap: tempel schema sekali di SQL
// Editor, sisanya bisa dari sini.
//
// Sumber datanya sama persis dengan supabase/assessment-module-seed.sql:
// default TypeScript di norms.ts dan job-profiles.ts. Memakai upsert, jadi aman
// dijalankan berulang — menjalankan ulang menyelaraskan baris, bukan menggandakan.
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_NORM_GROUPS } from "../src/lib/assessment/norms";
import { DEFAULT_JOB_PROFILES } from "../src/lib/assessment/job-profiles";
import { jobProfileToRow } from "../src/lib/assessment/assessment-data";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("env Supabase tidak ada (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  /* ─── Norma ─── */
  // tenant_id null = norma bawaan lintas-tenant, sama seperti di file SQL.
  const normRows = DEFAULT_NORM_GROUPS.map((g) => ({
    id: g.id,
    tenant_id: null,
    label: g.label,
    provenance: g.provenance,
    sample_size: g.sampleSize,
    effective_date: g.effectiveDate,
    entries: g.entries,
    notes: g.notes ?? null,
  }));

  const { error: normErr } = await supabase.from("pi_assessment_norms").upsert(normRows, { onConflict: "id" });
  if (normErr) throw new Error(`gagal menyisipkan norma: ${normErr.message}`);
  console.log(`Norma: ${normRows.length} baris di-upsert`);
  for (const n of normRows) {
    console.log(`  ${n.id} — ${n.provenance}, n=${n.sample_size}, ${n.entries.length} skala`);
  }

  /* ─── Profil jabatan ─── */
  const profileRows = DEFAULT_JOB_PROFILES.map((p) => ({
    ...jobProfileToRow(p, null),
    updated_at: new Date().toISOString(),
  }));

  const { error: profErr } = await supabase.from("pi_assessment_profiles").upsert(profileRows, { onConflict: "id" });
  if (profErr) throw new Error(`gagal menyisipkan profil jabatan: ${profErr.message}`);
  console.log(`\nProfil jabatan: ${profileRows.length} baris di-upsert`);
  for (const p of profileRows) {
    console.log(`  ${p.id.padEnd(16)} ${p.name} (${p.requirements.length} skala dinilai)`);
  }

  console.log("\nSelesai. Verifikasi: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/verify-assessment-setup.ts");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
