/* ═══════════════════════════════════════════════════════════════════════════
   Unified competency framework
   — Ulrich HR Competency Model (2012)
   — Evidence-based selection validity (Schmidt & Hunter, 1998)
   — SKKNI No. 149/2020 (Indonesian HR national work competency standards)
   — Extended: SFIA v8, Lominger, CGMA (multi-framework support)
═══════════════════════════════════════════════════════════════════════════ */

// Extended to support multi-framework: ulrich, skkni, sfia, lominger, cgma
export type CompetencyPillar = "ulrich" | "skkni" | "sfia" | "lominger" | "cgma" | string;

export interface RubricLevel {
  score: number;
  label: string;
  description: string;
}

export interface CompetencyDefinition {
  id: string;
  pillar: CompetencyPillar;
  name: string;
  /** Indonesian label for SKKNI competencies */
  nameId?: string;
  description: string;
  /** Cross-reference to related framework dimension */
  crossRef?: string;
  rubric: RubricLevel[];
  /** Primary evidence method per I/O psychology meta-analyses */
  evidenceMethod: string;
  validityCoeff?: number;
  /** Expected score for the role bar (0-100). Feeds the AI prompt so the model
   *  scores against the same bar the UI renders — see buildFrameworkPrompt(). */
  benchmark?: number;
}

export interface CompetencyScore {
  id: string;
  name: string;
  pillar: CompetencyPillar;
  score: number;
  benchmark: number;
  insight: string;
  rubric: RubricLevel[];
}

export interface CompetencyReportRow {
  id: string;
  name: string;
  pillar: CompetencyPillar;
  cvScore: number;
  /** null = this competency was not covered by the interview kit. Rendering 0
   *  would read as "scored zero" rather than "not asked". */
  interviewScore: number | null;
  finalScore: number;
  /** Sample reports only. Real rows carry no weight because no weighting model
   *  exists yet — the column is hidden rather than filled with invented numbers. */
  weight?: number;
  rubric: RubricLevel[];
}

/* Final-score weighting. Previously the caption said 40/60, the headline
   computed 60/40, and the per-competency rows computed 40/60 — three numbers
   for one score. One constant now feeds all three. */
export const CV_WEIGHT = 0.4;
export const INTERVIEW_WEIGHT = 0.6;

/** Blends CV and interview evidence. With no interview score yet, the CV score
 *  stands alone rather than being diluted against a zero. */
export function blendScore(cvScore: number, interviewScore: number | null): number {
  if (interviewScore === null) return Math.round(cvScore);
  return Math.round(cvScore * CV_WEIGHT + interviewScore * INTERVIEW_WEIGHT);
}

export const CITATIONS = {
  schmidtHunter:
    "Schmidt, F.L. & Hunter, J.E. (1998). The validity and utility of selection methods in personnel psychology. Psychological Bulletin, 124(2), 262–274.",
  ulrich:
    "Ulrich, D., Brockbank, W., Ulrich, M. & Lake, D. (2012). HR Competency Study: mastery of six domains distinguishes high-impact HR professionals.",
  skkni:
    "Peraturan Menteri Ketenagakerjaan RI No. 149 Tahun 2020 tentang Standar Kompetensi Kerja Nasional Indonesia (SKKNI) di bidang Sumber Daya Manusia.",
} as const;

/** Source citation per framework pillar. Canonical copy — the UI and the
 *  Interview Workspace both read this so a page can never cite Ulrich beside
 *  SFIA content, which is what happened when each component kept its own map. */
export const PILLAR_CITATIONS: Record<string, string> = {
  ulrich: CITATIONS.ulrich,
  skkni: CITATIONS.skkni,
  sfia: "SFIA Foundation (2023). Skills Framework for Information Age v8. sfia.org — adopted by Google, Microsoft, IBM, AWS.",
  lominger: "Korn Ferry Lominger (2014). Leadership Architect: The Complete Collection. Used by Fortune 500 for leadership selection.",
  cgma: "CGMA (2019). CGMA Competency Framework. Chartered Institute of Management Accountants / AICPA.",
  "skkni-broadcast": "Kepmenaker No. 133/2019 (Bidang Penyiaran & Multimedia). BNSP/LSP Penyiaran Indonesia.",
  "skkni-editorial": "Kepmenaker No. 246/2020 (Bidang Jurnalistik & Redaksi Berita). Dewan Pers / LSP Jurnalistik.",
  "skkni-security": "Kepmenaker No. 259/2018 (Jasa Satuan Pengamanan). Perpol No. 4/2020. BNSP/LSP Polri. Gada Pratama/Madya.",
};

/** Predictive validity coefficients (r) — Schmidt & Hunter (1998) meta-analysis */
export const SELECTION_VALIDITY = [
  {
    method: "Work samples",
    validity: 0.54,
    note: "Highest practical validity for job performance prediction",
  },
  {
    method: "Structured interviews",
    validity: 0.51,
    note: "Standardized questions & scoring — basis for this platform",
  },
  {
    method: "Unstructured interviews",
    validity: 0.38,
    note: "Avoid ad-hoc interviews without rubrics",
  },
  {
    method: "Reference checks",
    validity: 0.26,
    note: "Supplementary only; combine with structured assessment",
  },
] as const;

const researchRubric = (
  domain: string,
  levels: [string, string, string, string, string],
): RubricLevel[] => [
  { score: 1, label: "Far below", description: levels[0] },
  { score: 2, label: "Below standard", description: levels[1] },
  { score: 3, label: "Meets SKKNI / role bar", description: levels[2] },
  { score: 4, label: "Exceeds standard", description: levels[3] },
  { score: 5, label: "Role model", description: levels[4] },
];

// Same shape as researchRubric but with framework-neutral level labels — SFIA,
// Lominger and CGMA have no relationship to SKKNI, so "Meets SKKNI" would be wrong.
const frameworkRubric = (
  levels: [string, string, string, string, string],
): RubricLevel[] => [
  { score: 1, label: "Far below", description: levels[0] },
  { score: 2, label: "Below standard", description: levels[1] },
  { score: 3, label: "Meets role bar", description: levels[2] },
  { score: 4, label: "Exceeds standard", description: levels[3] },
  { score: 5, label: "Role model", description: levels[4] },
];

/* ─── Ulrich HR Competency Model (6) ─── */

