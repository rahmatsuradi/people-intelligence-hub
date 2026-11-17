---
name: preview-panel-samping
description: Dipakai setiap kali menjalankan atau menampilkan aplikasi web (server dev, hasil build, HTML statis) supaya pengguna melihatnya di panel preview samping aplikasi Claude, bukan di browser luar. Gunakan saat pengguna bilang "tampilkan", "buka webnya", "preview", atau saat selesai mengubah tampilan.
---

# Preview di panel samping

Panel preview hanya menampilkan server yang (1) bisa dipakai lewat alamat selain `localhost`
dan (2) port-nya sudah dilaporkan ke aplikasi. Urutan di bawah menjaga keduanya.

## Langkah

1. **Sesi lokal (aplikasi Desktop):** kalau ada alat berakhiran `preview_start`, pakai itu lalu selesai.
2. **Sesi cloud (tidak ada alat di atas):** jalankan server **produksi**, jangan `next dev`.
   `next dev` menolak (403) berkas `/_next/*` dari alamat selain localhost, jadi panel tampil kosong.
   ```bash
   npm run build
   npx next start -H 0.0.0.0 -p 3123
   ```
   Jalankan `next start` di latar belakang. Variabel `NEXT_PUBLIC_*` ikut tertanam saat build — isi sebelum `build`.
3. **Periksa sendiri sebelum bilang siap** — halaman 200 DAN berkas pendukung 200 dari alamat asing:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3123/<path>
   CH=$(curl -s http://localhost:3123/<path> | grep -o '/_next/static/[^"]*\.js' | head -1)
   curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: https://x.test" -H "Host: x.test" "http://localhost:3123$CH"
   ```
4. Panggil `report_preview_port` dengan port yang sebenarnya dan nama pendek. Sekali per server;
   ulangi hanya kalau port berubah atau server dinyalakan ulang di port lain.
5. Beri tahu pengguna **alamat lengkap yang harus dibuka** (mis. `/data-karyawan/<token>`) — panel
   tidak tahu halaman mana yang dimaksud. Jangan bilang "sudah terbuka": aplikasi yang memutuskan
   membuka panel, saya tidak bisa melihatnya. Tanyakan apa yang tampil kalau pengguna melapor kosong.

## Larangan

- Jangan membuka browser luar (`xdg-open`, `open`, Chrome). Chromium Playwright hanya untuk
  tangkapan layar pemeriksaan sendiri; kirim ke pengguna dengan `SendUserFile` bila perlu.
- Jangan mengarahkan `NEXT_PUBLIC_SUPABASE_URL` ke database sungguhan hanya untuk preview. Pakai
  alamat mati atau tiruan lokal berisi data fiktif (CLAUDE.md §1b: tidak ada data demo di database asli).
- Halaman yang butuh login Supabase tidak bisa dipratinjau dengan tiruan; katakan terus terang,
  dan arahkan ke preview Vercel dari PR.
- Kembalikan `tsconfig.json` bila `next` mengubahnya, dan jangan commit folder `.next`.
