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

### 1b. Satu jalur kerja — WAJIB dicek di awal setiap sesi (HP maupun laptop)

Juli–Oktober 2026 kerja dari HP masuk ke `main` sementara kerja dari laptop masuk ke `feat/multi-tenant-hr-platform`; keduanya tidak disatukan selama tiga bulan dan akhirnya saling bertentangan (satu menanam ulang data demo yang satunya hapus) sambil memakai **satu database yang sama**. Disatukan 24 Oktober 2026 (tag cadangan `backup/sebelum-merge-main-2026-10-24` dan `backup/main-sebelum-merge-2026-10-24`). Supaya tidak terulang:

- Sebelum mengerjakan apa pun: `git fetch` lalu `git rev-list --count HEAD..origin/main`. Kalau bukan 0, satukan dulu — jangan menumpuk kerja di atas versi yang tertinggal.
- Kerja kecil, disatukan dalam hitungan hari. Branch yang hidup berbulan-bulan adalah sumber konflik terbesar di repo ini.
- Instance ini melayani **satu perusahaan dengan data asli**. Jangan menambahkan data demo, seed contoh, atau "auto-seed agar layar tidak kosong" — termasuk di fitur baru. Layar kosong yang jujur adalah perilaku yang benar.
- Model data **ruang kerja bersama** (semua akun HR melihat data yang sama). Migrasi per-pengguna (`user_id` + composite key) dari `main` sengaja dibuang: pada satu tim HR, rekan tidak akan saling melihat kandidat. Jangan diperkenalkan ulang.

## 2. Tentang proyek

Dibangun oleh seorang praktisi HR sebagai alat kerja untuk payroll dan kepatuhan statutori Indonesia, sekaligus portofolio.

**Perusahaan yang dilayani instance ini: Rica Rico Bakery** (tempat pengelola repo bekerja, sejak 24 Oktober 2026) — pemberi kerja **PT Valen Persada Nusantara**. Merk "Rica Rico Bika Ambon" berdiri April 2002 (pendiri John Yen; nama dari anak pemilik, dua anak di logo), produk bika ambon (original, pandan, cokelat, durian, keju), bolu jadul, brownies; halal; jaringan outlet di mal/pasar/supermarket di DKI, Banten, Jabar, Jateng, DIY, Jatim. Sumber: IDN Times (Agustus 2025), Instagram resmi @ricarico_bakery, Hublife.

Implikasi untuk HR/payroll yang berbeda dari Lencir: tenaga kerja = produksi bakery + staf outlet ritel tersebar di 5 provinsi, jadi **UMK berlaku per lokasi kerja karyawan**, bukan satu nilai perusahaan; kelas risiko JKK produksi (oven, mixer) bisa berbeda dari outlet.

Identitas visual (rebrand 24 Oktober 2026): logo asli di `public/brand/rica-rico-logo.jpg` (JPG 192px dari pengelola repo — minta versi vektor/PNG resmi bila butuh tampil > 96px), wordmark huruf sambung Lobster, palet di `globals.css` (merah logo = aksi, kuning tulisan = aksen, krem/cokelat bika ambon = netral, merah anggur = bahaya). Lihat komentar di `globals.css` sebelum menyunting warna.

**Riwayat:** sebelumnya instance ini melayani **Lencir Indonesia** (brand beauty & wellness, PT Loe Cantik Kita Cuan). Saat pindah, ID tenant diganti (`3333…` → `4444…`), bukan dipakai ulang, supaya cache data Lencir tidak terbaca sebagai data Rica Rico. Catatan menarik yang belum dikonfirmasi: outlet Rica Rico Daan Mogot beralamat Jl. Penerangan No. 1EE — sama dengan alamat terdaftar PT Loe Cantik Kita Cuan.

**Data demo lama sudah dihapus (27 Agustus 2026).** Sebelumnya repo memuat dua tenant fiktif — "Valora TV" (754 karyawan sintetis, penyiaran) dan "Zus Textile" (245 karyawan sintetis, garmen) — lengkap dengan kandidat bernama pesepakbola dan angka SDM karangan. Semuanya dibuang: aplikasi ini melayani perusahaan sungguhan, dan angka SDM palsu di layar HR lebih berbahaya daripada layar kosong. Jangan menambahkan seed contoh baru. **Database juga sudah dibersihkan (24 Oktober 2026)** lewat `supabase/cleanup-demo-tenants.sql`: 999 karyawan + 999 kompensasi, 11 run payroll + 99 baris payroll, 2 sesi asesmen, 6 lowongan demo Valora, 6 aktivitas demo. Tarif statutori, norma, dan 9 profil jabatan bawaan tetap utuh.

