# Serah-terima: Formulir data karyawan + ekspor KantorKu

Tanggal: 17 November 2026 · Ditulis di akhir sesi cloud supaya sesi berikutnya (cloud, Desktop, atau terminal) bisa langsung lanjut tanpa membaca ulang percakapan.

> Baca dulu `CLAUDE.md` (terutama §1b "Satu jalur kerja", §6 kerahasiaan, §9e master karyawan, **§9g fitur ini**). Dokumen ini melengkapi §9g dengan status, keputusan, dan langkah berikutnya.

---

## 1. Tujuan (kata pengguna, diringkas)

Pengguna (HR Rica Rico) memakai **HRIS KantorKu** untuk absensi/cuti/slip. Ia ingin:

1. **Web ini jadi master database karyawan.**
2. Karyawan mengisi data lewat **formulir di web ini** (pengganti Google Form "Employee Database Rica Rico Bakery").
3. Dari web, data bisa **diekspor persis seperti template impor KantorKu** supaya bisa dimasukkan ke KantorKu.
4. Panel browser di samping sesi (aplikasi Claude) dipakai untuk melihat hasilnya.

Butir 1–3 sudah dibangun. Butir 4 belum bisa (lihat §6).

---

## 2. Status ringkas

| Hal | Status |
|---|---|
| Kode fitur (formulir publik, halaman HR 3 tab, ekspor xlsx) | ✅ Selesai, ada di PR #19 (draft) |
| Tes otomatis | ✅ 659 lulus (43 berkas); `tsc` bersih; `next build` berhasil |
| Formulir dicoba di ukuran HP (database tiruan) | ✅ lengkap sampai terkirim |
| Berkas ekspor dibuka ulang di LibreOffice | ✅ kolom Row Status template = "✓ OK" |
| Preview Vercel (Rica Rico & Lencir) | ✅ Ready |
| **SQL `supabase/data-karyawan-kantorku.sql` diterapkan ke database Rica Rico** | ❌ **BELUM** |
| **Impor ke KantorKu sungguhan dicoba** | ❌ **BELUM** |
| PR #19 dan PR #20 digabung ke `main` | ❌ BELUM (keduanya draft) |
| Browser samping tersedia di sesi cloud | ❌ Tidak (lihat §6) |

Pull request (repo `rahmatsuradi/people-intelligence-hub`):

- **#19** `claude/gracious-brown-jtymhd` → `main` — fitur KantorKu (28 berkas, +3250/−5). Head terakhir `babc423`.
- **#20** `claude/skill-preview-panel-samping` → `main` — hanya `.claude/skills/preview-panel-samping/SKILL.md`.
- `main` saat dokumen ini ditulis: `26c72e5`.

---

## 3. Cara memulai sesi baru (ikuti urutan)

```bash
git fetch origin
git rev-list --count HEAD..origin/main     # CLAUDE.md §1b: kalau bukan 0, satukan dulu
npm ci                                      # node_modules tidak ikut ter-clone
npx vitest run                              # harapan: 659 lulus
npx tsc --noEmit -p .
```

**Mengambil kode fitur ini ke sesi baru.** Sesi baru diberi nama branch sendiri dan hanya boleh mendorong ke branch itu.

- Kalau PR #19 **belum** digabung: `git fetch origin claude/gracious-brown-jtymhd && git merge --no-edit FETCH_HEAD` ke branch sesi, lalu lanjut.
- Kalau PR #19 **sudah** digabung: cukup mulai dari `main` terbaru.
- Jangan rebase atau force-push branch #19 (bisa dipakai sesi lain).

Catatan lingkungan:

- Tidak ada `gh` CLI. Pakai alat `mcp__github__*` (muat dengan ToolSearch). Setelah push, buat PR **draft**, lalu `subscribe_pr_activity`.
- Akhiri pesan commit dengan baris atribusi yang diberikan sistem sesi (Co-Authored-By + Claude-Session) dan PR dengan baris "Generated with Claude Code".
- Hook sesi akan meminta commit/push bila ada berkas belum terlacak.
- `next dev` / `next build` kadang mengubah `tsconfig.json` — cek `git diff` sebelum commit. Jangan commit `.next`.
- Jangan menambahkan data demo/seed ke repo atau database asli (CLAUDE.md §1b, §6). Semua data uji di tes memakai nama fiktif.

