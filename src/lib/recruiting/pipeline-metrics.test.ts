import { describe, it, expect } from "vitest";
import {
  buildFunnel,
  buildReqStatus,
  buildSourceStats,
  buildStageVelocity,
  buildSummary,
  computeTimeToHire,
  detectBottlenecks,
  everReached,
  findStalled,
  median,
  STALL_THRESHOLD_DAYS,
} from "./pipeline-metrics";
import type { CandidateRecord, JobRequisition, PipelineStage, StageEvent } from "../store";

const DAY = 86_400_000;
const BASE = new Date("2026-06-01T00:00:00.000Z").getTime();
const at = (dayOffset: number) => new Date(BASE + dayOffset * DAY).toISOString();

function cand(over: Partial<CandidateRecord> & { id: string }): CandidateRecord {
  return {
    name: over.id,
    email: "",
    phone: "",
    stage: "applied",
    jobReqId: "",
    department: "Ops",
    position: "Staf",
    source: "Manual",
    notes: "",
    cvAnalysis: null,
    interviewResults: [],
    createdAt: at(0),
    updatedAt: at(0),
    ...over,
  } as CandidateRecord;
}

/** Riwayat berurutan: stages[i] terjadi pada days[i]. */
function hist(stages: PipelineStage[], days: number[]): StageEvent[] {
  return stages.map((stage, i) => ({ stage, from: i === 0 ? null : stages[i - 1], at: at(days[i]) }));
}

describe("median", () => {
  it("mengembalikan null untuk daftar kosong, bukan nol", () => {
    // "Belum ada data" dan "nol hari" adalah dua pernyataan yang sangat berbeda.
    expect(median([])).toBeNull();
  });

  it("menghitung nilai tengah pada jumlah ganjil dan genap", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("tahan terhadap satu nilai ekstrem", () => {
    // Inilah alasan median dipakai, bukan rata-rata: satu kandidat yang
    // menggantung 300 hari tidak boleh merusak seluruh metrik.
    expect(median([2, 3, 4, 300])).toBe(3.5);
  });
});

describe("everReached", () => {
  it("membaca dari riwayat tahap bila ada", () => {
    const c = cand({ id: "A", stage: "rejected", stageHistory: hist(["applied", "screened", "rejected"], [0, 2, 5]) });
    expect(everReached(c, "screened")).toBe(true);
    expect(everReached(c, "interviewed")).toBe(false);
  });

  it("jatuh ke posisi tahap sekarang bagi kandidat lama tanpa riwayat", () => {
    // Kandidat lama tetap harus ikut terhitung di corong.
    const c = cand({ id: "B", stage: "offered" });
    expect(everReached(c, "applied")).toBe(true);
    expect(everReached(c, "interviewed")).toBe(true);
    expect(everReached(c, "hired")).toBe(false);
  });

  it("kandidat rejected tanpa riwayat tidak diklaim pernah mencapai tahap mana pun", () => {
    // 'rejected' bukan bagian dari urutan maju — tanpa riwayat, sejauh mana ia
    // sempat melangkah memang tidak diketahui, dan tidak boleh ditebak.
    const c = cand({ id: "C", stage: "rejected" });
    expect(everReached(c, "screened")).toBe(false);
  });
});

describe("buildFunnel", () => {
  const candidates = [
    cand({ id: "1", stage: "applied", stageHistory: hist(["applied"], [0]) }),
    cand({ id: "2", stage: "screened", stageHistory: hist(["applied", "screened"], [0, 2]) }),
    cand({ id: "3", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 2, 5]) }),
    cand({ id: "4", stage: "hired", stageHistory: hist(["applied", "screened", "interviewed", "offered", "hired"], [0, 2, 5, 8, 12]) }),
  ];

  it("menghitung berapa kandidat yang PERNAH mencapai tiap tahap", () => {
    const f = buildFunnel(candidates);
    expect(f.find((s) => s.stage === "applied")!.reached).toBe(4);
    expect(f.find((s) => s.stage === "screened")!.reached).toBe(3);
    expect(f.find((s) => s.stage === "interviewed")!.reached).toBe(2);
    expect(f.find((s) => s.stage === "hired")!.reached).toBe(1);
  });

  it("membedakan 'pernah mencapai' dari 'sedang berada di sini'", () => {
    const f = buildFunnel(candidates);
    const screened = f.find((s) => s.stage === "screened")!;
    expect(screened.reached).toBe(3); // 3 pernah lolos screening
    expect(screened.current).toBe(1); // tapi hanya 1 yang masih tertahan di sana
  });

  it("menghitung konversi antar-tahap terhadap tahap sebelumnya", () => {
    const f = buildFunnel(candidates);
    expect(f.find((s) => s.stage === "applied")!.stepConversionPct).toBeNull();
    expect(f.find((s) => s.stage === "screened")!.stepConversionPct).toBe(75); // 3 dari 4
  });

  it("tidak menghasilkan NaN untuk pipeline kosong", () => {
    for (const step of buildFunnel([])) {
      expect(step.reachedPct).toBe(0);
      expect(Number.isNaN(step.reachedPct)).toBe(false);
    }
  });
});