**Cloud selalu menang di `syncFromSupabase()` (sejak 24 Oktober 2026).** Dulu tabel cloud yang kosong memicu unggah isi localStorage (sisa migrasi dari era localStorage-only), sehingga baris yang sengaja dihapus di database hidup lagi dari browser lama. Sekarang tabel kosong = cache lokal ikut dikosongkan; hanya permintaan yang *gagal* (`res.error`) yang membiarkan cache. Jangan kembalikan fallback unggah itu. ⚠️ Deploy dari branch `main` masih memakai kode lama, jadi risikonya tetap ada di sana sampai branch ini di-merge.

Sisa data sintetis yang tidak tercakup skrip: kandidat `C-SIM-4834` & `C-SIM-5244` (dari tombol "simulasi lamaran WhatsApp" di `/candidates`, nama acak, melamar ke lowongan demo yang sudah dihapus) beserta 2 aktivitasnya, dan 2 aktivitas uji e2e asesmen ("Uji Ujung-ke-Ujung (sintetis)").

**Nama di slip gaji yang sebenarnya: "CV Rica Rico Bakery Indonesia"** (rekap gaji di Drive, Oktober 2026), dan BPJS karyawan terbagi di enam badan usaha (CV Rica Rico Bakery Indonesia, UD Rica Rico, CV Chocolava, CV Haven Prima Rasa, CV Kuliner Kreatif, CV Pastrindo) + BPU. Karena itu badan usaha dicatat **per karyawan** (`pi_employee_profiles.legal_entity`), bukan satu nilai perusahaan. Header aplikasi masih "PT Valen Persada Nusantara" — usulan menggantinya ke CV Rica Rico Bakery Indonesia sudah disetujui tapi belum diterapkan.

**PT Valen Persada Nusantara tidak ditemukan di sumber publik mana pun** (pencarian web, Oktober 2026). Yang harus dikonfirmasi dari dokumen internal sebelum slip gaji diterbitkan — ditandai `⚠️ MASIH HARUS DIKONFIRMASI` di `company-profile.ts`: ejaan persis nama PT (cocokkan dengan akta/kontrak kerja/registri AHU), alamat terdaftar PT (kolom `address` sengaja dibiarkan "—", bukan diisi alamat outlet), NPWP, nama/jabatan penanda tangan slip, kelas risiko JKK, dan UMK per wilayah outlet.

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

Instance ini melayani perusahaan sungguhan, jadi aturannya lebih ketat daripada saat masih demo:

- **Data karyawan tidak pernah masuk repo.** Satu-satunya sumber karyawan adalah tabel `pi_employees` di Supabase. `pay-data.ts` tidak lagi men-generate karyawan, dan `pay-module-seed.sql` sekarang **hanya berisi tarif statutori** — bagian karyawannya dihapus.
- **Jangan menulis ulang seed karyawan ke dalam file apa pun**, termasuk "cuma untuk contoh". Begitu data contoh tercampur dengan data asli di database, keduanya tidak bisa dipisahkan lagi dan seluruh metrik SDM jadi salah tanpa ada tandanya.
- Kalau perlu identitas perusahaan berbeda tanpa menulisnya ke repo, pakai env: `PI_COMPANY_NAME`, `PI_COMPANY_ADDRESS`, `PI_COMPANY_SIGNER_NAME`, `PI_COMPANY_SIGNER_TITLE` (dibaca `resolveCompanyProfile`).
- **Pintu masuk tanpa sandi sudah dimatikan.** Tombol "Masuk Tanpa Login" di `/login` kini hanya muncul bila `NEXT_PUBLIC_ENABLE_DEMO_BYPASS=true`. Jangan menyalakannya pada database yang memuat data karyawan asli — tombol itu memberi akses penuh ke NIK, NPWP, upah, dan rekening tanpa autentikasi.
- NIK/NPWP/rekening ter-masking di layer render (slip gaji). Patuh UU PDP 27/2022.
- Pembersihan baris demo yang terlanjur tersimpan di database: `supabase/cleanup-demo-tenants.sql` (jalankan sekali; langkah 1 menghitung, langkah 2 menghapus).

## 7. Cakupan regulasi (comp & ben Indonesia)