---

## 4. Peta kode

**Logika murni (`src/lib/kantorku/`, 41 tes):**

| Berkas | Isi |
|---|---|
| `spec.ts` | 44 kolom template A–AR (`KK_COLUMNS`), semua pilihan dropdown (`REF`), 114 kode bank (`KK_BANKS`). **Disalin dari template, jangan ditebak.** |
| `map.ts` | `toKantorkuRow(source, units, defaults)` → nilai A–AR + `problems` (menghalangi) + `derived` (diturunkan) + `notes`. Normalisasi tanggal DD/MM/YYYY, HP `62…`, agama, gender, status kawin, bank → kode. |
| `xlsx.ts` | `fillTemplate(xlsx, rows)` mengisi **template asli** (fflate): hanya sel A–AR baris 6+. `readUnits()` membaca Branch/Department/Position dari sheet "Existing Data". `readFilledRows()` untuk tes. |
| `intake.ts` | Definisi 27 pertanyaan formulir, `validateIntake` (dipakai klien **dan** server), `suggestPtkp`, `buildApplyPatch`, `diffWithMaster`, `matchOutlet`, `maskTail`. |
| `store.ts` | Akses Supabase sisi browser HR: `loadKantorku`, `saveHris`, `createLinks`, `applySubmission`, `rejectSubmission`, `openDoc` (signed URL), `markExported`. |
| `template.ts` | `builtinTemplate()` / `builtinUnits()` — **hanya instance `rica-rico`**; instance lain `null`. |
| `template-rica-rico.ts` | **DIBUAT OTOMATIS** (base64 template). Jangan disunting. Regenerasi: `node node_modules/tsx/dist/cli.mjs scripts/embed-kantorku-template.ts <template.xlsx> rica-rico` |

**Route & halaman:**

- `src/app/api/data-karyawan/route.ts` — PUBLIK (service-role, throttle per IP, isian jebakan bot `website`). GET = pertanyaan + data lama yang disamarkan; POST = simpan satu isian + dokumen.
- `src/app/api/kantorku/template/route.ts` — template bawaan, **khusus HR** (`requireHr`).
- `src/app/data-karyawan/[token]/page.tsx` + `src/components/data-karyawan/intake-form.tsx` — formulir HP, 7 bagian.
- `src/app/karyawan/kantorku/page.tsx` + `src/components/kantorku/{links-tab,submissions-tab,export-tab,shared}.tsx` — halaman HR, menu "Data Karyawan & KantorKu" (nav id `data-kantorku`).
- Diubah: `src/app/karyawan/page.tsx` (`DocLink` membuka `storage:` lewat signed URL), `src/components/app-shell.tsx` (menu), `vitest.config.ts` (menyertakan `src/lib/kantorku/**`), `package.json` (`fflate`).

**Database:** `supabase/data-karyawan-kantorku.sql` — aditif, aman dijalankan ulang:
`pi_employee_hris` (1:1 `pi_employees`), `pi_employee_data_links`, `pi_employee_data_submissions`, bucket privat `pi-employee-docs` (5 MB, JPG/PNG/WebP/PDF), policy baca storage khusus HR.

---

## 5. Keputusan desain yang HARUS dipertahankan

