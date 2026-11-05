/* ═══════════════════════════════════════════════════════════════════════════
   Formulir survei PUBLIK (pengganti Google Form). Tanpa AppShell, tanpa login —
   karyawan membuka link dari WhatsApp di HP. Data diambil & dikirim lewat /api/survei.
   noindex: link survei tidak boleh terindeks mesin pencari.

   Bentuk LAMA /survei/<token>, tetap berfungsi untuk link yang sudah dibagikan. Link baru
   memakai /survei/<nama-form>/<token> (lihat [slug]/[token]/page.tsx).
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { INSTANCE } from "@/lib/instance";
import { SurveiPage } from "@/components/survei/survei-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Survei Karyawan — ${INSTANCE.brandName}`,
  description: `Formulir survei karyawan ${INSTANCE.brandName}.`,
  robots: { index: false, follow: false },
};

export default async function SurveiRoute({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ u?: string | string[] }> }) {
  const { token } = await params;
  // ?u=… = link pribadi dari pengingat WA: nama terisi otomatis dan jawaban tercatat untuk orang itu.
  const { u } = await searchParams;
  return <SurveiPage token={token} invite={typeof u === "string" ? u : undefined} />;
}
