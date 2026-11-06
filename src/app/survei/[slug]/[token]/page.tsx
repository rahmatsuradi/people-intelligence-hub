/* ═══════════════════════════════════════════════════════════════════════════
   /survei/<nama-form>/<token> — link yang terkunci ke satu bulan. Bentuk ini dipakai link yang
   sudah dibagikan dan link terbuka selain yang terbaru; link baru memakai /survei/<nama-form>.
   <nama-form> di sini hanya hiasan dan judul pratinjau; formulir dicari dari <token> saja.
═══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { prettySlug } from "@/lib/rr/survey-link";
import { SurveiPage } from "@/components/survei/survei-page";
import { surveiMetadata } from "@/components/survei/survei-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return surveiMetadata(prettySlug((await params).slug));
}

export default async function SurveiRoute({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ u?: string | string[] }> }) {
  const { token } = await params;
  const { u } = await searchParams;
  return <SurveiPage token={token} invite={typeof u === "string" ? u : undefined} />;
}