1. **Ekspor mengisi berkas template asli, bukan membuat spreadsheet baru.** Sheet Instructions/REF/Existing Data, dropdown, rumus Row Status, dan conditional formatting harus utuh. Sel diisi sebagai inline string supaya NIK tetap teks 16 digit (bukan 3,17E+15). Verifikasi dengan LibreOffice (`soffice --headless --convert-to csv`), bukan hanya membaca XML.
2. **Bank Name = kode bank** (`bca`, `bri`, `bank_mandiri`, …). Contoh "bank_bca" di template tidak ada di daftar bank mereka sendiri.
3. **Ejaan "Confucious"** memang begitu di template KantorKu. Jangan "dibetulkan".
4. **Branch/Department/Position harus persis** nilai sheet "Existing Data" (Rica Rico: 8 branch, 11 department, 6 position). Dibaca dari template, dan HR bisa mengunggah template terbaru.
5. **Isian formulir tidak pernah langsung menimpa master.** Masuk ke `pi_employee_data_submissions` (status `baru` → `diterapkan` / `ditolak`, tidak dihapus). HR membandingkan per field, bisa mengecualikan field, lalu menerapkan.
6. **Link pribadi tidak mengirim balik data sensitif** (NIK, rekening, HP, alamat, tanggal lahir, nama ibu): hanya "sudah tercatat" + 4 digit terakhir. `data-karyawan-route.test.ts` memeriksa ini. Field sensitif yang sudah tercatat boleh dikosongkan = tidak berubah.
7. **Data pribadi kosong tidak ditebak.** Nama pemilik rekening bukan otomatis nama karyawan; gaji pokok bukan 0 → jadi `problems`, baris tidak siap impor. Turunan hanya untuk kolom administratif dan dicatat di `derived`.
8. **Draf isian di `sessionStorage`** (bukan localStorage): memuat NIK & rekening, dan HP outlet dipakai bergantian.
9. **Foto dikecilkan di HP** (≤ ~1,3 MB; server menolak > 1,4 MB) karena batas body Vercel 4,5 MB untuk 3 berkas.
10. **Dokumen di penyimpanan privat** (`storage:pi-employee-docs/<path>`), dibuka lewat signed URL 5 menit. Tautan Google Drive lama di profil tetap dibuka apa adanya.
11. **PTKP disarankan, HR yang menetapkan.** `suggestPtkp`: TK/K + tanggungan (maks 3); **karyawati kawin = TK/0** (PMK 168/2023 Pasal 9 ayat 2–3). ⚠️ Sumbernya ringkasan DDTC News dan pajak.go.id; **teks PMK-nya belum dibuka langsung** — verifikasi ke teks resmi sebelum diandalkan (CLAUDE.md §13).
12. **Tax Status bawaan**: freelance/borongan = Pegawai Tidak Tetap (wajib Payee Type); lainnya Pegawai Tetap. Tenaga Ahli / Bukan Pegawai **tidak didukung** (butuh kolom kondisional lain) — diisi langsung di KantorKu. **Taxability** dipilih HR sekali (bawaan perusahaan, disimpan di localStorage browser HR); KantorKu tidak mengizinkan Tax Status/Taxability diubah di tengah tahun pajak.
13. **Employee ID KantorKu** kosong = KantorKu membuatkan otomatis (format yang terlihat di ekspor cuti: `202604007`). Untuk karyawan yang sudah ada di KantorKu, isi ID-nya di web dulu.

---

## 6. Browser samping — kenapa tidak ada di sesi cloud

