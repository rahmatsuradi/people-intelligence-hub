# CLAUDE.md — People Intelligence

> Konteks persisten untuk Claude Code.
> Repo ini berevolusi dari "Hire Intelligence" menjadi platform **People Intelligence**. Modul rekrutmen (Hire) tetap utuh; modul **Pay** (payroll/PPh21/BPJS) ditambahkan secara aditif dan sudah berjalan end-to-end.

---

## 1. Aturan emas — jangan ganggu yang lama

Fitur Hire yang sudah berfungsi & bisa dites tidak boleh rusak:

- Route: `src/app/cv-analyzer/`, `src/app/interview/`, `src/app/candidates/`, `src/app/roles/`, `src/app/analytics/`, `src/app/report/`, `src/app/apply/`, `src/app/api/analyze-cv/`, `src/app/api/apply/`, `src/app/integrations/`, `src/app/settings/`, `src/app/login/`.
- Lib: `src/lib/cv-analyzer-ai.ts`, `cv-groq.ts`, `competency-framework.ts`, `store.ts`, `supabase*.ts`, `use-auth.ts`, `apply-roles.ts`, `email-templates.ts`.
- Pengembangan modul baru dikerjakan di branch terpisah; `main` = versi yang sudah teruji jalan. Merge hanya setelah modul baru berfungsi & Hire tetap OK.
- Penambahan bersifat **aditif**: file/route/tabel baru. Untuk DB, **tidak ada `ALTER`/`DROP`** pada tabel lama milik modul lain.

## 2. Tentang proyek

Dibangun oleh seorang praktisi HR (pengelola HR tunggal di perusahaan garmen keluarga, 70+ karyawan) sebagai portofolio sekaligus alat kerja pribadi untuk payroll dan kepatuhan statutori Indonesia.

## 3. Status modul Pay

Selesai dan terverifikasi end-to-end (bukan sekadar kode yang "terlihat jalan"):

- Skema + seed + RLS diterapkan ke database (`supabase/pay-module-*.sql`).
- Engine murni di `src/lib/payroll/`: `computeGross`, `computeBPJS`, `computePPh21_TER`, `computePPh21_Annual`, `computeTHR`, `computeOvertime`, `runPayroll`, `buildPayslip` — semua fungsi murni (input → output, tanpa efek samping), diuji dengan kasus ber-kunci-jawaban.
- 94 unit test lulus. Setiap tarif/formula (TER, biaya jabatan, tabel lembur PP 35/2021, THR, BPJS) diverifikasi dari sumber resmi/berlapis sebelum dipakai — sitasi lengkap ada di komentar `supabase/pay-module-seed.sql`.
- UI: `/pay/payroll` (hitung → simpan → slip, dengan input lembur/THR/potongan lain, plus rekonsiliasi Desember), `/pay/employees`, `/pay/laporan` (rekap lintas periode + ekspor CSV BPJS).
- Tarif statutori bersifat **versioned per `effective_date`** (`pickStatutoryConfigForPeriod`) — perubahan tarif pemerintah = tambah baris data baru, bukan ubah kode. Dibuktikan nyata saat plafon JP BPJS naik per Maret 2026.

## 4. Modul Pay — arsitektur

**Tabel** (semua ber-awalan `pi_`, di `supabase/pay-module-schema.sql`):
`pi_employees` (master, dipakai semua modul) · `pi_compensation` · `pi_statutory_config` (tarif = DATA, versioned) · `pi_payroll_runs` · `pi_payroll_lines` · `pi_payslips`.

**Pipeline:** `gross` → komponen upah (UU Ketenagakerjaan) → BPJS (potongan karyawan + beban perusahaan) → PPh 21 (TER bulanan Jan–Nov / rekonsiliasi tahunan Des) → `net` → slip.

**Engine** — fungsi TypeScript murni di `src/lib/payroll/`, semua tarif dibaca dari `pi_statutory_config`, tidak ada angka statutori di-hardcode di kode.

## 5. Cara apply skema + seed

Ikuti pola `schema.sql` yang sudah ada (bukan folder migrations): Supabase SQL Editor → jalankan `pay-module-schema.sql` → lalu `pay-module-seed.sql` → lalu `pay-module-rls.sql`.

