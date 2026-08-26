-- ============================================================
-- People Intelligence — Modul PAY · SEED TARIF STATUTORI
--
-- File ini HANYA berisi tarif statutori (PPh 21/TER, BPJS, PTKP, biaya jabatan,
-- lembur, UMK). Tarif = DATA ber-versi per effective_date, bukan kode — perubahan
-- tarif pemerintah dilakukan dengan MENAMBAH baris baru, bukan mengubah baris lama,
-- supaya perhitungan periode lampau tetap memakai tarif yang berlaku saat itu.
--
-- TIDAK ADA data karyawan di sini. Versi sebelumnya menyertakan 13 karyawan fiktif
-- (nama pesepakbola, NIK/NPWP karangan) sebagai data demo; semuanya dihapus karena
-- instance ini dipakai untuk perusahaan sungguhan. Karyawan diisi lewat aplikasi
-- (/pay/onboarding atau /pay/employees), bukan lewat file yang ikut masuk repo —
-- data karyawan asli tidak boleh berada di dalam repo (CLAUDE.md §6).
--
-- Jalankan SETELAH pay-module-schema.sql. Aman dijalankan ulang.
-- ============================================================

-- ── Konfigurasi statutori (TARIF TERVERIFIKASI — PP 58/2023) ──
-- Diverifikasi 2026-07-21 dari 2 sumber independen (klikpajak.id, hrdpintar.com),
-- disilangkan satu sama lain + terhadap kutipan resmi DJP (pajak.go.id) soal batas
-- teratas tiap kategori (A: >Rp1,4M, B: >Rp1,405M, C: >Rp1,419M — semua 34%) dan
-- jumlah bracket kategori A (44 baris). Satu baris di tabel C pada salah satu sumber
-- tidak monoton (turun dari 2% ke 1,75%) dan dibuang, diganti versi yang konsisten.
-- BPJS/PTKP/UMK di bawah adalah pengetahuan umum yang stabil sejak lama; PPh21/TER
-- adalah bagian paling berisiko salah sehingga ini yang diverifikasi via web.
-- biaya_jabatan: diverifikasi 2026-07-21 dari PMK 250/PMK.03/2008 (jdih.kemenkeu.go.id) +
-- dikonfirmasi DJP (pajak.go.id/en/node/61792) + Gadjian. TIDAK diatur/diubah oleh PP 58/2023
-- atau PMK 168/2023 -- kedua aturan itu hanya mengubah metode pemotongan bulanan (TER), bukan
-- komponen pengurang bruto ini. rate 5%, cap Rp500rb/bulan atau Rp6jt/tahun (kerja penuh setahun).
-- overtime: diverifikasi 2026-07-21 dari PP 35/2021 Pasal 31-32 (jdih.kemenkeu.go.id) --
-- MENGGANTIKAN Kepmenaker 102/2004 yang sudah dicabut Permenaker 23/2021. Batas lembur
-- harian naik 3->4 jam vs aturan lama, tier 4x dapat tambahan 1 jam (6 hari: jam 9-11,
-- bukan 9-10; 5 hari: jam 10-12, bukan 10-11) -- banyak blog HR masih pakai tabel lama, JANGAN.
insert into pi_statutory_config (id, effective_date, ptkp, ter_tables, bpjs_rates, progressive, biaya_jabatan, overtime, umk) values
 ('c0000000-0000-4000-8000-000000000001',
  '2026-01-01',
  '{"base":54000000,"married":4500000,"dependent":4500000,"max_dependents":3}',
  -- Kategori TER dipetakan dari status PTKP:
  --   A = TK/0,TK/1,K/0 | B = TK/2,TK/3,K/1,K/2 | C = K/3
  '{"A":[{"upTo":5400000,"rate":0},{"upTo":5650000,"rate":0.0025},{"upTo":5950000,"rate":0.005},{"upTo":6300000,"rate":0.0075},{"upTo":6750000,"rate":0.01},{"upTo":7500000,"rate":0.0125},{"upTo":8550000,"rate":0.015},{"upTo":9650000,"rate":0.0175},{"upTo":10050000,"rate":0.02},{"upTo":10350000,"rate":0.0225},{"upTo":10700000,"rate":0.025},{"upTo":11050000,"rate":0.03},{"upTo":11600000,"rate":0.035},{"upTo":12500000,"rate":0.04},{"upTo":13750000,"rate":0.05},{"upTo":15100000,"rate":0.06},{"upTo":16950000,"rate":0.07},{"upTo":19750000,"rate":0.08},{"upTo":24150000,"rate":0.09},{"upTo":26450000,"rate":0.1},{"upTo":28000000,"rate":0.11},{"upTo":30050000,"rate":0.12},{"upTo":32400000,"rate":0.13},{"upTo":35400000,"rate":0.14},{"upTo":39100000,"rate":0.15},{"upTo":43850000,"rate":0.16},{"upTo":47800000,"rate":0.17},{"upTo":51400000,"rate":0.18},{"upTo":56300000,"rate":0.19},{"upTo":62200000,"rate":0.2},{"upTo":68600000,"rate":0.21},{"upTo":77500000,"rate":0.22},{"upTo":89000000,"rate":0.23},{"upTo":103000000,"rate":0.24},{"upTo":125000000,"rate":0.25},{"upTo":157000000,"rate":0.26},{"upTo":206000000,"rate":0.27},{"upTo":337000000,"rate":0.28},{"upTo":454000000,"rate":0.29},{"upTo":550000000,"rate":0.3},{"upTo":695000000,"rate":0.31},{"upTo":910000000,"rate":0.32},{"upTo":1400000000,"rate":0.33},{"upTo":null,"rate":0.34}],"B":[{"upTo":6200000,"rate":0},{"upTo":6500000,"rate":0.0025},{"upTo":6850000,"rate":0.005},{"upTo":7300000,"rate":0.0075},{"upTo":9200000,"rate":0.01},{"upTo":10750000,"rate":0.015},{"upTo":11250000,"rate":0.02},{"upTo":11600000,"rate":0.025},{"upTo":12600000,"rate":0.03},{"upTo":13600000,"rate":0.04},{"upTo":14950000,"rate":0.05},{"upTo":16400000,"rate":0.06},{"upTo":18450000,"rate":0.07},{"upTo":21850000,"rate":0.08},{"upTo":26000000,"rate":0.09},{"upTo":27700000,"rate":0.1},{"upTo":29350000,"rate":0.11},{"upTo":31450000,"rate":0.12},{"upTo":33950000,"rate":0.13},{"upTo":37100000,"rate":0.14},{"upTo":41100000,"rate":0.15},{"upTo":45800000,"rate":0.16},{"upTo":49500000,"rate":0.17},{"upTo":53800000,"rate":0.18},{"upTo":58500000,"rate":0.19},{"upTo":64000000,"rate":0.2},{"upTo":71000000,"rate":0.21},{"upTo":80000000,"rate":0.22},{"upTo":93000000,"rate":0.23},{"upTo":109000000,"rate":0.24},{"upTo":129000000,"rate":0.25},{"upTo":163000000,"rate":0.26},{"upTo":211000000,"rate":0.27},{"upTo":374000000,"rate":0.28},{"upTo":459000000,"rate":0.29},{"upTo":555000000,"rate":0.3},{"upTo":704000000,"rate":0.31},{"upTo":957000000,"rate":0.32},{"upTo":1405000000,"rate":0.33},{"upTo":null,"rate":0.34}],"C":[{"upTo":6600000,"rate":0},{"upTo":6950000,"rate":0.0025},{"upTo":7350000,"rate":0.005},{"upTo":7800000,"rate":0.0075},{"upTo":8850000,"rate":0.01},{"upTo":9800000,"rate":0.0125},{"upTo":10950000,"rate":0.015},{"upTo":11200000,"rate":0.0175},{"upTo":12050000,"rate":0.02},{"upTo":12950000,"rate":0.03},{"upTo":14150000,"rate":0.04},{"upTo":15550000,"rate":0.05},{"upTo":17050000,"rate":0.06},{"upTo":19500000,"rate":0.07},{"upTo":22700000,"rate":0.08},{"upTo":26600000,"rate":0.09},{"upTo":28100000,"rate":0.1},{"upTo":30100000,"rate":0.11},{"upTo":32600000,"rate":0.12},{"upTo":35400000,"rate":0.13},{"upTo":38900000,"rate":0.14},{"upTo":43000000,"rate":0.15},{"upTo":47400000,"rate":0.16},{"upTo":51200000,"rate":0.17},{"upTo":55800000,"rate":0.18},{"upTo":60400000,"rate":0.19},{"upTo":66700000,"rate":0.2},{"upTo":74500000,"rate":0.21},{"upTo":83200000,"rate":0.22},{"upTo":95600000,"rate":0.23},{"upTo":110000000,"rate":0.24},{"upTo":134000000,"rate":0.25},{"upTo":169000000,"rate":0.26},{"upTo":221000000,"rate":0.27},{"upTo":390000000,"rate":0.28},{"upTo":463000000,"rate":0.29},{"upTo":561000000,"rate":0.3},{"upTo":709000000,"rate":0.31},{"upTo":965000000,"rate":0.32},{"upTo":1419000000,"rate":0.33},{"upTo":null,"rate":0.34}]}',
  '{"jht":{"employer":0.037,"employee":0.02},"jp":{"employer":0.02,"employee":0.01,"wage_cap":10547400},"jkk":{"I":0.0024,"II":0.0054,"III":0.0089,"IV":0.0127,"V":0.0174},"jkm":{"employer":0.003},"kesehatan":{"employer":0.04,"employee":0.01,"wage_cap":12000000}}',
  '[{"upTo":60000000,"rate":0.05},{"upTo":250000000,"rate":0.15},{"upTo":500000000,"rate":0.25},{"upTo":5000000000,"rate":0.30},{"upTo":null,"rate":0.35}]',
  '{"rate":0.05,"monthly_cap":500000,"annual_cap":6000000}',
  '{"hourly_divisor":173,"weekday":[{"maxHour":1,"multiplier":1.5},{"maxHour":null,"multiplier":2}],"restday_6day_week":[{"maxHour":7,"multiplier":2},{"maxHour":8,"multiplier":3},{"maxHour":11,"multiplier":4}],"restday_5day_week":[{"maxHour":8,"multiplier":2},{"maxHour":9,"multiplier":3},{"maxHour":12,"multiplier":4}]}',
  3400000)
