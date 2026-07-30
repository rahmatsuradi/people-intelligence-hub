/* ═══════════════════════════════════════════════════════════════════════════
   Employer Branding AI — Content idea generation with trend awareness
   Model: Groq Llama 3.3 70B (same as CV Analyzer)

   SERVER ONLY — calls the Groq API with the API key.
   Never import this from a client component.
═══════════════════════════════════════════════════════════════════════════ */

import { GROQ_MODEL, parseDurationSeconds } from "./cv-groq";

/* ─── Types ─── */

export type ContentPillar =
  | "culture"
  | "career-growth"
  | "benefits"
  | "behind-the-scenes"
  | "employee-stories"
  | "achievements"
  | "csr"
  | "leadership";

export type Platform =
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "career-page"
  | "twitter"
  | "youtube";

export type ContentFormat =
  | "video"
  | "carousel"
  | "article"
  | "story"
  | "reel"
  | "infographic"
  | "photo-post"
  | "live-session"
  | "podcast-clip";

export interface BrandingInput {
  companyName: string;
  industry: string;
  employeeCount: string;
  companyValues: string;
  openRoles: string;
  targetAudience: string;
  pillars: ContentPillar[];
  platforms: Platform[];
  additionalContext: string;
  manualTrends: string;
  campaignGoal: string;
  /** Optional — link to a viral post/video the user wants to use as inspiration. */
  referenceContentUrl?: string;
  /** Optional — user's own observation of why the reference content works (hook, format, etc). */
  referenceContentNotes?: string;
  /** Optional — client-extracted metadata (filename + duration) of an uploaded reference video. */
  referenceVideoMeta?: string;
  /** Optional — titles from recent generations (this session's history), so the AI avoids repeating itself. */
  avoidTitles?: string[];
}

export interface ContentBeat {
  /** Timestamp range for video-like formats ("0:00-0:03"), or slide/section label for static formats ("Slide 1"). */
  label: string;
  /** Short beat name, e.g. "Hook", "Build-up", "Klimaks/Insight", "CTA". */
  beat: string;
  /** Concrete visual + dialog/caption/on-screen text for this beat — specific, not generic. */
  description: string;
}

export interface ContentIdea {
  id: number;
  title: string;
  platform: Platform;
  contentType: ContentFormat;
  pillar: ContentPillar;
  description: string;
  talkingPoints: string[];
  hashtags: string[];
  calendarSuggestion: string;
  estimatedEngagement: "high" | "medium" | "low";
  trendReference: string;
  visualDirection: string;
  copyGuideline: string;
  productionNotes: string;
  /** Which viral/engagement principles (from VIRALITY_PRINCIPLES) this idea applies. */
  viralPrinciples: string[];
  /** Qualitative note on why similar content patterns tend to perform well — no fabricated stats. */
  performancePattern: string;
  /** 2-3 alternate execution angles for the same core idea, so the user isn't stuck with one take. */
  variations: string[];
  /** Named format this idea is modeled after (from VIRAL_FORMAT_LIBRARY or a modification of it) + platform. */
  formatUsed: string;
  /** Beat-by-beat breakdown — timestamps for video/reel/story, slides for carousel/static formats. */
  contentBreakdown: ContentBeat[];
  /** Real article URL from the trend research list, if this idea draws on one. Never a fabricated link. */
  sourceUrl: string;
}

export interface EditorialPost {
  day: string;
  time: string;
  platform: Platform;
  ideaRef: number;
  caption: string;
}

export interface EditorialWeek {
  week: number;
  theme: string;
  posts: EditorialPost[];
}

export interface BrandingIdeasResult {
  /** AI's own stated understanding of the company (industry, situation, recent activity) — lets the user
   *  immediately catch it if the AI misread the context, instead of finding out from generic ideas later. */
  companyContext: string;
  trendAnalysis: string;
  strategyNote: string;
  ideas: ContentIdea[];
  editorialPlan: EditorialWeek[];
  generalTips: string[];
}

export interface TrendItem {
  title: string;
  snippet: string;
  source: string;
  /** Real article URL from Google News RSS — only ever a genuine link, never fabricated. */
  url: string;
}

/* ─── Pillar & Platform Labels (Indonesian) ─── */

export const PILLAR_LABELS: Record<ContentPillar, string> = {
  culture: "Budaya Perusahaan",
  "career-growth": "Pengembangan Karir",
  benefits: "Benefit & Kompensasi",
  "behind-the-scenes": "Behind the Scenes",
  "employee-stories": "Cerita Karyawan",
  achievements: "Pencapaian",
  csr: "CSR & Dampak Sosial",
  leadership: "Kepemimpinan",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  "career-page": "Career Page",
  twitter: "Twitter/X",
  youtube: "YouTube",
};

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  video: "Video",
  carousel: "Carousel",
  article: "Artikel",
  story: "Story",
  reel: "Reel",
  infographic: "Infografis",
  "photo-post": "Photo Post",
  "live-session": "Live Session",
  "podcast-clip": "Podcast Clip",
};

export const CAMPAIGN_GOALS = [
  { value: "awareness", label: "Brand Awareness" },
  { value: "engagement", label: "Engagement" },
  { value: "talent-acquisition", label: "Talent Acquisition" },
  { value: "all", label: "Semua" },
] as const;

