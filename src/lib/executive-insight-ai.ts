/* ═══════════════════════════════════════════════════════════════════════════
   Executive Insight AI — generates a short, action-oriented 2-3 sentence
   summary for the Overview dashboard from REAL computed metrics only. The
   prompt explicitly forbids inventing numbers not supplied, and a
   deterministic template fallback keeps the widget working even without
   GROQ_API_KEY configured (see buildFallbackSummary).

   SERVER ONLY — calls the Groq API with the API key. Own minimal fetch
   wrapper (not cv-groq.ts/employer-branding-ai.ts) per CLAUDE.md's golden
   rule: additive only, never touch another module's file.
═══════════════════════════════════════════════════════════════════════════ */

export const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ExecutiveMetrics {
  companyName: string;
  industry: "broadcast" | "garment" | string;
  totalHeadcount: number;
  pkwttPct: number; // 0-100
  pkwtCount: number;
  openRoles: number;
  activePipeline: number;
  talentCount: number;
  talentAvgPct: number; // 0-100
  enpsScore: number | null; // -100..100, null = belum ada survei
  enpsPeriod: string | null;
  avgDaysOpen: number | null; // rata-rata usia requisition aktif (proxy time-to-fill), null = tidak ada req aktif
  slaTargetDays: number; // target time-to-fill yang ditetapkan HR
  bottleneckTitle: string | null; // requisition yang paling lama terbuka
  bottleneckDays: number | null;
  turnoverRatePct: number | null; // null = data lifecycle karyawan belum tersedia utk tenant ini
  voluntaryTurnoverPct: number | null;
  involuntaryTurnoverPct: number | null;
  headcountYoYPct: number | null;
  enpsDeltaVsPrev: number | null; // selisih poin vs round eNPS sebelumnya
  overtimeQuarterlyCost: number | null;
  overtimeVariancePct: number | null; // + = melewati budget
  overtimeTopDepartment: string | null;
  overtimeAvgHours: number | null;
}

function formatRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} miliar`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)} juta`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function buildInsightPrompt(m: ExecutiveMetrics): string {
  const enpsLine = m.enpsScore !== null
    ? `eNPS periode ${m.enpsPeriod}: ${m.enpsScore} (skala -100 s/d 100)`
    : "eNPS: belum ada data survei";
  const fillLine = m.avgDaysOpen !== null
    ? `Time to Fill rata-rata: ${m.avgDaysOpen} hari (target HR: <${m.slaTargetDays} hari)${m.bottleneckTitle ? `; posisi paling lama terbuka: ${m.bottleneckTitle} (${m.bottleneckDays} hari)` : ""}`
    : "Time to Fill: tidak ada posisi terbuka saat ini";
  const turnoverLine = m.turnoverRatePct !== null
    ? `Turnover rate tahun berjalan: ${m.turnoverRatePct}% (voluntary ${m.voluntaryTurnoverPct}%, involuntary ${m.involuntaryTurnoverPct}%)`
    : "Turnover rate: data siklus hidup karyawan belum tersedia untuk entitas ini";
  const headcountLine = m.headcountYoYPct !== null
    ? `Pertumbuhan headcount YoY: ${m.headcountYoYPct > 0 ? "+" : ""}${m.headcountYoYPct}%`
    : "Pertumbuhan headcount YoY: tidak tersedia";
  const enpsTrendLine = m.enpsDeltaVsPrev !== null
    ? `Perubahan eNPS vs survei sebelumnya: ${m.enpsDeltaVsPrev > 0 ? "+" : ""}${m.enpsDeltaVsPrev} poin`
    : "Perubahan eNPS: belum ada survei pembanding";
  const overtimeLine = m.overtimeQuarterlyCost !== null
    ? `Beban lembur kuartal berjalan: ${formatRupiah(m.overtimeQuarterlyCost)} (${m.overtimeVariancePct! > 0 ? "+" : ""}${m.overtimeVariancePct}% vs target budget)${m.overtimeTopDepartment ? `; penyumbang terbesar: ${m.overtimeTopDepartment}` : ""}${m.overtimeAvgHours !== null ? `; rata-rata ${m.overtimeAvgHours} jam lembur/karyawan/bulan` : ""}`
    : "Beban lembur: data jam lembur belum tersedia untuk entitas ini";

  return `Berperanlah sebagai HR Analytics Consultant senior (setara konsultan manajemen tier-1) untuk sebuah stasiun televisi nasional. Audiensmu adalah C-Level (CEO/CHRO/CFO).

TUGAS: tulis ringkasan 3-4 kalimat dalam Bahasa Indonesia yang TIDAK sekadar membaca ulang angka, melainkan MENGKORELASIKAN antar-metrik menjadi satu diagnosis sebab-akibat, lalu ditutup dengan TEPAT SATU rekomendasi strategis yang konkret dan bisa dieksekusi.

KERANGKA ANALISIS yang harus kamu pertimbangkan (pakai hanya yang didukung data di bawah):
- Rekrutmen yang lambat pada posisi produksi/lapangan memaksa kru yang ada menutup kekurangan → mendorong lonjakan jam lembur dan beban biaya lembur.
- Beban lembur tinggi yang berkepanjangan → kelelahan (burnout) kru lapangan → menekan skor eNPS.
- eNPS yang turun mendahului naiknya turnover sukarela (voluntary) → memperparah kekosongan posisi → lingkaran yang saling memperkuat.
Sebutkan secara eksplisit keterkaitan antar-metrik ini bila datanya memang mengarah ke sana. Jika data TIDAK mendukung sebuah keterkaitan, jangan dipaksakan.

PERHATIAN KHUSUS — waspadai "Flaw of Averages": rata-rata Time to Fill bisa terlihat sehat (dalam target SLA) padahal menyembunyikan satu posisi bottleneck yang waktu bukanya jauh di atas rata-rata (outlier ekstrem). Jika situasi ini muncul di data — rata-rata dalam/mendekati target TAPI posisi bottleneck jauh melampauinya — kamu WAJIB menyoroti anomali ini secara eksplisit, jangan biarkan rata-rata yang tampak sehat menyembunyikan risiko nyata dari satu posisi kritis yang kosong berbulan-bulan. Jelaskan secara logis bagaimana kekosongan posisi kritis tersebut memicu lonjakan beban lembur pada kru yang menutup kekurangannya, yang pada akhirnya berisiko menekan eNPS akibat kelelahan (burnout).

WAJIB KUANTIFIKASI — "Cost of Delay": jika data beban lembur (biaya lembur kuartal + deviasi budget) tersedia BERSAMAAN dengan bottleneck rekrutmen, kamu WAJIB menyebutkan angka Rupiah beban lembur dan persentase deviasi budgetnya SECARA EKSPLISIT dalam kalimat — jangan pernah menulisnya secara abstrak seperti "lonjakan biaya lembur" tanpa angka. Bingkai ini sebagai argumen "Cost of Delay": menunda pengisian posisi kritis menciptakan biaya variabel (lembur) yang nyata dan terukur, yang kemungkinan besar lebih mahal daripada segera mengisi posisi tersebut. Sebutkan pula divisi penyumbang lembur terbesar jika datanya tersedia.

ATURAN KETAT:
- Hanya gunakan angka yang diberikan di bawah. JANGAN mengarang angka, persentase, nominal rupiah, atau statistik apa pun yang tidak ada di data ini.
- Jangan menyebut revenue, profit, atau biaya per hire — tidak tersedia.
- Jangan menyebut metrik yang statusnya "tidak tersedia"/"belum ada data".
- Balas HANYA dalam format JSON: {"summary": "..."}

DATA:
- Perusahaan: ${m.companyName} (industri: ${m.industry})
- Total headcount: ${m.totalHeadcount}
- ${headcountLine}
- Karyawan tetap (PKWTT): ${m.pkwttPct}% (${m.totalHeadcount - m.pkwtCount} orang)
- Karyawan kontrak (PKWT): ${m.pkwtCount} orang
- Posisi terbuka (open roles): ${m.openRoles}
- Kandidat aktif di pipeline: ${m.activePipeline}
- Freelance & kontributor aktif: ${m.talentCount} orang, readiness rate ${m.talentAvgPct}%
- ${enpsLine}
- ${enpsTrendLine}
- ${fillLine}
- ${turnoverLine}
- ${overtimeLine}`;
}

interface InsightGroqCall {
  content: string;
}

async function callGroqInsight(prompt: string): Promise<InsightGroqCall> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_xxx")) {
    throw new Error("GROQ_API_KEY belum dikonfigurasi.");
  }

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "Kamu adalah asisten eksekutif HR. Selalu balas dalam format JSON valid saja, tanpa markdown code block." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 220,
    response_format: { type: "json_object" },
  });

  const MAX_ATTEMPTS = 2;
  let lastErr = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
    });

    if (response.ok) {
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq mengembalikan respons kosong.");
      return { content: text };
    }

    const errorText = await response.text();
    console.error(`[executive-insight-ai] Groq ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}):`, errorText.slice(0, 300));
    if (response.status === 429 || response.status >= 500) {
      lastErr = `Groq ${response.status}`;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
    }
    throw new Error(`Groq ${response.status}: ${errorText.slice(0, 150)}`);
  }
  throw new Error(lastErr || "Groq gagal setelah beberapa percobaan.");
}

export function parseInsightResponse(raw: string): string {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned) as { summary?: string };
  if (!parsed.summary || typeof parsed.summary !== "string") {
    throw new Error("Respons AI tidak memiliki field summary.");
  }
  return parsed.summary.trim();
}

/** Ringkasan deterministik (bukan AI) — dipakai saat GROQ_API_KEY tidak
 *  dikonfigurasi atau panggilan Groq gagal, supaya widget tidak pernah rusak. */