- Aman dijalankan ulang: awalan `pi_` + `create table if not exists` + tanpa `ALTER`/`DROP` pada tabel lama.
- RLS pada tabel `pi_*` sudah aktif, dibatasi ke role `authenticated` (pola sama dengan `rls-authenticated.sql` milik Hire).

## 6. Kerahasiaan (dijaga sejak fondasi)

- **Instance PRIVAT** (`DATA_MODE=production`): data perusahaan **asli** → Supabase project privat, lokal/internal, **tidak pernah publik / tidak pernah masuk repo**.
- **Demo PUBLIK**: data **sintetis** (`pay-module-seed.sql`, 12 karyawan fiktif, perusahaan fiktif) → inilah yang di-deploy & di-screenshot untuk portofolio.
- Portofolio memakai demo sintetis + metrik agregat/anonim. NIK/NPWP/rekening ter-masking di layer render (slip gaji), data mentah terenkripsi di produksi. Patuh UU PDP 27/2022.

## 7. Cakupan regulasi (comp & ben Indonesia)

- **Pilar 1 — Struktur Upah** (UU Ketenagakerjaan/PP 36/2021): komponen upah, UMK, THR (prorata `masa/12`, Permenaker 6/2016), lembur (1/173 × upah, tabel multiplier PP 35/2021 — menggantikan Kepmenaker 102/2004 yang sudah dicabut).
- **Pilar 2 — BPJS**: JHT 5,7% (3,7/2) · JP 3% (2/1, plafon upah disesuaikan tiap Maret) · JKK 0,24–1,74% (per kelas risiko) · JKM 0,3% · Kesehatan 5% (4/1, plafon 12jt); interaksi dgn PPh 21.
- **Pilar 3 — PPh 21 (TER, PP 58/2023)**: PTKP, kategori TER A/B/C, TER bulanan Jan–Nov, rekonsiliasi Des progresif (Pasal 17 UU HPP), biaya jabatan (PMK 250/2008, tidak diubah PP 58/2023).
- **Pilar 4 — Slip & Pelaporan**: slip gaji (selesai) · ekspor pelaporan BPJS (selesai) · formulir 1721-A1 (belum dibangun — di luar cakupan MVP).

## 8. Integrasi UI (aditif)

- Seksi nav **"Pay"** di `navItems` pada `src/components/app-shell.tsx` (di samping "Main"/"Tools") — Onboarding, Payroll, Employees, Laporan.
- Route di `src/app/pay/*`, tidak menyentuh route Hire.
- **Jembatan Hire → Pay (selesai):** `/pay/onboarding` menampilkan kandidat berstatus `hired` yang belum punya record payroll, lalu form onboarding membuat `pi_employees` + `pi_compensation` sekaligus. Tautan disimpan di `pi_employees.hired_candidate_id` (nullable — karyawan lama tidak berasal dari Hire; unique — satu kandidat tidak bisa di-onboard dua kali; `on delete set null` — kandidat dihapus dari Hire tidak boleh menghapus record karyawan).
- Jembatan ini **sengaja tidak sepenuhnya otomatis**: data rekrutmen tidak pernah memuat upah disepakati, PTKP, NIK, tanggal masuk, tipe kontrak, dan kelas risiko JKK — semuanya wajib untuk BPJS/PPh 21 dan hanya tersedia saat kontrak ditandatangani. Form onboarding menarik otomatis yang sudah diketahui (nama, posisi, departemen) dan meminta sisanya.

## 9. Modul Assessment (psikotes) — status & arsitektur

Modul ketiga, aditif di atas Hire dan Pay. Mengadministrasi psikotes ke kandidat dan menginterpretasikan hasilnya terhadap kebutuhan posisi.

**Instrumen — hanya yang boleh dipakai bebas.** Kepribadian memakai adaptasi Bahasa Indonesia **IPIP-BFM-50** (Goldberg 1999, domain publik). Item kognitif (30 soal: numerik/verbal/logika) dan SJT (12 skenario, kunci efektivitas 1–5) **ditulis sendiri** untuk repo ini. MBTI, DISC, 16PF, Papikostick, CFIT, IST, Hogan, SHL/OPQ, Watson-Glaser **tidak** direproduksi — berlisensi, dan item yang bocor kehilangan daya bedanya.

