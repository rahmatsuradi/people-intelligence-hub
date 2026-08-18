"use client";

import {
  CitationNote,
  EvidenceValidityPanel,
  FrameworkPillarBadge,
  RubricTable,
} from "@/components/competency-framework-ui";
import {
  CLUSTER_FRAMEWORKS,
  COMPETENCY_BY_ID,
  PILLAR_CITATIONS,
  getPillarLabel,
  type RubricLevel,
} from "@/lib/competency-framework";
// Single shared cluster router — the CV Analyzer scores against the framework this
// picks, so the interview kit must use the exact same call or a candidate gets
// screened on one framework and interviewed on another.
import { detectCluster } from "@/lib/cv-analyzer-ai";
import {
  findCandidateByName, createCandidate, saveInterviewResult, getCandidate,
  type InterviewResultSnapshot,
} from "@/lib/store";
import { AppShell, Icon, SvgPath, ICON_PATHS, Card, Button, Label, inputClass, cn } from "@/components/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  aggregatePanel,
  computeInterviewOutcome,
  RATING_HELP,
  RATING_LABELS,
  VERDICT_LABELS,
  type ScoredQuestion,
  type Verdict,
} from "@/lib/recruiting/interview-scoring";
import {
  analyzeEvidenceCoverage,
  ASSESSMENT_HANDOFF_KEY,
  deriveQuestionFormat,
  FORMAT_LABELS,
  type AssessmentHandoff,
} from "@/lib/recruiting/interview-kit";
import {
  isKitTooThin,
  summarizeSelection,
  validateCustomQuestion,
  type BankQuestion,
  type CustomQuestionDraft,
} from "@/lib/recruiting/question-bank";
import { loadCustomQuestions, saveCustomQuestion } from "@/lib/recruiting/question-bank-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { toast } from "@/components/toast";

/* ═══════════════════════════════════════════════════════════════════════════
   Types & constants
═══════════════════════════════════════════════════════════════════════════ */

type InterviewType = "Behavioral" | "Technical" | "Leadership" | "Cultural Fit" | "Situational" | "Assessment Probe";
type Seniority =
  | "Junior"
  | "Mid-Level"
  | "Senior"
  | "Staff"
  | "Principal"
  | "Director";
type ScoringState = "idle" | "scoring" | "complete";

interface QuestionScore {
  rating: 1 | 2 | 3 | 4 | 5 | null;
  /** Sengaja tidak ditanyakan. Dikeluarkan dari pembagi cakupan, dan TIDAK
   *  sama dengan nilai 1 — pertanyaan yang tak sempat ditanyakan bukan
   *  performa terburuk kandidat. */
  notAsked: boolean;
  notes: string;
}

interface InterviewQuestion {
  id: string;
  type: InterviewType;
  competencyId: string;
  competencyName: string;
  question: string;
  strongAnswer: string;
  redFlags: string[];
  rubric: RubricLevel[];
}

interface QuestionPack {
  packId: string;
  generatedAt: string;
  position: string;
  seniority: Seniority;
  types: InterviewType[];
  durationMin: number;
  questions: InterviewQuestion[];
  interviewerNotes: string[];
  /** Kompetensi yang tidak bisa ditawar untuk posisi ini. Nilai di bawah batas
   *  pada salah satunya memblokir rekomendasi, berapa pun rata-ratanya. */
  criticalCompetencyIds: string[];
}

interface CvPrefill {
  candidateName: string;
  position: string;
  department: string;
  overallScore: number;
  matchScore: number;
  recommendation: string;
  questions: { id: number; category: string; question: string; rationale: string }[];
  reportId: string;
}

const SENIORITY_LEVELS: Seniority[] = [
  "Junior",
  "Mid-Level",
  "Senior",
  "Staff",
  "Principal",
  "Director",
];

/** Label tampilan untuk tiap tipe. Nilai internalnya sengaja TIDAK diubah:
 *  hasil wawancara lama menyimpan string tipe apa adanya, dan menggantinya akan
 *  membuat laporan terdahulu kehilangan pengelompokannya.
 *
 *  "Cultural Fit" diberi label ulang menjadi keselarasan nilai & motivasi.
 *  Menilai "kecocokan budaya" adalah pintu masuk bias kembali ke proses yang
 *  sudah distrukturkan — yang bisa dinilai secara adil adalah keselarasan pada
 *  nilai kerja yang dinyatakan, dengan jangkar perilaku, bukan kesan cocok. */
const TYPE_LABELS: Record<InterviewType, string> = {
  Behavioral: "Perilaku Masa Lalu",
  Technical: "Teknis",
  Leadership: "Kepemimpinan",
  "Cultural Fit": "Keselarasan Nilai & Motivasi",
  Situational: "Situasional",
  "Assessment Probe": "Pendalaman Asesmen",
};

const INTERVIEW_TYPES: InterviewType[] = [
  "Behavioral",
  "Technical",
  "Leadership",
  "Cultural Fit",
  "Situational",
];

const TYPE_STYLES: Record<
  InterviewType,
  { chip: string; header: string; border: string }
> = {
  Behavioral: {
    chip: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30",
    header: "border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5",
    border: "border-violet-200 dark:border-violet-500/30",
  },
  Technical: {
    chip: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
    header: "border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/5",
    border: "border-blue-200 dark:border-blue-500/30",
  },
  Leadership: {
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30",
    header: "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/5",
    border: "border-indigo-200 dark:border-indigo-500/30",
  },
  "Cultural Fit": {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    header: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5",
    border: "border-emerald-200 dark:border-emerald-500/30",
  },
  "Assessment Probe": {
    chip: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30",
    header: "border-teal-200 bg-teal-50/50 dark:border-teal-500/30 dark:bg-teal-500/5",
    border: "border-teal-200 dark:border-teal-500/30",
  },
  Situational: {
    chip: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    header: "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/30",
  },
};

function rubricFor(id: string): RubricLevel[] {
  return COMPETENCY_BY_ID[id]?.rubric ?? [];
}

/** Client-side JSON export — no server round-trip, no fake "processing" delay. */
function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pillar for a question's competency, read from the framework rather than guessed
 *  from the id prefix (the old `startsWith("skkni") ? "skkni" : "ulrich"` test
 *  labelled every SFIA/Lominger/CGMA question as "Ulrich"). */
function pillarFor(id: string): string {
  return COMPETENCY_BY_ID[id]?.pillar ?? "ulrich";
}

const TECH_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "TB1", type: "Behavioral", competencyId: "sfia-collaboration", competencyName: "Technical Collaboration & Communication",
    question: "Ceritakan situasi di mana Anda harus men-debug masalah kritis di production bersama tim. Bagaimana Anda membagi tugas dan mengkomunikasikan progress?",
    strongAnswer: "Structured incident response (on-call runbook); clear ownership; post-mortem culture; measurable MTTR improvement.",
    redFlags: ["No structured process", "Blame shifting", "No post-mortem"],
    rubric: rubricFor("sfia-collaboration"),
  },
  {
    id: "TB2", type: "Behavioral", competencyId: "sfia-delivery-agility", competencyName: "Delivery & Agile Execution",
    question: "Berikan contoh fitur atau sistem yang Anda deliver dari awal hingga production. Apa trade-off teknikal terbesar yang Anda buat dan mengapa?",
    strongAnswer: "Clear scope, explicit trade-off reasoning (speed vs. correctness vs. cost), measurable outcome, learned lessons applied.",
    redFlags: ["No ownership taken", "Cannot articulate trade-offs", "No production metrics"],
    rubric: rubricFor("sfia-delivery-agility"),
  },
  {
    id: "TT1", type: "Technical", competencyId: "sfia-solution-architecture", competencyName: "Solution Architecture & Design",
    question: "Rancang sistem yang skalabel untuk menangani 1 juta request/hari. Jelaskan komponen utama, bottleneck potensial, dan strategi mitigasi.",
    strongAnswer: "Load balancer, caching layer, async queues, DB sharding/replication; identifies CAP trade-offs; concrete latency/throughput targets.",
    redFlags: ["Single-server solution only", "No caching consideration", "Cannot discuss failure modes"],
    rubric: rubricFor("sfia-solution-architecture"),
  },
  {
    id: "TT2", type: "Technical", competencyId: "sfia-security-quality", competencyName: "Security & Quality Mindset",
    question: "Bagaimana Anda memastikan kualitas kode di tim — strategi testing, code review, dan technical debt management?",
    strongAnswer: "Layered tests (unit/integration/e2e); meaningful PR review culture; measurable test coverage; tech-debt sprint allocation.",
    redFlags: ["No tests", "Superficial code review", "Tech debt ignored"],
    rubric: rubricFor("sfia-security-quality"),
  },
  {
    id: "TL1", type: "Leadership", competencyId: "sfia-technical-proficiency", competencyName: "Technical Proficiency",
    question: "Bagaimana Anda membimbing junior engineer untuk grow secara teknikal? Berikan contoh konkret mentorship yang memberikan dampak nyata.",
    strongAnswer: "Structured 1-1s; tailored growth plan; code review as teaching; measurable skill improvement in mentee.",
    redFlags: ["Delegates only without guidance", "No growth plan", "Cannot recall specific impact"],
    rubric: rubricFor("sfia-technical-proficiency"),
  },
  {
    id: "TL2", type: "Leadership", competencyId: "sfia-innovation", competencyName: "Innovation & Problem Solving",
    question: "Ceritakan saat Anda mengadvokasi perubahan arsitektur atau teknologi baru di organisasi. Bagaimana Anda membangun konsensus?",
    strongAnswer: "Data-backed proposal; addresses concerns; phased rollout plan; wins key stakeholders; documents decision.",
    redFlags: ["Top-down authority only", "No data", "Cannot handle pushback"],
    rubric: rubricFor("sfia-innovation"),
  },
  {
    id: "TC1", type: "Cultural Fit", competencyId: "sfia-learning-agility", competencyName: "Learning Agility & Tech Adaptability",
    question: "Teknologi berubah cepat — bagaimana Anda tetap up-to-date? Berikan contoh teknologi yang Anda pelajari sendiri dan berhasil diterapkan.",
    strongAnswer: "Structured learning habits; specific example with applied outcome; contributes knowledge back (blog/talk/PR).",
    redFlags: ["No self-learning", "Cannot cite recent examples", "Waits to be told what to learn"],
    rubric: rubricFor("sfia-learning-agility"),
  },
  {
    id: "TC2", type: "Cultural Fit", competencyId: "sfia-collaboration", competencyName: "Technical Collaboration & Communication",
    question: "Ceritakan pengalaman bekerja dengan Product atau Design untuk deliver fitur — friction apa yang muncul dan bagaimana Anda mengatasinya?",
    strongAnswer: "Proactive collaboration; early design review; translates tech constraints clearly; resolves friction via process improvement.",
    redFlags: ["Silo mentality", "Blames Product/Design", "No process improvement"],
    rubric: rubricFor("sfia-collaboration"),
  },
];