on conflict (id) do nothing;

-- ── Config statutori v2 — berlaku sejak MARET 2026 ───────────
-- Diverifikasi 2026-07-23: plafon upah JP BPJS Ketenagakerjaan naik dari Rp10.547.400 ke
-- Rp11.086.300 sejak Maret 2026 (SE BPJS TK No. B/1226/022026, 25 Feb 2026; +5,11% ikut
-- pertumbuhan PDB, disesuaikan tiap Maret). Semua tarif lain DIKONFIRMASI masih terkini
-- (JHT 3,7/2, JP rate 2/1, JKK I-V, JKM 0,3, Kesehatan 4/1 cap 12jt tak berubah sejak 2020).
-- ADITIF: baris Januari (v1) dibiarkan utuh agar periode Jan-Feb 2026 tetap pakai plafon lama
-- yang benar. Engine memilih config per-periode (pickStatutoryConfigForPeriod), bukan yang
-- terbaru. Hanya jp.wage_cap yang diubah -- field lain disalin dari v1 via jsonb_set agar tidak
-- ada duplikasi/drift. VERIFIKASI ULANG plafon JP tiap Maret (mis. Maret 2027).
insert into pi_statutory_config (id, effective_date, ptkp, ter_tables, bpjs_rates, progressive, biaya_jabatan, overtime, umk)
select
  'c0000000-0000-4000-8000-000000000002',
  '2026-03-01',
  ptkp, ter_tables,
  jsonb_set(bpjs_rates, '{jp,wage_cap}', '11086300'::jsonb),
  progressive, biaya_jabatan, overtime, umk
from pi_statutory_config
where id = 'c0000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;
