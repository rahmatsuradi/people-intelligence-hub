/* ═══════════════════════════════════════════════════════════════════════════
   CV Analyzer AI — Multi-framework competency analysis
   Model: Groq Llama 3.3 70B
   
   7 Cluster Framework (sesuai standar industri media & penyiaran):
   1. HR         → Ulrich (2012) + SKKNI No.149/2020
   2. Tech       → SFIA v8 (Skills Framework for Information Age)
   3. Business   → Lominger Leadership Architect (Korn Ferry)
   4. Finance    → CGMA Competency Framework (CIMA/AICPA)
   5. Broadcast  → SKKNI Penyiaran (Kepmenaker No. 133/2019)
   6. Editorial  → SKKNI Jurnalistik & Redaksi (Kepmenaker No. 246/2020)
   7. Security   → SKKNI Satpam (Kepmenaker No. 259/2018)
═══════════════════════════════════════════════════════════════════════════ */

import {
  CLUSTER_FRAMEWORKS,
  buildFrameworkPrompt,
  type CompetencyCluster,
} from "./competency-framework";

export type { CompetencyCluster };

export interface AiCompetencyScore {
  id: string;
  name: string;
  pillar: string;
  score: number;
  rawLevel: number;
  benchmark: number;
  insight: string;
  evidenceQuote: string;
  gap: "strength" | "meets" | "develop";
}

export interface AiRiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
  source: string;
}

export interface AiInterviewQuestion {
  id: number;
  category: string;
  question: string;
  rationale: string;
  targetCompetency: string;
  validityMethod: string;
}