const BUSINESS_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "BB1", type: "Behavioral", competencyId: "lom-drive-results", competencyName: "Drive for Results",
    question: "Ceritakan pencapaian bisnis terbesar Anda dalam 2 tahun terakhir — metric apa yang digerakkan dan bagaimana kontribusi Anda?",
    strongAnswer: "Specific KPIs cited; clear personal contribution; overcame obstacles; outcome sustained.",
    redFlags: ["Vague outcome", "Team credit only", "No metrics"],
    rubric: rubricFor("lom-drive-results"),
  },
  {
    id: "BB2", type: "Behavioral", competencyId: "lom-manages-ambiguity", competencyName: "Manages Ambiguity & Complexity",
    question: "Berikan contoh saat strategi bisnis Anda harus berubah drastis karena perubahan pasar. Bagaimana Anda memimpin pivot tersebut?",
    strongAnswer: "Reads market signals early; clear pivot rationale; team alignment; measurable recovery/growth after pivot.",
    redFlags: ["Rigid to original plan", "Blames external factors", "No team management"],
    rubric: rubricFor("lom-manages-ambiguity"),
  },
  {
    id: "BT1", type: "Technical", competencyId: "lom-strategic-agility", competencyName: "Strategic Agility",
    question: "Bagaimana Anda menganalisis peluang bisnis baru? Walk-through framework yang biasanya Anda gunakan dengan contoh nyata.",
    strongAnswer: "Structured framework (market sizing, competitive, unit economics); hypothesis-driven; data sources cited; decision criteria clear.",
    redFlags: ["Gut-feel only", "No framework", "Cannot size market"],
    rubric: rubricFor("lom-strategic-agility"),
  },
  {
    id: "BT2", type: "Technical", competencyId: "lom-problem-solving", competencyName: "Problem Solving & Decision Quality",
    question: "Ceritakan keputusan bisnis penting yang Anda ambil berdasarkan data. Data apa yang Anda kumpulkan dan bagaimana Anda menginterpretasinya?",
    strongAnswer: "Specific data sources; statistical awareness; action taken from insight; result measured.",
    redFlags: ["Data not used", "Correlation vs causation confused", "No follow-up measurement"],
    rubric: rubricFor("lom-problem-solving"),
  },
  {
    id: "BL1", type: "Leadership", competencyId: "lom-communicates", competencyName: "Communicates Effectively",
    question: "Bagaimana Anda menyelaraskan tim Anda dengan tujuan strategis perusahaan? Berikan contoh cascading goals yang berhasil.",
    strongAnswer: "OKR/KPI cascade; regular alignment check-ins; autonomy within boundaries; team understands 'why'.",
    redFlags: ["Top-down diktat", "Team not aware of strategy", "No accountability mechanism"],
    rubric: rubricFor("lom-communicates"),
  },
  {
    id: "BL2", type: "Leadership", competencyId: "lom-interpersonal-savvy", competencyName: "Interpersonal Savvy & Influence",
    question: "Ceritakan situasi di mana Anda harus meyakinkan eksekutif senior untuk mendukung inisiatif Anda tanpa otoritas langsung.",
    strongAnswer: "Builds coalition; tailors message to audience; addresses objections; secures commitment; delivers on promise.",
    redFlags: ["Cannot influence up", "Gives up without pushback", "No follow-through"],
    rubric: rubricFor("lom-interpersonal-savvy"),
  },
  {
    id: "BC1", type: "Cultural Fit", competencyId: "lom-collaborates", competencyName: "Collaboration & Teamwork",
    question: "Nilai bisnis apa yang paling penting bagi Anda? Ceritakan situasi di mana nilai itu diuji dan bagaimana Anda meresponnya.",
    strongAnswer: "Authentic specific values; example under pressure; integrity maintained; learns from experience.",
    redFlags: ["Generic answer", "Values not tested", "Inconsistency detected"],
    rubric: rubricFor("lom-collaborates"),
  },
  {
    id: "BC2", type: "Cultural Fit", competencyId: "lom-learning-agility", competencyName: "Learning Agility",
    question: "Apa kegagalan terbesar Anda dalam karier bisnis dan apa yang Anda pelajari? Bagaimana Anda menerapkan pelajaran tersebut setelahnya?",
    strongAnswer: "Genuine self-reflection; specific failure; clear learnings; applied change measurable.",
    redFlags: ["Reframes failure as success", "Blames others", "No specific lesson applied"],
    rubric: rubricFor("lom-learning-agility"),
  },
];

const FINANCE_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "FB1", type: "Behavioral", competencyId: "cgma-ethics-compliance", competencyName: "Ethics, Governance & Compliance",
    question: "Ceritakan situasi di mana Anda menemukan ketidaksesuaian material dalam laporan keuangan. Langkah apa yang Anda ambil?",
    strongAnswer: "Follows escalation protocol; documents evidence; involves compliance/legal; resolves with proper trail.",
    redFlags: ["Suppresses findings", "No escalation", "Vague response"],
    rubric: rubricFor("cgma-ethics-compliance"),
  },
  {
    id: "FB2", type: "Behavioral", competencyId: "cgma-technical-accounting", competencyName: "Technical Accounting & Reporting",
    question: "Bagaimana Anda mengelola proses penutupan buku akhir kuartal saat ada tekanan waktu tinggi?",
    strongAnswer: "Clear close calendar; prioritized tasks; team coordination; reconciliation checklist; continuous improvement of close timeline.",
    redFlags: ["No structure", "Errors found post-close", "Cannot describe process"],
    rubric: rubricFor("cgma-technical-accounting"),
  },
  {
    id: "FT1", type: "Technical", competencyId: "cgma-financial-analysis", competencyName: "Financial Analysis & Planning",
    question: "Jelaskan bagaimana Anda membangun model keuangan untuk evaluasi investasi baru. Asumsi apa yang paling kritis?",
    strongAnswer: "DCF/IRR/NPV explained correctly; sensitivity analysis; key assumptions tested; decision criteria clear.",
    redFlags: ["Cannot build model", "No sensitivity analysis", "Single scenario only"],
    rubric: rubricFor("cgma-financial-analysis"),
  },
  {
    id: "FT2", type: "Technical", competencyId: "cgma-risk-control", competencyName: "Risk Management & Internal Control",
    question: "Bagaimana Anda mengidentifikasi dan memitigasi risiko keuangan dalam portofolio atau operasi bisnis?",
    strongAnswer: "Risk matrix; hedging strategies; monitoring KRIs; escalation triggers defined; documented process.",
    redFlags: ["Risk ignored", "Reactive only", "No documentation"],
    rubric: rubricFor("cgma-risk-control"),
  },
  {
    id: "FL1", type: "Leadership", competencyId: "cgma-stakeholder-influence", competencyName: "Stakeholder Influence & Presentation",
    question: "Bagaimana Anda membangun hubungan yang efektif dengan non-finance leaders untuk mendorong keputusan berbasis data keuangan?",
    strongAnswer: "Translates financial concepts; proactive insights not just reports; trusted advisor role; measurable impact.",
    redFlags: ["Finance-only perspective", "Cannot simplify for business", "Reactive reporting only"],
    rubric: rubricFor("cgma-stakeholder-influence"),
  },
  {
    id: "FL2", type: "Leadership", competencyId: "cgma-leadership", competencyName: "Leadership & People Development",
    question: "Ceritakan bagaimana Anda membangun kapabilitas tim finance — dari hiring hingga pengembangan kompetensi teknikal.",
    strongAnswer: "Competency framework; structured development plan; stretch assignments; retention strategy.",
    redFlags: ["No development plan", "High turnover team", "Technical skill not measured"],
    rubric: rubricFor("cgma-leadership"),
  },
  {
    id: "FC1", type: "Cultural Fit", competencyId: "cgma-business-acumen", competencyName: "Business Acumen & Commercial Awareness",
    question: "Bagaimana Anda memastikan tim tetap patuh terhadap regulasi keuangan yang berubah (PSAK, IFRS, pajak)?",
    strongAnswer: "Continuous monitoring; training program; external advisor network; embedded compliance culture.",
    redFlags: ["Reactive compliance only", "No training program", "External changes missed"],
    rubric: rubricFor("cgma-business-acumen"),
  },
  {
    id: "FC2", type: "Cultural Fit", competencyId: "cgma-digital-finance", competencyName: "Digital Finance & Data Analytics",
    question: "Berikan contoh bagaimana Anda menggunakan teknologi (ERP, BI tools, automation) untuk meningkatkan efisiensi fungsi finance.",
    strongAnswer: "Specific tools; quantified time/cost savings; adoption strategy; scalable implementation.",
    redFlags: ["Manual-only approach", "No technology adoption", "Cannot quantify improvement"],
    rubric: rubricFor("cgma-digital-finance"),
  },
];

