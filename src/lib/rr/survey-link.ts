/* ═══════════════════════════════════════════════════════════════════════════
   Nama link survei yang terbaca: /survei/monthly-pulse-check-lencir-oktober-2026/<token>

   Bagian nama (slug) HANYA hiasan supaya link yang dibagikan di WhatsApp jelas isinya —
   yang melindungi link tetap token acak di belakangnya. Server tidak pernah memakai slug
   untuk mencari survei, jadi slug yang salah/lama tetap membuka formulir yang benar, dan link
   lama tanpa slug (/survei/<token>) tetap berfungsi.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { Survey } from "./pulse";

/** Nama form menurut kunci survei; selain itu memakai `config.linkName`, lalu judul survei. */
const NAME_BY_KEY: Record<string, string> = {
  pulse_bulanan: "Monthly Pulse Check",
  feedback_spg_bulanan: "Feedback SPG to SPV",
  feedback_360: "Feedback 360 SPV",
};

export function slugify(s: string): string {
  return s
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80).replace(/-+$/g, "");
}

/** Nama form untuk link, mis. "Monthly Pulse Check". */
export function surveyLinkName(survey: Pick<Survey, "key" | "title" | "config">): string {
  const custom = (survey.config as { linkName?: string }).linkName?.trim();
  return custom || NAME_BY_KEY[survey.key] || survey.title;
}

/** "monthly-pulse-check-lencir-oktober-2026" — nama form + perusahaan + bulan yang dinilai. */
export function surveyLinkSlug(survey: Pick<Survey, "key" | "title" | "config">, brand: string, periodLabel: string): string {
  return slugify(`${surveyLinkName(survey)} ${brand} ${periodLabel}`) || "survei";
}

export function surveyLinkPath(survey: Pick<Survey, "key" | "title" | "config">, brand: string, periodLabel: string, token: string): string {
  return `/survei/${surveyLinkSlug(survey, brand, periodLabel)}/${token}`;
}

/** Slug dari URL → judul tab/pratinjau WhatsApp. null bila bukan slug yang wajar (dipakai apa adanya = berbahaya). */
export function prettySlug(slug: string): string | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+){0,19}$/.test(slug) || slug.length > 90) return null;
  return slug.split("-").map((w) => (/^\d+$/.test(w) ? w : w.length <= 3 && /^(spv|spg|hr)$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
}