describe("buildStageVelocity", () => {
  it("menghitung median hari yang dihabiskan di tiap tahap", () => {
    const candidates = [
      cand({ id: "1", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 2, 6]) }),
      cand({ id: "2", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 4, 10]) }),
    ];
    const v = buildStageVelocity(candidates);
    expect(v.find((x) => x.stage === "applied")!.medianDays).toBe(3); // median(2, 4)
    expect(v.find((x) => x.stage === "screened")!.medianDays).toBe(5); // median(4, 6)
    expect(v.find((x) => x.stage === "applied")!.basedOn).toBe(2);
  });

  it("melaporkan null (bukan nol) untuk tahap yang belum punya data", () => {
    const v = buildStageVelocity([cand({ id: "1", stage: "applied", stageHistory: hist(["applied"], [0]) })]);
    expect(v.find((x) => x.stage === "offered")!.medianDays).toBeNull();
    expect(v.find((x) => x.stage === "offered")!.basedOn).toBe(0);
  });

  it("mengabaikan riwayat dengan urutan waktu terbalik", () => {
    const broken = cand({ id: "X", stage: "screened", stageHistory: hist(["applied", "screened"], [10, 2]) });
    expect(buildStageVelocity([broken]).find((x) => x.stage === "applied")!.basedOn).toBe(0);
  });
});

describe("computeTimeToHire", () => {
  it("mengukur dari entri riwayat pertama sampai tahap hired", () => {
    const candidates = [
      cand({ id: "1", stage: "hired", stageHistory: hist(["applied", "screened", "hired"], [0, 5, 20]) }),
      cand({ id: "2", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 30]) }),
    ];
    const t = computeTimeToHire(candidates);
    expect(t.medianDays).toBe(25);
    expect(t.fastestDays).toBe(20);
    expect(t.slowestDays).toBe(30);
    expect(t.basedOn).toBe(2);
  });

  it("mengeluarkan kandidat hired tanpa riwayat dan melaporkan jumlahnya", () => {
    // Ini pagar utamanya: kandidat tanpa riwayat TIDAK boleh dihitung 0 hari,
    // karena itu akan membuat time-to-hire terlihat jauh lebih cepat dari nyatanya.
    const t = computeTimeToHire([
      cand({ id: "1", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 20]) }),
      cand({ id: "2", stage: "hired" }),
    ]);
    expect(t.basedOn).toBe(1);
    expect(t.excludedNoHistory).toBe(1);
    expect(t.medianDays).toBe(20);
  });

  it("mengembalikan null ketika belum ada yang direkrut", () => {
    const t = computeTimeToHire([cand({ id: "1", stage: "applied" })]);
    expect(t.medianDays).toBeNull();
    expect(t.basedOn).toBe(0);
  });
});