export const ULRICH_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "ulrich-credible-activist",
    pillar: "ulrich",
    name: "Credible Activist",
    description:
      "Builds trust through integrity, courageous advocacy, and data-informed influence with business leaders.",
    crossRef: "SKKNI: Hubungan Industrial",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: researchRubric("Credible Activist", [
      "Lacks ethical grounding; damages credibility with stakeholders.",
      "Passive in challenging decisions; avoids conflict or data.",
      "Speaks up with evidence when needed; maintains professional relationships.",
      "Trusted advisor; shifts leadership decisions with well-framed business cases.",
      "Enterprise conscience; shapes culture and policy through sustained principled influence.",
    ]),
  },
  {
    id: "ulrich-strategic-positioner",
    pillar: "ulrich",
    name: "Strategic Positioner",
    description:
      "Aligns HR and talent decisions with business strategy, market context, and organizational positioning.",
    crossRef: "SKKNI: Perencanaan SDM",
    evidenceMethod: "Structured interview + case exercise",
    validityCoeff: 0.51,
    benchmark: 78,
    rubric: researchRubric("Strategic Positioner", [
      "No link between talent actions and business outcomes.",
      "Executes HR tasks without strategic framing.",
      "Articulates how role supports unit strategy and KPIs.",
      "Anticipates workforce implications of strategic shifts; proposes options.",
      "Co-creates business strategy with measurable talent implications.",
    ]),
  },
  {
    id: "ulrich-capability-builder",
    pillar: "ulrich",
    name: "Capability Builder",
    description:
      "Develops organizational and individual capabilities through learning systems, talent processes, and workforce architecture.",
    crossRef: "SKKNI: Pengembangan Kompetensi",
    evidenceMethod: "Work sample / structured interview",
    validityCoeff: 0.54,
    benchmark: 80,
    rubric: researchRubric("Capability Builder", [
      "No evidence of building skills or systems beyond own tasks.",
      "Ad-hoc training or hiring without competency models.",
      "Uses competency frameworks; supports development plans.",
      "Designs scalable L&D or hiring systems tied to capability gaps.",
      "Transforms workforce capability as competitive advantage.",
    ]),
  },
  {
    id: "ulrich-change-champion",
    pillar: "ulrich",
    name: "Change Champion",
    description:
      "Leads and sustains organizational change; manages resistance, communications, and adoption metrics.",
    crossRef: "SKKNI: Manajemen Kinerja",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 78,
    rubric: researchRubric("Change Champion", [
      "Resists or derails change initiatives.",
      "Participates in change without ownership of adoption.",
      "Executes change plan with stakeholder map and feedback loops.",
      "Drives measurable adoption; addresses resistance proactively.",
      "Institutionalizes change capability; leaders cite as transformation partner.",
    ]),
  },
  {
    id: "ulrich-hr-innovator",
    pillar: "ulrich",
    name: "HR Innovator & Integrator",
    description:
      "Integrates HR practices across recruitment, development, rewards, and culture; innovates with measurable impact.",
    crossRef: "SKKNI: Rekrutmen & Seleksi",
    evidenceMethod: "Structured interview + work sample",
    validityCoeff: 0.51,
    benchmark: 81,
    rubric: researchRubric("HR Innovator & Integrator", [
      "Siloed HR activities; no integration across employee lifecycle.",
      "Copies best practices without contextualization.",
      "Connects 2+ HR levers (e.g., selection + onboarding) with metrics.",
      "Designs integrated talent architecture with continuous improvement.",
      "Industry-recognized innovator; evidence of replication internally.",
    ]),
  },
  {
    id: "ulrich-technology-proponent",
    pillar: "ulrich",
    name: "Technology Proponent",
    description:
      "Leverages HR technology, people analytics, and digital tools for evidence-based workforce decisions.",
    crossRef: "SKKNI: Perencanaan SDM (analytics)",
    evidenceMethod: "Work sample / technical interview",
    validityCoeff: 0.54,
    benchmark: 83,
    rubric: researchRubric("Technology Proponent", [
      "Avoids data and systems; manual-only decision making.",
      "Uses basic HRIS reports without interpretation.",
      "Applies analytics to hiring or workforce questions with clear metrics.",
      "Builds dashboards or automations improving decision speed/quality.",
      "Drives people analytics strategy linked to business outcomes.",
    ]),
  },
];

/* ─── SKKNI No. 149/2020 — HR field (5) ─── */

export const SKKNI_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "skkni-perencanaan",
    pillar: "skkni",
    name: "Perencanaan SDM",
    nameId: "Perencanaan SDM",
    description:
      "Perencanaan strategis tenaga kerja, proyeksi kebutuhan, dan penyusunan rencana SDM sesuai regulasi ketenagakerjaan Indonesia.",
    crossRef: "Ulrich: Strategic Positioner",
    evidenceMethod: "Structured interview",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: researchRubric("Perencanaan SDM", [
      "Tidak memahami perencanaan tenaga kerja dan regulasi terkait.",
      "Perencanaan operasional tanpa analisis kebutuhan jangka menengah.",
      "Menyusun rencana SDM dengan analisis supply-demand dan anggaran dasar.",
      "Mengintegrasikan rencana SDM dengan strategi bisnis dan UU Ketenagakerjaan.",
      "Memimpin workforce planning enterprise dengan skenario dan mitigasi risiko.",
    ]),
  },
  {
    id: "skkni-rekrutmen",
    pillar: "skkni",
    name: "Rekrutmen & Seleksi",
    nameId: "Rekrutmen & Seleksi",
    description:
      "Pelaksanaan rekrutmen berbasis kompetensi, seleksi terstruktur, dan kepatuhan terhadap prinsip kesetaraan dan non-diskriminasi.",
    crossRef: "Ulrich: HR Innovator & Integrator",
    evidenceMethod: "Structured interview (validity r ≈ 0.51)",
    validityCoeff: 0.51,
    benchmark: 85,
    rubric: researchRubric("Rekrutmen & Seleksi", [
      "Seleksi tidak terstruktur; risiko bias dan prediksi rendah (r ≈ 0.38).",
      "Rekrutmen dasar tanpa kriteria kompetensi terukur.",
      "Menerapkan wawancara terstruktur dan rubrik penilaian per kompetensi.",
      "Mendesain proses seleksi multi-metode dengan validitas prediktif lebih tinggi.",
      "Mengoptimalkan quality-of-hire metrics dan employer branding terukur.",
    ]),
  },
  {
    id: "skkni-pengembangan",
    pillar: "skkni",
    name: "Pengembangan Kompetensi",
    nameId: "Pengembangan Kompetensi",
    description:
      "Identifikasi gap kompetensi, program pelatihan, dan evaluasi efektivitas pengembangan karyawan.",
    crossRef: "Ulrich: Capability Builder",
    evidenceMethod: "Work sample / structured interview",
    validityCoeff: 0.54,
    benchmark: 82,
    rubric: researchRubric("Pengembangan Kompetensi", [
      "Tidak ada program pengembangan atau evaluasi belajar.",
      "Training event-driven tanpa TNA (training needs analysis).",
      "TNA berbasis kompetensi; evaluasi level Kirkpatrick dasar.",
      "Career path dan pipeline talent terintegrasi dengan SKKNI/unit kompetensi.",
      "Budaya pembelajaran terukur; dampak bisnis program L&D terdokumentasi.",
    ]),
  },
  {
    id: "skkni-kinerja",
    pillar: "skkni",
    name: "Manajemen Kinerja",
    nameId: "Manajemen Kinerja",
    description:
      "Penetapan KPI, evaluasi kinerja, umpan balik, dan tindak lanjut peningkatan produktivitas.",
    crossRef: "Ulrich: Change Champion",
    evidenceMethod: "Structured interview",
    validityCoeff: 0.51,
    benchmark: 79,
    rubric: researchRubric("Manajemen Kinerja", [
      "Tidak memahami siklus manajemen kinerja.",
      "Evaluasi kinerja formalitas tanpa coaching atau tindak lanjut.",
      "KPI selaras job description; feedback rutin terdokumentasi.",
      "Menghubungkan kinerja dengan pengembangan dan reward secara adil.",
      "Revolusi budaya kinerja berbasis data; turnover rendah pada high performers.",
    ]),
  },
  {
    id: "skkni-hubungan-industrial",
    pillar: "skkni",
    name: "Hubungan Industrial",
    nameId: "Hubungan Industrial",
    description:
      "Pengelolaan hubungan industrial, kepatuhan peraturan ketenagakerjaan, dan penyelesaian perselisihan sesuai hukum Indonesia.",
    crossRef: "Ulrich: Credible Activist",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: researchRubric("Hubungan Industrial", [
      "Pelanggaran prosedur atau ketidaktahuan UU Ketenagakerjaan.",
      "Reaktif terhadap konflik; dokumentasi lemah.",
      "Memahami PK/Bipartit; komunikasi dengan serikat pekerja dan mediasi dasar.",
      "Mencegah eskalasi konflik; kepatuhan audit HR tercatat baik.",
      "Diakui sebagai mitra industrial relations; zero major labor disputes.",
    ]),
  },
];

