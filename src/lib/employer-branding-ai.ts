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

export async function fetchTrendData(
  industry: string,
  platforms: Platform[],
): Promise<TrendItem[]> {
  // Ordered so viral/trending social content discovery runs first — this is
  // the default, automatic research the tool leans on. Industry & platform
  // queries fill in the rest; manual user input (if any) only supplements it.
  const queries = [
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
      try {
        const url = `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) continue;
        const xml = await res.text();

        const titleMatches = xml.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<source[^>]*>(.*?)<\/source>[\s\S]*?<\/item>/g);
        if (!titleMatches) continue;

        for (const match of titleMatches.slice(0, 5)) {
          const t = match.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const s = match.match(/<source[^>]*>(.*?)<\/source>/);
          if (t?.[1]) {
            items.push({
              title: t[1],
              snippet: t[1],
              source: s?.[1] ?? "Google News",
            });
          }
        }
      } catch {
        continue;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  console.log(`[eb-ai] Fetched ${items.length} trend items`);
  return items.slice(0, 12);
}

/* ─── Groq API call (branding-specific, creative temperature) ─── */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GroqBrandingCall {
  content: string;
  remainingTokens: number | null;
  resetSeconds: number | null;
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
    temperature: 0.7,
    max_tokens: 4000,
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
      console.log(
        "[eb-ai] Groq OK, tokens:",
        data.usage?.prompt_tokens,
        "+",
        data.usage?.completion_tokens,
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
): string {
  const pillarLabels = input.pillars
    .map((p) => PILLAR_LABELS[p])
    .join(", ");
  const platformLabels = input.platforms
    .map((p) => PLATFORM_LABELS[p])
    .join(", ");

  const trendSection =
    trendData.length > 0
      ? trendData
          .map((t, i) => `${i + 1}. "${t.title}" (sumber: ${t.source})`)
          .join("\n")
      : "Tidak ada data tren terbaru. Gunakan pengetahuanmu tentang tren employer branding terkini.";

  const manualTrendSection = input.manualTrends.trim()
    ? input.manualTrends.trim()
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

  const goalMap: Record<string, string> = {
    awareness: "Meningkatkan brand awareness perusahaan sebagai tempat kerja pilihan",
    engagement: "Meningkatkan engagement dan interaksi di media sosial",
    "talent-acquisition": "Menarik kandidat berkualitas untuk posisi yang dibuka",
    all: "Brand awareness, engagement, dan talent acquisition",
  };

  return `Buat strategi konten employer branding untuk perusahaan berikut.

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

PILAR KONTEN YANG DIMINTA: ${pillarLabels}
PLATFORM TARGET: ${platformLabels}

INSTRUKSI:
1. Prioritaskan TREN VIRAL & TRENDING OTOMATIS sebagai riset utama. TREN TAMBAHAN DARI USER hanya pelengkap opsional — kalau kosong, itu normal, jangan anggap kekurangan data.
2. Buat 6-8 ide konten yang kreatif, spesifik, dan actionable, masing-masing menerapkan minimal 1-3 KUNCI VIRAL & ENGAGEMENT di atas
3. Setiap ide harus mencakup production brief lengkap (arahan visual, panduan copy, catatan produksi)
4. Untuk setiap ide, tulis juga "performancePattern": pola kualitatif kenapa konten sejenis biasanya berkinerja baik (rujuk ke kunci viral & engagement) — JANGAN mengarang angka/statistik spesifik seolah itu data nyata
5. Untuk setiap ide, tulis "variations": 2 variasi eksekusi/sudut pandang alternatif dari ide inti yang sama, supaya user punya beberapa opsi bukan cuma satu
6. Jika ada REFERENSI KONTEN dari user, terapkan metode Amati-Tiru-Modifikasi (ATM): amati pola/hook/format dari referensi tsb, lalu modifikasi agar relevan dengan employer branding perusahaan ini — jangan tiru mentah-mentah, dan sertakan idenya di trendReference
7. Buat editorial plan 4 minggu (tema per minggu, 3-5 post per minggu)
8. Semua konten harus relevan dengan konteks perusahaan Indonesia
9. Hashtag campuran Bahasa Indonesia dan Inggris
10. Pastikan variasi antar pilar, platform, dan tipe konten
11. Jika ada posisi terbuka, beberapa ide harus mengarah ke talent acquisition

FORMAT OUTPUT JSON:
{
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
      "variations": ["<variasi eksekusi/sudut pandang alternatif 1>", "<variasi eksekusi/sudut pandang alternatif 2>"]
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
- ideas harus berisi 6-8 item dengan variasi platform dan pilar
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

export function parseBrandingResponse(raw: string): BrandingIdeasResult {
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
    trendAnalysis: message,
    strategyNote: "",
    ideas: [],
    editorialPlan: [],
    generalTips: [],
  };
}