- **Pilar 1 — Struktur Upah** (UU Ketenagakerjaan/PP 36/2021): komponen upah, UMK, THR (prorata `masa/12`, Permenaker 6/2016), lembur (1/173 × upah, tabel multiplier PP 35/2021 — menggantikan Kepmenaker 102/2004 yang sudah dicabut).
- **Pilar 2 — BPJS**: JHT 5,7% (3,7/2) · JP 3% (2/1, plafon upah disesuaikan tiap Maret) · JKK 0,24–1,74% (per kelas risiko) · JKM 0,3% · Kesehatan 5% (4/1, plafon 12jt); interaksi dgn PPh 21.
- **Pilar 3 — PPh 21 (TER, PP 58/2023)**: PTKP, kategori TER A/B/C, TER bulanan Jan–Nov, rekonsiliasi Des progresif (Pasal 17 UU HPP), biaya jabatan (PMK 250/2008, tidak diubah PP 58/2023).
- **Pilar 4 — Slip & Pelaporan**: slip gaji (selesai) · ekspor pelaporan BPJS (selesai) · formulir 1721-A1 (selesai — `/pay/laporan/1721-a1`, mesin `src/lib/payroll/tax-1721-a1.ts` + 7 unit test; belum diuji dengan data payroll asli setahun penuh).

## 8. Integrasi UI (aditif)

- Seksi nav **"Pay"** di `navItems` pada `src/components/app-shell.tsx` (di samping "Main"/"Tools") — Onboarding, Payroll, Employees, Laporan.
- Route di `src/app/pay/*`, tidak menyentuh route Hire.
- **Pemilih perusahaan (multi-tenant) sudah dihapus.** `ALL_COMPANIES` kini berisi satu entri dan `getActiveCompanyId()` mengembalikan nilai tetap; header menampilkan nama perusahaan sebagai label, bukan dropdown berisi satu pilihan. Namespace tenant di localStorage (`getTenantKey`) sengaja **dipertahankan** supaya data dua tenant demo lama tidak ikut terbaca.
- **`/analytics` tab Workforce dihitung dari data nyata** (`pi_employees` + `pi_compensation`), bukan angka tetap. Karyawan yang belum punya data upah dikeluarkan dari penjumlahan dan jumlahnya dilaporkan — pola yang sama dengan `excludedNoHistory` di metrik rekrutmen: jangan pernah menghitungnya sebagai nol, karena total beban gaji jadi terlihat lebih kecil tanpa ada tandanya. Tab "Simulator Beban Siaran" dihapus (koefisien ilustratif khusus industri penyiaran).
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

**Jembatan asesmen → wawancara (selesai).** Tombol "Pakai untuk Wawancara" di laporan asesmen memilih skala paling menonjol (`selectProbes`: sten ≤ 4 atau ≥ 8, maksimal 6, diurutkan dari yang paling jauh dari rata-rata) dan mengirimkannya lewat `sessionStorage` — pola yang sama dengan CV Analyzer → Interview, supaya tidak ada mekanisme perpindahan data kedua. Pertanyaan masuk sebagai tipe `Assessment Probe` dengan namespace kompetensi `assessment:<scaleId>` agar tidak bertabrakan dengan id framework.

**Format vs domain.** Kategori lama mencampur FORMAT (`Behavioral`) dengan DOMAIN (`Technical`, `Leadership`). `analyzeEvidenceCoverage()` kini menandai kompetensi yang hanya digali lewat pertanyaan hipotetis — itu mengukur apa yang kandidat TAHU sebaiknya dilakukan, bukan apa yang pernah ia lakukan. `deriveQuestionFormat()` adalah heuristik berbasis penanda kalimat dan **default-nya situasional**, karena mengaku punya bukti perilaku yang tidak ada lebih berbahaya daripada sebaliknya.

**"Cultural Fit" diberi label ulang** menjadi "Keselarasan Nilai & Motivasi" lewat `TYPE_LABELS`; nilai internalnya sengaja tidak diubah agar hasil wawancara lama tidak kehilangan pengelompokannya.

**Angka validitas disamakan seluruh aplikasi.** `SELECTION_VALIDITY` dan 32 `validityCoeff` di `competency-framework.ts` diperbarui dari .51 (Schmidt & Hunter 1998) ke **.42** (Sackett dkk. 2022). Wawancara terstruktur kini prediktor tunggal terkuat, di atas tes kognitif .31. Sebelumnya modul asesmen menyebut .42 sementara modul wawancara menyebut .51 — dua angka berbeda untuk klaim yang sama di aplikasi yang sama.

**Bank soal perusahaan (selesai).** Tabel `pi_interview_questions` (migration `create_pi_interview_questions`, RLS authenticated-only) menyimpan pertanyaan yang ditulis perusahaan sendiri; pertanyaan bawaan tetap di kode karena versinya mengikuti rilis aplikasi. `cluster` null = berlaku untuk semua posisi.