/* ─── SFIA v8 — Skills Framework for Information Age (8) — Tech roles ─── */

export const SFIA_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "sfia-technical-proficiency",
    pillar: "sfia",
    name: "Technical Proficiency",
    description: "Depth of hands-on craft in the role's core technologies, and the judgement to apply it without supervision.",
    evidenceMethod: "Work sample / technical interview",
    validityCoeff: 0.54,
    benchmark: 82,
    rubric: frameworkRubric([
      "Basic awareness only; cannot apply the core technology unaided.",
      "Applies familiar patterns with close supervision; struggles outside known cases.",
      "Applies the core stack independently to normal problems.",
      "Handles hard, unfamiliar problems; raises the technical bar of those around them.",
      "Recognized expert; sets technical direction beyond own team.",
    ]),
  },
  {
    id: "sfia-solution-architecture",
    pillar: "sfia",
    name: "Solution Architecture & Design",
    description: "Designing components and systems with explicit trade-offs, constraints, and failure modes considered.",
    evidenceMethod: "System design exercise",
    validityCoeff: 0.54,
    benchmark: 78,
    rubric: frameworkRubric([
      "Follows existing patterns without understanding why they exist.",
      "Designs small pieces but cannot justify trade-offs or foresee failure modes.",
      "Designs components with clear rationale and stated trade-offs.",
      "Designs systems spanning teams; anticipates scale and failure modes.",
      "Designs enterprise-grade systems; architectural decisions outlive their tenure.",
    ]),
  },
  {
    id: "sfia-data-analytics",
    pillar: "sfia",
    name: "Data & Analytics Literacy",
    description: "Turning data into decisions — querying, modelling, visualising, and interpreting with statistical care.",
    evidenceMethod: "Work sample",
    validityCoeff: 0.54,
    benchmark: 80,
    rubric: frameworkRubric([
      "Reads basic reports; cannot query or validate data.",
      "Extracts data with help; interpretation often unchecked.",
      "Builds dashboards and queries independently; interprets with reasonable rigour.",
      "Designs data models others rely on; distinguishes correlation from causation.",
      "Designs data strategy; drives an evidence culture across the organisation.",
    ]),
  },
  {
    id: "sfia-security-quality",
    pillar: "sfia",
    name: "Security & Quality Mindset",
    description: "Treating correctness, testing, and security as part of the work rather than a later phase.",
    evidenceMethod: "Technical interview + work sample",
    validityCoeff: 0.54,
    benchmark: 79,
    rubric: frameworkRubric([
      "Unaware of security basics; ships untested work.",
      "Tests only when asked; security handled by someone else.",
      "Applies secure coding and writes meaningful tests as standard practice.",
      "Designs quality gates for the team; finds classes of defect, not just instances.",
      "Drives security and quality culture; recognised authority on it.",
    ]),
  },
  {
    id: "sfia-delivery-agility",
    pillar: "sfia",
    name: "Delivery & Agile Execution",
    description: "Reliably shipping working software end-to-end, including ownership after release.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 81,
    rubric: frameworkRubric([
      "Struggles to deliver; commitments routinely slip without signal.",
      "Delivers small scoped tasks; needs direction to finish.",
      "Delivers consistently in an agile cadence and owns what ships.",
      "Unblocks the team's delivery; improves throughput measurably.",
      "Shapes delivery methodology adopted beyond own team.",
    ]),
  },
  {
    id: "sfia-collaboration",
    pillar: "sfia",
    name: "Technical Collaboration & Communication",
    description: "Working effectively across engineering and non-engineering functions; making technical constraints legible to others.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 77,
    rubric: frameworkRubric([
      "Works in isolation; communication creates friction or confusion.",
      "Collaborates within own team only; struggles with other functions.",
      "Effective in cross-functional teams; explains technical constraints clearly.",
      "Builds alignment between teams; mentors others to collaborate better.",
      "Multiplies team capability; sets the standard for how the org works together.",
    ]),
  },
  {
    id: "sfia-innovation",
    pillar: "sfia",
    name: "Innovation & Problem Solving",
    description: "Diagnosing root causes and introducing better approaches rather than repeating prescribed solutions.",
    evidenceMethod: "Structured behavioral interview + case",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: frameworkRubric([
      "Follows prescribed solutions; stops at the first obstacle.",
      "Solves surface symptoms; rarely investigates underlying cause.",
      "Identifies root cause and fixes the actual problem.",
      "Introduces better approaches and gets them adopted with evidence.",
      "Drives technical innovation that changes how the organisation works.",
    ]),
  },
  {
    id: "sfia-learning-agility",
    pillar: "sfia",
    name: "Learning Agility & Tech Adaptability",
    description: "Acquiring new technical skills quickly and applying them to real work as the stack changes.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 83,
    rubric: frameworkRubric([
      "Resists new tools; relies only on long-familiar technology.",
      "Learns when required, slowly, and rarely applies it beyond the trigger.",
      "Learns a new stack in reasonable time and applies it to real work.",
      "Picks up unfamiliar domains fast; shares what they learn with the team.",
      "Continuously at the leading edge; the org's source of new technical direction.",
    ]),
  },
];

/* ─── Lominger Leadership Architect (9) — Business / General Management ─── */

export const LOMINGER_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "lom-strategic-agility",
    pillar: "lominger",
    name: "Strategic Agility",
    description: "Seeing beyond immediate tasks to market and organisational direction, and acting on it.",
    evidenceMethod: "Structured interview + case exercise",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: frameworkRubric([
      "Purely tactical; no view beyond the current task.",
      "Aware of strategy but cannot connect own work to it.",
      "Connects daily work to strategy and explains the link.",
      "Anticipates market shifts and repositions the team ahead of them.",
      "Shapes organisational direction; strategy bears their fingerprints.",
    ]),
  },
  {
    id: "lom-drive-results",
    pillar: "lominger",
    name: "Drive for Results",
    description: "Consistently delivering measurable outcomes, including through obstacles.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 85,
    rubric: frameworkRubric([
      "Misses targets consistently; outcomes not tracked.",
      "Hits easy targets; stalls when obstacles appear.",
      "Meets targets and overcomes normal obstacles.",
      "Exceeds targets in difficult conditions; results sustained over time.",
      "Delivers extraordinary results that reset expectations.",
    ]),
  },
  {
    id: "lom-learning-agility",
    pillar: "lominger",
    name: "Learning Agility",
    description: "Extracting transferable lessons from experience, especially from failure.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 82,
    rubric: frameworkRubric([
      "Repeats mistakes; fixed mindset; deflects responsibility.",
      "Acknowledges mistakes but draws no usable lesson.",
      "Learns quickly from varied experience and applies it.",
      "Turns failures into changed behaviour others benefit from.",
      "Thrives in first-time situations; learns faster than the problem evolves.",
    ]),
  },
  {
    id: "lom-interpersonal-savvy",
    pillar: "lominger",
    name: "Interpersonal Savvy & Influence",
    description: "Building trust and moving decisions without relying on formal authority.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 78,
    rubric: frameworkRubric([
      "Creates friction; tone-deaf to people and context.",
      "Gets along but cannot influence outcomes.",
      "Builds rapport and navigates organisational politics effectively.",
      "Shifts senior decisions through well-framed cases and coalitions.",
      "Trusted at all levels; sought out on sensitive matters.",
    ]),
  },
  {
    id: "lom-problem-solving",
    pillar: "lominger",
    name: "Problem Solving & Decision Quality",
    description: "Structured analysis leading to decisions that hold up after the fact.",
    evidenceMethod: "Case exercise + structured interview",
    validityCoeff: 0.51,
    benchmark: 81,
    rubric: frameworkRubric([
      "Reactive; poor analysis; decisions frequently reversed.",
      "Analyses simple problems; struggles with incomplete data.",
      "Systematic analysis producing sound, defensible decisions.",
      "Decides well under incomplete information; explains the reasoning.",
      "Solves complex ambiguous problems others could not frame.",
    ]),
  },
  {
    id: "lom-manages-ambiguity",
    pillar: "lominger",
    name: "Manages Ambiguity & Complexity",
    description: "Functioning and leading when the situation, data, or direction is unsettled.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 79,
    rubric: frameworkRubric([
      "Paralyzed by uncertainty; waits for full clarity.",
      "Copes with mild ambiguity; escalates most unclear situations.",
      "Functions well in ambiguous situations and keeps moving.",
      "Leads others through ambiguity; creates clarity for the team.",
      "Thrives in chaos; turns unsettled situations into advantage.",
    ]),
  },
  {
    id: "lom-collaborates",
    pillar: "lominger",
    name: "Collaboration & Teamwork",
    description: "Working across boundaries and sharing credit to produce collective outcomes.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: frameworkRubric([
      "Siloed and competitive; withholds information.",
      "Cooperates when required; territorial under pressure.",
      "Effective team player who shares credit.",
      "Builds cross-functional partnerships that outlast the project.",
      "Creates a collaboration culture others replicate.",
    ]),
  },
  {
    id: "lom-communicates",
    pillar: "lominger",
    name: "Communicates Effectively",
    description: "Conveying meaning clearly to different audiences, and listening well enough to be changed by it.",
    evidenceMethod: "Structured interview + presentation",
    validityCoeff: 0.51,
    benchmark: 78,
    rubric: frameworkRubric([
      "Unclear and disorganised; poor listener.",
      "Communicates facts but not meaning; one register only.",
      "Clear and adapts message to the audience.",
      "Creates alignment through communication; makes complex things simple.",
      "Compelling across all media; communication moves the organisation.",
    ]),
  },
  {
    id: "lom-customer-focus",
    pillar: "lominger",
    name: "Customer/Stakeholder Focus",
    description: "Understanding and serving the real needs of customers or internal stakeholders.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: frameworkRubric([
      "Internally focused only; unaware of customer impact.",
      "Responds to stated requests without understanding the need.",
      "Consistently meets stakeholder needs and checks the outcome.",
      "Uncovers unstated needs; stakeholders treat them as a partner.",
      "Anticipates needs and builds durable loyalty.",
    ]),
  },
];