- Browser bawaan adalah panel di **aplikasi Claude Desktop di laptop pengguna**. Alatnya (`mcp__remote-devices__Claude_Browser__*`) hanya muncul bila sesi cloud **tersambung ke laptop**. Di sesi ini tidak ada alat itu.
- `list_computer_folders` menunjukkan laptop `LAPTOP-NDD5QTS3`, folder "Proyek AI", status **`not_available`** (laptop tidak menawarkan folder ke sesi cloud, tanpa alasan). Penyebab umum: aplikasi Desktop perlu diperbarui (Windows), atau folder di dalam direktori tersembunyi. Pengguna sudah memperbarui; masih `not_available` — kemungkinan perlu **restart penuh aplikasi**, atau tambahkan folder baru berjalur biasa (mis. `Documents\people-intelligence-hub`) di Settings → Claude Code → Remote Control. Bisa juga fitur belum tersedia untuk akunnya; jangan menyimpulkan sebab paket/organisasi.
- Browser itu **tidak bisa membuka server `localhost` yang dijalankan di container cloud** (beda komputer). `report_preview_port` tidak menolong. Untuk menampilkan HTML buatan sesi, pakai **Artifact**.
- Pelajaran terpisah (sudah di skill #20): `next dev` menolak (403) `/_next/*` dari alamat selain localhost → panel preview kosong. Di cloud pakai `next build` lalu `next start -H 0.0.0.0 -p <port>`.
- Cek ulang tiap sesi: `list_computer_folders`; bila folder muncul di `folders`, panggil `request_computer_folder` (pengguna harus menyetujui), lalu muat alat browser dengan ToolSearch `mcp__remote-devices__Claude_Browser__` (atau panggil `enable__mcp__remote-devices__Claude_Browser` bila itu satu-satunya yang ada).

---

## 7. Langkah berikutnya (urut prioritas)

### A. Terapkan SQL ke database Rica Rico
Dua cara:

1. **Pengguna menempel sendiri**: Supabase → project Rica Rico → SQL Editor → New query → tempel seluruh `supabase/data-karyawan-kantorku.sql` → Run. Hasil akhir menampilkan 3 tabel dan bucket `pi-employee-docs`.
2. **Lewat alat Supabase di sesi**: butuh **nomor project 20 karakter** (ada di alamat dashboard `supabase.com/dashboard/project/<nomor>`, atau di `NEXT_PUBLIC_SUPABASE_URL` project Vercel `people-intelligence-hub` = `https://<nomor>.supabase.co`). Alat yang ada hanya notebook (`create_notebook` → `run_notebook`); tidak ada `execute_sql` maupun daftar project. Notebook meminta konfirmasi form untuk perintah yang mengubah struktur — **belum pernah dicoba untuk DDL**. Jangan menebak nomor project (alat menolak yang bukan 20 karakter). Perintah mengubah database asli: minta izin eksplisit pengguna dulu.

Setelah diterapkan, verifikasi (baca saja): ketiga tabel ada, `rowsecurity = true`, bucket `pi-employee-docs` `public = false`, dan akun non-HR melihat 0 baris di `pi_employee_data_links` / `pi_employee_data_submissions`.
Database **Lencir** tidak perlu SQL ini kecuali fiturnya dipakai di sana (lihat butir F).

### B. Uji alur di situs Rica Rico dengan 1–2 orang
1. Login akun **HR** → menu **Core HR → Data Karyawan & KantorKu** (`/karyawan/kantorku`).
2. Tab *Kirim link*: buat link pribadi untuk 1–2 orang (boleh pengguna sendiri) → isi dari HP.
3. Tab *Isian masuk*: periksa perbandingan, pilih PTKP/outlet/kelompok kerja → **Terapkan**.
4. Tab *Ekspor KantorKu*: pilih **Taxability**, isi kolom KantorKu lewat tombol **Atur**, lengkapi gaji pokok (Pay → Employees) dan nama pemilik rekening. Unduh berkas.

### C. Uji impor ke KantorKu sungguhan (1–2 orang)
Yang belum diketahui: apakah KantorKu **memperbarui atau menggandakan** karyawan yang sudah ada saat diimpor ulang, dan kolom mana yang ditolak. Catat pesan galat KantorKu → perbaiki `map.ts` / `spec.ts` sesuai. Setelah impor, catat Employee ID dari KantorKu ke web (tombol Atur) supaya ekspor berikutnya tidak membuat ganda. Cakupan ekspor bawaan = "belum pernah diekspor".

### D. Lengkapi data yang dibutuhkan KantorKu
Banyak karyawan lama akan tampil "belum siap": gaji pokok (`pi_compensation`), PTKP (`BELUM_DIISI`), nama pemilik rekening, Employee ID, Taxability. Jalur tercepat: **link pribadi massal + Kirim WA** (tab Kirim link). Tab Ekspor menampilkan "masalah paling sering" per kolom.

### E. Gabungkan PR
1. PR #20 (skill) bisa digabung kapan saja — sekali masuk `main`, skill `/preview-panel-samping` aktif di semua sesi.
2. PR #19 setelah A–C lolos. Tandai *Ready for review*, lalu gabungkan. Pengguna yang menggabungkan; sesi tidak menyetujui atau menggabungkan sendiri.

### F. Keputusan yang belum dijawab pengguna
- **Sembunyikan menu ini di Lencir?** Menunya ikut muncul di pemasangan Lencir padahal belum ada template KantorKu bawaan. Usulan: tambahkan `"data-kantorku"` ke `hiddenNav` Lencir di `src/lib/instance.ts` (jangan hapus kode; CLAUDE.md §2b). Tes `instance.test.ts` harus tetap lulus.
- **Skill versi umum untuk proyek lain** (`~/.claude/skills/` di komputer pengguna) — saat ini skill berisi hal khusus repo ini.

### G. Perbaikan yang layak dikerjakan
- Tab "Isian masuk": pencocokan otomatis hanya lewat NIK; belum ada pencarian nama mirip.
- Notifikasi ke HR saat ada isian baru (sekarang hanya angka di judul tab).
- Pengingat WA untuk yang belum mengisi (pola ada di `src/lib/rr/pulse-remind.ts`).
- Impor balik Employee ID dari ekspor KantorKu (sekarang diketik manual).
- Template Lencir: unggah dari KantorKu-nya lalu `embed-kantorku-template.ts <file> lencir` dan perluas `template.ts`.

---

## 8. Cara menguji tanpa menyentuh data asli

Tidak ada database tiruan di repo (sengaja — CLAUDE.md §6). Pola yang dipakai sesi ini:

- Tiruan PostgREST kecil di Node (±40 baris, di luar repo) berisi tabel `pi_employee_data_links`, `pi_outlets`, `pi_employees`, `pi_employee_profiles`, `pi_employee_hris`, `pi_employee_data_submissions` dengan **data fiktif**, plus penampung unggahan `/storage/v1/object/…`.
- Jalankan aplikasi dengan `NEXT_PUBLIC_SUPABASE_URL=http://localhost:<port> NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x`.
- Playwright + Chromium sudah terpasang di container cloud (`require('playwright')`, `devices['iPhone 13']`). Jangan `playwright install`.
- Halaman HR butuh login Supabase asli → tidak bisa dicoba dengan tiruan; uji logikanya lewat tes unit (`map`, `intake`, `xlsx`) dan preview Vercel setelah SQL diterapkan.
- Tes route publik memakai tiruan di memori (`src/lib/kantorku/data-karyawan-route.test.ts`, pola sama dengan `src/lib/rr/survei-load.test.ts`).

---

## 9. Sumber & bahan yang dipakai

- **Template KantorKu**: "HRIS KantorKu — Template Import Karyawan" (xlsx, diunggah pengguna 17 Nov 2026). Isinya sudah tertanam di `template-rica-rico.ts`; untuk memulihkan berkasnya: dekode base64 `KANTORKU_TEMPLATE_B64`. Sheet: `Instructions`, `Import Employees Template` (baris 3 = judul, baris 4 = petunjuk, baris 5 = contoh "John Doe", data mulai **baris 6** sampai 1002 → maks **997 karyawan per berkas**), `Existing Data`, `REF`. Sheet Existing Data memuat nama SPV pada nama branch ("Jakarta 1 - Irfan", …) dan nama shift/lokasi absen — bukan data pribadi karyawan, tetapi tinjau sebelum repo dibuka ke pihak luar.
- **Google Form lama** "Employee Database Rica Rico Bakery" (29 kolom: nama, NIK, tempat/tgl lahir, jenis kelamin, agama, golongan darah, HP, alamat, kontak darurat, status kawin, ibu kandung, pendidikan, tanggal gabung, posisi, outlet, atasan, rekening, bank, unggah KTP/KK/pas foto) dan hasilnya di sheet "Employee Database Rica Rico Bakery (Responses)". Form baru "… - Kantorku" dibuat Shidqi 17 Nov 2026 (isinya tidak berhasil dibaca lewat alat Drive).
- **Alur lama HR** (rekaman handover "4# Handover Didi (Rica Rico)"): offering letter → karyawan mengisi database karyawan → hari pertama onboarding. Link formulir umum menggantikan link Google Form di langkah ini.
- Aturan PTKP: lihat butir 11 §5 (belum diverifikasi ke teks PMK).

---

## 10. Teks untuk ditempel di sesi baru

```
Lanjutkan fitur "Formulir data karyawan + ekspor KantorKu" di repo people-intelligence-hub.
Baca CLAUDE.md (§1b, §6, §9g) dan docs/handoff-kantorku-2026-11-17.md lebih dulu.
Kode ada di PR #19 (branch claude/gracious-brown-jtymhd); PR #20 berisi skill preview-panel-samping.
Mulai dengan: git fetch, cek tertinggal dari origin/main, npm ci, npx vitest run (harapan 659 lulus).
Status: kode selesai & teruji; BELUM ada: (1) SQL supabase/data-karyawan-kantorku.sql diterapkan ke
database Rica Rico, (2) uji impor ke KantorKu sungguhan, (3) PR digabung.
Jangan menjalankan perintah ke database asli tanpa izin eksplisit saya. Jangan menambah data demo.
Tugas pertama: [isi: mis. "terapkan SQL — nomor project Supabase: ____" atau "perbaiki hasil impor KantorKu: <galat>"].
```