describe("buildReqStatus", () => {
  const req = (over: Partial<JobRequisition> = {}): JobRequisition => ({
    id: "R1", title: "Host Live", department: "Sales", level: "Staff", status: "active",
    description: "", requirements: "", salaryMin: 0, salaryMax: 0, currency: "IDR",
    location: "", targetDate: "2026-06-30", headcount: 2, hiringManager: "",
    createdAt: at(0), updatedAt: at(0), ...over,
  });

  const now = new Date(BASE + 20 * DAY);

  it("menandai lowongan terpenuhi ketika jumlah hired mencapai headcount", () => {
    const s = buildReqStatus([req()], [
      cand({ id: "1", jobReqId: "R1", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 8]) }),
      cand({ id: "2", jobReqId: "R1", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 12]) }),
    ], now)[0];

    expect(s.status).toBe("terpenuhi");
    expect(s.hiredCount).toBe(2);
    expect(s.filledInDays).toBe(12); // sampai hire ke-2 yang menutup kebutuhan
  });

  it("belum terpenuhi bila hired masih kurang dari headcount", () => {
    const s = buildReqStatus([req()], [
      cand({ id: "1", jobReqId: "R1", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 8]) }),
    ], now)[0];
    expect(s.status).toBe("berjalan");
    expect(s.filledInDays).toBeNull();
  });

  it("menandai lowongan yang sudah lewat tanggal target", () => {
    const late = new Date(BASE + 60 * DAY); // target 2026-06-30 sudah lewat
    const s = buildReqStatus([req()], [cand({ id: "1", jobReqId: "R1", stage: "screened" })], late)[0];
    expect(s.status).toBe("lewat_target");
    expect(s.daysToTarget! < 0).toBe(true);
  });

  it("menandai lowongan yang sama sekali belum punya pelamar", () => {
    const s = buildReqStatus([req()], [], now)[0];
    expect(s.status).toBe("tanpa_kandidat");
    expect(s.activePipeline).toBe(0);
  });

  it("tidak menghitung kandidat rejected sebagai pipeline aktif", () => {
    const s = buildReqStatus([req()], [
      cand({ id: "1", jobReqId: "R1", stage: "rejected" }),
      cand({ id: "2", jobReqId: "R1", stage: "screened" }),
    ], now)[0];
    expect(s.activePipeline).toBe(1);
  });
});

describe("buildSourceStats", () => {
  it("mengurutkan sumber berdasarkan jumlah hire, bukan jumlah pelamar", () => {
    // Sumber ramai tanpa hasil tidak boleh terlihat sebagai sumber terbaik.
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => cand({ id: `job-${i}`, source: "JobStreet", stage: "rejected" })),
      cand({ id: "ref-1", source: "Referral", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 10]) }),
      cand({ id: "ref-2", source: "Referral", stage: "screened" }),
    ];
    const stats = buildSourceStats(candidates);
    expect(stats[0].source).toBe("Referral");
    expect(stats[0].hireRatePct).toBe(50);
    expect(stats.find((s) => s.source === "JobStreet")!.hireRatePct).toBe(0);
  });

  it("mengelompokkan sumber kosong sebagai 'Tidak diketahui', bukan string kosong", () => {
    expect(buildSourceStats([cand({ id: "1", source: "" })])[0].source).toBe("Tidak diketahui");
  });

  it("mengembalikan null untuk skor CV bila belum ada yang dianalisis", () => {
    expect(buildSourceStats([cand({ id: "1", source: "Manual" })])[0].avgCvScore).toBeNull();
  });
});

describe("findStalled", () => {
  const now = new Date(BASE + 30 * DAY);

  it("menandai kandidat yang melewati ambang tahapnya", () => {
    const c = cand({ id: "1", stage: "screened", stageHistory: hist(["applied", "screened"], [0, 5]) });
    const stalled = findStalled([c], now);
    expect(stalled).toHaveLength(1);
    expect(stalled[0].daysInStage).toBe(25);
    expect(stalled[0].thresholdDays).toBe(STALL_THRESHOLD_DAYS.screened);
  });

  it("tidak menandai kandidat yang masih dalam ambang", () => {
    const recent = new Date(BASE + 8 * DAY);
    const c = cand({ id: "1", stage: "screened", stageHistory: hist(["applied", "screened"], [0, 5]) });
    expect(findStalled([c], recent)).toHaveLength(0);
  });

  it("tidak pernah menandai kandidat yang sudah hired atau rejected", () => {
    const done = [
      cand({ id: "1", stage: "hired", stageHistory: hist(["applied", "hired"], [0, 1]) }),
      cand({ id: "2", stage: "rejected", stageHistory: hist(["applied", "rejected"], [0, 1]) }),
    ];
    expect(findStalled(done, now)).toHaveLength(0);
  });

  it("memakai updatedAt sebagai perkiraan untuk kandidat tanpa riwayat", () => {
    const c = cand({ id: "1", stage: "applied", updatedAt: at(2) });
    expect(findStalled([c], now)[0].daysInStage).toBe(28);
  });

  it("mengurutkan yang paling lama mandek di paling atas", () => {
    const list = [
      cand({ id: "baru", stage: "applied", updatedAt: at(20) }),
      cand({ id: "lama", stage: "applied", updatedAt: at(1) }),
    ];
    expect(findStalled(list, now)[0].id).toBe("lama");
  });
});

