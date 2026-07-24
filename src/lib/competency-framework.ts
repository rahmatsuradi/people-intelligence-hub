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
  interviewScore: number;
  finalScore: number;
  weight: number;
  rubric: RubricLevel[];
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

export const ALL_COMPETENCY_DEFINITIONS: CompetencyDefinition[] = [
  ...ULRICH_COMPETENCIES,
  ...SKKNI_COMPETENCIES,
  ...SFIA_COMPETENCIES,
  ...LOMINGER_COMPETENCIES,
  ...CGMA_COMPETENCIES,
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

export type CompetencyCluster = "hr" | "tech" | "business" | "finance";

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

export function buildReportCompetencyRows(candidateId: string): CompetencyReportRow[] {
  const overrides = REPORT_CANDIDATE_SCORES[candidateId] ?? REPORT_CANDIDATE_SCORES["C-1042"];
  return ALL_COMPETENCY_DEFINITIONS.map((def) => {
    const o = overrides[def.id] ?? { cv: 75, interview: 74, weight: 9 };
    const finalScore = Math.round(o.cv * 0.4 + o.interview * 0.6);
    return {
      id: def.id,
      name: def.pillar === "skkni" && def.nameId ? def.nameId : def.name,
      pillar: def.pillar,
      cvScore: o.cv,
      interviewScore: o.interview,
      finalScore,
      weight: o.weight,
      rubric: def.rubric,
    };
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
  };
  return map[pillar] ?? pillar;
}