**Engine murni** di `src/lib/assessment/` — `scoreAll`, `applyNorms`, `buildValidityReport`, `computeFit`, `interpretAll`, `buildAssessmentReport`. Semua fungsi murni, 92 unit test ber-kunci-jawaban (total repo: 235 lulus).

**Pipeline:** jawaban → skor mentah → norma (sten/persentil/T/stanine) → indeks kualitas jawaban → interpretasi per skala → kesesuaian profil jabatan → laporan.

**Tabel** (`supabase/assessment-module-schema.sql`): `pi_assessment_norms` (norma = DATA ber-versi per `effective_date`) · `pi_assessment_profiles` (profil jabatan, bisa disunting per tenant) · `pi_assessment_sessions` (satu undangan = satu baris; kolom `report` menyimpan **snapshot** laporan agar hasil lama tidak berubah saat bank item/norma diperbarui).

**Route:** `/assessment` (konsol: undang, pantau, salin tautan) · `/assessment/profiles` (profil jabatan) · `/assessment/[sessionId]` (laporan) · `/tes/[token]` (**publik, tanpa login** — peserta tidak punya akun) · `/api/assessment/session` (service-role, pola sama dengan `/api/apply`).

**Aturan yang tidak boleh dilanggar saat menyentuh modul ini:**
- Kunci jawaban kognitif, nilai efektivitas SJT, dan keying item kepribadian **tidak pernah** dikirim ke browser peserta (`toPublicItem()` yang menjaganya). Peserta juga tidak pernah menerima skor.
- Norma bawaan berlabel `synthetic_demo`, `sampleSize = 0`. Selama masih sintetis, persentil sah untuk **membandingkan kandidat dalam satu lowongan**, tidak sah sebagai ambang kelulusan absolut. Label ini jangan dinaikkan tanpa data.
- Indeks kualitas jawaban (attention check, long-string, inkonsistensi, impression management, kelengkapan, kecepatan) hanya **memberi status dan menyarankan verifikasi** — tidak pernah mengoreksi skor secara otomatis.
- Setiap `ProfileRequirement` wajib punya `rationale` (divalidasi di UI) supaya keputusan seleksi bisa diaudit.
- Seed di-generate dari kode: `node node_modules/tsx/dist/cli.mjs scripts/generate-assessment-seed.ts`. Jangan menyunting `assessment-module-seed.sql` langsung.

**Cara apply:** tempel `supabase/assessment-module-ALL.sql` (gabungan schema+seed+RLS, urutan terkunci, di-generate oleh `scripts/bundle-assessment-sql.ts`) di Supabase SQL Editor. Ketiga file terpisah tetap sumber kebenaran dan tetap bisa dijalankan sendiri-sendiri. Konsol `/assessment` mendeteksi tabel belum ada, mematikan tombol Undang, dan menyediakan tombol Salin SQL + tautan ke SQL Editor project yang bersangkutan.

**Status: SUDAH DITERAPKAN & TERVERIFIKASI UJUNG-KE-UJUNG** (11 Agustus 2026). Skema, seed (1 norma + 9 profil), dan RLS terpasang di database. Dibuktikan bukan hanya lewat unit test:
- `scripts/verify-assessment-setup.ts` — tabel ada, seed masuk, label norma jujur, dan RLS menolak baca **maupun** tulis dari kunci anon.
- `scripts/e2e-assessment-smoke.ts` — buat sesi → ambil soal lewat API publik → kirim 5 bagian jawaban → laporan tersimpan sebagai snapshot. Sekaligus menguji bahwa respons API tidak memuat `answerIndex`, `rationale`, `keying`, maupun field nilai efektivitas SJT, dan tidak mengembalikan skor apa pun ke peserta.

Catatan untuk uji berikutnya: jangan memeriksa kebocoran kunci dengan pencarian substring polos — kata `effectiveness` memang sah muncul sebagai nama format item (`sjt_effectiveness`). Yang diperiksa harus strukturnya: tidak ada field `"effectiveness":`, dan setiap opsi SJT terkirim sebagai teks polos.