const BROADCAST_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "BR1", type: "Behavioral", competencyId: "brd-studio-cam", competencyName: "Broadcast Studio & Camera Operation",
    question: "Ceritakan situasi saat Anda mengoperasikan kamera atau peralatan teknis dalam siaran langsung (live broadcast) dan mengalami kendala teknis tiba-tiba. Bagaimana Anda mengatasinya tanpa mengganggu tayangan?",
    strongAnswer: "Maintains composure under live pressure; communicates quickly with program director; switches to backup camera or framing smoothly.",
    redFlags: ["Panics during live broadcast", "Abandons camera position", "Blames equipment without attempting recovery"],
    rubric: rubricFor("brd-studio-cam"),
  },
  {
    id: "BR2", type: "Behavioral", competencyId: "brd-rundown-dir", competencyName: "Rundown & Program Directing",
    question: "Ceritakan pengalaman Anda ketika rundown acara TV yang sudah disiapkan harus berubah drastis saat siaran langsung karena adanya breaking news atau durasi narasumber yang molor.",
    strongAnswer: "Makes rapid timing adjustments; coordinates smoothly with anchor, MCR, and floor team; ensures zero air silence or clumsy transition.",
    redFlags: ["Freezes under schedule pressure", "Argues with producer during live show", "Fails to give clear visual cues"],
    rubric: rubricFor("brd-rundown-dir"),
  },
  {
    id: "BR3", type: "Technical", competencyId: "brd-video-edit", competencyName: "Video Editing & Post-Production",
    question: "Jelaskan alur kerja (workflow) Anda dalam mengedit paket berita atau promo televisi di bawah deadline ketat menjelang jadwal tayang (on-air).",
    strongAnswer: "Prioritizes rough cut and audio leveling first; uses NLE templates and shortcuts efficiently; ensures broadcast color/audio standards.",
    redFlags: ["Misses on-air deadline due to over-editing", "Poor audio balancing", "Does not follow station style guide"],
    rubric: rubricFor("brd-video-edit"),
  },
  {
    id: "BR4", type: "Technical", competencyId: "brd-mcr-trans", competencyName: "MCR & Transmission Control",
    question: "Bagaimana standar prosedur yang Anda terapkan di Master Control Room (MCR) untuk memastikan transisi siaran dan insersi iklan komersial berjalan tepat waktu tanpa jeda hitam (blackout)?",
    strongAnswer: "Checks playlist automation rigorously; verifies backup server readiness; monitors RF and audio levels continuously; reacts instantly to signal drops.",
    redFlags: ["Inattentive monitoring", "Causes commercial insertion errors", "Slow to switch backup feeds"],
    rubric: rubricFor("brd-mcr-trans"),
  },
  {
    id: "BR5", type: "Leadership", competencyId: "brd-audio-eng", competencyName: "Studio Audio Engineering",
    question: "Dalam penyiaran talkshow TV dengan banyak tamu di studio, bagaimana Anda memimpin tim audio atau mengatur frekuensi RF mic wireless agar terhindar dari feedback atau gangguan sinyal?",
    strongAnswer: "Performs thorough RF frequency scan before show; instructs floor team on proper mic placement; monitors mixing console levels actively.",
    redFlags: ["Tolerates audio feedback on air", "Poor communication with floor crew", "Lacks technical RF preparation"],
    rubric: rubricFor("brd-audio-eng"),
  },
  {
    id: "BR6", type: "Leadership", competencyId: "brd-lighting", competencyName: "Studio Lighting Directing",
    question: "Ceritakan pengalaman Anda memimpin penataan cahaya (lighting setup) untuk set studio baru atau program khusus. Bagaimana Anda menyeimbangkan kualitas visual dan efisiensi waktu penyiaran?",
    strongAnswer: "Plans lighting plot in advance; collaborates closely with set designer and cameraman; calibrates color temperature precisely; delegates tasks to lighting crew.",
    redFlags: ["Harsh shadows on anchor faces", "Slow setup delaying studio rehearsal", "Resists feedback from director"],
    rubric: rubricFor("brd-lighting"),
  },
  {
    id: "BR7", type: "Cultural Fit", competencyId: "brd-rundown-dir", competencyName: "Rundown & Program Directing",
    question: "Industri televisi menuntut kedisiplinan waktu yang mutlak (per hitungan detik). Bagaimana budaya kedisiplinan dan akurasi waktu ini mempengaruhi cara kerja Anda sehari-hari?",
    strongAnswer: "Values precise timekeeping; arrives early for briefings and rehearsals; integrates second-by-second timing into all professional habits.",
    redFlags: ["Casual attitude toward deadlines", "Habituated to tardiness", "Underestimates live television rigor"],
    rubric: rubricFor("brd-rundown-dir"),
  },
  {
    id: "BR8", type: "Cultural Fit", competencyId: "brd-studio-cam", competencyName: "Broadcast Studio & Camera Operation",
    question: "Pembuatan program televisi adalah kerja tim lintas kerabat kerja (kamera, audio, lighting, sutradara, produser). Ceritakan situasi ketika terjadi perbedaan pendapat teknis di studio dan bagaimana Anda menjaga keharmonisan tim.",
    strongAnswer: "Focuses on best show outcome; respects director's final call; communicates constructively without ego; maintains studio morale.",
    redFlags: ["Egotistical or disruptive in studio", "Blames other technical units", "Unwilling to collaborate"],
    rubric: rubricFor("brd-studio-cam"),
  },
];

const EDITORIAL_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "ED1", type: "Behavioral", competencyId: "edt-news-research", competencyName: "Investigative Journalism & News Research",
    question: "Ceritakan pengalaman Anda saat harus meliput isu sensitif atau investigatif dan menemui kendala akses informasi dari narasumber. Bagaimana strategi Anda mendapatkan fakta yang akurat?",
    strongAnswer: "Uses multi-source verification (triangulation); builds ethical rapport with contacts; protects confidential sources; persists through official/unofficial channels.",
    redFlags: ["Relies on single unverified source", "Breaches journalistic ethics or law", "Gives up easily on difficult research"],
    rubric: rubricFor("edt-news-research"),
  },
  {
    id: "ED2", type: "Behavioral", competencyId: "edt-fact-checking", competencyName: "Fact-Checking & Journalistic Ethics",
    question: "Ceritakan situasi ketika Anda menemukan informasi yang sangat menarik untuk menjadi headline atau breaking news, tetapi Anda meragukan kebenarannya. Apa tindakan Anda?",
    strongAnswer: "Prioritizes truth over speed; conducts thorough fact-checking before publishing; consults editorial standard/legal if defamation risk exists.",
    redFlags: ["Publishes rumor for sensation/clickbait", "Ignores verification protocols", "Blames social media if information is false"],
    rubric: rubricFor("edt-fact-checking"),
  },
  {
    id: "ED3", type: "Technical", competencyId: "edt-scriptwriting", competencyName: "News Scriptwriting & Copyediting",
    question: "Jelaskan bagaimana Anda merancang struktur naskah berita televisi (voice-over/soundbite/stand-up) agar narasi ringkas, lugas, dan sinkron dengan gambar visual (natural sound).",
    strongAnswer: "Writes conversational active-voice script; matches visual cues (lead-in to SOT); avoids redundant description of what is already visible; paces audio flow.",
    redFlags: ["Long, bureaucratic sentences", "Script disconnected from video visuals", "Ignores natural sound/audio context"],
    rubric: rubricFor("edt-scriptwriting"),
  },
  {
    id: "ED4", type: "Technical", competencyId: "edt-talkshow-host", competencyName: "Live Interviewing & Talkshow Hosting",
    question: "Bagaimana teknik wawancara Anda (di studio atau lapangan) ketika menghadapi narasumber yang evasive (menghindar menjawab pokok pertanyaan) pada isu publik yang kritis?",
    strongAnswer: "Maintains professional composure; rephrases question sharply and persistently; uses data/facts to challenge evasive answers; controls interview pacing.",
    redFlags: ["Rude or emotionally confrontational", "Lets interviewee take over the broadcast", "Fails to ask follow-up questions"],
    rubric: rubricFor("edt-talkshow-host"),
  },
  {
    id: "ED5", type: "Leadership", competencyId: "edt-field-report", competencyName: "Field Reporting & Breaking News",
    question: "Sebagai koordinator liputan atau redaktur, bagaimana Anda menugaskan dan mengarahkan reporter lapangan saat terjadi peristiwa luar biasa (bencana/kerusuhan) agar tetap aman namun liputan maksimal?",
    strongAnswer: "Prioritizes reporter safety; establishes clear check-in protocols and evacuation routes; assigns coverage angles efficiently; coordinates live feeds.",
    redFlags: ["Forces reporter into fatal hazard without PPE/support", "Poor communication with field team", "Lacks crisis coverage strategy"],
    rubric: rubricFor("edt-field-report"),
  },
  {
    id: "ED6", type: "Leadership", competencyId: "edt-fact-checking", competencyName: "Fact-Checking & Journalistic Ethics",
    question: "Bagaimana Anda membimbing jurnalis junior di ruang redaksi untuk menghindari plagiarisme dan menjaga standar etika jurnalistik sesuai UU Pers dan Kode Etik?",
    strongAnswer: "Enforces strict attribution rules; reviews source material regularly; explains legal risks of libel/slander; fosters culture of integrity.",
    redFlags: ["Tolerates copy-paste journalism", "Unfamiliar with journalistic code of ethics", "Ignores junior staff mistakes"],
    rubric: rubricFor("edt-fact-checking"),
  },
  {
    id: "ED7", type: "Cultural Fit", competencyId: "edt-fact-checking", competencyName: "Fact-Checking & Journalistic Ethics",
    question: "Dalam industri media, independensi dan integritas adalah segalanya. Bagaimana Anda bersikap apabila ada pihak eksternal yang mencoba mengintervensi atau menyuap agar berita tertentu ditiadakan/diubah?",
    strongAnswer: "Refuses bribery or undue influence categorically; reports intervention attempt to chief editor/legal; stands firm on editorial independence.",
    redFlags: ["Accepts gifts/bribes from sources", "Willing to compromise news integrity for favor", "Lacks ethical boundary awareness"],
    rubric: rubricFor("edt-fact-checking"),
  },
  {
    id: "ED8", type: "Cultural Fit", competencyId: "edt-scriptwriting", competencyName: "News Scriptwriting & Copyediting",
    question: "Dunia redaksi berita bekerja dalam ritme deadline 24/7 yang sangat cepat dan terkadang penuh tekanan mental. Bagaimana Anda menjaga performa dan objektivitas di bawah ritme ini?",
    strongAnswer: "Manages time and stress effectively; maintains emotional balance; separates personal bias from objective reporting; supports newsroom colleagues.",
    redFlags: ["Burnout leading to careless errors", "Injects personal emotion/opinion into hard news", "Unreliable during breaking news cycles"],
    rubric: rubricFor("edt-scriptwriting"),
  },
];

