/* ═══════════════════════════════════════════════════════════════════════════
   Formulir survei PUBLIK (pengganti Google Form). Tanpa AppShell, tanpa login —
   karyawan membuka link dari WhatsApp di HP. Data diambil & dikirim lewat /api/survei.
   noindex: link survei tidak boleh terindeks mesin pencari.

   /survei/<x>: <x> adalah nama form (link pendek, mis. monthly-pulse-check-lencir) atau token
   link lama. /api/survei yang membedakan keduanya (lihat src/lib/rr/survey-link.ts).

   Folder ini bernama [slug] (bukan [token]) karena Next.js mewajibkan nama bagian dinamis yang
   sama di tingkat yang sama untuk /survei/<x> dan /survei/<x>/<token>.
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { isSurveySlug, prettySlug } from "@/lib/rr/survey-link";
import { SurveiPage } from "@/components/survei/survei-page";
import { surveiMetadata } from "@/components/survei/survei-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return surveiMetadata(isSurveySlug(slug) ? prettySlug(slug) : null);
}

export default async function SurveiRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ u?: string | string[] }> }) {
  const { slug: token } = await params; // nama form atau token link lama
  // ?u=… = link pribadi dari pengingat WA: nama terisi otomatis dan jawaban tercatat untuk orang itu.
  const { u } = await searchParams;
  return <SurveiPage token={token} invite={typeof u === "string" ? u : undefined} />;
}