export const INDUSTRIES = [
  "Garmen & Tekstil",
  "Teknologi",
  "Manufaktur",
  "Perbankan & Keuangan",
  "Retail",
  "FMCG",
  "Kesehatan",
  "Pendidikan",
  "Logistik",
  "Lainnya",
] as const;

export const EMPLOYEE_COUNTS = ["1-50", "51-200", "201-500", "501-1000", "1000+"] as const;

/* ─── Virality & Engagement Playbook (research-backed, cited) ───
   Grounds AI output in real mechanics instead of guessing. Also shown
   directly to the user in the UI as an educational reference card. */

export interface ViralityPrinciple {
  title: string;
  description: string;
}

export const VIRALITY_PRINCIPLES: ViralityPrinciple[] = [
  {
    title: "Hook 2-3 detik pertama",
    description:
      "Algoritma TikTok/Reels/Shorts menilai retensi sejak detik pertama. Buka dengan masalah, pertanyaan, atau visual yang mengejutkan — bukan logo perusahaan atau intro panjang.",
  },
  {
    title: "Sinyal engagement awal menentukan jangkauan",
    description:
      "Menurut analisis konten Meta awal 2026, sekitar 72% konten dengan engagement rate di atas 4% pada 30 menit pertama akhirnya viral dalam 24 jam, sementara hanya ~4% yang di bawah 2% berhasil viral. Dorong komentar & share sejak awal lewat pertanyaan atau CTA yang jelas.",
  },
  {
    title: "Watch time & completion rate > jumlah follower",
    description:
      "Distribusi kini didorong algoritma ke orang yang belum follow akun Anda. Video pendek yang selesai ditonton (bukan di-skip) lebih menentukan jangkauan daripada jumlah follower perusahaan.",
  },
  {
    title: "Autentik mengalahkan polished",
    description:
      "Konten mentah/unscripted (cerita karyawan asli, behind-the-scenes) secara konsisten mengungguli video korporat yang terlalu diedit — kandidat bisa membedakan konten yang dibuat-buat dari yang jujur.",
  },
  {
    title: "Native ke platform, bukan re-upload",
    description:
      "Video ber-watermark TikTok yang di-upload ulang ke Reels/Shorts biasanya ditekan jangkauannya oleh algoritma. Edit ulang tanpa watermark dan sesuaikan rasio/gaya caption per platform.",
  },
  {
    title: "Saves & shares = sinyal terkuat",
    description:
      "Save berarti kandidat menyimpan perusahaan Anda untuk dipertimbangkan nanti — sinyal minat karir yang kuat. Share memperluas jangkauan ke luar audiens yang sudah follow.",
  },
  {
    title: "Tutup dengan CTA atau pertanyaan",
    description:
      "Ajak komentar/diskusi di akhir video atau caption (mis. 'Menurutmu gimana?', 'Ada yang pernah ngalamin ini?') untuk memicu komentar yang mendorong algoritma menyebarkan konten lebih luas.",
  },
];

/* ─── Viral Format Library ───
   Named, evergreen social content formats with generic beat skeletons.
   Grounds each idea in a real, recognizable structure instead of a vague
   "make something creative" instruction — and a random subset is offered
   per generation so ideas don't converge on the same 2-3 patterns every time. */

export interface ViralFormat {
  name: string;
  platform: string;
  structure: string;
}