/* ─── CGMA Competency Framework (8) — Finance / Accounting / Compliance ─── */

export const CGMA_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "cgma-technical-accounting",
    pillar: "cgma",
    name: "Technical Accounting & Reporting",
    description: "Applying accounting standards correctly and closing the books reliably under deadline.",
    evidenceMethod: "Technical interview + work sample",
    validityCoeff: 0.54,
    benchmark: 83,
    rubric: frameworkRubric([
      "Basic bookkeeping only; unfamiliar with reporting standards.",
      "Prepares routine entries; needs review for anything non-standard.",
      "Prepares financial statements per PSAK/IFRS and runs a controlled close.",
      "Resolves complex treatments; shortens and de-risks the close cycle.",
      "Technical authority others consult on contentious treatments.",
    ]),
  },
  {
    id: "cgma-financial-analysis",
    pillar: "cgma",
    name: "Financial Analysis & Planning",
    description: "Modelling, forecasting, and testing the assumptions that drive financial decisions.",
    evidenceMethod: "Work sample (modelling exercise)",
    validityCoeff: 0.54,
    benchmark: 82,
    rubric: frameworkRubric([
      "Reads basic P&L only; cannot build or critique a model.",
      "Maintains existing models without understanding the drivers.",
      "Builds financial models with sound structure and stated assumptions.",
      "Runs sensitivity and scenario analysis; challenges weak assumptions.",
      "Drives financial strategy; models shape capital allocation.",
    ]),
  },
  {
    id: "cgma-risk-control",
    pillar: "cgma",
    name: "Risk Management & Internal Control",
    description: "Identifying financial and operational risk, and designing controls that actually bind.",
    evidenceMethod: "Structured interview + case",
    validityCoeff: 0.51,
    benchmark: 80,
    rubric: frameworkRubric([
      "Unaware of risk frameworks; controls not considered.",
      "Follows existing controls without understanding their purpose.",
      "Identifies and mitigates key risks; documents the control.",
      "Designs controls proportionate to risk; monitors leading indicators.",
      "Owns an enterprise risk framework tied to business strategy.",
    ]),
  },
  {
    id: "cgma-business-acumen",
    pillar: "cgma",
    name: "Business Acumen & Commercial Awareness",
    description: "Connecting financial numbers to the operating reality that produced them.",
    evidenceMethod: "Structured interview + case",
    validityCoeff: 0.51,
    benchmark: 79,
    rubric: frameworkRubric([
      "Sees numbers in isolation from the business.",
      "Explains variances mechanically without commercial insight.",
      "Connects financials to operational outcomes and drivers.",
      "Influences commercial decisions with financial insight ahead of time.",
      "Strategic partner to CEO/CFO on business direction.",
    ]),
  },
  {
    id: "cgma-digital-finance",
    pillar: "cgma",
    name: "Digital Finance & Data Analytics",
    description: "Using systems and automation to make the finance function faster and less error-prone.",
    evidenceMethod: "Work sample",
    validityCoeff: 0.54,
    benchmark: 81,
    rubric: frameworkRubric([
      "Manual spreadsheets only; no systems literacy.",
      "Uses the ERP as instructed; no improvement attempted.",
      "Builds dashboards and automates recurring reports.",
      "Redesigns finance processes around systems with quantified savings.",
      "Leads finance digital transformation across the function.",
    ]),
  },
  {
    id: "cgma-ethics-compliance",
    pillar: "cgma",
    name: "Ethics, Governance & Compliance",
    description: "Upholding regulatory and ethical obligations, including when it is inconvenient.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 84,
    rubric: frameworkRubric([
      "Unaware of compliance obligations; ignores irregularities.",
      "Complies when reminded; escalation avoided.",
      "Ensures full regulatory compliance and escalates issues properly.",
      "Anticipates regulatory change and prepares the organisation.",
      "Shapes ethics culture; the reason issues surface early.",
    ]),
  },
  {
    id: "cgma-stakeholder-influence",
    pillar: "cgma",
    name: "Stakeholder Influence & Presentation",
    description: "Making financial information usable and persuasive for non-finance decision makers.",
    evidenceMethod: "Structured interview + presentation",
    validityCoeff: 0.51,
    benchmark: 77,
    rubric: frameworkRubric([
      "Cannot explain financials in plain language.",
      "Presents data without narrative; audience left to interpret.",
      "Clear financial storytelling tailored to the audience.",
      "Changes non-finance decisions through well-framed financial insight.",
      "Boardroom-ready; trusted voice in the highest-stakes decisions.",
    ]),
  },
  {
    id: "cgma-leadership",
    pillar: "cgma",
    name: "Leadership & People Development",
    description: "Building the capability and retention of the finance team.",
    evidenceMethod: "Structured behavioral interview",
    validityCoeff: 0.51,
    benchmark: 78,
    rubric: frameworkRubric([
      "Individual contributor only; no development of others.",
      "Assigns work but does not develop capability.",
      "Effectively leads a small team with clear development plans.",
      "Builds bench strength; retains and grows strong performers.",
      "Builds a high-performing finance function others recruit from.",
    ]),
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Operational / Blue-collar competency definitions

   These are based on verified SKKNI (Standar Kompetensi Kerja Nasional
   Indonesia) decrees for TV broadcasting, journalism/editorial, and
   physical security roles. Each competency maps to specific Elemen Kompetensi
   and Kriteria Unjuk Kerja (KUK) from the relevant Kepmenaker decree.

   Evidence methods emphasize work samples (r=0.54, Schmidt & Hunter 1998)
   as the gold standard for blue-collar selection validity, rather than
   structured interviews alone (which work best with concrete, observable
   behavioral anchors for operational roles).

   Benchmarks are intentionally lower than white-collar (~65-75 vs 78-85):
   the bar is "competently executes SOPs per SKKNI", not "exceeds in
   strategic/abstract dimensions".
═══════════════════════════════════════════════════════════════════════════ */

// Rubric with Indonesian-language level labels — appropriate for SKKNI-based
// operational competencies where the standard IS the national competency decree.
const operationalRubric = (
  levels: [string, string, string, string, string],
): RubricLevel[] => [
  { score: 1, label: "Di bawah standar", description: levels[0] },
  { score: 2, label: "Perlu bimbingan", description: levels[1] },
  { score: 3, label: "Memenuhi SKKNI", description: levels[2] },
  { score: 4, label: "Di atas standar", description: levels[3] },
  { score: 5, label: "Ahli / role model", description: levels[4] },
];

/* ─── SKKNI Penyiaran & Multimedia — Kepmenaker No. 133/2019 (6) ─── */
/* Covers: Cameraman, Video Editor, Floor Director, Studio Technician, Audio Engineer */

export const BROADCAST_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "brd-studio-cam",
    pillar: "skkni-broadcast",
    name: "Broadcast Studio & Camera Operation",
    nameId: "Pengoperasian Kamera & Studio Siaran",
    description:
      "Operating broadcast cameras, pedestals, and studio lighting equipment with correct framing, focus, and exposure during live and taped television productions.",
    crossRef: "SKKNI: J.59MVI00.001.1 (Mengoperasikan Kamera Video)",
    evidenceMethod: "Work sample — live studio camera simulation",
    validityCoeff: 0.54,
    benchmark: 72,
    rubric: operationalRubric([
      "Cannot operate studio cameras without supervision; poor framing or focus drift during production.",
      "Operates static shots well but struggles with dynamic live studio movements or multi-cam coordination.",
      "Consistently delivers sharp, well-framed shots in live broadcasts; communicates smoothly with program director.",
      "Anticipates director needs; executes complex live pedestal movements smoothly; assists in studio lighting setup.",
      "Lead camera operator; trains junior cameramen; designs studio technical layouts and camera blocking.",
    ]),
  },
  {
    id: "brd-rundown-dir",
    pillar: "skkni-broadcast",
    name: "Rundown & Program Directing",
    nameId: "Manajemen Rundown & Tata Acara Siaran",
    description:
      "Managing live program timelines, coordinating studio floor activities, and ensuring seamless transitions between program segments, commercial breaks, and live feeds.",
    crossRef: "SKKNI: J.59MVI00.015.1 (Mengatur Pelaksanaan Siaran TV)",
    evidenceMethod: "Work sample — live floor directing simulation",
    validityCoeff: 0.54,
    benchmark: 75,
    rubric: operationalRubric([
      "Struggles to keep time; misses cue points for talent or commercial breaks during live broadcasts.",
      "Follows rundown when show is routine but gets flustered during breaking news or live schedule changes.",
      "Manages live studio floor smoothly; maintains precise timing; gives clear visual cues to anchors and guests.",
      "Flawlessly handles live breaking news interruptions and dynamic timing adjustments without air silence.",
      "Master floor director; designs rundown contingency procedures; role model for broadcast composure.",
    ]),
  },
  {
    id: "brd-video-edit",
    pillar: "skkni-broadcast",
    name: "Video Editing & Post-Production",
    nameId: "Editing Video & Post-Production",
    description:
      "Editing news packages, promos, and program segments using professional NLE systems (Adobe Premiere, Avid) with proper color grading, audio leveling, and broadcast compliance.",
    crossRef: "SKKNI: J.59MVI00.022.1 (Melakukan Editing Video)",
    evidenceMethod: "Work sample — timed editing trial",
    validityCoeff: 0.54,
    benchmark: 74,
    rubric: operationalRubric([
      "Slow editing pace; fails to meet broadcast deadline; technical errors in audio levels or color balance.",
      "Completes edits on time for routine clips but requires guidance on complex packages or color correction.",
      "Consistently produces broadcast-ready packages under tight newsroom deadlines; excellent pacing and audio balance.",
      "Creative editor who enhances storytelling through dynamic graphics and pacing; go-to person for prime-time promos.",
      "Senior post-production editor; establishes station visual standards and NLE workflow templates.",
    ]),
  },
  {
    id: "brd-mcr-trans",
    pillar: "skkni-broadcast",
    name: "MCR & Transmission Control",
    nameId: "Master Control Room (MCR) & Transmisi",
    description:
      "Monitoring Master Control Room operations, managing playout automation, switching feeds, and ensuring uninterrupted broadcast signal transmission and quality.",
    crossRef: "SKKNI: J.59MVI00.030.1 (Mengoperasikan Master Control Room)",
    evidenceMethod: "Work sample — MCR switching simulation",
    validityCoeff: 0.54,
    benchmark: 76,
    rubric: operationalRubric([
      "Inattentive monitoring; causes on-air blackouts or incorrect commercial insertion; slow error recovery.",
      "Operates routine playout schedules well but slow to switch backup systems during signal loss.",
      "Maintains flawless broadcast transmission; executes seamless switching; responds instantly to signal anomalies.",
      "Optimises MCR redundancy procedures; manages multi-channel digital playout without errors.",
      "Chief transmission engineer; designs MCR failsafe architectures; zero preventable broadcast outages.",
    ]),
  },
  {
    id: "brd-audio-eng",
    pillar: "skkni-broadcast",
    name: "Studio Audio Engineering",
    nameId: "Tata Suara & Audio Engineering",
    description:
      "Managing studio audio mixing consoles, wireless microphone RF coordination, acoustic balance, and eliminating feedback or audio clipping during live shows.",
    crossRef: "SKKNI: J.59MVI00.018.1 (Mengatur Tata Suara Siaran)",
    evidenceMethod: "Work sample — live audio mixing trial",
    validityCoeff: 0.54,
    benchmark: 73,
    rubric: operationalRubric([
      "Frequent audio feedback, clipping, or dead mics during live production; poor RF frequency coordination.",
      "Sets up basic talkshow audio well but struggles with live musical acts or multi-feed remote panels.",
      "Delivers crystal-clear broadcast audio; manages complex multi-mic live panels; proactive RF management.",
      "Solves complex acoustic challenges on remote broadcasts; masters surround sound and loudness compliance.",
      "Lead audio engineer; designs studio acoustic treatments and audio SOPs across all production units.",
    ]),
  },
  {
    id: "brd-lighting",
    pillar: "skkni-broadcast",
    name: "Studio Lighting Directing",
    nameId: "Tata Cahaya & Lighting Studio",
    description:
      "Designing and operating studio lighting rigs, DMX controllers, color temperature balancing, and creating mood lighting for various television show formats.",
    crossRef: "SKKNI: J.59MVI00.019.1 (Mengatur Tata Cahaya Studio)",
    evidenceMethod: "Work sample — lighting setup trial",
    validityCoeff: 0.54,
    benchmark: 71,
    rubric: operationalRubric([
      "Uneven studio lighting; harsh shadows on anchor faces; improper color temperature matching.",
      "Follows existing lighting presets well but slow to adjust for new set designs or special guest positions.",
      "Creates professional, flattering studio lighting setups; operates DMX consoles smoothly during production.",
      "Innovative lighting director who creates visually stunning atmospheres for prime-time variety shows.",
      "Master lighting designer; establishes station lighting guidelines and energy-efficient LED studio conversions.",
    ]),
  },
];