Aturan di `question-bank.ts` (23 unit test):
- Pertanyaan perusahaan **melengkapi**, tidak menimpa bawaan, dan selalu ditempatkan setelahnya agar urutan bawaan tetap sama antar-kandidat.
- Menyaring pertanyaan boleh, **tetapi tercatat**: `summarizeSelection()` menandai kompetensi yang seluruh pertanyaannya dikeluarkan (kompetensi itu jadi tidak terukur), dan `isKitTooThin()` memperingatkan bila tersisa < 4 pertanyaan.
- Pengecualian **tidak disimpan** — menyaring permanen adalah keputusan lain yang harus disengaja, bukan efek samping satu kali wawancara.
- `validateCustomQuestion()` **menolak** pertanyaan yang menyinggung kehamilan/status pernikahan, agama/suku/ras, usia, rencana punya anak, kondisi kesehatan/disabilitas, dan orientasi seksual. Ditolak di depan, bukan ditegur setelah dipakai mewawancarai orang. Pertanyaan tentang kesediaan menjalankan tuntutan pekerjaan tetap lolos.
- `activePack` memisahkan kit lengkap dari kit yang benar-benar dipakai menilai, sehingga cakupan dan rata-rata dihitung atas pertanyaan yang nyata ditanyakan.

## 9d. Fitur HR di cloud — `pi_hr_records` (24 Oktober 2026)

Enam fitur (eNPS & umpan balik, pelatihan, suksesi & 9-box, OD & grading, hubungan industrial, matriks kompetensi) = 14 koleksi, semuanya di satu tabel dokumen `pi_hr_records` (`supabase/hr-records-schema.sql`, PK `tenant_id + kind + record_id`, `data jsonb`, `updated_by` = akun pengubah, RLS authenticated-only). Daftar koleksi yang sah: `HR_KINDS` di `src/lib/hr-records.ts` (15 unit test).

- **Pola sama dengan `store.ts`:** localStorage = cache yang dibaca sinkron; tulis lewat `saveHrCollection()` yang hanya mengirim catatan yang **berubah** (urutan array diabaikan) dan menghapus yang hilang. `syncHrRecords()` dipanggil AppShell setelah login, menimpa cache (cloud menang, termasuk saat kosong), lalu memicu `HR_SYNCED_EVENT` yang didengarkan keenam halaman + dashboard.
- **Gagal tulis wajib terlihat** (toast). Kalau diam, perubahan itu hanya hidup di satu browser dan akan tertimpa saat sinkron berikutnya.
- **Ambil per halaman 1.000 baris** — PostgREST memotong diam-diam di 1.000, dan matriks kompetensi (karyawan × kompetensi) mudah melewatinya.
- **Setiap tombol hapus wajib `window.confirm`** — sejak di cloud, satu klik menghapus data seluruh tim (hapus kursus juga menghapus semua pesertanya).
- Store baru yang menyimpan data HR: tambahkan `kind` ke `HR_KINDS` dan pakai `saveHrCollection`, jangan `localStorage.setItem` langsung.
- Satu tabel jsonb, bukan 14 tabel bertipe, karena bentuk data fitur-fitur ini masih akan berubah. Pecah ke tabel bertipe bila dibutuhkan kueri/laporan lintas koleksi.
- Batasan yang disadari: dua orang menyunting **catatan yang sama** bersamaan → yang terakhir menang (per catatan, bukan per koleksi).

## 9e. Fase 1 Rica Rico — master karyawan, outlet, peran (25 Oktober 2026)

Skema `supabase/rica-rico-phase1.sql` (sudah diterapkan). Data diimpor dari Google Drive HR (Employee Database, rekap gaji September, tracker omset outlet) — **skrip impornya sengaja tidak ada di repo** karena memuat data pribadi; hasilnya hanya di database.

