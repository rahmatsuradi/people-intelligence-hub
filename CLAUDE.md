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

**Route:** `/assessment` (konsol: undang, pantau, salin tautan) · `/assessment/panduan` (panduan 4 tab: Cara Kerja, Isi Tes, Dasar Ilmiah, Contoh Hasil — jalan tanpa DB) · `/assessment/profiles` (profil jabatan) · `/assessment/[sessionId]` (laporan) · `/tes/[token]` (**publik, tanpa login** — peserta tidak punya akun) · `/api/assessment/session` (service-role, pola sama dengan `/api/apply`).

**Bahasa antarmuka — aturan yang tidak boleh dilanggar.** Teks yang dilihat pengguna ditulis untuk praktisi HR tanpa latar teknis maupun psikometrik. DILARANG muncul di UI: nama tabel, nama file SQL, "database", "schema", "RLS", "service-role", "norma sintetis", "sten" tanpa penjelasan. Padanan yang dipakai: kelompok pembanding (norma), penyimpanan asesmen (tabel/DB), perintah pengaktifan (SQL setup), pemeriksa kesungguhan (item QC), dibalik (reverse-keyed). Istilah teknis tetap boleh — dan wajib — ada di komentar kode dan file SQL.

**Sitasi validitas — angka yang dipakai sudah diverifikasi ke sumber:** Schmidt & Hunter (1998) *Psychological Bulletin* 124(2), 262–274 · Sackett dkk. (2022) *JAP* 107(11), 2040–2068 (GMA direvisi .51 → **.31**; wawancara terstruktur **.42** = prediktor tunggal terkuat) · McDaniel dkk. (2001) *JAP* 86(4), 730–740 (SJT rho **.34**, korelasi SJT–kognitif .46) · Barrick & Mount (1991) *Personnel Psychology* 44(1), 1–26. Klaim "tes kognitif adalah prediktor terbaik" **tidak akurat lagi** dan tidak boleh dipakai. Tabel validitas di `/assessment/panduan` wajib disertai peringatan bahwa angka itu milik *jenis metodenya*, bukan milik bank soal repo ini.

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

## 9b. Modul Rekrutmen — peningkatan & Konsultan HR (AI)

**Riwayat tahap kandidat (fondasi metrik).** `candidates.stage_history` (jsonb, aditif lewat migration `add_stage_history_to_candidates`) mencatat `{stage, from, at}` setiap perpindahan. Tanpa kolom ini seluruh metrik kecepatan mustahil dihitung — `created_at`/`updated_at` hanya menyimpan titik awal dan akhir. Field TypeScript-nya `stageHistory?` sengaja **opsional**: kandidat lama memang tidak punya riwayat, dan itu berbeda artinya dari riwayat kosong.

**Aturan yang tidak boleh dilanggar:** kandidat tanpa riwayat **dikeluarkan** dari perhitungan kecepatan dan jumlahnya dilaporkan (`basedOn`, `excludedNoHistory`, `withoutHistory`) — jangan pernah dihitung nol hari, karena itu membuat metrik terlihat paling cepat justru pada kandidat yang paling lama didiamkan. Durasi memakai **median**, bukan rata-rata.

**Mesin metrik** di `src/lib/recruiting/pipeline-metrics.ts` (37 unit test): corong konversi kumulatif, kecepatan per tahap, time-to-hire, status pemenuhan per lowongan, efektivitas sumber, deteksi kandidat mandek, dan deteksi hambatan. Catatan: deteksi hambatan durasi membandingkan tiap tahap terhadap median tahap **lain** — kalau tahap yang diperiksa ikut masuk pembanding, ia menaikkan ambangnya sendiri dan menyamarkan diri.

**Route:** `/analytics/hiring` (dulu placeholder, kini terisi) menampilkan masalah lebih dulu (hambatan + kandidat mandek), baru angkanya.

**Konsultan HR (AI)** — `/hr-consultant` + `/api/hr-consultant`, persona di `src/lib/hr-consultant.ts` (17 unit test). Menjawab pertanyaan SDM di luar data yang ada di sistem, seperti konsultan HR berpengalaman; data pipeline perusahaan disuntikkan hanya bila pengguna mengaktifkan sakelarnya, dan isinya bisa dilihat sebelum dikirim.