/* ─── SKKNI Jurnalistik & Redaksi — Kepmenaker No. 246/2020 (5) ─── */
/* Covers: Reporter, News Producer, Scriptwriter, Video Journalist, News Editor */

export const EDITORIAL_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "edt-news-research",
    pillar: "skkni-editorial",
    name: "Investigative Journalism & News Research",
    nameId: "Riset Berita & Jurnalistik Investigatif",
    description:
      "Conducting in-depth journalistic research, cultivating reliable news sources, analyzing data, and uncovering exclusive news stories of public interest.",
    crossRef: "SKKNI: M.70JUR00.001.1 (Melakukan Riset dan Investigasi Berita)",
    evidenceMethod: "Work sample — investigative research proposal",
    validityCoeff: 0.54,
    benchmark: 75,
    rubric: operationalRubric([
      "Relies only on press releases; lacks depth or initiative in finding original news angles or sources.",
      "Conducts basic background checks but needs guidance on complex data journalism or investigative digging.",
      "Consistently uncovers strong original story angles; verifies facts rigorously; maintains credible source network.",
      "Breaks high-impact investigative reports; handles sensitive whistleblower data safely and ethically.",
      "Senior investigative reporter; role model for journalistic integrity; mentors newsroom in research methods.",
    ]),
  },
  {
    id: "edt-scriptwriting",
    pillar: "skkni-editorial",
    name: "News Scriptwriting & Copyediting",
    nameId: "Penulisan Naskah Berita & Scriptwriting",
    description:
      "Writing concise, engaging broadcast news scripts (voice-over, package, lead-in) tailored for television audiences under tight newsroom deadlines.",
    crossRef: "SKKNI: M.70JUR00.005.1 (Menulis Naskah Berita Televisi)",
    evidenceMethod: "Work sample — timed news scriptwriting",
    validityCoeff: 0.54,
    benchmark: 74,
    rubric: operationalRubric([
      "Scripts are wordy, grammatically flawed, or awkward to read aloud; frequently misses deadlines.",
      "Writes clear basic news scripts but structure can be dry; occasional factual punctuation slips.",
      "Writes punchy, accurate, engaging broadcast scripts that align perfectly with video footage; always on deadline.",
      "Master storyteller who turns complex news topics into compelling, easy-to-understand television scripts.",
      "Chief copyeditor; sets newsroom writing standards and style guide; edits headline news scripts.",
    ]),
  },
  {
    id: "edt-fact-checking",
    pillar: "skkni-editorial",
    name: "Fact-Checking & Journalistic Ethics",
    nameId: "Verifikasi Fakta & Etika Jurnalistik",
    description:
      "Applying rigorous fact-checking protocols, cross-referencing multiple independent sources, and upholding strict journalistic ethics and media law compliance.",
    crossRef: "SKKNI: M.70JUR00.008.1 (Menerapkan Kode Etik Jurnalistik)",
    evidenceMethod: "Structured interview + case simulation",
    validityCoeff: 0.54,
    benchmark: 78,
    rubric: operationalRubric([
      "Publishes unverified claims; misses obvious misinformation or potential libel risks; ignores right of reply.",
      "Checks primary facts but occasionally relies on single-source verification for non-headline stories.",
      "Strictly adheres to journalistic ethics; verifies claims through multiple sources; ensures balanced reporting.",
      "Expert in debunking digital misinformation and deepfakes; navigates complex legal and ethical dilemmas flawlessly.",
      "Newsroom ethics ombudsman; sets verification protocols; protects station credibility and journalistic standards.",
    ]),
  },
  {
    id: "edt-field-report",
    pillar: "skkni-editorial",
    name: "Field Reporting & Breaking News",
    nameId: "Liputan Lapangan & Breaking News",
    description:
      "Delivering live on-camera reports from field locations, conducting on-scene interviews, and maintaining composure and accuracy during breaking news events.",
    crossRef: "SKKNI: M.70JUR00.012.1 (Melakukan Liputan Langsung / Live Report)",
    evidenceMethod: "Work sample — live reporting simulation",
    validityCoeff: 0.54,
    benchmark: 75,
    rubric: operationalRubric([
      "Nervous or articulate on camera; loses train of thought without teleprompter; poor situational awareness.",
      "Delivers solid planned field reports but gets rattled during chaotic or fast-changing breaking news.",
      "Confident, authoritative on-camera presence; delivers clear, factual live reports in dynamic field conditions.",
      "Excels in high-stakes breaking news (disasters, elections); gathers crucial facts while broadcasting live.",
      "Star anchor and senior correspondent; role model for live broadcast journalism across national media.",
    ]),
  },
  {
    id: "edt-talkshow-host",
    pillar: "skkni-editorial",
    name: "Live Interviewing & Talkshow Hosting",
    nameId: "Wawancara & Hosting Talkshow",
    description:
      "Conducting probing, balanced interviews with public figures, politicians, and experts, guiding talkshow discussions while keeping the audience engaged.",
    crossRef: "SKKNI: M.70JUR00.018.1 (Melakukan Wawancara Mendalam / In-Depth Interview)",
    evidenceMethod: "Work sample — live talkshow simulation",
    validityCoeff: 0.54,
    benchmark: 76,
    rubric: operationalRubric([
      "Reads prepared questions rigidly; fails to follow up on evasive answers; loses control of panel debates.",
      "Conducts competent interviews but misses opportunities for deeper follow-up questions or sharp insights.",
      "Skilled interviewer who asks sharp follow-ups, manages difficult guests politely, and keeps discussions on track.",
      "Master host who extracts headline-making revelations from evasive guests while maintaining fairness and poise.",
      "Flagship talkshow host; sets standard for national televised interviews and political debates.",
    ]),
  },
];