export interface AiAnalysisResult {
  candidateName?: string; // extracted from CV when not provided (bulk mode)
  overallScore: number;
  matchScore: number;
  confidence: number;
  recommendation: "Strong Hire" | "Hire" | "Review" | "Reject";
  summary: string;
  recommendationDetail: string;
  processingNote: string;
  cluster: CompetencyCluster;
  frameworkLabel: string;
  competencies: AiCompetencyScore[];
  risks: AiRiskFlag[];
  questions: AiInterviewQuestion[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLUSTER ROUTING
   Urutan prioritas: Department → Position keywords → Default business
═══════════════════════════════════════════════════════════════════════════ */

export function detectCluster(position: string, department: string): CompetencyCluster {
  const pos = position.toLowerCase().trim();
  const dept = department.toLowerCase().trim();

  // 1. Department mapping — paling reliable
  const DEPT_MAP: Record<string, CompetencyCluster> = {
    "hr": "hr",
    "engineering": "tech",
    "product": "tech",
    "data": "tech",
    "finance": "finance",
    "legal": "finance",
    "design": "business",
    "sales": "business",
    "operations": "business",
    // Operational — Broadcast & Multimedia
    "penyiaran": "broadcast",
    "broadcast": "broadcast",
    "studio": "broadcast",
    "kamera": "broadcast",
    "mcr": "broadcast",
    "multimedia": "broadcast",
    // Editorial & Newsroom
    "redaksi": "editorial",
    "jurnalistik": "editorial",
    "news": "editorial",
    "berita": "editorial",
    "reporter": "editorial",
    "editorial": "editorial",
    // Physical security (BUKAN cybersecurity — konteks Indonesia: satpam)
    "security": "security",
    "keamanan": "security",
  };
  // Check position first, then department (as department is broader)

  // 2. Position keyword matching — spesifik, tidak overlap
  // Operational position keywords — checked BEFORE white-collar keywords
  const BROADCAST_POS = ["cameraman", "kamera", "video editor", "editor video",
    "floor director", "studio technician", "teknisi studio", "audio engineer",
    "lighting", "mcr", "broadcast", "penyiaran"];

  const EDITORIAL_POS = ["reporter", "jurnalis", "journalist", "news producer",
    "produser berita", "scriptwriter", "penulis naskah", "news editor",
    "redaksi", "editor berita", "anchor", "host", "pembawa acara"];

  const SECURITY_POS = ["satpam", "security guard", "jaga malam",
    "petugas keamanan", "penjaga", "pengamanan"];

  const HR_POS = ["hr ", " hr", "human resource", "hrd", "hrga", "hrbp",
    "rekrutmen", "talent acquisition", "talent management", "payroll",
    "compensation", "people ops", "people partner", "industrial relation"];

  const FINANCE_POS = ["finance", "financial", "accounting", "accountant",
    "akuntan", "keuangan", "treasury", "tax", "pajak", "audit", "auditor",
    "controller", "cfo", "investment", "banking", "legal", "compliance",
    "risk manager", "actuary", "budget analyst", "cost analyst"];

  const TECH_POS = ["engineer", "developer", "software", "backend", "frontend",
    "fullstack", "mobile dev", "android dev", "ios dev", "data scientist",
    "data engineer", "ml engineer", "ai engineer", "devops", "cloud",
    "cybersecurity", "infosec", "solution architect", "tech lead",
    "programmer", "qa engineer", "sre", "platform engineer"];

  // Cek operational dulu (paling spesifik untuk konteks media/penyiaran)
  if (BROADCAST_POS.some(k => pos.includes(k))) return "broadcast";
  if (EDITORIAL_POS.some(k => pos.includes(k))) return "editorial";
  if (SECURITY_POS.some(k => pos.includes(k))) return "security";

  // Cek HR dulu (spesifik)
  if (HR_POS.some(k => pos.includes(k))) return "hr";
  // Cek Finance (spesifik)
  if (FINANCE_POS.some(k => pos.includes(k))) return "finance";
  // Cek Tech (spesifik)
  if (TECH_POS.some(k => pos.includes(k))) return "tech";

  // 3. Cek Department sebagai fallback jika posisi tidak spesifik
  if (DEPT_MAP[dept]) return DEPT_MAP[dept];

  // 4. Default: business — MT, General Manager, Operations, Sales, dll
  return "business";
}

/* ═══════════════════════════════════════════════════════════════════════════
   FRAMEWORK METADATA

   Competency definitions, benchmarks and rubric levels live in
   competency-framework.ts — the single source of truth shared with the UI and
   the Interview Workspace. The prompt text below is GENERATED from them, so a
   benchmark shown on screen and a benchmark sent to the model can never drift.
   (They previously lived in hand-written prompt strings here, which is why 25
   of 36 competencies had no rubric anywhere the UI could reach.)
═══════════════════════════════════════════════════════════════════════════ */

interface FrameworkMeta {
  label: string;
  reference: string;
  competencyCount: number;
  definition: string;
}

const FRAMEWORK_META: Record<CompetencyCluster, FrameworkMeta> = Object.fromEntries(
  (Object.keys(CLUSTER_FRAMEWORKS) as CompetencyCluster[]).map((cluster) => [
    cluster,
    {
      label: CLUSTER_FRAMEWORKS[cluster].label,
      reference: CLUSTER_FRAMEWORKS[cluster].reference,
      competencyCount: CLUSTER_FRAMEWORKS[cluster].competencies.length,
      definition: buildFrameworkPrompt(cluster),
    },
  ]),
) as Record<CompetencyCluster, FrameworkMeta>;

export function buildAnalysisPrompt(
  cvText: string,
  candidateName: string,
  targetPosition: string,
  department: string
): string {
  const cluster = detectCluster(targetPosition, department);
  const meta = FRAMEWORK_META[cluster];
  const trimmedCv = cvText.slice(0, 2500);

  const hasName = Boolean(candidateName && candidateName.trim());
  const nameLine = hasName
    ? `KANDIDAT: ${candidateName}`
    : `KANDIDAT: (tidak diberikan — EKSTRAK nama lengkap kandidat dari teks CV di bawah)`;

  return `Kamu adalah Senior Talent Assessment Specialist di perusahaan multinasional Fortune 500. Analisis CV kandidat menggunakan framework kompetensi standar internasional. Kembalikan HANYA JSON valid tanpa teks tambahan apapun.

${nameLine}
POSISI TARGET: ${targetPosition}
DEPARTEMEN: ${department}
FRAMEWORK: ${meta.label}
REFERENSI: ${meta.reference}

═══ TEKS CV ═══
${trimmedCv}
═══════════════

${meta.definition}

INSTRUKSI:
- Evaluasi setiap kompetensi dari evidence nyata di CV
- Jika tidak ada bukti, beri rawLevel 1-2
- evidenceQuote: kutipan langsung dari CV max 15 kata, atau "Tidak ditemukan bukti eksplisit"
- gap: "strength" jika score>=bench, "meets" jika |score-bench|<=5, "develop" jika score<bench-5
- 5 pertanyaan STAR, prioritaskan gap terbesar

OUTPUT JSON:
{
  "candidateName": "${hasName ? candidateName : "<nama lengkap kandidat hasil ekstraksi dari CV>"}",
  "overallScore": <0-100>,
  "matchScore": <0-100>,
  "confidence": <0-100>,
  "recommendation": <"Strong Hire"|"Hire"|"Review"|"Reject">,
  "summary": "<2-3 kalimat Indonesia>",
  "recommendationDetail": "<next step konkret>",
  "processingNote": "<catatan kualitas CV>",
  "cluster": "${cluster}",
  "frameworkLabel": "${meta.label}",
  "competencies": [{"id","name","pillar","score","rawLevel","benchmark","insight","evidenceQuote","gap"}],
  "risks": [{"id","label","detail","severity","source"}],
  "questions": [{"id","category","question","rationale","targetCompetency","validityMethod"}]
}

PENTING: competencies harus berisi TEPAT ${meta.competencyCount} item sesuai framework di atas.`;
}

export function parseAnalysisResponse(rawResponse: string): AiAnalysisResult {
  let cleaned = rawResponse.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  const parsed = JSON.parse(cleaned) as AiAnalysisResult;

  if (!parsed.competencies || !Array.isArray(parsed.competencies)) {
    throw new Error("Response tidak valid: field competencies tidak ditemukan");
  }
  if (!parsed.recommendation) {
    throw new Error("Response tidak valid: field recommendation tidak ditemukan");
  }

  parsed.competencies = parsed.competencies.map((c) => ({
    ...c,
    score: Math.min(100, Math.max(0, Number(c.score) || 50)),
    benchmark: Math.min(100, Math.max(0, Number(c.benchmark) || 75)),
    rawLevel: Math.min(5, Math.max(1, Number(c.rawLevel) || 3)),
  }));

  parsed.overallScore = Math.min(100, Math.max(0, Number(parsed.overallScore) || 0));
  parsed.matchScore = Math.min(100, Math.max(0, Number(parsed.matchScore) || 0));
  parsed.confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 0));

