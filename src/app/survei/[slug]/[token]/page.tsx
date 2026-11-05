/* ═══════════════════════════════════════════════════════════════════════════
   /survei/<nama-form>/<token> — link survei dengan nama yang terbaca, mis.
   /survei/monthly-pulse-check-lencir-oktober-2026/<token>. <nama-form> hanya hiasan dan judul
   pratinjau WhatsApp; formulir dicari dari <token> saja (lihat src/lib/rr/survey-link.ts).
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { INSTANCE } from "@/lib/instance";
import { prettySlug } from "@/lib/rr/survey-link";
import { SurveiPage } from "@/components/survei/survei-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const name = prettySlug((await params).slug);
  return {
    title: `${name ?? "Survei Karyawan"} — ${INSTANCE.brandName}`,
    description: `Formulir survei karyawan ${INSTANCE.brandName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function SurveiRoute({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ u?: string | string[] }> }) {
  const { token } = await params;
  const { u } = await searchParams;
  return <SurveiPage token={token} invite={typeof u === "string" ? u : undefined} />;
}
