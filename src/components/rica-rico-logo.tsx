import Image from "next/image";

const cn = (...c: (string | undefined)[]) => c.filter(Boolean).join(" ");

/* ═══════════════════════════════════════════════════════════════════════════
   Identitas visual Rica Rico Bakery.

   Lambang = berkas logo asli (lingkaran merah, dua anak, tulisan "Rica-Rico"
   kuning ber-outline merah, "bika ambon" di bawahnya). Dipakai apa adanya,
   bukan digambar ulang, karena wajah dua anak itu inti merknya — tiruan
   vektor akan terlihat "hampir benar" dan justru terasa palsu.

   Berkasnya JPG 192px dengan sudut putih; `rounded-full` memotongnya jadi
   lingkaran sehingga tetap rapi di atas latar gelap. Di atas ~96px gambar
   mulai lembut — kalau butuh lebih besar, minta berkas vektor/PNG resmi.

   Wordmark teks memakai Lobster (--font-script, lihat layout.tsx): huruf
   sambung tebal bergaya retro yang paling dekat dengan tulisan di logo.
   ═══════════════════════════════════════════════════════════════════════════ */

export function RicaRicoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/rica-rico-logo.jpg"
      alt="Rica Rico Bika Ambon"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 rounded-full ring-2 ring-white shadow-sm dark:ring-slate-800", className)}
    />
  );
}

export function RicaRicoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-script leading-none tracking-[0.01em] text-blue-600 dark:text-amber-300",
        className,
      )}
    >
      Rica Rico
    </span>
  );
}
