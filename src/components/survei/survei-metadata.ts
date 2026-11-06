/* Judul dan gambar pratinjau link survei (yang dibaca WhatsApp). WhatsApp butuh alamat gambar
   lengkap, jadi alamat situs diambil dari permintaan — satu kode dipakai dua pemasangan. */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { INSTANCE } from "@/lib/instance";

export async function surveiMetadata(formName: string | null): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const title = `${formName ?? "Survei Karyawan"} — ${INSTANCE.brandName}`;
  const description = `Formulir survei karyawan ${INSTANCE.brandName}.`;
  const image = { url: "/brand-og", width: 1200, height: 630, alt: INSTANCE.brandName };
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title, description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: INSTANCE.brandName, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