export const VIRAL_FORMAT_LIBRARY: ViralFormat[] = [
  { name: "POV (Point of View)", platform: "TikTok/Reels", structure: "0-3d: teks 'POV: kamu...' + visual sudut pandang orang pertama (hook rasa penasaran) → 3-20d: adegan berjalan dari sudut pandang itu → 20-25d: twist/insight → 25-30d: CTA/teks penutup." },
  { name: "Get Ready With Me (GRWM)", platform: "TikTok/Reels/YouTube Shorts", structure: "0-3d: hook ('GRWM buat...') sambil mulai rutinitas → 3-40d: proses berjalan sambil ngobrol santai/cerita relevan → 40-55d: insight/reveal utama → 55-60d: CTA." },
  { name: "Day in the Life", platform: "TikTok/Reels/YouTube Shorts", structure: "0-3d: hook waktu/jam mulai ('6 pagi di...') → 3-45d: montase aktivitas kronologis dengan teks jam berjalan → 45-55d: momen paling menarik/highlight → 55-60d: CTA." },
  { name: "Before vs After / Transformasi", platform: "Instagram Reels/TikTok", structure: "0-2d: tampilkan 'before' singkat → 2-4d: transisi cepat (jump cut/whip pan) → 4-20d: proses/alasan perubahan → 20-25d: reveal 'after' → 25-30d: CTA." },
  { name: "Text Overlay Storytime", platform: "TikTok/Reels", structure: "0-3d: hook tulisan besar di layar ('Cerita waktu aku...') → 3-40d: cerita berlanjut lewat teks + visual pendukung, pacing cepat → 40-50d: klimaks/pelajaran → 50-55d: CTA." },
  { name: "Green Screen React/Explain", platform: "TikTok", structure: "0-3d: reaksi/ekspresi ke sumber di background (hook visual) → 3-30d: jelaskan/react ke poin-poin sumber tsb → 30-40d: kesimpulan → 40-45d: CTA." },
  { name: "Rank/Tier List", platform: "TikTok/Reels/YouTube Shorts", structure: "0-3d: hook ('5 hal ter... di perusahaan ini') → 3-45d: tiap item cepat dengan teks angka & alasan singkat → 45-55d: rangkuman/pilihan favorit → 55-60d: CTA." },
  { name: "Q&A Rapid Fire", platform: "Instagram Reels/TikTok", structure: "0-3d: hook ('Jawab pertanyaan tercepat!') → 3-40d: rentetan pertanyaan-jawaban cepat, potongan jumpcut → 40-50d: pertanyaan paling seru → 50-55d: CTA." },
  { name: "Ekspektasi vs Realita", platform: "TikTok/Reels", structure: "0-2d: 'Ekspektasi' (visual ideal/lucu) → 2-4d: transisi → 4-20d: 'Realita' (jujur, relatable) → 20-25d: insight/pesan → 25-30d: CTA." },
  { name: "Vox Pop Kantor (interview jalanan versi kantor)", platform: "TikTok/Reels/LinkedIn", structure: "0-3d: hook pertanyaan ke kamera ('Kalau ditanya kenapa betah kerja di sini...') → 3-40d: potongan jawaban beberapa karyawan bergantian → 40-50d: benang merah jawaban → 50-55d: CTA." },
  { name: "Myth vs Fact", platform: "LinkedIn/Instagram/TikTok", structure: "0-3d: hook mitos yang provokatif → 3-15d: bantah dengan fakta+bukti → 15-25d: mitos kedua → 25-40d: fakta → 40-45d: CTA." },
  { name: "Silent Vlog Sinematik", platform: "Instagram Reels/YouTube Shorts", structure: "0-5d: visual sinematik tanpa narasi, hanya musik + teks kecil → 5-40d: montase visual dengan caption minimal → 40-50d: teks pesan utama → 50-55d: CTA halus (link di bio)." },
  { name: "Countdown/Listicle", platform: "TikTok/Reels/LinkedIn Carousel", structure: "0-3d: hook angka ('3 alasan...') → 3-45d: tiap poin dengan visual+teks angka besar → 45-55d: poin terkuat di akhir (climax terbalik) → 55-60d: CTA." },
  { name: "Balas Komentar/DM (Stitch/Reply)", platform: "TikTok/Instagram", structure: "0-3d: tampilkan komentar/pertanyaan asli sbg hook → 3-35d: jawab dengan cerita/data → 35-45d: kesimpulan → 45-50d: CTA (ajak komentar pertanyaan baru)." },
  { name: "Transisi Mengikuti Audio Tren", platform: "TikTok/Reels", structure: "0-3d: buka dengan gerakan/transisi khas audio yang sedang tren → 3-20d: isi pesan employer branding menyesuaikan beat musik → 20-25d: transisi kedua (klimaks beat) → 25-30d: CTA/teks penutup." },
  { name: "Roleplay Singkat", platform: "TikTok/Reels", structure: "0-3d: hook adegan roleplay lucu/relatable (mis. 'HR vs kandidat') → 3-30d: dialog roleplay berkembang → 30-40d: punchline/insight jujur → 40-45d: CTA." },
];

function pickRandomFormats(n: number): ViralFormat[] {
  const pool = [...VIRAL_FORMAT_LIBRARY];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export const VIRALITY_SOURCES = [
  { label: "HeyOrca — Best social media hooks for 2026", url: "https://www.heyorca.com/blog/the-best-social-media-hooks-for-2026" },
  { label: "Black Digital Group — What makes a post go viral in 2026", url: "https://blackdigitalgroup.com/what-makes-a-social-media-post-go-viral/" },
  { label: "HR Brew — Employers lean on Instagram & TikTok for Gen-Z recruiting", url: "https://www.hr-brew.com/stories/2025/09/23/hr-recruitment-marketing-tiktok" },
] as const;

export const TARGET_AUDIENCES = [
  { value: "fresh-graduate", label: "Fresh graduate" },
  { value: "mid-career", label: "Mid-career (3-7 tahun)" },
  { value: "senior", label: "Senior (7+ tahun)" },
  { value: "all", label: "Semua level" },
] as const;

/* ─── Trend Fetching (Google News RSS) ─── */

async function fetchGoogleNewsQuery(
  query: string,
  signal: AbortSignal,
  limit: number,
): Promise<TrendItem[]> {
  const items: TrendItem[] = [];
  try {
    const url = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;
    const res = await fetch(url, { signal });
    if (!res.ok) return items;
    const xml = await res.text();

    const titleMatches = xml.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<source[^>]*>(.*?)<\/source>[\s\S]*?<\/item>/g);
    if (!titleMatches) return items;

    for (const match of titleMatches.slice(0, limit)) {
      const t = match.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const l = match.match(/<link>(.*?)<\/link>/);
      const s = match.match(/<source[^>]*>(.*?)<\/source>/);
      if (t?.[1]) {
        items.push({
          title: t[1],
          snippet: t[1],
          source: s?.[1] ?? "Google News",
          url: l?.[1]?.trim() ?? "",
        });
      }
    }
  } catch {
    // Network/abort failure — caller treats an empty list as "nothing found".
  }
  return items;
}