const SECURITY_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "SC1", type: "Behavioral", competencyId: "sec-conflict-management", competencyName: "Conflict De-escalation & Crowd Control",
    question: "Ceritakan pengalaman Anda saat harus menenangkan (de-eskalasi) konflik fisik atau adu mulut antar pengunjung atau staf di area studio/kantor televisi. Bagaimana Anda menyelesaikannya tanpa kekerasan?",
    strongAnswer: "Stays calm; separates involved parties; uses assertive but non-aggressive body language; listens actively; calls for backup if needed.",
    redFlags: ["Uses unnecessary force", "Panics or escalates situation", "Takes sides prematurely"],
    rubric: rubricFor("sec-conflict-management"),
  },
  {
    id: "SC2", type: "Behavioral", competencyId: "sec-access-control", competencyName: "Access Control & Guarding",
    question: "Pernahkah Anda menghadapi situasi di mana seseorang (bisa jadi tamu VIP atau atasan) mencoba masuk area terbatas tanpa izin/ID yang sesuai? Bagaimana Anda menanganinya?",
    strongAnswer: "Remains polite but firm; explains SOP clearly; offers to contact authorized personnel for escort/approval; does not bend rules for status.",
    redFlags: ["Intimidated easily by VIPs", "Rude or confrontational", "Lets unauthorized people in to avoid conflict"],
    rubric: rubricFor("sec-access-control"),
  },
  {
    id: "SC3", type: "Situational", competencyId: "sec-emergency-response", competencyName: "Emergency Response & Crime Scene Preservation",
    question: "Jelaskan prosedur TPTKP (Tindakan Pertama Tempat Kejadian Perkara) yang harus Anda lakukan jika terjadi pencurian aset di area studio atau kantor siaran sebelum polisi tiba.",
    strongAnswer: "Secures the perimeter (police line/barricade); prevents anyone from entering; documents initial observations; preserves evidence untouched; reports to superiors.",
    redFlags: ["Touches or moves evidence", "Allows crowds to gather at scene", "Fails to secure the area"],
    rubric: rubricFor("sec-emergency-response"),
  },
  {
    id: "SC4", type: "Technical", competencyId: "sec-patrol", competencyName: "Patrol & Perimeter Surveillance",
    question: "Bagaimana prosedur patroli yang benar di area titik rawan seperti ruang server MCR dan studio penyiaran pada saat shift malam?",
    strongAnswer: "Varies patrol routes/times; checks locks, lighting, and blind spots; uses guard tour system/checkpoints; maintains situational awareness; reports anomalies immediately.",
    redFlags: ["Predictable patrol routes", "Ignores dark spots", "Sleeps on duty or falsifies patrol logs"],
    rubric: rubricFor("sec-patrol"),
  },
  {
    id: "SC5", type: "Leadership", competencyId: "sec-reporting", competencyName: "Incident Reporting & Documentation",
    question: "Bagaimana cara Anda membimbing anggota regu pengamanan (satpam) untuk membuat laporan kejadian (incident reporting) secara kronologis, lengkap, dan obyektif?",
    strongAnswer: "Teaches the 5W1H method (Who, What, When, Where, Why, How); emphasizes factual over emotional language; reviews and provides constructive feedback on reports.",
    redFlags: ["Writes reports based on assumptions", "Cannot articulate 5W1H", "Does not review subordinates' logs"],
    rubric: rubricFor("sec-reporting"),
  },
  {
    id: "SC6", type: "Leadership", competencyId: "sec-legal-compliance", competencyName: "Regulatory Compliance & Security Ethics",
    question: "Ceritakan inisiatif Anda dalam mensosialisasikan aturan perusahaan atau kepatuhan hukum kepada kru studio dan karyawan kantor agar pelanggaran keamanan dapat dicegah.",
    strongAnswer: "Conducts friendly briefings during shift changes; uses clear signage; builds rapport with workers to encourage voluntary compliance; acts as a role model.",
    redFlags: ["Relies solely on punishment", "Fails to communicate rules clearly", "Shows favoritism in enforcement"],
    rubric: rubricFor("sec-legal-compliance"),
  },
  {
    id: "SC7", type: "Cultural Fit", competencyId: "sec-physical-readiness", competencyName: "Physical Readiness & Mental Alertness",
    question: "Kesiapsiagaan fisik dan mental sangat penting. Bagaimana Anda menjaga rutinitas disiplin diri dan kesigapan tim Anda di tengah jadwal shift yang panjang?",
    strongAnswer: "Maintains fitness routine; manages rest off-duty; encourages alertness checks; leads stretching or brief exercises during roll call.",
    redFlags: ["Appears fatigued or unfit", "Complains excessively about shift work", "Lacks discipline in uniform/appearance"],
    rubric: rubricFor("sec-physical-readiness"),
  },
  {
    id: "SC8", type: "Cultural Fit", competencyId: "sec-access-control", competencyName: "Access Control & Guarding",
    question: "Bagaimana Anda membangun hubungan baik dengan warga sekitar lingkungan studio dan karyawan, namun tetap tegas dalam menegakkan aturan akses keluar-masuk (access control)?",
    strongAnswer: "Uses \"Senyum, Sapa, Salam\"; separates personal relationships from professional duties; handles rejections gracefully; builds community trust.",
    redFlags: ["Overly aggressive with locals", "Bribable or easily compromised by friends", "Lacks interpersonal skills"],
    rubric: rubricFor("sec-access-control"),
  },
];

function buildMockQuestions(
  position: string,
  seniority: Seniority,
  types: InterviewType[],
  department: string,
): InterviewQuestion[] {
  const cluster = detectCluster(position, department);

  let pool: InterviewQuestion[];
  if (cluster === "tech") pool = TECH_QUESTION_POOL;
  else if (cluster === "business") pool = BUSINESS_QUESTION_POOL;
  else if (cluster === "finance") pool = FINANCE_QUESTION_POOL;
  else if (cluster === "broadcast") pool = BROADCAST_QUESTION_POOL;
  else if (cluster === "editorial") pool = EDITORIAL_QUESTION_POOL;
  else if (cluster === "security") pool = SECURITY_QUESTION_POOL;
  else pool = HR_QUESTION_POOL;

  // Inject position/seniority into question text
  return pool
    .filter((q) => types.includes(q.type))
    .map((q) => ({
      ...q,
      question: q.question
        .replace(/\{position\}/g, position)
        .replace(/\{seniority\}/g, seniority),
    }));
}

const HR_QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "B1", type: "Behavioral", competencyId: "ulrich-credible-activist", competencyName: "Credible Activist",
    question: "Ceritakan situasi di mana Anda membela keputusan berbasis data terhadap manajemen senior terkait posisi HR. Apa hasilnya?",
    strongAnswer: "STAR format; ethical framing; measurable influence on decision; maintains relationships.",
    redFlags: ["Avoids conflict", "No data cited", "Damages trust with stakeholders"],
    rubric: rubricFor("ulrich-credible-activist"),
  },
  {
    id: "B2", type: "Behavioral", competencyId: "skkni-hubungan-industrial", competencyName: "Hubungan Industrial",
    question: "Bagaimana Anda menangani situasi ketenagakerjaan sensitif (mis. PK/Bipartit atau kepatuhan UU Ketenagakerjaan)?",
    strongAnswer: "References Indonesian labor law basics; mediation steps; documentation; escalation path.",
    redFlags: ["Unaware of PK/Bipartit", "Reactive only", "Non-compliance risk"],
    rubric: rubricFor("skkni-hubungan-industrial"),
  },
  {
    id: "T1", type: "Technical", competencyId: "ulrich-technology-proponent", competencyName: "Technology Proponent",
    question: "Bagaimana Anda menggunakan people analytics untuk keputusan SDM?",
    strongAnswer: "Specific metrics, dashboards, decision changed by data; validity-aware (work sample r ≈ 0.54).",
    redFlags: ["No metrics", "Manual-only HR", "Cannot explain analytics logic"],
    rubric: rubricFor("ulrich-technology-proponent"),
  },
  {
    id: "T2", type: "Technical", competencyId: "skkni-rekrutmen", competencyName: "Rekrutmen & Seleksi",
    question: "Jelaskan proses seleksi terstruktur yang pernah Anda desain — kriteria kompetensi, rubrik, dan validitas prediktif.",
    strongAnswer: "Structured interview guide; competency rubrics; avoids unstructured bias (r ≈ 0.38).",
    redFlags: ["Ad-hoc interviews only", "No scoring rubric", "Discrimination risk"],
    rubric: rubricFor("skkni-rekrutmen"),
  },
  {
    id: "L1", type: "Leadership", competencyId: "ulrich-strategic-positioner", competencyName: "Strategic Positioner",
    question: "Bagaimana Anda menyelaraskan rencana SDM dengan strategi bisnis organisasi?",
    strongAnswer: "Workforce plan linked to KPIs; scenario planning; executive alignment.",
    redFlags: ["HR siloed from strategy", "No KPI link", "Cannot articulate business case"],
    rubric: rubricFor("ulrich-strategic-positioner"),
  },
  {
    id: "L2", type: "Leadership", competencyId: "skkni-kinerja", competencyName: "Manajemen Kinerja",
    question: "Berikan contoh siklus manajemen kinerja yang Anda pimpin — KPI, feedback, dan tindak lanjut.",
    strongAnswer: "Full cycle documented; coaching for low performers; reward linkage fair.",
    redFlags: ["Paper exercise only", "No follow-up coaching", "Unfair ratings"],
    rubric: rubricFor("skkni-kinerja"),
  },
  {
    id: "C1", type: "Cultural Fit", competencyId: "ulrich-credible-activist", competencyName: "Credible Activist",
    question: "Nilai keselarasan nilai Anda dengan budaya perusahaan kami — apa potensi gesekan dan mitigasinya?",
    strongAnswer: "Honest self-assessment; examples; asks about norms; credible activist tone.",
    redFlags: ["Generic answer", "Blames past employers", "Misaligned values"],
    rubric: rubricFor("ulrich-credible-activist"),
  },
  {
    id: "C2", type: "Cultural Fit", competencyId: "skkni-perencanaan", competencyName: "Perencanaan SDM",
    question: "Mengapa tertarik posisi ini sekarang — rencana 90 hari pertama Anda?",
    strongAnswer: "SKKNI-aligned workforce planning hooks; 30/60/90 with learning goals.",
    redFlags: ["Title/comp only motivation", "No research", "Unrealistic plan"],
    rubric: rubricFor("skkni-perencanaan"),
  },
];