Pelajaran yang sudah dibayar saat membangunnya, jangan diulang:
- Persona generik menghasilkan jawaban generik ("kurangnya pelatihan", "lingkungan kerja tidak kondusif") yang bisa ditempel ke pekerjaan apa pun. Penawarnya: bagian **"Realitas pekerjaan ini" wajib ditulis pertama**.
- Contoh kedalaman di dalam prompt **disalin mentah** oleh model sebagai jawaban. Contohnya karena itu memakai peran yang berbeda dari pertanyaan lazim (kurir last-mile) dan diberi larangan menyalin eksplisit.
- Larangan di prompt saja tidak cukup. Ada penjaga di server: `findGenericPhrases()` memeriksa jawaban, dan bila lolos frasa kosong, dikirim **satu** permintaan perbaikan terarah — dipakai hanya bila hasilnya benar-benar lebih baik.
- `callGroq()` terkunci mode JSON; percakapan bebas memakai `callGroqChat()`.
- Pesan ber-role `system` dari klien **dibuang** di route, supaya persona dan batasannya tidak bisa ditimpa dari browser.

## 9c. Wawancara terstruktur — panel, kompetensi wajib, cakupan

Mesin murni di `src/lib/recruiting/interview-scoring.ts` (26 unit test). Layar skoring, layar hasil, dan debrief semuanya menghitung lewat mesin ini — tidak ada lagi ambang yang ditulis ulang di komponen.

**Empat cacat yang diperbaiki, jangan diulang:**
- **"Tidak ditanya" bukan nilai terburuk.** Skala lama memberi label `No evidence` pada angka 1, sehingga pertanyaan yang tak sempat ditanyakan tercatat sebagai performa terburuk. Sekarang 1–5 murni performa, dan `notAsked` adalah status terpisah yang dikeluarkan dari pembagi.
- **Cakupan wajib dilaporkan.** Melewati pertanyaan sulit dulu menaikkan rata-rata. Kesimpulan kini ditahan (`data_belum_cukup`) bila cakupan < `MIN_COVERAGE_PCT` (60%).
- **Kompetensi wajib memblokir rekomendasi**, berapa pun rata-ratanya — pola yang sama dengan `criticalMinSten` di modul asesmen. Kompetensi wajib yang *tidak dinilai* juga memblokir: tidak ada bukti sama menghalanginya dengan bukti buruk.
- **`kitId` dulu `KIT-${Date.now()}`** sehingga berubah tiap simpan, dan dedupe di `saveInterviewResult` memakai `kitId` saja — akibatnya penilaian pewawancara kedua **menimpa** penilaian pewawancara pertama. Kini `kitId = pack.packId` (stabil) dan kunci dedupe adalah pasangan **kit + pewawancara**.

**Panel:** tiap pewawancara menilai independen lebih dulu (kartu persiapan meminta nama sebelum wawancara). `aggregatePanel()` merata-ratakan **antar-pewawancara**, bukan antar-butir — kalau butir digabung mentah, pewawancara yang menilai lebih banyak pertanyaan otomatis punya suara lebih besar. Selisih ≥ 2 tingkat pada satu kompetensi ditandai sebagai ketidaksepakatan dan **menahan kesimpulan panel**, karena rata-rata gabungan justru menyembunyikannya.

## 10. Yang belum dikerjakan

- Formulir pelaporan pajak tahunan 1721-A1.
- **Wawancara:** jembatan dari laporan asesmen ke kit wawancara belum ada; "Cultural Fit" masih dipakai sebagai kategori berskor (pintu masuk bias, sebaiknya diubah jadi keselarasan nilai berjangkar perilaku); tipe pertanyaan masih mencampur format (Behavioral) dengan domain (Technical/Leadership); sebagian label UI masih bahasa Inggris.
- **Rekrutmen:** metrik kecepatan baru akan berarti setelah cukup kandidat berjalan lewat pipeline dengan riwayat tercatat (kandidat lama tidak ikut terhitung). Belum ada: cost-per-hire, sumber biaya iklan lowongan, dan pelacakan alasan penolakan kandidat.
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