export async function fetchTrendData(
  industry: string,
  platforms: Platform[],
  manualTrendQuery?: string,
): Promise<TrendItem[]> {
  // If the user named something specific (a person, meme, trend), search for
  // it directly first — this is what makes "Erling Haaland lagi viral" (etc.)
  // resolve to real, current articles instead of being a vague footnote the
  // AI can safely ignore. Falls back to generic viral/industry queries.
  const manualQuery = manualTrendQuery?.trim()
    ? encodeURIComponent(manualTrendQuery.trim().slice(0, 80)).replace(/%20/g, "+")
    : null;

  const queries = [
    ...(manualQuery ? [manualQuery] : []),
    `konten+viral+medsos+Indonesia+minggu+ini`,
    `tren+TikTok+Reels+Indonesia+viral+engagement+tinggi`,
    `employer+branding+${encodeURIComponent(industry)}+Indonesia`,
    ...platforms.slice(0, 2).map(
      (p) => `employer+branding+${encodeURIComponent(PLATFORM_LABELS[p])}`,
    ),
  ];

  const items: TrendItem[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    for (const q of queries.slice(0, 3)) {
      items.push(...(await fetchGoogleNewsQuery(q, controller.signal, 5)));
    }
  } finally {
    clearTimeout(timeout);
  }

  console.log(`[eb-ai] Fetched ${items.length} trend items`);
  return items.slice(0, 12);
}

/** Real, current news about the company itself — grounds the AI in who this
 *  company actually is (recent activity, reputation, industry moves) as soon
 *  as a name is entered, instead of only reasoning from a bare name string.
 *  Demo/fictional company names will simply return nothing, which is fine —
 *  the prompt falls back to the user-provided profile fields in that case. */
