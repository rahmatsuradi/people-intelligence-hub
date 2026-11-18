/* Formulir data karyawan PUBLIK (pengganti Google Form "Employee Database"). Tanpa AppShell,
   tanpa login — karyawan membuka link dari WhatsApp. Data lewat /api/data-karyawan.
   noindex: link ini tidak boleh terindeks mesin pencari. */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandMark } from "@/components/brand-logo";
import { INSTANCE } from "@/lib/instance";
import { IntakeForm } from "@/components/data-karyawan/intake-form";

export const dynamic = "force-dynamic";

/* WhatsApp membaca judul + gambar dari sini. Alamat gambar harus lengkap, jadi alamat situs diambil
   dari permintaan (pola sama dengan link survei). Gambar = logo resmi lewat /brand-og. */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const title = `Data Karyawan — ${INSTANCE.brandName}`;
  const description = `Formulir data karyawan ${INSTANCE.brandName}. Isi sekitar 10 menit dari HP.`;
  const image = { url: "/brand-og", width: 1200, height: 630, alt: INSTANCE.brandName };
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title, description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: INSTANCE.brandName, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function DataKaryawanRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandMark size={40} />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">{INSTANCE.brandName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Data karyawan</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <IntakeForm token={token} />
      </div>
    </main>
  );
}