  if (!parsed.cluster) parsed.cluster = "business";
  if (!parsed.frameworkLabel) parsed.frameworkLabel = FRAMEWORK_META[parsed.cluster].label;

  if (parsed.candidateName) parsed.candidateName = String(parsed.candidateName).trim().slice(0, 80);

  return parsed;
}

export function buildFallbackResult(errorMessage: string): AiAnalysisResult {
  const makeComp = (id: string, name: string, pillar: string, benchmark: number): AiCompetencyScore => ({
    id, name, pillar, score: 50, rawLevel: 3, benchmark,
    insight: "Analisis tidak tersedia.", evidenceQuote: "Error", gap: "develop",
  });

  return {
    overallScore: 0, matchScore: 0, confidence: 0,
    recommendation: "Review",
    cluster: "business",
    frameworkLabel: "Error — Framework tidak terdeteksi",
    summary: `Analisis gagal: ${errorMessage}`,
    recommendationDetail: "Periksa koneksi API dan coba kembali.",
    processingNote: errorMessage,
    competencies: [
      makeComp("lom-strategic-agility", "Strategic Agility", "lominger", 80),
      makeComp("lom-drive-results", "Drive for Results", "lominger", 85),
      makeComp("lom-learning-agility", "Learning Agility", "lominger", 82),
    ],
    risks: [{ id: "R1", label: "Analisis tidak tersedia", detail: `Error: ${errorMessage}`, severity: "high", source: "System" }],
    questions: [],
  };
}

export { FRAMEWORK_META };
