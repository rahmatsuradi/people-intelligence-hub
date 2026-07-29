# People Intelligence — Hiring + Payroll Platform

**AI-powered HR platform** untuk konteks Indonesia: mulai dari analisis CV berbasis kompetensi (modul **Hire**) sampai kalkulasi gaji, BPJS, dan PPh 21 yang terverifikasi sesuai regulasi resmi (modul **Pay**).

🔗 **Live Demo:** [hire-intelligence-system.vercel.app](https://hire-intelligence-system.vercel.app) — data 100% sintetis/fiktif, aman dijelajahi.

---

## Overview

Repo ini berevolusi dari **Hire Intelligence** (platform rekrutmen AI) menjadi **People Intelligence** — platform HR yang lebih luas, dengan dua modul independen berbagi satu shell aplikasi:

- **Hire** — analisis CV kandidat berbasis dua framework kompetensi HR sekaligus (Ulrich & SKKNI), pipeline kandidat, dan workspace interview.
- **Pay** — mesin payroll: hitung gaji kotor → BPJS → PPh 21 → gaji bersih, terbitkan slip gaji, dan laporan lintas periode — dengan **setiap tarif/formula statutori diverifikasi dari sumber resmi sebelum dipakai**, bukan diasumsikan benar.

Filosofi modul Pay: logika pajak dan BPJS bukan sekadar fitur, tapi **klaim kepatuhan hukum** — jadi setiap rumus punya kasus uji ber-kunci-jawaban dan setiap tarif punya sitasi sumbernya.

---

## Features

### 🎯 Hire — CV Analyzer (AI-Powered)
- Upload PDF resume → AI membaca dan menganalisis teks CV
- Scoring otomatis untuk 11 kompetensi (6 Ulrich + 5 SKKNI)
- Risk flags: identifikasi potensi masalah sebelum interview
- 5 pertanyaan interview terstruktur (STAR format) berdasarkan gap kompetensi kandidat
- Final recommendation: Strong Hire / Hire / Review / Reject
- Evidence validity panel berbasis Schmidt & Hunter (1998) — r ≈ 0.51 untuk structured interview
- Halaman lamar publik (`/apply`) dengan analisis CV otomatis di sisi server

### 📊 Hire — Dashboard & Workspace
- Pipeline kandidat dengan tracking status, hiring velocity chart, department fill rate
- Interview workspace dengan template pertanyaan & scoring guide per kompetensi
- Hiring report: panel keputusan multi-kandidat

### 💰 Pay — Payroll Engine
- **BPJS** — JHT, JP, JKK (per kelas risiko), JKM, Kesehatan; potongan karyawan & beban perusahaan dihitung terpisah
- **PPh 21** — metode TER bulanan (Januari–November, PP 58/2023) *dan* rekonsiliasi tahunan progresif (Desember, Pasal 17 UU HPP) — termasuk kasus kelebihan-potong yang dikembalikan ke karyawan
- **THR** — prorata sesuai masa kerja (Permenaker 6/2016)
- **Lembur** — tabel multiplier berjenjang sesuai PP 35/2021 (bukan tabel Kepmenaker 102/2004 yang sudah dicabut — kesalahan umum yang masih beredar di banyak kalkulator online)
- **Tarif sebagai data, bukan kode** — setiap tarif statutori disimpan *versioned* per tanggal berlaku; saat pemerintah mengubah tarif (mis. plafon upah BPJS naik tiap Maret), tinggal tambah baris data baru — perhitungan periode lama tetap akurat secara retroaktif

### 🔗 Jembatan Hire → Pay (Onboarding)
- Kandidat berstatus **Hired** otomatis muncul di antrean onboarding payroll
- Form onboarding menarik data yang sudah diketahui dari rekrutmen (nama, posisi, departemen) dan meminta data yang **hanya ada saat kontrak ditandatangani** — upah disepakati, status PTKP, NIK, tanggal masuk, tipe kontrak (PKWT/PKWTT), kelas risiko JKK
- Sekali submit → karyawan + profil kompensasi terbentuk, langsung ikut terhitung di payroll periode berikutnya
- Relasi dirancang aman: satu kandidat tidak bisa di-onboard dua kali, dan menghapus kandidat di modul Hire **tidak** menghapus record karyawannya (orangnya tetap bekerja)

### 🧾 Pay — Slip Gaji & Laporan
- Slip gaji otomatis dengan itemisasi lengkap (pendapatan, potongan, kontribusi perusahaan terpisah)
- Data pribadi sensitif (NIK, NPWP, rekening bank) **ter-masking otomatis** sesuai UU PDP 27/2022
- Pemeriksaan integritas built-in: slip menolak diterbitkan jika totalnya tidak cocok dengan hasil mesin hitung
- Potongan non-statutori (kasbon, denda) bisa ditambahkan per periode tanpa mengganggu kalkulasi pajak/BPJS
- Laporan rekap lintas periode + ekspor CSV untuk pelaporan BPJS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database & Auth | Supabase (Postgres + Row Level Security) |
| AI Model (Hire) | Llama 3.3 70B via Groq API |
| PDF Extraction | unpdf |
| Testing | Vitest — 94 unit test, metodologi kasus ber-kunci-jawaban |
| Deployment | Vercel |

---

## Architecture

### Hire — alur analisis CV

```
User uploads PDF
       ↓
PDF text extraction (unpdf)
       ↓
Prompt engineering (Ulrich + SKKNI framework definitions)
       ↓
Groq API → Llama 3.3 70B (JSON mode)
       ↓
Structured response parsing + score normalization
       ↓
UI render: competency bars, risk flags, interview questions
```

### Pay — alur payroll

```
pi_compensation (upah pokok + tunjangan)
       ↓
computeGross  →  gross bulanan (+ lembur, + THR bila periode ybs)
       ↓
computeBPJS   →  potongan karyawan (JHT/JP/Kesehatan) + beban perusahaan (+ JKK/JKM)
       ↓
computePPh21_TER (Jan–Nov)  atau  computePPh21_Annual (Desember, rekonsiliasi)
       ↓
net  →  buildPayslip (masking PDP + pemeriksaan integritas)  →  slip gaji
```

Semua fungsi di atas **murni** (pure functions) — kasih input yang sama, hasilnya selalu sama, tanpa efek samping tersembunyi. Ini yang membuatnya bisa diuji dengan kasus ber-kunci-jawaban: angka dihitung manual dulu, lalu dicocokkan dengan hasil program.

### Competency Framework (Hire)

**Ulrich HR Competency Model (6 dimensi):**
| ID | Kompetensi | Benchmark |
|---|---|---|
| ulrich-credible-activist | Credible Activist | 80 |
| ulrich-strategic-positioner | Strategic Positioner | 78 |
| ulrich-capability-builder | Capability Builder | 80 |
| ulrich-change-champion | Change Champion | 78 |
| ulrich-hr-innovator | HR Innovator & Integrator | 81 |
| ulrich-technology-proponent | Technology Proponent | 83 |

**SKKNI No. 149/2020 (5 unit kompetensi):**
| ID | Kompetensi | Benchmark |
|---|---|---|
| skkni-perencanaan | Perencanaan SDM | 80 |
| skkni-rekrutmen | Rekrutmen & Seleksi | 85 |
| skkni-pengembangan | Pengembangan Kompetensi | 82 |
| skkni-kinerja | Manajemen Kinerja | 79 |
| skkni-hubungan-industrial | Hubungan Industrial | 80 |

Setiap kompetensi memiliki rubrik 1-5 yang di-map ke skor 20-100, dengan validity coefficient mengacu pada Schmidt & Hunter (1998).

---

## Dasar Hukum Modul Pay

Setiap tarif dan formula di mesin payroll diverifikasi dari peraturan resmi sebelum diimplementasikan — bukan dari template kalkulator online yang sering sudah usang:

| Area | Dasar Hukum |
|---|---|
| Struktur upah, THR, lembur | UU Ketenagakerjaan, PP 36/2021 tentang Pengupahan |
| THR Keagamaan | Permenaker No. 6 Tahun 2016 |
| Tarif & tabel lembur | **PP 35/2021** Pasal 31–32 (menggantikan Kepmenaker 102/2004 yang sudah dicabut Permenaker 23/2021) |
| PPh 21 metode TER | PP 58/2023, PMK 168/2023 |
| PPh 21 rekonsiliasi tahunan | Pasal 17 UU HPP (tarif progresif) |
| Biaya jabatan | PMK 250/PMK.03/2008 (tidak diubah PP 58/2023) |
| PTKP | PMK 101/PMK.010/2016 |
| BPJS Ketenagakerjaan (JHT/JP/JKK/JKM) | PP 44/2015, PP 45/2015, PP 46/2015 |
| BPJS Kesehatan | Perpres 82/2018 jo. Perpres 75/2019 jo. Perpres 64/2020 |
| Perlindungan data pribadi (masking NIK/NPWP) | UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi |

Tarif yang disesuaikan berkala oleh pemerintah (mis. plafon upah BPJS, disesuaikan tiap Maret) disimpan sebagai data *versioned* per tanggal berlaku, bukan angka tetap di kode — sudah dibuktikan bekerja saat plafon berubah pertengahan tahun berjalan.

---

## Local Development

```bash
# Clone repo
git clone https://github.com/rahmatsuradi/people-intelligence-hub.git
cd people-intelligence-hub

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Isi GROQ_API_KEY dari https://console.groq.com
# Isi kredensial Supabase (lihat Environment Variables di bawah)

# Terapkan skema database (Supabase SQL Editor, berurutan):
#   1. supabase/schema.sql            (modul Hire — RLS authenticated-only, aman dijalankan ulang)
#   2. supabase/pay-module-schema.sql
#   3. supabase/pay-module-seed.sql   (12 karyawan sintetis)
#   4. supabase/pay-module-rls.sql
#
# Semua file di atas idempoten (aman dijalankan ulang) dan RLS-nya dibatasi ke
# role `authenticated` — anon key yang publik tidak bisa membaca/menulis data.
# Jika database Anda dibuat oleh schema.sql versi lama, jalankan sekali:
#   supabase/rls-authenticated.sql

# Jalankan development server
npm run dev

# Jalankan unit test
npm run test
```

Buka [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
GROQ_API_KEY=gsk_...                        # Groq API key (free tier tersedia) — untuk CV Analyzer
NEXT_PUBLIC_SUPABASE_URL=https://...         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...            # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=...                # Untuk alur publik (/apply) yang butuh bypass RLS
```

---

## Cara Penggunaan

### CV Analyzer
1. Buka `/cv-analyzer`
2. Upload PDF resume kandidat (max 10MB, harus PDF dengan teks yang bisa diseleksi — bukan scan gambar)
3. Isi nama kandidat, posisi target, dan departemen
4. Klik **Analyze CV**
5. Tunggu 5-10 detik — AI akan menganalisis dan menghasilkan laporan lengkap

### Payroll
1. Login (invite-only) → buka `/pay/payroll`
2. Pilih periode (bulan) — sistem otomatis menghitung gaji semua karyawan aktif
3. Tambahkan lembur, THR, atau potongan lain per karyawan bila relevan pada periode itu
4. Klik **Simpan Run** untuk menyimpan hasil periode tersebut
5. Klik **Lihat** pada baris karyawan untuk membuka/mengunduh slip gaji
6. Buka `/pay/laporan` untuk rekap lintas periode dan ekspor CSV pelaporan BPJS

---

## Testing

Mesin payroll diuji dengan **94 unit test** memakai metodologi kasus ber-kunci-jawaban: setiap kasus uji dihitung manual dari tarif resmi terlebih dahulu (kadang disilangkan dengan verifikasi independen kedua), baru dicocokkan dengan hasil program. Contoh kasus yang diuji: pembulatan di batas plafon BPJS, rekonsiliasi PPh 21 Desember dengan hasil kelebihan-potong (negatif), tabel lembur lintas hari kerja/hari libur, dan transisi tarif antar periode.

```bash
npm run test
```

---

## Academic & Legal References

- Ulrich, D., Brockbank, W., Ulrich, M. & Lake, D. (2012). *HR Competency Study: mastery of six domains distinguishes high-impact HR professionals.*
- Schmidt, F.L. & Hunter, J.E. (1998). The validity and utility of selection methods in personnel psychology. *Psychological Bulletin, 124(2), 262–274.*
- Kementerian Ketenagakerjaan RI. (2020). *SKKNI No. 149 Tahun 2020 — Standar Kompetensi Kerja Nasional Indonesia Bidang Manajemen Sumber Daya Manusia.*
- Lihat tabel [Dasar Hukum Modul Pay](#dasar-hukum-modul-pay) di atas untuk regulasi payroll/BPJS/pajak.

---

## About

Dibangun oleh **Rahmat Suradi** sebagai portofolio HR tech — dari rekrutmen berbasis AI (modul Hire) sampai mesin payroll yang taat regulasi (modul Pay).

Latar belakang: Communication Science graduate (Universitas Andalas, GPA 3.78) dengan pengalaman praktis sebagai pengelola HR tunggal di industri konveksi keluarga (70+ karyawan), kini HRGA Staff, dan transisi ke HR Generalist / Organizational Development / HR Tech.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://linkedin.com/in/rahmatsuradi)