/* ─── SKKNI Satpam — Kepmenaker No. 259/2018 + Perpol No. 4/2020 (7) ─── */
/* Covers: Satpam (Gada Pratama), Danru / Supervisor Keamanan (Gada Madya) */

export const SECURITY_COMPETENCIES: CompetencyDefinition[] = [
  {
    id: "sec-access-control",
    pillar: "skkni-security",
    name: "Access Control & Guarding",
    nameId: "Kontrol Akses & Penjagaan",
    description:
      "Gate guarding, visitor/vendor logging, vehicle inspection at loading docks, employee bag checks, and reconciliation of Surat Jalan against physical cargo.",
    crossRef: "SKKNI: N.80PAM00.003.2 (Melaksanakan Penjagaan)",
    evidenceMethod: "Situational Judgment Test + observation",
    validityCoeff: 0.51,
    benchmark: 72,
    rubric: operationalRubric([
      "Allows unauthorised access; no visitor logging; fails to check Surat Jalan or cargo.",
      "Logs visitors but inconsistent vehicle checks; misses discrepancies in delivery documents.",
      "Consistent gate control; accurate visitor logging; verifies Surat Jalan against cargo; bag checks per SOP.",
      "Detects document forgery or cargo discrepancies proactively; maintains situational awareness.",
      "Designs access control procedures; zero unauthorised access incidents; trains new guards.",
    ]),
  },
  {
    id: "sec-patrol",
    pillar: "skkni-security",
    name: "Patrol & Perimeter Surveillance",
    nameId: "Pelaksanaan Patroli & Pengawasan",
    description:
      "Executing guard tour with checkpoint scanning, identifying vulnerabilities at loading bays and perimeter, monitoring CCTV, and immediate hazard reporting.",
    crossRef: "SKKNI: N.80PAM00.005.2 (Melaksanakan Patroli)",
    evidenceMethod: "Observation + patrol log review",
    validityCoeff: 0.51,
    benchmark: 70,
    rubric: operationalRubric([
      "Skips patrol checkpoints; misses obvious security vulnerabilities; no log entries.",
      "Completes patrol route but superficially; checkpoint scans inconsistent; logs lack detail.",
      "100% checkpoint compliance; identifies and logs hazards; accurate shift handover documentation.",
      "Identifies non-obvious vulnerabilities; varies patrol pattern to prevent predictability; proactive reporting.",
      "Designs patrol routes and checkpoint placement; drives perimeter security improvements; mentors junior guards.",
    ]),
  },
  {
    id: "sec-emergency-response",
    pillar: "skkni-security",
    name: "Emergency Response & Crime Scene Preservation",
    nameId: "Tanggap Darurat & TPTKP",
    description:
      "First response to fire, medical emergency, or security incidents; crime scene preservation (TPTKP — police line, status quo, witness documentation); fire suppression with APAR.",
    crossRef: "SKKNI: N.80PAM00.012.2 (TPTKP), N.80PAM00.006.2 (Pengamanan TKP)",
    evidenceMethod: "Situational Judgment Test + drill observation",
    validityCoeff: 0.51,
    benchmark: 72,
    rubric: operationalRubric([
      "Panics or freezes in emergencies; contaminates crime scenes; no first aid knowledge.",
      "Responds but with incorrect sequence; partial scene preservation; basic APAR knowledge only.",
      "Correct emergency response sequence; proper TPTKP execution (police line, evidence preservation); uses APAR.",
      "Calm under pressure; coordinates with authorities; complete BAP (Berita Acara) documentation.",
      "Leads emergency drills; designs evacuation plans; recognised authority on incident response.",
    ]),
  },
  {
    id: "sec-conflict-management",
    pillar: "skkni-security",
    name: "Conflict De-escalation & Crowd Control",
    nameId: "Penanganan Konflik & De-eskalasi",
    description:
      "Managing confrontational situations with emotional individuals, de-escalating verbal or physical conflicts between workers or outsiders, maintaining professional composure.",
    crossRef: "SKKNI Gada Madya: N.80PAM00.020.2 (Menangani Konflik)",
    evidenceMethod: "Situational Judgment Test",
    validityCoeff: 0.51,
    benchmark: 70,
    rubric: operationalRubric([
      "Escalates situations through aggression or inaction; loses composure under pressure.",
      "Attempts de-escalation but lacks technique; may use excessive or insufficient authority.",
      "De-escalates verbal conflicts using measured communication; maintains composure; reports accurately.",
      "Handles complex multi-party conflicts; prevents physical escalation; trusted by both sides.",
      "Master de-escalator; trains others; designs conflict protocols; zero excessive-force incidents.",
    ]),
  },
  {
    id: "sec-reporting",
    pillar: "skkni-security",
    name: "Incident Reporting & Documentation",
    nameId: "Pelaporan & Dokumentasi Insiden",
    description:
      "Writing accurate Incident Reports (BAP — Berita Acara Pemeriksaan), maintaining shift logbooks, documenting evidence with photos/notes, and chain-of-custody procedures.",
    evidenceMethod: "Work sample — report writing exercise",
    validityCoeff: 0.54,
    benchmark: 68,
    rubric: operationalRubric([
      "No written reports; verbal-only handovers; critical information lost between shifts.",
      "Basic logbook entries but reports lack detail, timeline accuracy, or witness information.",
      "Complete, accurate incident reports with timeline, witnesses, and evidence documentation.",
      "Reports meet legal standards (BAP format); photos and notes support investigation; clear chain of custody.",
      "Designs reporting templates; trains guards on documentation; reports cited as exemplary by management/police.",
    ]),
  },
  {
    id: "sec-physical-readiness",
    pillar: "skkni-security",
    name: "Physical Readiness & Mental Alertness",
    nameId: "Kesiapsiagaan Fisik & Mental",
    description:
      "Maintaining physical fitness for security duties (patrol stamina, emergency sprint, restraint capability), staying alert during long shifts, and professional bearing.",
    crossRef: "SKKNI: N.80PAM00.001.2 (Persiapan Pelaksanaan Tugas)",
    evidenceMethod: "Physical fitness test (Tes Kesamaptaan) + observation",
    validityCoeff: 0.51,
    benchmark: 68,
    rubric: operationalRubric([
      "Poor fitness; falls asleep on duty; unprofessional appearance or behaviour.",
      "Adequate fitness for routine duty but struggles with extended patrols or physical response.",
      "Passes fitness standards (Tes Kesamaptaan); alert throughout shift; professional bearing maintained.",
      "Excellent fitness; fast emergency response; maintains alertness under fatigue; sets example.",
      "Peak condition; trains others in fitness; leads physical readiness programmes.",
    ]),
  },
  {
    id: "sec-legal-compliance",
    pillar: "skkni-security",
    name: "Regulatory Compliance & Security Ethics",
    nameId: "Kepatuhan Regulasi & Etika Keamanan",
    description:
      "Holding valid KTA Satpam and Gada Pratama/Madya certificate, understanding legal authority limits, acting within the law (UU 2/2002), and maintaining integrity.",
    crossRef: "Perpol No. 4/2020 (Pengamanan Swakarsa)",
    evidenceMethod: "Knowledge test + integrity assessment",
    validityCoeff: 0.51,
    benchmark: 70,
    rubric: operationalRubric([
      "No valid KTA or Gada certification; unaware of legal authority limits; integrity concerns.",
      "Valid certification but poor understanding of when force is authorised; occasional protocol breaches.",
      "Valid KTA + Gada Pratama; understands authority limits; acts within legal boundaries; trustworthy.",
      "Deep understanding of security law; mentors on ethical conduct; zero integrity incidents.",
      "Gada Madya certified; shapes security policy; recognised for professional integrity by management and Polri.",
    ]),
  },
];