export function buildFallbackSummary(m: ExecutiveMetrics): string {
  const parts: string[] = [];
  parts.push(`Kesehatan organisasi: ${m.pkwttPct}% karyawan tetap (PKWTT) dari total ${m.totalHeadcount} orang.`);
  if (m.enpsScore !== null) {
    const mood = m.enpsScore >= 30 ? "sentimen karyawan positif" : m.enpsScore >= 0 ? "sentimen karyawan cukup netral" : "sentimen karyawan perlu perhatian";
    parts.push(`eNPS periode ${m.enpsPeriod} tercatat ${m.enpsScore} — ${mood}.`);
  } else {
    parts.push("Belum ada data eNPS — pertimbangkan menjalankan survei pertama.");
  }
  if (m.openRoles > 0) {
    parts.push(`${m.openRoles} posisi masih terbuka dengan ${m.activePipeline} kandidat aktif di pipeline${m.talentCount > 0 ? `; pertimbangkan menengok ${m.talentCount} kandidat di talent pool` : ""}.`);
  }
  const hasBottleneck = m.avgDaysOpen !== null && m.bottleneckTitle !== null && m.bottleneckDays !== null;
  const hasOvertime = m.overtimeQuarterlyCost !== null;

  if (hasBottleneck && hasOvertime) {
    // "Cost of Delay": merge the bottleneck and overtime cost into one
    // explicit financial argument, citing the exact Rupiah figure rather
    // than an abstract "lonjakan biaya" — matches the AI prompt's mandate.
    const overSla = m.avgDaysOpen! > m.slaTargetDays;
    const isHiddenOutlier = !overSla && m.bottleneckDays! >= m.slaTargetDays * 2;
    const healthyAvgNote = isHiddenOutlier
      ? `Time to Fill rata-rata ${m.avgDaysOpen} hari terlihat sehat (dalam target ${m.slaTargetDays} hari), namun `
      : "";
    const varianceStr = m.overtimeVariancePct !== null && m.overtimeVariancePct > 0 ? `, ${m.overtimeVariancePct}% di atas target budget` : "";
    parts.push(
      `${healthyAvgNote}posisi ${m.bottleneckTitle} sudah ${m.bottleneckDays} hari kosong — Cost of Delay-nya nyata: beban lembur kuartal berjalan mencapai ${formatRupiah(m.overtimeQuarterlyCost!)}${varianceStr}${m.overtimeTopDepartment ? `, terkonsentrasi di ${m.overtimeTopDepartment}` : ""}, kemungkinan besar lebih mahal daripada segera mengisi posisi tersebut.`,
    );
  } else if (hasBottleneck) {
    const overSla = m.avgDaysOpen! > m.slaTargetDays;
    const isHiddenOutlier = !overSla && m.bottleneckDays! >= m.slaTargetDays * 2;
    if (isHiddenOutlier) {
      parts.push(
        `Time to Fill rata-rata ${m.avgDaysOpen} hari terlihat sehat (dalam target ${m.slaTargetDays} hari), namun posisi ${m.bottleneckTitle} sudah ${m.bottleneckDays} hari terbuka — jauh di atas rata-rata, dan berisiko membebani kru yang menutup kekurangannya dengan lembur.`,
      );
    } else {
      parts.push(
        `Time to Fill rata-rata ${m.avgDaysOpen} hari${overSla ? ` — melewati target ${m.slaTargetDays} hari` : ` (dalam target ${m.slaTargetDays} hari)`}; posisi ${m.bottleneckTitle} sudah ${m.bottleneckDays} hari terbuka.`,
      );
    }
  } else if (m.avgDaysOpen !== null) {
    const overSla = m.avgDaysOpen > m.slaTargetDays;
    parts.push(`Time to Fill rata-rata ${m.avgDaysOpen} hari${overSla ? ` — melewati target ${m.slaTargetDays} hari` : ` (dalam target ${m.slaTargetDays} hari)`}.`);
  } else if (hasOvertime) {
    parts.push(
      `Beban lembur kuartal berjalan ${formatRupiah(m.overtimeQuarterlyCost!)}${m.overtimeVariancePct !== null && m.overtimeVariancePct > 0 ? ` — ${m.overtimeVariancePct}% di atas target budget` : " (dalam target budget)"}${m.overtimeTopDepartment ? `, terbesar di ${m.overtimeTopDepartment}` : ""}.`,
    );
  }

  if (m.turnoverRatePct !== null) {
    parts.push(`Turnover rate tahun berjalan ${m.turnoverRatePct}% (voluntary ${m.voluntaryTurnoverPct}%, involuntary ${m.involuntaryTurnoverPct}%).`);
  }
  return parts.join(" ");
}

export async function generateExecutiveInsight(m: ExecutiveMetrics): Promise<{ summary: string; source: "ai" | "fallback" }> {
  try {
    const prompt = buildInsightPrompt(m);
    const { content } = await callGroqInsight(prompt);
    const summary = parseInsightResponse(content);
    return { summary, source: "ai" };
  } catch (err) {
    console.warn("[executive-insight-ai] Falling back to template:", (err as Error).message);
    return { summary: buildFallbackSummary(m), source: "fallback" };
  }
}