## 10. Yang belum dikerjakan

- Formulir pelaporan pajak tahunan 1721-A1.
- Arahkan instance produksi ke data perusahaan asli (baru dilakukan setelah kelas risiko JKK final dikonfirmasi ke BPJS, dan UMK diisi sesuai SK Gubernur/Permenaker tahun berjalan untuk wilayah yang relevan — nilai UMK di seed saat ini murni placeholder demo).
- **Assessment** (skema/seed/RLS sudah terpasang & terverifikasi — lihat §9). Yang belum: norma lokal dari data nyata (butuh ≥ 100 peserta; lihat §12), analisis butir untuk item kognitif/SJT, uji reliabilitas & analisis faktor untuk adaptasi IPIP, pengiriman tautan tes lewat email otomatis (saat ini disalin manual — modul email belum ada), dan halaman umpan balik hasil untuk peserta.

## 11. Verifikasi tarif — status & jadwal ulang

Semua tarif di `pi_statutory_config` sudah diverifikasi dari sumber resmi/berlapis (lihat komentar per baris di `supabase/pay-module-seed.sql` untuk sitasi lengkap per tarif). Tarif yang berubah periodik dan perlu diverifikasi ulang:

- **Plafon upah JP BPJS Ketenagakerjaan** — disesuaikan tiap Maret berdasarkan pertumbuhan PDB. Verifikasi berikutnya: Maret 2027.
- **UMK** — mengikuti SK Gubernur/Permenaker tahun berjalan, per wilayah. Belum diisi dengan nilai riil (masih placeholder demo).
- **Kelas risiko JKK** — perlu dikonfirmasi final ke BPJS Ketenagakerjaan per perusahaan sebelum dipakai ke data produksi asli.

Update tahunan/periodik = tambah baris data baru di `pi_statutory_config` dengan `effective_date` yang sesuai, **bukan** mengubah kode atau menimpa baris lama (biar perhitungan retroaktif tetap akurat).

## 12. Verifikasi psikometrik — status & jadwal ulang

Berbeda dari tarif statutori yang bisa diverifikasi ke peraturan, angka psikometrik hanya bisa diverifikasi ke **data**. Statusnya sekarang:

- **Norma** — masih sintetis (`NORM-DEMO-UMUM-2026`). Norma lokal dibangun dengan `buildNormGroupFromSample()` setelah terkumpul ≥ 100 peserta pada populasi yang sebanding, lalu dimasukkan sebagai **baris baru** di `pi_assessment_norms` dengan `effective_date` baru — bukan menimpa baris lama, supaya laporan lama tetap bisa dihitung ulang dengan angka yang sama. Script pembangun: `scripts/build-assessment-norms.ts`.
- **Item kognitif & SJT** — belum melalui analisis butir (tingkat kesukaran, daya beda, analisis distraktor). Item yang terlalu mudah/sulit atau tidak membedakan perlu diganti setelah ada data.
- **Adaptasi IPIP** — belum melalui back-translation, uji reliabilitas (α/ω), maupun analisis faktor pada sampel Indonesia.
- **Profil jabatan** — masih template hasil penalaran praktik, belum job analysis. Profil sahih dibangun dengan membandingkan skor pemangku jabatan saat ini terhadap penilaian kinerja mereka.

Selama keempatnya belum dikerjakan, hasil asesmen dipakai sebagai bahan probing wawancara dan pembanding antar-kandidat — **bukan** sebagai skor kelulusan.

## 13. Prinsip kerja

Aditif di atas fondasi yang sudah jalan; prototipe dulu lalu perbesar cakupan; setiap tarif/formula statutori diverifikasi dari sumber sebelum dipakai, dengan sitasi tersimpan; setiap fungsi hitung disertai unit test ber-kunci-jawaban; jangan bangun backend/arsitektur baru mendahului kebutuhan yang sudah tervalidasi; klaim ditulis apa adanya — instrumen yang belum divalidasi dinyatakan belum divalidasi, bukan dibungkus bahasa yang terdengar meyakinkan.
