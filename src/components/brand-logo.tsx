import { INSTANCE } from "@/lib/instance";
import { LencirMark, LencirWordmark } from "@/components/lencir-logo";
import { RicaRicoMark, RicaRicoWordmark } from "@/components/rica-rico-logo";

/* ═══════════════════════════════════════════════════════════════════════════
   Logo menurut instance (lihat src/lib/instance.ts).

   Tiga tempat memakai logo: sidebar, halaman login, dan survei publik. Masing-masing
   memanggil komponen di sini, bukan logo satu merek langsung — supaya menambah merek
   ketiga cukup menambah satu cabang di tiap fungsi, tanpa menyisir halaman.

   Bentuk sengaja berbeda per merek karena asetnya berbeda: Rica Rico punya lambang
   bergambar (dua anak di dalam cincin merah) plus wordmark sambung; Lencir hanya
   punya wordmark serif, jadi tampil sebagai teks tanpa lambang.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Lambang kecil berdiri sendiri (survei publik, ruang sempit). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  if (INSTANCE.key === "lencir") {
    return <LencirMark size={size} className={`shrink-0 text-slate-900 dark:text-slate-50 ${className ?? ""}`} />;
  }
  return <RicaRicoMark size={size} className={className} />;
}

/** Isi tautan beranda di kepala sidebar. */
export function BrandSidebarLogo() {
  if (INSTANCE.key === "lencir") {
    return (
      <span className="min-w-0 flex-1">
        <LencirWordmark className="h-4 w-auto text-slate-900 dark:text-slate-50" />
        <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          People Intelligence
        </span>
      </span>
    );
  }
  return (
    <>
      <RicaRicoMark size={38} />
      <span className="min-w-0">
        <RicaRicoWordmark className="block text-[22px]" />
        <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          People Intelligence
        </span>
      </span>
    </>
  );
}

/** Kepala halaman login. */
export function BrandLoginLogo() {
  if (INSTANCE.key === "lencir") {
    // Wordmark tampil apa adanya di atas kanvas putih hangat, mengikuti cara merek ini
    // menampilkan dirinya sendiri.
    return (
      <div className="mb-10 flex flex-col items-center text-center">
        <LencirWordmark className="h-6 w-auto text-slate-900 dark:text-slate-50" />
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          People Intelligence
        </p>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Masuk ke ruang kerja Anda</p>
      </div>
    );
  }
  // Logo asli sebagai pusat, wordmark sambung di bawahnya. 88px adalah batas atas yang
  // masih tajam dari berkas logo 192px di layar retina.
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <RicaRicoMark size={88} className="ring-4 shadow-md shadow-blue-900/10" />
      <RicaRicoWordmark className="mt-4 text-4xl" />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        Bakery &middot; People Intelligence
      </p>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Masuk ke ruang kerja Anda</p>
    </div>
  );
}