export async function fetchCompanyContext(
  companyName: string,
): Promise<TrendItem[]> {
  const name = companyName.trim();
  if (!name) return [];

  const query = encodeURIComponent(name.slice(0, 80)).replace(/%20/g, "+");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const items = await fetchGoogleNewsQuery(query, controller.signal, 6);
    console.log(`[eb-ai] Fetched ${items.length} company-context items for "${name}"`);
    return items;
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── Groq API call (branding-specific, creative temperature) ─── */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GroqBrandingCall {
  content: string;
  remainingTokens: number | null;
  resetSeconds: number | null;
  /** "length" means Groq cut the response off at max_tokens — the JSON is likely truncated/invalid. */
  finishReason: string | null;
}

export async function callGroqBranding(
  prompt: string,
  maxAttempts = 3,
): Promise<GroqBrandingCall> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_xxx")) {
    throw new Error(
      "GROQ_API_KEY belum dikonfigurasi di .env.local. Dapatkan key gratis di console.groq.com",
    );
  }

  console.log(`[eb-ai] Calling Groq ${GROQ_MODEL}, prompt: ${prompt.length} chars`);

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah Employer Branding Specialist berpengalaman di Indonesia. " +
          "Kamu ahli dalam content marketing, social media strategy, dan talent acquisition. " +
          "Selalu kembalikan respons dalam format JSON valid saja, tanpa teks tambahan, tanpa markdown code block.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.85,
    max_tokens: 7800, // Groq's llama-3.3-70b-versatile caps completions at 8192
    response_format: { type: "json_object" },
  });

  const MAX_ATTEMPTS = Math.max(1, maxAttempts);
  let lastErr = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq mengembalikan respons kosong.");
      const finishReason = data.choices?.[0]?.finish_reason ?? null;
      console.log(
        "[eb-ai] Groq OK, tokens:",
        data.usage?.prompt_tokens,
        "+",
        data.usage?.completion_tokens,
        "finish_reason:",
        finishReason,
      );
      const remTok = parseFloat(
        response.headers.get("x-ratelimit-remaining-tokens") ?? "",
      );
      return {
        content: text,
        remainingTokens: Number.isFinite(remTok) ? remTok : null,
        resetSeconds: parseDurationSeconds(
          response.headers.get("x-ratelimit-reset-tokens"),
        ),
        finishReason,
      };
    }

    const errorText = await response.text();
    console.error(
      `[eb-ai] Groq ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}):`,
      errorText.slice(0, 400),
    );

    if (response.status === 401)
      throw new Error("GROQ_API_KEY tidak valid. Periksa key di .env.local");
    if (response.status === 400)
      throw new Error(`Request tidak valid: ${errorText.slice(0, 200)}`);

    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < MAX_ATTEMPTS
    ) {
      const retryAfter = parseFloat(
        response.headers.get("retry-after") ?? "",
      );
      const backoff = Math.min(
        4000,
        Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 500,
      );
      console.log(`[eb-ai] Retrying in ${backoff}ms…`);
      await sleep(backoff);
      lastErr = `Groq ${response.status}`;
      continue;
    }

    if (response.status === 429) {
      const ra = parseFloat(response.headers.get("retry-after") ?? "");
      const err = new Error("Rate limit Groq tercapai.") as Error & {
        retryAfter?: number;
      };
      if (Number.isFinite(ra)) err.retryAfter = ra;
      throw err;
    }
    throw new Error(
      `Groq API error ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  throw new Error(
    `Groq gagal setelah ${MAX_ATTEMPTS} percobaan (${lastErr}). Coba lagi nanti.`,
  );
}

/* ─── Prompt Builder ─── */

export function buildBrandingPrompt(
  input: BrandingInput,
  trendData: TrendItem[],
  companyNewsData: TrendItem[] = [],
  ideaCount: { min: number; max: number } = { min: 6, max: 8 },
): string {
  const ideaCountLabel = `${ideaCount.min}-${ideaCount.max}`;

  const companyContextSection =
    companyNewsData.length > 0
      ? companyNewsData
          .map((t, i) => `${i + 1}. "${t.title}" (sumber: ${t.source}${t.url ? `, URL: ${t.url}` : ""})`)
          .join("\n")
      : "Tidak ditemukan berita spesifik tentang perusahaan ini (wajar untuk perusahaan kecil/lokal/baru, atau nama demo/fiktif) — pahami perusahaan HANYA dari PROFIL PERUSAHAAN di bawah (industri, budaya, nilai, konteks tambahan). JANGAN mengarang aktivitas/berita/pencapaian yang tidak disebutkan user.";
  const pillarLabels = input.pillars
    .map((p) => PILLAR_LABELS[p])
    .join(", ");
  const platformLabels = input.platforms
    .map((p) => PLATFORM_LABELS[p])
    .join(", ");

  const trendSection =
    trendData.length > 0
      ? trendData
          .map((t, i) => `${i + 1}. "${t.title}" (sumber: ${t.source}${t.url ? `, URL: ${t.url}` : ""})`)
          .join("\n")
      : "Tidak ada data tren terbaru. Gunakan pengetahuanmu tentang tren employer branding terkini — JANGAN mengarang URL, biarkan sourceUrl kosong.";

  const manualTrendSection = input.manualTrends.trim()
    ? `"${input.manualTrends.trim()}" — WAJIB DIPAKAI SEBAGAI ANCHOR UTAMA (lihat INSTRUKSI di bawah, ini bukan pelengkap opsional kalau terisi)`
    : "Tidak ada — user tidak mengisi kolom ini (opsional), gunakan sepenuhnya TREN OTOMATIS di atas.";

  const openRolesSection = input.openRoles.trim()
    ? input.openRoles.trim()
    : "Tidak ada posisi terbuka saat ini.";

  const referenceLines = [
    input.referenceContentUrl?.trim()
      ? `- Link konten referensi: ${input.referenceContentUrl.trim()}`
      : null,
    input.referenceVideoMeta?.trim()
      ? `- Video referensi diunggah user: ${input.referenceVideoMeta.trim()}`
      : null,
    input.referenceContentNotes?.trim()
      ? `- Pengamatan user tentang konten ini: ${input.referenceContentNotes.trim()}`
      : null,
  ].filter((l): l is string => Boolean(l));
  const referenceSection =
    referenceLines.length > 0
      ? referenceLines.join("\n")
      : "Tidak ada — user tidak memberi referensi konten spesifik (opsional).";

  const playbookText = VIRALITY_PRINCIPLES.map(
    (p, i) => `${i + 1}. ${p.title}: ${p.description}`,
  ).join("\n");

  const formatsText = pickRandomFormats(8)
    .map(
      (f, i) =>
        `${i + 1}. ${f.name} (${f.platform}) — kerangka beat: ${f.structure}`,
    )
    .join("\n");

  const avoidTitlesSection =
    input.avoidTitles && input.avoidTitles.length > 0
      ? input.avoidTitles.slice(0, 20).map((t) => `- ${t}`).join("\n")
      : null;

  const goalMap: Record<string, string> = {
    awareness: "Meningkatkan brand awareness perusahaan sebagai tempat kerja pilihan",
    engagement: "Meningkatkan engagement dan interaksi di media sosial",
    "talent-acquisition": "Menarik kandidat berkualitas untuk posisi yang dibuka",
    all: "Brand awareness, engagement, dan talent acquisition",
  };

  return `Buat strategi konten employer branding untuk perusahaan berikut.

KONTEKS PERUSAHAAN DARI BERITA TERKINI (riset otomatis berdasarkan nama perusahaan):
${companyContextSection}

PROFIL PERUSAHAAN:
- Nama: ${input.companyName}
- Industri: ${input.industry}
- Jumlah karyawan: ${input.employeeCount}
- Budaya & nilai: ${input.companyValues || "Belum diisi"}
- Target audiens: ${input.targetAudience}
- Tujuan campaign: ${goalMap[input.campaignGoal] || goalMap.all}
- Konteks tambahan: ${input.additionalContext || "-"}

POSISI TERBUKA (untuk konten talent acquisition):
${openRolesSection}

TREN VIRAL & TRENDING OTOMATIS (RISET UTAMA — prioritaskan ini):
${trendSection}

TREN TAMBAHAN DARI USER (opsional, hanya pelengkap — boleh kosong):
${manualTrendSection}

REFERENSI KONTEN UNTUK METODE AMATI-TIRU-MODIFIKASI (opsional):
${referenceSection}

KUNCI VIRAL & ENGAGEMENT (terapkan prinsip-prinsip ini ke SETIAP ide, sebutkan mana yang dipakai):
${playbookText}

FORMAT VIRAL UNTUK DIADAPTASI (pilih & modifikasi — SATU IDE = SATU FORMAT BERBEDA, dilarang ada dua ide dengan format yang sama dalam batch ini):
${formatsText}
${
  avoidTitlesSection
    ? `\nIDE YANG SUDAH PERNAH DIBUAT SEBELUMNYA UNTUK PERUSAHAAN INI — JANGAN BUAT YANG MIRIP, HARUS SESUATU YANG BARU:\n${avoidTitlesSection}\n`
    : ""
}
PILAR KONTEN YANG DIMINTA: ${pillarLabels}
PLATFORM TARGET: ${platformLabels}

CONTOH STANDAR KUALITAS YANG DIHARAPKAN (ilustrasi pola, jangan disalin persis — buat versi orisinal untuk perusahaan ini):
Ide: tanya satu per satu ke beberapa karyawan "Sudah berapa lama kerja di sini?" — begitu mereka jawab, wajah & penampilan mereka di-morph pakai efek transformasi usia (aging filter/AI face morph yang sedang tren) jadi terlihat "bertumbuh" sesuai lama kerjanya, sebagai visualisasi jenaka untuk pesan "berkembang bareng perusahaan". Breakdown-nya konkret per detik: 0:00-0:03 karyawan A duduk depan kamera, teks besar muncul "UDAH BERAPA LAMA KERJA DI SINI?"; 0:03-0:06 karyawan A jawab "3 tahun kak!" sambil ketawa; 0:06-0:09 wajahnya di-morph cepat (efek aging transition) jadi versi "3 tahun lebih matang", teks overlay "Level Up"; lalu lanjut ke karyawan berikutnya dengan pola sama tapi durasi kerja beda, dst — bukan cuma "wawancara karyawan tentang masa kerja mereka" yang datar tanpa twist visual.
Itulah level kekonkretan yang diharapkan: nama efek/teknik visual PERSIS, dialog PERSIS, dan twist konsep yang benar-benar baru — bukan template korporat generik ("video budaya kerja", "hari dalam kehidupan karyawan" tanpa modifikasi kreatif).

INSTRUKSI:
0. WAJIB tulis "companyContext" LEBIH DULU sebelum membuat ide apa pun: 1 paragraf yang membuktikan kamu benar-benar paham perusahaan ini — sebutkan industrinya, situasi/aktivitas terkininya (dari KONTEKS PERUSAHAAN DARI BERITA TERKINI kalau ada, atau dari PROFIL PERUSAHAAN kalau tidak ada berita), dan apa artinya itu untuk strategi employer branding-nya. Kalau tidak ada berita ditemukan, katakan itu terus terang dan gunakan profil yang diberikan — JANGAN mengarang seolah-olah kamu tahu aktivitas/berita yang sebenarnya tidak ada di data.
1. TREN VIRAL & TRENDING OTOMATIS adalah riset default. TAPI kalau TREN TAMBAHAN DARI USER terisi (nama orang, meme, momen viral spesifik, dll), itu WAJIB jadi anchor konkret untuk MINIMAL 2 ide — sebut entitasnya secara eksplisit di title & description (bukan cuma disinggung sepintas di trendReference), dan jelaskan persis bagaimana entitas/momen itu dihubungkan ke pesan employer branding di contentBreakdown. Kalau kosong, itu normal, pakai TREN OTOMATIS sepenuhnya.
2. Buat ${ideaCountLabel} ide konten dengan tingkat kekonkretan seperti CONTOH STANDAR KUALITAS di atas. Setiap ide WAJIB relevan dengan companyContext yang sudah kamu tulis (industri & situasi nyata perusahaan ini, bukan generik untuk industri manapun), dan WAJIB memakai format berbeda dari daftar FORMAT VIRAL (boleh dimodifikasi, sebutkan nama format aslinya + platform di "formatUsed")
3. Untuk SETIAP ide, buat "contentBreakdown": array 4-6 beat. Setiap beat WAJIB memuat: (a) label waktu/slide, (b) nama beat singkat, (c) description berisi CONTOH DIALOG/TEKS-DI-LAYAR PERSIS yang muncul DAN nama teknik visual/transisi spesifik (mis. jump cut, morph/aging filter, split-screen, freeze-frame, whip pan, voice-over reveal). DILARANG deskripsi abstrak seperti "buka dengan hook menarik" tanpa isi konkret — description minimal 15 kata dan harus terbaca seperti instruksi shot-list yang bisa langsung dieksekusi kru produksi
4. Minimal 2 dari ${ideaCountLabel} ide WAJIB menggabungkan SATU data/fakta spesifik perusahaan (masa kerja karyawan, jabatan, pencapaian) dengan SATU mekanik/efek visual yang sedang tren (age filter, freeze-frame reveal, split-screen before-after, morph cut, voice reveal, dll) — bukan sekadar format wawancara/testimoni polos
5. visualDirection, copyGuideline, productionNotes, dan contentBreakdown WAJIB berbeda-beda kalimatnya di setiap ide sesuai konten spesifiknya — DILARANG KERAS memakai kalimat yang sama persis di lebih dari satu ide
6. Setiap ide menerapkan minimal 1-3 KUNCI VIRAL & ENGAGEMENT — sebutkan di "viralPrinciples"
7. Untuk setiap ide, tulis juga "performancePattern": pola kualitatif kenapa konten sejenis biasanya berkinerja baik (rujuk ke kunci viral & engagement) — JANGAN mengarang angka/statistik spesifik seolah itu data nyata
8. Untuk setiap ide, tulis "variations": 2 variasi eksekusi/sudut pandang alternatif dari ide inti yang sama, supaya user punya beberapa opsi bukan cuma satu
9. Jika ada REFERENSI KONTEN dari user (link/video/catatan), WAJIB buat minimal 1 ide yang menerapkan metode Amati-Tiru-Modifikasi (ATM) darinya secara konkret — sebutkan persis pola/hook yang diamati di description, dan detail eksekusi modifikasinya di contentBreakdown. Jangan sekadar menyebut nama trennya tanpa menerjemahkan ke eksekusi nyata
10. Isi "sourceUrl" dengan URL PERSIS dari daftar TREN VIRAL & TRENDING OTOMATIS di atas kalau ide tsb merujuk padanya — SALIN PERSIS, JANGAN PERNAH mengarang/mengubah URL. Kalau tidak ada yang relevan atau tidak ada URL di daftar, kosongkan ("")
11. Buat editorial plan 4 minggu (tema per minggu, 3-5 post per minggu)
12. Semua konten harus relevan dengan konteks perusahaan Indonesia
13. Hashtag campuran Bahasa Indonesia dan Inggris
14. Pastikan variasi antar pilar, platform, dan tipe konten
15. Jika ada posisi terbuka, beberapa ide harus mengarah ke talent acquisition

FORMAT OUTPUT JSON:
{
  "companyContext": "<paragraf pemahamanmu tentang perusahaan ini: industri, situasi/aktivitas terkini (dari berita jika ada), dan implikasinya untuk employer branding — tulis ini PALING AWAL, sebelum ideas>",
  "trendAnalysis": "<paragraf rangkuman tren employer branding terkini yang relevan>",
  "strategyNote": "<paragraf rekomendasi strategi employer branding keseluruhan untuk perusahaan ini>",
  "ideas": [
    {
      "id": 1,
      "title": "<judul ide konten yang catchy>",
      "platform": "<linkedin|instagram|tiktok|career-page|twitter|youtube>",
      "contentType": "<video|carousel|article|story|reel|infographic|photo-post|live-session|podcast-clip>",
      "pillar": "<culture|career-growth|benefits|behind-the-scenes|employee-stories|achievements|csr|leadership>",
      "description": "<deskripsi/outline konten 2-3 kalimat>",
      "talkingPoints": ["<poin 1>", "<poin 2>", "<poin 3>"],
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
      "calendarSuggestion": "<saran hari dan waktu posting, e.g. 'Selasa pagi 08:00'>",
      "estimatedEngagement": "<high|medium|low>",
      "trendReference": "<tren apa yang menginspirasi ide ini>",
      "visualDirection": "<arahan visual: warna, style, mood, komposisi>",
      "copyGuideline": "<panduan copy: tone of voice, CTA, panjang caption, hook>",
      "productionNotes": "<catatan produksi: durasi video, ukuran asset, tools yang bisa dipakai>",
      "viralPrinciples": ["<1-3 judul prinsip dari daftar KUNCI VIRAL & ENGAGEMENT yang diterapkan di ide ini>"],
      "performancePattern": "<pola kualitatif kenapa konten sejenis biasanya berkinerja baik, merujuk kunci viral & engagement — tanpa angka fiktif>",
      "variations": ["<variasi eksekusi/sudut pandang alternatif 1>", "<variasi eksekusi/sudut pandang alternatif 2>"],
      "formatUsed": "<nama format dari FORMAT VIRAL + platform asalnya, mis. 'Day in the Life (TikTok/Reels)'>",
      "contentBreakdown": [
        { "label": "0:00-0:04", "beat": "Hook", "description": "<contoh konkret: 'Kamera close-up ke wajah karyawan A, teks besar di layar: SUDAH BERAPA LAMA KERJA DI SINI? — karyawan menjawab \"3 tahun kak!\" sambil tertawa'>" }
      ],
      "sourceUrl": "<URL PERSIS dari daftar TREN VIRAL & TRENDING OTOMATIS jika relevan, atau string kosong \"\" jika tidak ada>"
    }
  ],
  "editorialPlan": [
    {
      "week": 1,
      "theme": "<tema minggu ini>",
      "posts": [
        {
          "day": "<Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu>",
          "time": "<HH:MM>",
          "platform": "<platform>",
          "ideaRef": 1,
          "caption": "<contoh caption pendek 1-2 kalimat>"
        }
      ]
    }
  ],
  "generalTips": ["<tip 1>", "<tip 2>", "<tip 3>", "<tip 4>", "<tip 5>"]
}

PENTING:
- ideas harus berisi ${ideaCountLabel} item dengan variasi platform dan pilar
- editorialPlan harus berisi 4 minggu, masing-masing 3-5 post
- Semua teks dalam Bahasa Indonesia kecuali hashtag dan istilah umum
- Production brief harus cukup detail untuk briefing tim desain/produksi`;
}

/* ─── Response Parser ─── */

const VALID_PLATFORMS = new Set<Platform>([
  "linkedin", "instagram", "tiktok", "career-page", "twitter", "youtube",
]);
const VALID_FORMATS = new Set<ContentFormat>([
  "video", "carousel", "article", "story", "reel",
  "infographic", "photo-post", "live-session", "podcast-clip",
]);
const VALID_PILLARS = new Set<ContentPillar>([
  "culture", "career-growth", "benefits", "behind-the-scenes",
  "employee-stories", "achievements", "csr", "leadership",
]);
const VALID_ENGAGEMENT = new Set(["high", "medium", "low"]);

export function parseBrandingResponse(
  raw: string,
  knownTrendUrls: string[] = [],
): BrandingIdeasResult {
  let text = raw.trim();
  // Strip markdown code fences
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  // Find JSON boundaries
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Tidak ditemukan JSON dalam respons AI.");
  }
  text = text.slice(start, end + 1);

  const data = JSON.parse(text) as Record<string, unknown>;
  const trendUrlSet = new Set(knownTrendUrls.filter(Boolean));

  const ideas = (Array.isArray(data.ideas) ? data.ideas : []).map(
    (raw: Record<string, unknown>, i: number): ContentIdea => ({
      id: typeof raw.id === "number" ? raw.id : i + 1,
      title: String(raw.title ?? `Ide ${i + 1}`),
      platform: VALID_PLATFORMS.has(raw.platform as Platform)
        ? (raw.platform as Platform)
        : "instagram",
      contentType: VALID_FORMATS.has(raw.contentType as ContentFormat)
        ? (raw.contentType as ContentFormat)
        : "carousel",
      pillar: VALID_PILLARS.has(raw.pillar as ContentPillar)
        ? (raw.pillar as ContentPillar)
        : "culture",
      description: String(raw.description ?? ""),
      talkingPoints: Array.isArray(raw.talkingPoints)
        ? raw.talkingPoints.map(String)
        : [],
      hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.map(String) : [],
      calendarSuggestion: String(raw.calendarSuggestion ?? ""),
      estimatedEngagement: VALID_ENGAGEMENT.has(
        raw.estimatedEngagement as string,
      )
        ? (raw.estimatedEngagement as "high" | "medium" | "low")
        : "medium",
      trendReference: String(raw.trendReference ?? ""),
      visualDirection: String(raw.visualDirection ?? ""),
      copyGuideline: String(raw.copyGuideline ?? ""),
      productionNotes: String(raw.productionNotes ?? ""),
      viralPrinciples: Array.isArray(raw.viralPrinciples)
        ? raw.viralPrinciples.map(String)
        : [],
      performancePattern: String(raw.performancePattern ?? ""),
      variations: Array.isArray(raw.variations)
        ? raw.variations.map(String)
        : [],
      formatUsed: String(raw.formatUsed ?? ""),
      contentBreakdown: (Array.isArray(raw.contentBreakdown)
        ? raw.contentBreakdown
        : []
      ).map(
        (b: Record<string, unknown>): ContentBeat => ({
          label: String(b.label ?? ""),
          beat: String(b.beat ?? ""),
          description: String(b.description ?? ""),
        }),
      ),
      // Only trust a sourceUrl that exactly matches one of the real URLs we
      // actually fetched — never let the model's own invented link through.
      sourceUrl: trendUrlSet.has(String(raw.sourceUrl ?? ""))
        ? String(raw.sourceUrl)
        : "",
    }),
  );

  const editorialPlan = (
    Array.isArray(data.editorialPlan) ? data.editorialPlan : []
  ).map(
    (w: Record<string, unknown>, i: number): EditorialWeek => ({
      week: typeof w.week === "number" ? w.week : i + 1,
      theme: String(w.theme ?? `Minggu ${i + 1}`),
      posts: (Array.isArray(w.posts) ? w.posts : []).map(
        (p: Record<string, unknown>): EditorialPost => ({
          day: String(p.day ?? "Senin"),
          time: String(p.time ?? "08:00"),
          platform: VALID_PLATFORMS.has(p.platform as Platform)
            ? (p.platform as Platform)
            : "instagram",
          ideaRef: typeof p.ideaRef === "number" ? p.ideaRef : 1,
          caption: String(p.caption ?? ""),
        }),
      ),
    }),
  );

  return {
    companyContext: String(data.companyContext ?? ""),
    trendAnalysis: String(data.trendAnalysis ?? ""),
    strategyNote: String(data.strategyNote ?? ""),
    ideas,
    editorialPlan,
    generalTips: Array.isArray(data.generalTips)
      ? data.generalTips.map(String)
      : [],
  };
}

/* ─── Fallback ─── */

export function buildFallbackResult(message: string): BrandingIdeasResult {
  return {
    companyContext: "",
    trendAnalysis: message,
    strategyNote: "",
    ideas: [],
    editorialPlan: [],
    generalTips: [],
  };
}