describe("buildSummary", () => {
  const reqs: JobRequisition[] = [{
    id: "R1", title: "Host", department: "Sales", level: "Staff", status: "active",
    description: "", requirements: "", salaryMin: 0, salaryMax: 0, currency: "IDR",
    location: "", targetDate: "", headcount: 1, hiringManager: "", createdAt: at(0), updatedAt: at(0),
  }];

  it("menghitung offer acceptance dari yang PERNAH ditawari", () => {
    const candidates = [
      cand({ id: "1", stage: "hired", stageHistory: hist(["applied", "offered", "hired"], [0, 5, 8]) }),
      cand({ id: "2", stage: "rejected", stageHistory: hist(["applied", "offered", "rejected"], [0, 5, 9]) }),
    ];
    const s = buildSummary(candidates, reqs, new Date(BASE + 10 * DAY));
    expect(s.offerBasedOn).toBe(2);
    expect(s.offerAcceptRatePct).toBe(50);
  });

  it("mengembalikan null untuk offer acceptance bila belum ada penawaran", () => {
    const s = buildSummary([cand({ id: "1", stage: "applied" })], reqs);
    expect(s.offerAcceptRatePct).toBeNull();
    expect(s.offerBasedOn).toBe(0);
  });

  it("melaporkan jumlah kandidat tanpa riwayat sebagai batas keandalan metrik", () => {
    const s = buildSummary([
      cand({ id: "1", stage: "applied", stageHistory: hist(["applied"], [0]) }),
      cand({ id: "2", stage: "applied" }),
    ], reqs);
    expect(s.withoutHistory).toBe(1);
  });

  it("tidak membagi dengan nol ketika tidak ada lowongan aktif", () => {
    const s = buildSummary([cand({ id: "1", stage: "applied" })], []);
    expect(s.candidatesPerOpenReq).toBeNull();
  });
});

describe("detectBottlenecks", () => {
  it("menandai tahap dengan konversi anjlok", () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) =>
        cand({ id: `a${i}`, stage: "applied", stageHistory: hist(["applied"], [0]) })),
      cand({ id: "s1", stage: "screened", stageHistory: hist(["applied", "screened"], [0, 2]) }),
    ];
    const funnel = buildFunnel(candidates);
    const b = detectBottlenecks(funnel, buildStageVelocity(candidates));
    expect(b.some((x) => x.stage === "screened" && x.severity === "tinggi")).toBe(true);
  });

  it("menandai tahap yang durasinya jauh di atas tahap lain", () => {
    const candidates = [
      cand({ id: "1", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 1, 31]) }),
      cand({ id: "2", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 1, 31]) }),
    ];
    const b = detectBottlenecks(buildFunnel(candidates), buildStageVelocity(candidates));
    expect(b.some((x) => x.stage === "screened" && x.severity === "sedang")).toBe(true);
  });

  it("tidak menandai apa pun pada pipeline kosong", () => {
    expect(detectBottlenecks(buildFunnel([]), buildStageVelocity([]))).toHaveLength(0);
  });

  it("tidak menandai tahap yang memang cepat meski selisihnya berlipat", () => {
    // 0,5 hari vs 0,2 hari adalah selisih 2,5x tetapi bukan hambatan apa pun.
    const candidates = [
      cand({ id: "1", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 0.2, 0.7]) }),
      cand({ id: "2", stage: "interviewed", stageHistory: hist(["applied", "screened", "interviewed"], [0, 0.2, 0.7]) }),
    ];
    const b = detectBottlenecks(buildFunnel(candidates), buildStageVelocity(candidates));
    expect(b.filter((x) => x.severity === "sedang")).toHaveLength(0);
  });
});
