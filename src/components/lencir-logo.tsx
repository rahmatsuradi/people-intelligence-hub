/* ═══════════════════════════════════════════════════════════════════════════
   Wordmark LENCIR.

   Dibuat sebagai SVG teks, bukan gambar raster, karena tiga alasan:
   - tajam di semua ukuran dan kerapatan layar (sidebar 20px s/d layar login);
   - mewarisi `currentColor`, jadi otomatis jadi terang di mode gelap tanpa
     perlu menyiapkan dua berkas logo yang bisa saling tertinggal versinya;
   - tidak menambah permintaan jaringan.

   Wordmark aslinya memakai serif kontras tinggi (jenis Didone) dengan jarak
   antar huruf sangat lebar dan ™ kecil di kanan atas. Ditiru di sini dengan
   Cormorant Garamond (lihat --font-serif di layout.tsx) plus fallback serif
   berkelas sama, sehingga tetap terbaca wajar bila webfont gagal dimuat.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LencirWordmark({
  className,
  title = "LENCIR",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 142 32"
      role="img"
      aria-label={title}
      className={className}
      fill="currentColor"
    >
      <text
        x="0"
        y="25"
        fontFamily="var(--font-serif), 'Didot', 'Bodoni MT', Georgia, serif"
        fontSize="26"
        fontWeight="500"
        letterSpacing="7.6"
      >
        LENCIR
      </text>
      {/* ™ diposisikan manual. Kalau ditulis sebagai bagian dari teks yang sama,
          ia ikut terkena letter-spacing 7.6 milik huruf terakhir dan terlempar
          menjauh dari wordmark. Nilai x di bawah = lebar glif "LENCIR" terukur
          (136.8 termasuk spasi ekor, jadi ~129) ditambah sedikit jarak. */}
      <text
        x="132"
        y="10"
        fontFamily="var(--font-serif), 'Didot', 'Bodoni MT', Georgia, serif"
        fontSize="7.5"
        fontWeight="500"
      >
        ™
      </text>
    </svg>
  );
}

/** Lencana persegi untuk ruang sempit (favicon-like, avatar sidebar saat
 *  menu diciutkan). Memakai inisial, bukan wordmark penuh, karena wordmark
 *  yang dimampatkan ke kotak kecil jadi tidak terbaca. */
export function LencirMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label="LENCIR" className={className}>
      <rect width="40" height="40" rx="10" fill="currentColor" />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-serif), 'Didot', 'Bodoni MT', Georgia, serif"
        fontSize="19"
        fontWeight="500"
        letterSpacing="0.5"
        className="fill-white dark:fill-slate-950"
      >
        L
      </text>
    </svg>
  );
}