function buildInterviewerNotes(
  position: string,
  seniority: Seniority,
  types: InterviewType[],
  department: string,
  questions: InterviewQuestion[],
): string[] {
  const cluster = detectCluster(position, department);
  const frameworkLabel = CLUSTER_FRAMEWORKS[cluster].label;

  // Competencies actually covered by the generated questions. INTERVIEW_TYPE_MAP
  // is HR-only, so using it here told a finance interviewer to score against
  // "skkni-hubungan-industrial" — a competency that appears nowhere on their kit.
  const covered = [...new Set(questions.map((q) => q.competencyName))];

  return [
    // Angka validitas disamakan dengan modul asesmen: estimasi lama Schmidt &
    // Hunter (1998) direvisi Sackett dkk. (2022), dan sejak revisi itu wawancara
    // TERSTRUKTUR-lah prediktor tunggal terkuat, bukan tes kognitif. Menyebut
    // angka berbeda di dua tempat pada aplikasi yang sama merusak kepercayaan
    // pada keduanya.
    "Ajukan pertanyaan yang sama untuk semua kandidat pada posisi ini. Wawancara terstruktur adalah prediktor kinerja tunggal terkuat (Sackett dkk., 2022: r ≈ .42) — jauh di atas wawancara bebas tanpa panduan.",
    `Kalibrasikan ke standar level ${seniority} memakai rubrik kompetensi ${frameworkLabel}.`,
    `Alokasikan sekitar ${Math.max(45, types.length * 15)} menit untuk: ${types.map((t) => TYPE_LABELS[t]).join(", ")}.`,
    `Kompetensi yang dinilai: ${covered.join(", ")}.`,
    `Untuk posisi ${position}, lengkapi dengan uji kerja bila memungkinkan — contoh kerja nyata lebih mendekati pekerjaan sehari-hari daripada pertanyaan apa pun.`,
    "Catat kutipan langsung untuk setiap nilai 4 ke atas dan setiap temuan yang mengkhawatirkan. Nilai tanpa catatan tidak bisa dipertanggungjawabkan saat debrief.",
    "Nilai segera setelah kandidat menjawab, jangan menunggu wawancara selesai — ingatan atas jawaban awal memudar dan cenderung tertarik mengikuti kesan akhir.",
  ];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Interview features
═══════════════════════════════════════════════════════════════════════════ */

function CvContextCard({ data }: { data: CvPrefill }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-indigo-200 bg-indigo-50/60 px-5 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400">
            <SvgPath name="sparkles" />
          </Icon>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pertanyaan dari CV Analysis — Gap-Based (STAR)
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Auto-generated dari gap kompetensi {data.candidateName} · {data.position}
        </p>
      </div>
      <div className="divide-y divide-slate-100 px-5 dark:divide-slate-800">
        {data.questions.map((q) => (
          <div key={q.id} className="flex gap-3 py-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {q.id}
            </div>
            <div>
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {q.category}
              </span>
              <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white">{q.question}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Rationale:</span> {q.rationale}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuestionCard({ q, index }: { q: InterviewQuestion; index: number }) {
  const style = TYPE_STYLES[q.type];
  return (
    <article
      className={cn(
        "rounded-xl border bg-white dark:bg-slate-900",
        style.border,
      )}
    >
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {index}
          </span>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
              style.chip,
            )}
          >
            {TYPE_LABELS[q.type]}
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {q.competencyName}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
          {q.question}
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Icon className="h-4 w-4">
              <SvgPath name="check" />
            </Icon>
            Strong answer looks like
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{q.strongAnswer}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <Icon className="h-4 w-4">
              <SvgPath name="flag" />
            </Icon>
            Red flags to watch for
          </div>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
            {q.redFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Research-based rubric (1-5)
            </span>
            <FrameworkPillarBadge pillar={pillarFor(q.competencyId)} />
          </div>
          <RubricTable rubric={q.rubric} compact />
        </div>
      </div>
    </article>
  );
}

/* --- Live Scoring --- */

/** Menjembatani bentuk skor di layar ke bentuk yang dipahami mesin penilaian.
 *  Satu-satunya tempat pemetaan ini terjadi, supaya layar skoring, hasil, dan
 *  debrief tidak pernah menghitung dengan cara yang berbeda-beda. */
function toScoredQuestions(pack: QuestionPack, scores: Record<string, QuestionScore>): ScoredQuestion[] {
  return pack.questions.map((q) => ({
    questionId: q.id,
    competencyId: q.competencyId,
    competencyName: q.competencyName,
    type: q.type,
    rating: scores[q.id]?.rating ?? null,
    notAsked: scores[q.id]?.notAsked ?? false,
    notes: scores[q.id]?.notes ?? "",
  }));
}

/* Label skala kini berasal dari mesin penilaian bersama (lib/recruiting).
   Definisi lama di sini memakai "No evidence" pada angka 1, yang mencampur
   ketiadaan bukti ke dalam skala performa. */

function ScoringPanel({
  pack,
  candidateName,
  scores,
  onScoreChange,
  onNotAskedChange,
  elapsedSeconds,
  onComplete,
}: {
  pack: QuestionPack;
  candidateName: string;
  scores: Record<string, QuestionScore>;
  onScoreChange: (id: string, rating: 1|2|3|4|5|null, notes: string) => void;
  onNotAskedChange: (id: string, notAsked: boolean) => void;
  elapsedSeconds: number;
  onComplete: () => void;
}) {
  // Cakupan dan rata-rata dihitung mesin bersama, supaya angka di layar ini
  // persis sama dengan angka yang tersimpan di hasil dan laporan.
  const outcome = computeInterviewOutcome(toScoredQuestions(pack, scores), pack.criticalCompetencyIds);
  const rated = outcome.coverage.rated;
  const avgRating = outcome.average ?? 0;

  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-20 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/95 px-5 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/30 dark:bg-slate-900/95">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Penilaian Langsung — {candidateName || "Candidate"} · {pack.position}
          </p>
          <p className="text-xs text-slate-500">
            {rated} dari {outcome.coverage.planned} pertanyaan dinilai
            {outcome.coverage.notAsked > 0 && ` · ${outcome.coverage.notAsked} tidak ditanya`}
            {" · "}rata-rata {avgRating > 0 ? avgRating.toFixed(1) : "—"}/5
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <Icon className="h-4 w-4 text-slate-400"><SvgPath name="clock" /></Icon>
            <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">{mm}:{ss}</span>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={onComplete}
            disabled={rated === 0}
          >
            <Icon className="h-4 w-4"><SvgPath name="check" /></Icon>
            Complete
          </Button>
        </div>
      </div>

      {pack.questions.map((q, idx) => {
        const score = scores[q.id] ?? { rating: null, notAsked: false, notes: "" };
        const style = TYPE_STYLES[q.type];
        return (
          <div key={q.id} className={cn("rounded-xl border bg-white dark:bg-slate-900", style.border)}>
            <div className={cn("rounded-t-xl border-b px-5 py-3", style.header)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{idx + 1}</span>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset", style.chip)}>{TYPE_LABELS[q.type]}</span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{q.competencyName}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {FORMAT_LABELS[deriveQuestionFormat(q.type, q.question)]}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{q.question}</p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nilai performa (1-5)</p>
                  <button
                    type="button"
                    onClick={() => onNotAskedChange(q.id, !score.notAsked)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      score.notAsked
                        ? "border-slate-400 bg-slate-200 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                    )}
                  >
                    {score.notAsked ? "✓ Tidak ditanya" : "Tandai tidak ditanya"}
                  </button>
                </div>
                <div className={cn("flex flex-wrap gap-2", score.notAsked && "pointer-events-none opacity-40")}>
                  {([1, 2, 3, 4, 5] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      title={RATING_HELP[r]}
                      onClick={() => onScoreChange(q.id, score.rating === r ? null : r, score.notes)}
                      className={cn(
                        "flex flex-col items-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        score.rating === r
                          ? r >= 4 ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : r === 3 ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                      )}
                    >
                      <span className="text-base font-bold">{r}</span>
                      <span className="mt-0.5 text-[9px] leading-tight text-center w-14">{RATING_LABELS[r]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Catatan / kutipan langsung
                </label>
                <textarea
                  value={score.notes}
                  onChange={(e) => onScoreChange(q.id, score.rating, e.target.value)}
                  placeholder="Tulis kata-kata persis kandidat atau pengamatan penting..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoringResultsPanel({
  pack,
  candidateName,
  scores,
  elapsedSeconds,
  onBack,
}: {
  pack: QuestionPack;
  candidateName: string;
  scores: Record<string, QuestionScore>;
  elapsedSeconds: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const outcome = computeInterviewOutcome(toScoredQuestions(pack, scores), pack.criticalCompetencyIds);
  const avgRating = outcome.average ?? 0;

  // Penilaian pewawancara LAIN pada kit yang sama, untuk debrief panel.
  // Dibaca dari kandidat tersimpan agar tidak bergantung pada sesi tab ini.
  const panel = useMemo(() => {
    if (!candidateName) return null;
    const candidate = findCandidateByName(candidateName, pack.position);
    if (!candidate) return null;
    const raters = candidate.interviewResults
      .filter((r) => r.kitId === pack.packId && Array.isArray(r.questionScores))
      .map((r) => ({
        interviewer: r.interviewerName ?? r.interviewer ?? "Tanpa nama",
        completedAt: r.completedAt,
        scores: (r.questionScores ?? []).map((qs) => ({
          questionId: qs.questionId,
          competencyId: qs.competencyId,
          competencyName: qs.competencyName,
          type: qs.type,
          rating: (qs.rating as 1|2|3|4|5|null) ?? null,
          notAsked: qs.notAsked ?? false,
          notes: qs.notes,
        })),
      }));
    if (raters.length < 2) return null; // debrief baru berarti bila ada pembanding
    return aggregatePanel(raters, pack.criticalCompetencyIds);
  }, [candidateName, pack]);

  const byType = INTERVIEW_TYPES.map(type => {
    const qs = pack.questions.filter(q => q.type === type && scores[q.id]?.rating != null);
    if (qs.length === 0) return null;
    const avg = qs.reduce((s, q) => s + (scores[q.id]?.rating ?? 0), 0) / qs.length;
    return { type, avg, count: qs.length };
  }).filter(Boolean) as { type: InterviewType; avg: number; count: number }[];

  const recommendation = VERDICT_LABELS[outcome.verdict];

  const recStyles: Record<Verdict, { card: string; badge: string }> = {
    sangat_direkomendasikan: { card: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10", badge: "bg-emerald-600 text-white" },
    direkomendasikan: { card: "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10", badge: "bg-blue-600 text-white" },
    perlu_pertimbangan: { card: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10", badge: "bg-amber-600 text-white" },
    tidak_direkomendasikan: { card: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10", badge: "bg-red-600 text-white" },
    data_belum_cukup: { card: "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50", badge: "bg-slate-600 text-white" },
  };

  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className="space-y-6">
      <div className={cn("rounded-xl border p-5", recStyles[outcome.verdict].card)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white", recStyles[outcome.verdict].badge)}>
              {avgRating.toFixed(1)}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hasil Wawancara</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">{recommendation}</p>
              <p className="text-sm text-slate-500">{candidateName || "Candidate"} · {pack.position} · {pack.seniority}</p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{outcome.coverage.rated}/{outcome.coverage.planned}</p>
              <p className="text-xs text-slate-500">Dinilai</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{mm}:{ss}</p>
              <p className="text-xs text-slate-500">Durasi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dasar kesimpulan — ditulis apa adanya supaya pewawancara tahu mengapa
          sistem menyimpulkan begitu, bukan sekadar menerima labelnya. */}
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Dasar kesimpulan</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{outcome.reason}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Cakupan</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{outcome.coverage.coveragePct}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Tidak ditanya</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{outcome.coverage.notAsked}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Terlewat</p>
            <p className={cn("mt-0.5 text-sm font-semibold", outcome.coverage.missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>
              {outcome.coverage.missing}
            </p>
          </div>
        </div>

        {outcome.criticalGaps.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Kompetensi wajib belum terpenuhi</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
              {outcome.criticalGaps.map((g) => (
                <li key={g.competencyId}><span className="font-medium">{g.competencyName}</span> — {g.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Debrief panel — hanya muncul bila ada pembanding */}
      {panel && (
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Debrief Panel — {panel.raterCount} pewawancara
          </p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{panel.reason}</p>

          <div className="mt-3 space-y-1.5">
            {panel.perRater.map((r) => (
              <div key={r.interviewer} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-900 dark:text-white">{r.interviewer}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {r.average === null ? "belum menilai" : `${r.average.toFixed(1)}/5`} · cakupan {r.coverage.coveragePct}% · {VERDICT_LABELS[r.verdict]}
                </span>
              </div>
            ))}
          </div>

          {panel.disagreements.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Perlu dibahas — penilaian berbeda tajam
              </p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                Rata-rata gabungan justru menyembunyikan perbedaan ini. Bahas bukti yang didengar masing-masing sebelum memutuskan.
              </p>
              <ul className="mt-2 space-y-1.5">
                {panel.disagreements.map((d) => (
                  <li key={d.competencyId} className="text-sm text-amber-900 dark:text-amber-200">
                    <span className="font-medium">{d.competencyName}</span> (selisih {d.spread}) — {d.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {byType.map(({ type, avg, count }) => {
          const style = TYPE_STYLES[type];
          const bar = Math.round((avg / 5) * 100);
          return (
            <div key={type} className={cn("rounded-xl border p-4", style.header)}>
              <div className="flex items-center justify-between">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset", style.chip)}>{TYPE_LABELS[type]}</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{avg.toFixed(1)}/5</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={cn("h-full rounded-full transition-all", avg >= 4 ? "bg-emerald-500" : avg >= 3 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${bar}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{count} question{count !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rincian Penilaian</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pack.questions.map((q, idx) => {
            const score = scores[q.id];
            const rating = score?.rating ?? null;
            const style = TYPE_STYLES[q.type];
            return (
              <div key={q.id} className="flex gap-4 px-5 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700 dark:text-slate-300">{q.question}</p>
                  {score?.notes && <p className="mt-0.5 text-xs italic text-slate-400">&ldquo;{score.notes}&rdquo;</p>}
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", style.chip)}>{q.type.slice(0, 3)}</span>
                  {rating != null ? (
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white",
                      rating >= 4 ? "bg-emerald-500" : rating === 3 ? "bg-blue-500" : "bg-amber-500"
                    )}>{rating}</span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-400 dark:bg-slate-700">&mdash;</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="secondary" size="md" onClick={onBack}>
          <Icon className="h-4 w-4"><SvgPath name="chevronLeft" /></Icon>
          Back to Kit
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => downloadJSON(`interview-result-${candidateName.replace(/\s+/g, "-").toLowerCase()}-${pack.packId}.json`, {
              candidateName,
              position: pack.position,
              avgRating,
              recommendation,
              durationSec: elapsedSeconds,
              byType,
              answers: pack.questions.map((q) => ({ question: q.question, type: q.type, rating: scores[q.id]?.rating ?? null, notes: scores[q.id]?.notes ?? "" })),
            })}
          >
            <Icon className="h-4 w-4"><SvgPath name="download" /></Icon>
            Export Results
          </Button>
          <Button variant="primary" size="md" onClick={() => router.push("/report")}>
            <Icon className="h-4 w-4"><SvgPath name="document" /></Icon>
            View Hiring Report
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pengelola isi kit: menyaring pertanyaan bawaan dan menambah pertanyaan khas
 *  perusahaan. Bank soal bawaan berlaku umum untuk sebuah klaster jabatan; yang
 *  tidak bisa disediakan bawaan adalah pertanyaan yang lahir dari pengalaman
 *  perusahaan itu sendiri — kejadian yang pernah bikin repot, mesin yang cuma
 *  ada di pabrik mereka, aturan internal yang sering dilanggar. */
function QuestionManagerCard({
  pack,
  excludedIds,
  onToggleExclude,
  onAddCustom,
  saving,
}: {
  pack: QuestionPack;
  excludedIds: string[];
  onToggleExclude: (id: string) => void;
  onAddCustom: (draft: CustomQuestionDraft) => Promise<void>;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [draft, setDraft] = useState<CustomQuestionDraft>({
    competencyId: "",
    competencyName: "",
    type: "Behavioral",
    question: "",
    strongAnswer: "",
    redFlags: [],
  });

  const competencies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of pack.questions) if (!seen.has(q.competencyId)) seen.set(q.competencyId, q.competencyName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [pack.questions]);

  const summary = useMemo(
    () =>
      summarizeSelection(
        pack.questions.map((q): BankQuestion => ({
          id: q.id,
          type: q.type,
          competencyId: q.competencyId,
          competencyName: q.competencyName,
          question: q.question,
          strongAnswer: q.strongAnswer,
          redFlags: q.redFlags,
          source: q.id.startsWith("CQ-") ? "custom" : "builtin",
        })),
        excludedIds,
      ),
    [pack.questions, excludedIds],
  );

  const submit = async () => {
    const withComp: CustomQuestionDraft = {
      ...draft,
      competencyName: competencies.find((c) => c.id === draft.competencyId)?.name ?? draft.competencyName,
    };
    const found = validateCustomQuestion(withComp);
    setProblems(found);
    if (found.length > 0) return;
    await onAddCustom(withComp);
    setDraft({ competencyId: "", competencyName: "", type: "Behavioral", question: "", strongAnswer: "", redFlags: [] });
    setAdding(false);
  };

  const fieldCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Isi Kit</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {summary.included} pertanyaan dipakai
            {summary.excluded > 0 ? ` · ${summary.excluded} dikeluarkan` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Tutup daftar" : "Pilih pertanyaan"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)}>
            + Pertanyaan perusahaan
          </Button>
        </div>
      </div>

      {summary.droppedCompetencies.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <span className="font-semibold">{summary.droppedCompetencies.map((c) => c.competencyName).join(", ")}</span>{" "}
            tidak lagi punya satu pun pertanyaan — kompetensi itu menjadi tidak terukur sama sekali.
          </p>
        </div>
      )}

      {isKitTooThin(summary) && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-800 dark:text-red-200">
            Hanya {summary.included} pertanyaan tersisa. Penilaian dari sebegini sedikit bukti mudah berayun oleh satu
            jawaban saja.
          </p>
        </div>
      )}

      {adding && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Tambah pertanyaan perusahaan</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tersimpan dan otomatis muncul pada kit berikutnya untuk klaster jabatan yang sama.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Kompetensi yang dinilai
              </label>
              <select
                value={draft.competencyId}
                onChange={(e) => setDraft({ ...draft, competencyId: e.target.value })}
                className={fieldCls}
              >
                <option value="">— pilih —</option>
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Jenis pertanyaan</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className={fieldCls}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Pertanyaan</label>
            <textarea
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              rows={2}
              placeholder="mis. Ceritakan saat Anda menemukan cacat jahitan setelah barang siap kirim. Apa yang Anda lakukan?"
              className={cn(fieldCls, "resize-y")}
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Ciri jawaban kuat{" "}
              <span className="font-normal text-slate-400">(patokan yang sama untuk semua pewawancara)</span>
            </label>
            <textarea
              value={draft.strongAnswer}
              onChange={(e) => setDraft({ ...draft, strongAnswer: e.target.value })}
              rows={2}
              placeholder="mis. Menyebut tindakan konkret, siapa yang diberi tahu, dan bagaimana pengiriman diselamatkan."
              className={cn(fieldCls, "resize-y")}
            />
          </div>

          {problems.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 pl-8 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={submit} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan & tambahkan ke kit"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAdding(false);
                setProblems([]);
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-1.5">
          {pack.questions.map((q) => {
            const excluded = excludedIds.includes(q.id);
            const isCustom = q.id.startsWith("CQ-");
            return (
              <label
                key={q.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                  excluded
                    ? "border-slate-200 bg-slate-50 opacity-50 dark:border-slate-800 dark:bg-slate-800/40"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                )}
              >
                <input
                  type="checkbox"
                  checked={!excluded}
                  onChange={() => onToggleExclude(q.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-800 dark:text-slate-200">{q.question}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">{q.competencyName}</span>
                    <span className="text-[11px] text-slate-400">· {TYPE_LABELS[q.type]}</span>
                    {isCustom && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        pertanyaan perusahaan
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Persiapan sebelum wawancara: siapa yang menilai, dan kompetensi mana yang
 *  tidak bisa ditawar. Keduanya ditanyakan DI DEPAN, bukan setelah selesai —
 *  menentukan kompetensi wajib setelah melihat nilai kandidat sama saja dengan
 *  menggeser standar agar sesuai kesimpulan yang sudah terlanjur diambil. */
function PanelSetupCard({
  pack,
  interviewerName,
  onInterviewerNameChange,
  onToggleCritical,
  onStart,
}: {
  pack: QuestionPack;
  interviewerName: string;
  onInterviewerNameChange: (v: string) => void;
  onToggleCritical: (competencyId: string) => void;
  onStart: () => void;
}) {
  const competencies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of pack.questions) if (!seen.has(q.competencyId)) seen.set(q.competencyId, q.competencyName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [pack.questions]);

  return (
    <Card className="border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sebelum wawancara dimulai</h3>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        Setiap pewawancara menilai sendiri lebih dulu, baru hasilnya dibandingkan di debrief. Berdiskusi sebelum
        menilai membuat semua orang mengikuti suara yang paling dominan.
      </p>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nama pewawancara
        </label>
        <input
          value={interviewerName}
          onChange={(e) => onInterviewerNameChange(e.target.value)}
          placeholder="mis. Rahmat — HR"
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500">
          Dipakai membedakan penilaian antar-pewawancara pada kit yang sama.
        </p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Kompetensi wajib <span className="font-normal text-slate-500">(opsional, klik untuk menandai)</span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Nilai di bawah 3 pada kompetensi wajib akan memblokir rekomendasi, berapa pun rata-ratanya. Pakai hanya
          untuk yang benar-benar tidak bisa ditawar — makin banyak yang ditandai, makin sedikit kandidat yang lolos.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {competencies.map((c) => {
            const active = pack.criticalCompetencyIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCritical(c.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                {active && "★ "}{c.name}
              </button>
            );
          })}
        </div>
      </div>

      {(() => {
        // Kompetensi yang hanya digali lewat situasi hipotetis mengukur apa yang
        // kandidat TAHU sebaiknya dilakukan, bukan apa yang pernah ia lakukan.
        const gaps = analyzeEvidenceCoverage(pack.questions).filter((r) => r.lacksBehavioralEvidence);
        if (gaps.length === 0) return null;
        return (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {gaps.length} kompetensi belum punya pertanyaan berbasis kejadian nyata
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {gaps.map((g) => g.competencyName).join(", ")} — semuanya baru digali lewat pertanyaan hipotetis.
              Tambahkan pertanyaan &quot;Ceritakan saat Anda…&quot; agar penilaiannya berpijak pada yang pernah
              benar-benar dilakukan kandidat.
            </p>
          </div>
        );
      })()}

      <Button variant="primary" size="lg" className="mt-5" onClick={onStart}>
        <Icon className="h-4 w-4"><SvgPath name="play" /></Icon>
        Mulai wawancara &amp; nilai
      </Button>
    </Card>
  );
}

function ResultsPanel({ pack, onStartInterview }: { pack: QuestionPack; onStartInterview: () => void }) {
  const questionIndexById = useMemo(
    () => new Map(pack.questions.map((q, i) => [q.id, i + 1])),
    [pack.questions],
  );

  const grouped = useMemo(() => {
    const map = new Map<InterviewType, InterviewQuestion[]>();
    // Beriterasi atas tipe yang BENAR-BENAR ADA di kit, bukan atas daftar tipe
    // yang bisa dicentang pengguna. "Pendalaman Asesmen" datang dari laporan
    // asesmen dan tidak pernah dicentang -- dengan iterasi lama, pertanyaan itu
    // masuk ke pack tetapi tidak pernah tampil di layar.
    const presentTypes = [...new Set(pack.questions.map((q) => q.type))];
    for (const type of presentTypes) {
      const qs = pack.questions.filter((q) => q.type === type);
      if (qs.length) map.set(type, qs);
    }
    return map;
  }, [pack.questions]);

  // Framework label and citations are derived from the questions actually in the
  // kit, so a tech kit can never be captioned "Ulrich + SKKNI" (it was hardcoded).
  const kitPillars = useMemo(
    () => [...new Set(pack.questions.map((q) => pillarFor(q.competencyId)))],
    [pack.questions],
  );
  const kitFrameworkLabel = useMemo(
    () => kitPillars.map((p) => getPillarLabel(p)).join(" + ") || "competency",
    [kitPillars],
  );

  return (
    <div className="space-y-6">
      <EvidenceValidityPanel />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-500/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Icon className="h-6 w-6">
                  <SvgPath name="clipboard" />
                </Icon>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Interview Question Kit
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    Ready
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {pack.position} · {pack.seniority}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {pack.packId} · {pack.generatedAt}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-center sm:justify-end">
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {pack.questions.length}
                </p>
                <p className="text-xs text-slate-500">Questions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {pack.durationMin}m
                </p>
                <p className="text-xs text-slate-500">Est. duration</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-3">
          {pack.types.map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                TYPE_STYLES[t].chip,
              )}
            >
              {TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </Card>

      {Array.from(grouped.entries()).map(([type, questions]) => {
        const style = TYPE_STYLES[type];
        return (
          <section key={type}>
            <div
              className={cn(
                "mb-3 flex items-center gap-2 rounded-lg border px-4 py-2.5",
                style.header,
              )}
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{TYPE_LABELS[type]}</h3>
              <span className="text-xs text-slate-500">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-4">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  index={questionIndexById.get(q.id) ?? 0}
                />
              ))}
            </div>
          </section>
        );
      })}

      <Card>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-500">
            <SvgPath name="document" />
          </Icon>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Catatan untuk Pewawancara
          </h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          Panel guidance — {kitFrameworkLabel} aligned evaluation
        </p>
        {kitPillars.map((p) => (
          <CitationNote key={p}>{PILLAR_CITATIONS[p] ?? getPillarLabel(p)}</CitationNote>
        ))}
        <ul className="mt-4 space-y-2">
          {pack.interviewerNotes.map((note, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
            >
              <span className="font-semibold tabular-nums text-slate-400">{i + 1}.</span>
              {note}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50/50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/5">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Ready to conduct interview</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Launch live scoring mode with timer and per-question notes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => downloadJSON(`interview-kit-${pack.packId}.json`, pack)}
          >
            <Icon className="h-4 w-4">
              <SvgPath name="download" />
            </Icon>
            Export kit
          </Button>
          <Button variant="primary" size="lg" onClick={onStartInterview}>
            <Icon className="h-5 w-5">
              <SvgPath name="play" />
            </Icon>
            Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════════ */

export default function InterviewPage() {
  const [position, setPosition] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("Senior");
  const [selectedTypes, setSelectedTypes] = useState<InterviewType[]>([
    ...INTERVIEW_TYPES,
  ]);
  const generating = false; // kit tersusun instan dari bank soal lokal — tidak ada proses async/AI
  // Nama pewawancara diambil dari nama pengguna yang sudah tersimpan, supaya
  // pengisian ulang tidak menjadi hambatan yang membuat orang melewatinya.
  // Pertanyaan pendalaman yang dikirim dari laporan asesmen, bila ada.
  const [assessmentHandoff, setAssessmentHandoff] = useState<AssessmentHandoff | null>(null);
  // Bank soal milik perusahaan, dimuat per klaster jabatan.
  const [customBank, setCustomBank] = useState<BankQuestion[]>([]);
  const [savingQuestion, setSavingQuestion] = useState(false);
  // Pertanyaan yang dikeluarkan dari kit ini saja. TIDAK disimpan: menyaring
  // permanen adalah keputusan lain yang harus disengaja, bukan efek samping
  // dari satu kali wawancara.
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [interviewerName, setInterviewerName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("hi_user_name") ?? "";
  });
  const [pack, setPack] = useState<QuestionPack | null>(null);
  const [cvAnalysisData, setCvAnalysisData] = useState<CvPrefill | null>(null);
  const [scoringState, setScoringState] = useState<ScoringState>("idle");
  const [scores, setScores] = useState<Record<string, QuestionScore>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Opened via "Interview" on a candidate (/interview?candidate=ID): start a
    // fresh interview for THAT candidate so the result saves back to them.
    const candId = params.get("candidate");
    if (candId) {
      const c = getCandidate(candId);
      if (c) {
        setPosition(c.position);
        setCvAnalysisData({
          candidateName: c.name,
          position: c.position,
          department: c.department,
          overallScore: c.cvAnalysis?.overallScore ?? 0,
          matchScore: c.cvAnalysis?.matchScore ?? 0,
          recommendation: c.cvAnalysis?.recommendation ?? "",
          questions: [],
          reportId: c.cvAnalysis?.reportId ?? "",
        });
      }
      return; // skip stale prefill/session — this is a deliberate fresh interview
    }

    const pos = params.get("position");
    if (pos) setPosition(decodeURIComponent(pos));
    try {
      const stored = sessionStorage.getItem("interview_prefill");
      if (stored) setCvAnalysisData(JSON.parse(stored));
    } catch { /* ignore */ }
    try {
      const handoff = sessionStorage.getItem(ASSESSMENT_HANDOFF_KEY);
      if (handoff) {
        const parsed = JSON.parse(handoff) as AssessmentHandoff;
        setAssessmentHandoff(parsed);
        if (parsed.position) setPosition(parsed.position);
      }
    } catch { /* ignore */ }
    try {
      const saved = sessionStorage.getItem("interview_session");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.pack) setPack(s.pack);
        if (s.scores) setScores(s.scores);
        if (s.elapsed) setElapsedSeconds(s.elapsed);
        if (s.state === "scoring" || s.state === "complete") setScoringState(s.state);
        if (s.position) setPosition(s.position);
        if (s.seniority) setSeniority(s.seniority);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (scoringState !== "scoring") return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [scoringState]);

  useEffect(() => {
    if (scoringState === "idle" && !pack) return;
    try {
      sessionStorage.setItem("interview_session", JSON.stringify({
        pack, scores, elapsed: elapsedSeconds, state: scoringState, position, seniority,
      }));
    } catch { /* quota */ }
  }, [pack, scores, elapsedSeconds, scoringState, position, seniority]);

  // Kit yang BENAR-BENAR dipakai menilai. Pertanyaan yang dikeluarkan hilang
  // dari sini, sehingga cakupan dan rata-rata dihitung atas kit yang nyata —
  // bukan atas kit lengkap yang sebagian tidak pernah ditanyakan.
  const activePack = useMemo(
    () => (pack ? { ...pack, questions: pack.questions.filter((q) => !excludedIds.includes(q.id)) } : null),
    [pack, excludedIds],
  );

  const handleStartInterview = useCallback(() => {
    if (!pack || !activePack) return;
    const initial: Record<string, QuestionScore> = {};
    (activePack ?? pack).questions.forEach((q) => { initial[q.id] = { rating: null, notAsked: false, notes: "" }; });
    setScores(initial);
    setElapsedSeconds(0);
    setScoringState("scoring");
  }, [pack, activePack]);

  const handleScoreChange = useCallback((id: string, rating: 1|2|3|4|5|null, notes: string) => {
    setScores((prev) => ({ ...prev, [id]: { ...prev[id], rating, notes, notAsked: false } }));
  }, []);

  // Menandai "tidak ditanya" membuang nilainya: keduanya tidak boleh hidup
  // bersamaan, karena nanti tidak jelas mana yang dipakai saat menghitung.
  const handleNotAskedChange = useCallback((id: string, notAsked: boolean) => {
    setScores((prev) => ({
      ...prev,
      [id]: { rating: notAsked ? null : (prev[id]?.rating ?? null), notAsked, notes: prev[id]?.notes ?? "" },
    }));
  }, []);

  const handleCompleteScoring = useCallback(() => {
    setScoringState("complete");
    // Persist to candidate store
    const pack = activePack;
    if (pack) {
      try {
        const name = cvAnalysisData?.candidateName ?? "";
        const pos = pack.position;
        if (name && pos) {
          let candidate = findCandidateByName(name, pos);
          if (!candidate) {
            candidate = createCandidate({ name, position: pos, department: cvAnalysisData?.department ?? "", source: "Interview" });
          }
          // Kesimpulan dihitung mesin bersama: cakupan diperiksa, kompetensi
          // wajib memblokir, dan pertanyaan yang tidak ditanyakan dikeluarkan.
          const outcome = computeInterviewOutcome(toScoredQuestions(pack, scores), pack.criticalCompetencyIds);
          const result: InterviewResultSnapshot = {
            // kitId memakai packId yang STABIL, bukan Date.now(). Dengan id yang
            // berubah tiap simpan, penilaian dua pewawancara atas kit yang sama
            // tidak akan pernah terkelompok menjadi satu panel.
            kitId: pack.packId,
            interviewerName: interviewerName.trim() || "Tanpa nama",
            criticalCompetencyIds: pack.criticalCompetencyIds,
            coveragePct: outcome.coverage.coveragePct,
            avgRating: outcome.average ?? 0,
            recommendation: VERDICT_LABELS[outcome.verdict],
            durationSec: elapsedSeconds,
            completedAt: new Date().toISOString(),
            questionCount: pack.questions.length,
            ratedCount: outcome.coverage.rated,
            // Per-question detail: ratings and verbatim notes used to live only in
            // sessionStorage and vanished with the tab. competencyId is what lets
            // the Hiring Report join these against the CV scores.
            questionScores: pack.questions.map((q) => ({
              questionId: q.id,
              competencyId: q.competencyId,
              competencyName: q.competencyName,
              type: q.type,
              rating: scores[q.id]?.rating ?? null,
              notAsked: scores[q.id]?.notAsked ?? false,
              notes: scores[q.id]?.notes ?? "",
            })),
          };
          saveInterviewResult(candidate.id, result);
        }
      } catch { /* non-critical */ }
    }
  }, [activePack, scores, elapsedSeconds, cvAnalysisData, interviewerName]);

  // Bank soal perusahaan dimuat ulang setiap klaster jabatan berubah, karena
  // pertanyaan khas perusahaan disimpan per klaster.
  useEffect(() => {
    if (!position.trim()) return;
    const cluster = detectCluster(position, cvAnalysisData?.department ?? "");
    let cancelled = false;
    loadCustomQuestions(getActiveCompanyId(), cluster).then((res) => {
      if (cancelled) return;
      if (res.error) toast(`Bank soal perusahaan gagal dimuat: ${res.error}`, "error");
      setCustomBank(res.questions);
    });
    return () => { cancelled = true; };
  }, [position, cvAnalysisData?.department]);

  const handleToggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleAddCustom = useCallback(async (draft: CustomQuestionDraft) => {
    setSavingQuestion(true);
    try {
      const cluster = detectCluster(position, cvAnalysisData?.department ?? "");
      const res = await saveCustomQuestion(getActiveCompanyId(), cluster, draft);
      if (res.error || !res.question) {
        toast(res.error ?? "Gagal menyimpan pertanyaan.", "error");
        return;
      }
      const saved = res.question;
      setCustomBank((prev) => [...prev, saved]);
      // Langsung masuk ke kit yang sedang terbuka, supaya tidak perlu menyusun
      // ulang kit hanya untuk memakai pertanyaan yang baru ditulis.
      setPack((prev) =>
        prev
          ? {
              ...prev,
              questions: [
                ...prev.questions,
                {
                  id: saved.id,
                  type: saved.type as InterviewType,
                  competencyId: saved.competencyId,
                  competencyName: saved.competencyName,
                  question: saved.question,
                  strongAnswer: saved.strongAnswer,
                  redFlags: saved.redFlags,
                  rubric: rubricFor(saved.competencyId),
                },
              ],
            }
          : prev,
      );
      toast("Pertanyaan tersimpan dan ditambahkan ke kit.");
    } finally {
      setSavingQuestion(false);
    }
  }, [position, cvAnalysisData?.department]);

  const handleToggleCritical = useCallback((competencyId: string) => {
    setPack((prev) =>
      prev
        ? {
            ...prev,
            criticalCompetencyIds: prev.criticalCompetencyIds.includes(competencyId)
              ? prev.criticalCompetencyIds.filter((id) => id !== competencyId)
              : [...prev.criticalCompetencyIds, competencyId],
          }
        : prev,
    );
  }, []);

  const handleBackToKit = useCallback(() => {
    setScoringState("idle");
    sessionStorage.removeItem("interview_session");
  }, []);

  const toggleType = (type: InterviewType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const canGenerate = position.trim() !== "" && selectedTypes.length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setPack(null);
    setScoringState("idle");
    setScores({});
    setExcludedIds([]);

    // Kit disusun dari bank soal terkurasi per klaster kompetensi — instan, tanpa
    // delay buatan yang menyamar sebagai proses AI.
    const now = new Date();
    const department = cvAnalysisData?.department ?? "";
    const questions = buildMockQuestions(position, seniority, selectedTypes, department);

    // Pertanyaan dari asesmen ditempel DI AKHIR, dengan tipe tersendiri.
    // Namespace kompetensinya diberi awalan 'assessment:' supaya tidak
    // bertabrakan dengan id kompetensi framework, dan tetap terpisah saat
    // skor per kompetensi dihitung.
    const probeQuestions: InterviewQuestion[] = (assessmentHandoff?.probes ?? []).map((p, i) => ({
      id: `AP${i + 1}`,
      type: "Assessment Probe" as InterviewType,
      competencyId: `assessment:${p.scaleId}`,
      competencyName: p.scaleName,
      question: p.question,
      strongAnswer: p.rationale,
      redFlags: ["Jawaban umum tanpa contoh nyata", "Contohnya tidak bisa diverifikasi", "Menghindari pertanyaan"],
      rubric: [],
    }));
    // Pertanyaan perusahaan MELENGKAPI bank bawaan, tidak menimpanya, dan
    // ditempatkan setelah pertanyaan bawaan agar urutan bawaan tetap sama
    // untuk semua kandidat pada posisi yang sama.
    const customForKit: InterviewQuestion[] = customBank
      .filter((c) => selectedTypes.includes(c.type as InterviewType))
      .map((c) => ({
        id: c.id,
        type: c.type as InterviewType,
        competencyId: c.competencyId,
        competencyName: c.competencyName,
        question: c.question,
        strongAnswer: c.strongAnswer,
        redFlags: c.redFlags,
        rubric: rubricFor(c.competencyId),
      }));

    const allQuestions = [...questions, ...customForKit, ...probeQuestions];
    setPack({
      packId: `KIT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      generatedAt: now.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      position: position.trim(),
      seniority,
      types: selectedTypes,
      durationMin: Math.max(45, selectedTypes.length * 15 + allQuestions.length * 5),
      questions: allQuestions,
      interviewerNotes: buildInterviewerNotes(position, seniority, selectedTypes, department, questions),
      criticalCompetencyIds: [],
    });
  };

  return (
    <AppShell activeNavId="interview-workspace" title="Interview Workspace" subtitle="Kit pertanyaan terstruktur & panduan penilaian">
      {assessmentHandoff && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/80 px-5 py-4 dark:border-teal-500/30 dark:bg-teal-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {assessmentHandoff.probes.length} pertanyaan pendalaman dari hasil asesmen
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {assessmentHandoff.candidateName} · pembanding: {assessmentHandoff.normLabel}. Pertanyaan ini menguji
                hipotesis dari skor asesmen — bukan mengonfirmasinya. Akan ditambahkan otomatis saat kit disusun.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { sessionStorage.removeItem(ASSESSMENT_HANDOFF_KEY); setAssessmentHandoff(null); }}
            >
              Lepas
            </Button>
          </div>
        </div>
      )}

      {cvAnalysisData && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-5 py-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Icon className="h-5 w-5"><SvgPath name="scan" /></Icon>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Pre-filled dari CV Analysis</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cvAnalysisData.candidateName} · {cvAnalysisData.position} · {cvAnalysisData.department}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{cvAnalysisData.overallScore}</p>
                <p className="text-[10px] text-slate-500">Score</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{cvAnalysisData.matchScore}%</p>
                <p className="text-[10px] text-slate-500">Match</p>
              </div>
              <span className="rounded-full border border-indigo-400 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-400 dark:text-indigo-300">
                {cvAnalysisData.recommendation}
              </span>
            </div>
          </div>
          <p className="mt-2 font-mono text-xs text-slate-400">{cvAnalysisData.reportId}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <Card>
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400">
                <SvgPath name="clipboard" />
              </Icon>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Configure Interview Kit
                </h2>
                <p className="text-sm text-slate-500">
                  Bank soal terkurasi per klaster kompetensi, dengan rubrik penilaian
                </p>
              </div>
            </div>

            <form
              className="mt-5 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
            >
              <div>
                <Label htmlFor="position">Job position</Label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <Label htmlFor="seniority">Seniority level</Label>
                <select
                  id="seniority"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value as Seniority)}
                  className={cn(inputClass, "cursor-pointer")}
                >
                  {SENIORITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Interview type</Label>
                <p className="mb-2 text-xs text-slate-500">
                  Select types — 2 questions each, mapped to {CLUSTER_FRAMEWORKS[detectCluster(position, cvAnalysisData?.department ?? "")].label}
                </p>
                <div
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  role="group"
                  aria-label="Interview types"
                >
                  {INTERVIEW_TYPES.map((type) => {
                    const selected = selectedTypes.includes(type);
                    const style = TYPE_STYLES[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleType(type)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                          selected
                            ? cn("ring-2 ring-blue-500/40", style.border, style.header)
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                        )}
                        aria-pressed={selected}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 dark:border-slate-600",
                          )}
                        >
                          {selected && (
                            <Icon className="h-3 w-3">
                              <SvgPath name="check" />
                            </Icon>
                          )}
                        </span>
                        {TYPE_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!canGenerate || generating}
              >
                <Icon className="h-5 w-5">
                  <SvgPath name="clipboard" />
                </Icon>
                Susun Kit dari Bank Soal
              </Button>

              {!canGenerate && !generating && (
                <p className="text-center text-xs text-slate-400">
                  Enter a job position and select at least one interview type
                </p>
              )}
            </form>
          </Card>
        </div>

        <div className="xl:col-span-3">
          {generating && (
            <Card className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/20">
                <Icon className="h-8 w-8 animate-pulse text-indigo-600 dark:text-indigo-400">
                  <SvgPath name="clipboard" />
                </Icon>
              </div>
              <p className="mt-4 font-medium text-slate-900 dark:text-white">
                Building interview kit...
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Calibrating questions, rubrics, and red flags for {seniority} level
              </p>
              <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full w-3/4 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" />
              </div>
            </Card>
          )}

          {!generating && !pack && (
            <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
              <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600">
                <SvgPath name="workspace" />
              </Icon>
              <p className="mt-4 font-medium text-slate-900 dark:text-white">
                No question kit yet
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Configure the role and interview types, then generate a structured kit with
                scoring rubrics and interviewer notes.
              </p>
            </Card>
          )}

          {!generating && pack && scoringState === "idle" && (
            <div className="space-y-4">
              {cvAnalysisData && <CvContextCard data={cvAnalysisData} />}
              <>
                <QuestionManagerCard
                  pack={pack}
                  excludedIds={excludedIds}
                  onToggleExclude={handleToggleExclude}
                  onAddCustom={handleAddCustom}
                  saving={savingQuestion}
                />
                <PanelSetupCard
                  pack={activePack ?? pack}
                  interviewerName={interviewerName}
                  onInterviewerNameChange={setInterviewerName}
                  onToggleCritical={handleToggleCritical}
                  onStart={handleStartInterview}
                />
                <ResultsPanel pack={activePack ?? pack} onStartInterview={handleStartInterview} />
              </>
            </div>
          )}

          {!generating && pack && scoringState === "scoring" && (
            <ScoringPanel
              pack={activePack ?? pack}
              candidateName={cvAnalysisData?.candidateName ?? ""}
              scores={scores}
              onScoreChange={handleScoreChange}
              elapsedSeconds={elapsedSeconds}
              onNotAskedChange={handleNotAskedChange}
              onComplete={handleCompleteScoring}
            />
          )}

          {!generating && pack && scoringState === "complete" && (
            <ScoringResultsPanel
              pack={activePack ?? pack}
              candidateName={cvAnalysisData?.candidateName ?? ""}
              scores={scores}
              elapsedSeconds={elapsedSeconds}
              onBack={handleBackToKit}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