export const ALL_COMPETENCY_DEFINITIONS: CompetencyDefinition[] = [
  ...ULRICH_COMPETENCIES,
  ...SKKNI_COMPETENCIES,
  ...SFIA_COMPETENCIES,
  ...LOMINGER_COMPETENCIES,
  ...CGMA_COMPETENCIES,
  ...BROADCAST_COMPETENCIES,
  ...EDITORIAL_COMPETENCIES,
  ...SECURITY_COMPETENCIES,
];

export const COMPETENCY_BY_ID = Object.fromEntries(
  ALL_COMPETENCY_DEFINITIONS.map((c) => [c.id, c]),
) as Record<string, CompetencyDefinition>;

/* ═══════════════════════════════════════════════════════════════════════════
   Cluster registry — the single place that maps a role cluster to its
   framework. cv-analyzer-ai.ts generates its prompt from this, and the
   Interview Workspace picks its rubrics from it, so the two can never drift
   apart the way they did when each file kept its own copy.
═══════════════════════════════════════════════════════════════════════════ */

export type CompetencyCluster = "hr" | "tech" | "business" | "finance" | "broadcast" | "editorial" | "security";

export interface ClusterFramework {
  label: string;
  reference: string;
  competencies: CompetencyDefinition[];
}

export const CLUSTER_FRAMEWORKS: Record<CompetencyCluster, ClusterFramework> = {
  hr: {
    label: "Ulrich HR Competency Model + SKKNI No.149/2020",
    reference: "Ulrich et al. (2012); Kemnaker RI (2020)",
    competencies: [...ULRICH_COMPETENCIES, ...SKKNI_COMPETENCIES],
  },
  tech: {
    label: "SFIA v8 — Skills Framework for Information Age",
    reference: "SFIA Foundation (2023); adopted by Google, Microsoft, IBM",
    competencies: SFIA_COMPETENCIES,
  },
  business: {
    label: "Lominger Leadership Architect (Korn Ferry)",
    reference: "Korn Ferry Lominger (2014); Fortune 500 leadership selection standard",
    competencies: LOMINGER_COMPETENCIES,
  },
  finance: {
    label: "CGMA Competency Framework (CIMA/AICPA)",
    reference: "CGMA (2019); CFA Institute Standards",
    competencies: CGMA_COMPETENCIES,
  },
  broadcast: {
    label: "SKKNI Penyiaran & Multimedia — Kepmenaker No. 133/2019",
    reference: "Kemnaker RI (2019); BNSP/LSP Penyiaran; Schmidt & Hunter (1998) work sample validity",
    competencies: BROADCAST_COMPETENCIES,
  },
  editorial: {
    label: "SKKNI Jurnalistik & Redaksi — Kepmenaker No. 246/2020",
    reference: "Kemnaker RI (2020); Dewan Pers / LSP Jurnalistik",
    competencies: EDITORIAL_COMPETENCIES,
  },
  security: {
    label: "SKKNI Satuan Pengamanan — Kepmenaker No. 259/2018",
    reference: "Kemnaker RI (2018); Perpol No. 4/2020; BNSP/LSP Polri; Gada Pratama/Madya",
    competencies: SECURITY_COMPETENCIES,
  },
};