- **Peran, bukan sekadar login.** `pi_user_roles` (`hr` | `owner`) + fungsi `pi_role()` (security definer). 16 tabel `pi_*` memakai policy `pi read <tabel>` (select: hr/owner) dan `pi write <tabel>` (all: hr). Owner melihat semua termasuk gaji & NIK tapi **ditolak database** saat menulis (42501) — banner "Mode lihat saja" hanya penanda, bukan penjaganya. Akun tanpa peran melihat 0 baris. Peran tidak di-bootstrap di file SQL; HR pertama diberikan manual.
- **Akun dibuat dari `/pengaturan/akses`** lewat `/api/admin/users` (service-role, wajib token akun HR; HR tidak bisa mengubah perannya sendiri). Pengguna ganti sandi di `/akun`.
- **`pi_outlets`** (110 outlet; unik per `tenant_id + name`) dan **`pi_employee_profiles`** (1:1 dengan `pi_employees`, `on delete cascade`): kelompok kerja (`spg|spv|office|produksi|santan|sopir|host_live|lainnya`), outlet, SPV, badan usaha BPJS, data pribadi/kontak/darurat/pendidikan, tautan dokumen, dan `data_flags`.
- **`pi_employees.join_date` kini nullable** — 46 karyawan tidak punya tanggal masuk yang sah di sumber; mengisinya dengan tebakan lebih buruk daripada kosong.
- **Sentinel `BELUM_DIISI`** di `ptkp_status`, `risk_class`, dan `employment_type` yang tidak tercatat di sumber. Mesin payroll sengaja melempar error untuk PTKP yang tidak dikenal, jadi karyawan ini tidak bisa ikut payroll tanpa sengaja sebelum datanya dilengkapi.
- **`data_flags` = daftar yang harus dibereskan HR, bukan koreksi otomatis.** Arti tiap tanda: `FLAG_LABEL` di `src/lib/rr/master.ts`. NIK ganda/tidak 16 digit dan nama yang cocok ke lebih dari satu orang **tidak pernah digabung atau ditebak**. Karyawan resign tidak dihitung di ringkasan tanda.
- **Status `perlu_verifikasi`** = ada di Employee Database tapi tidak digaji September (40 orang) — mungkin sudah keluar, mungkin belum; HR yang memutuskan.
- Halaman: `/karyawan` (NIK & rekening disamarkan sampai diklik "Tampilkan"), `/outlet` (outlet per area, jumlah SPG aktif, outlet lowong). Fungsi murni di `src/lib/rr/master.ts` (7 unit test).

## 10. Yang belum dikerjakan

- Kalender konten & riwayat employer branding, target SLA rekrutmen, dan cache ringkasan eksekutif masih hanya di browser (localStorage). Enam fitur HR inti sudah di cloud — lihat §9d.
- **Turnover & beban lembur di dashboard** butuh kolom siklus hidup (`exit_date`, `exit_type`) dan jam lembur yang belum ada di `pi_employees`; kartu-kartunya kini jujur menampilkan "belum tersedia".
- **Endpoint AI (`/api/analyze-cv`, `/api/hr-consultant`, `/api/employer-branding`, `/api/executive-insight`) belum memeriksa login** — siapa pun yang tahu alamatnya bisa menghabiskan kuota Groq. `/api/send-email` sudah dijaga (wajib token Supabase); pola yang sama perlu diterapkan ke keempatnya.
- 13 error lint gaya (tipe `any`, tanda kutip di JSX) dan penghitung yang diubah saat render di `talent/od` (`renderedCount`).
- **Rekrutmen:** metrik kecepatan baru akan berarti setelah cukup kandidat berjalan lewat pipeline dengan riwayat tercatat (kandidat lama tidak ikut terhitung). Belum ada: cost-per-hire, sumber biaya iklan lowongan, dan pelacakan alasan penolakan kandidat.
- **Lengkapi data karyawan Rica Rico Bakery.** 365 karyawan sudah diimpor (§9e), tapi PTKP, kelas risiko JKK, dan sebagian status kerja masih `BELUM_DIISI`, dan daftar `data_flags` belum dibereskan. UMK per wilayah outlet/dapur produksi juga masih placeholder.
- **Fase berikutnya Rica Rico** (urutan disepakati): rekap gaji praktik per kelompok (catat praktik apa adanya, tanpa perbandingan aturan) → komisi SPG/SPV skema berversi (tiering persentil per Oktober 2026) → host live → rekrutmen/onboarding/kontrak/BPJS/reimburse → cuti → absensi (menggantikan Kantorku perlahan, target sebelum ~September 2027).
- **Kerangka kompetensi belum mencakup bakery & ritel outlet.** `CompetencyCluster` hanya punya `hr | tech | business | finance | broadcast | editorial | security`. Peran khas Rica Rico — baker/produksi, QC & keamanan pangan (halal, BPOM PIRT/MD), kepala outlet, kasir/SPG mal, gudang & distribusi antar-outlet, admin pesanan online (GoFood/GrabFood/ShopeeFood) — belum ada klasternya dan sementara jatuh ke `business`. Bank soal wawancara juga masih bertema penyiaran/pabrik. Ini gap nyata, bukan sekadar penamaan.
- Script `scripts/run-seed-payroll.ts` dan `scripts/generate-seed-payslips.ts` dulu bergantung pada 13 karyawan seed yang kini sudah dihapus; keduanya sekarang membaca apa pun yang ada di database.
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
