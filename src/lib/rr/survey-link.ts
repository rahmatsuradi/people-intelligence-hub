/* ═══════════════════════════════════════════════════════════════════════════
   Nama link survei yang terbaca: /survei/monthly-pulse-check-lencir

   Link pendek ini TANPA token acak (permintaan HR, 6 Nov 2026): server mencari survei dari
   namanya lalu membuka bulan terbaru yang masih terbuka, jadi siapa pun yang tahu/menebak
   alamatnya bisa mengisi selama link bulan itu terbuka. Tiap link pribadi tetap memakai ?u=<token>.
   Survei dengan config.privateLink (360 SPV) tidak melayani link pendek sama sekali.

   Bentuk lama tetap berfungsi untuk link yang sudah dibagikan: /survei/<token> dan
   /survei/<nama>/<token> (di bentuk ini nama hanya hiasan, survei dicari dari token).
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

/** "monthly-pulse-check-lencir" — nama form + perusahaan. Bulan tidak ikut: link ini selalu membuka bulan yang sedang terbuka. */
export function surveyLinkSlug(survey: Pick<Survey, "key" | "title" | "config">, brand: string): string {
  return slugify(`${surveyLinkName(survey)} ${brand}`) || "survei";
}

/** Tanpa token = link pendek. Dengan token = terkunci ke satu bulan (untuk link terbuka selain yang terbaru). */
export function surveyLinkPath(survey: Pick<Survey, "key" | "title" | "config">, brand: string, token?: string): string {
  return `/survei/${surveyLinkSlug(survey, brand)}${token ? `/${token}` : ""}`;
}

/** Nama form di URL. Token tidak pernah memuat tanda hubung, jadi keduanya tidak tertukar. */
export function isSurveySlug(ref: string): boolean {
  return ref.length <= 90 && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(ref);
}

/** Slug dari URL → judul tab/pratinjau WhatsApp. null bila bukan slug yang wajar (dipakai apa adanya = berbahaya). */
export function prettySlug(slug: string): string | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+){0,19}$/.test(slug) || slug.length > 90) return null;
  return slug.split("-").map((w) => (/^\d+$/.test(w) ? w : w.length <= 3 && /^(spv|spg|hr)$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
}