/** Renders a cluster's competencies as the prompt block sent to the model.
 *  Generated from the definitions above so benchmarks and level descriptions
 *  can never disagree with what the UI renders. Levels are compressed to 1/3/5
 *  to keep the prompt inside the Groq per-minute token budget. */
export function buildFrameworkPrompt(cluster: CompetencyCluster): string {
  const fw = CLUSTER_FRAMEWORKS[cluster];
  const lines = fw.competencies.map((c, i) => {
    const at = (score: number) => c.rubric.find((r) => r.score === score)?.description ?? "";
    return `${i + 1}. id:${c.id} | ${c.name} | pillar:${c.pillar} | bench:${c.benchmark}\n   Level 1=${at(1)} | 3=${at(3)} | 5=${at(5)}`;
  });
  return [
    `FRAMEWORK: ${fw.label}`,
    `Reference: ${fw.reference}`,
    `Score conversion: level 1→20, 2→40, 3→60, 4→80, 5→100`,
    ``,
    ...lines,
    ``,
    `Total: ${fw.competencies.length} kompetensi`,
  ].join("\n");
}

// REMOVED — INTERVIEW_TYPE_MAP, CV_MOCK_SCORES and buildCvCompetencyScores().
// All three were dead code that produced HR-only or fabricated scores. They are
// the same hazard that caused real Hiring Reports to display a demo candidate's
// numbers: a plausible-looking function returning invented data, sitting in
// scope waiting to be wired up. Interviewer notes now list the competencies the
// generated questions actually cover, and CV scores come from the AI response.

const REPORT_CANDIDATE_SCORES: Record<
  string,
  Partial<Record<string, { cv: number; interview: number; weight: number }>>
> = {
  "C-1042": {
    "ulrich-credible-activist": { cv: 90, interview: 92, weight: 10 },
    "ulrich-strategic-positioner": { cv: 88, interview: 86, weight: 10 },
    "ulrich-capability-builder": { cv: 89, interview: 88, weight: 9 },
    "ulrich-change-champion": { cv: 85, interview: 84, weight: 9 },
    "ulrich-hr-innovator": { cv: 87, interview: 90, weight: 9 },
    "ulrich-technology-proponent": { cv: 86, interview: 84, weight: 8 },
    "skkni-perencanaan": { cv: 88, interview: 87, weight: 9 },
    "skkni-rekrutmen": { cv: 92, interview: 91, weight: 10 },
    "skkni-pengembangan": { cv: 90, interview: 89, weight: 9 },
    "skkni-kinerja": { cv: 86, interview: 88, weight: 9 },
    "skkni-hubungan-industrial": { cv: 82, interview: 85, weight: 8 },
  },
  "C-1038": {
    "ulrich-credible-activist": { cv: 80, interview: 78, weight: 9 },
    "ulrich-strategic-positioner": { cv: 82, interview: 80, weight: 10 },
    "ulrich-capability-builder": { cv: 92, interview: 90, weight: 10 },
    "ulrich-change-champion": { cv: 78, interview: 76, weight: 8 },
    "ulrich-hr-innovator": { cv: 84, interview: 82, weight: 9 },
    "ulrich-technology-proponent": { cv: 94, interview: 92, weight: 11 },
    "skkni-perencanaan": { cv: 80, interview: 78, weight: 8 },
    "skkni-rekrutmen": { cv: 88, interview: 86, weight: 10 },
    "skkni-pengembangan": { cv: 86, interview: 84, weight: 9 },
    "skkni-kinerja": { cv: 82, interview: 80, weight: 9 },
    "skkni-hubungan-industrial": { cv: 74, interview: 72, weight: 7 },
  },
  "C-1024": {
    "ulrich-credible-activist": { cv: 72, interview: 74, weight: 9 },
    "ulrich-strategic-positioner": { cv: 64, interview: 70, weight: 9 },
    "ulrich-capability-builder": { cv: 70, interview: 72, weight: 9 },
    "ulrich-change-champion": { cv: 66, interview: 68, weight: 8 },
    "ulrich-hr-innovator": { cv: 68, interview: 70, weight: 8 },
    "ulrich-technology-proponent": { cv: 78, interview: 80, weight: 10 },
    "skkni-perencanaan": { cv: 62, interview: 68, weight: 8 },
    "skkni-rekrutmen": { cv: 70, interview: 74, weight: 10 },
    "skkni-pengembangan": { cv: 68, interview: 70, weight: 9 },
    "skkni-kinerja": { cv: 64, interview: 66, weight: 9 },
    "skkni-hubungan-industrial": { cv: 70, interview: 72, weight: 9 },
  },
};

/** Rows for the three built-in DEMO reports only. Emits a row only where the
 *  demo data actually has a score: it must not iterate every definition and
 *  invent numbers for the rest. (It used to fall back to `{cv:75, interview:74}`
 *  for anything missing, which meant adding the 25 SFIA/Lominger/CGMA
 *  definitions silently grew every demo report by 25 fabricated rows.) */
export function buildReportCompetencyRows(candidateId: string): CompetencyReportRow[] {
  const overrides = REPORT_CANDIDATE_SCORES[candidateId];
  if (!overrides) return [];
  return ALL_COMPETENCY_DEFINITIONS.flatMap((def) => {
    const o = overrides[def.id];
    if (!o) return [];
    return [{
      id: def.id,
      name: def.pillar === "skkni" && def.nameId ? def.nameId : def.name,
      pillar: def.pillar,
      cvScore: o.cv,
      interviewScore: o.interview,
      finalScore: blendScore(o.cv, o.interview),
      weight: o.weight,
      rubric: def.rubric,
    }];
  });
}

export function getCompetencyRubric(competencyId: string): RubricLevel[] {
  return COMPETENCY_BY_ID[competencyId]?.rubric ?? [];
}

export function getPillarLabel(pillar: CompetencyPillar): string {
  const map: Record<string, string> = {
    ulrich: "Ulrich HR Competency Model",
    skkni: "SKKNI No. 149/2020 (Indonesia)",
    sfia: "SFIA v8 — Skills Framework for Information Age",
    lominger: "Lominger Leadership Architect (Korn Ferry)",
    cgma: "CGMA Competency Framework (CIMA/AICPA)",
    "skkni-broadcast": "SKKNI Penyiaran & Multimedia (Kepmenaker 133/2019)",
    "skkni-editorial": "SKKNI Jurnalistik & Redaksi (Kepmenaker 246/2020)",
    "skkni-security": "SKKNI Satuan Pengamanan (Kepmenaker 259/2018)",
  };
  return map[pillar] ?? pillar;
}
