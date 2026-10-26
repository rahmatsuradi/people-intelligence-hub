import { describe, expect, it } from "vitest";
import {
  distribution, groupAverage, lastChange, periodLabel, periodsWithoutActions, questionAverage, recurringThemes, summarize, trend,
  type PeriodSummary, type SurveyAction, type SurveyQuestion,
} from "./pulse";

const happiness: SurveyQuestion = {
  key: "happiness", label: "Rasa bahagia", type: "choice", higherIsBetter: true,
  options: [{ value: "Sangat Tidak Bahagia", score: 1 }, { value: "Tidak Bahagia", score: 2 }, { value: "Bahagia", score: 3 }, { value: "Sangat Bahagia", score: 4 }],
};
const stress: SurveyQuestion = {
  key: "stress", label: "Frekuensi stres", type: "choice", higherIsBetter: false,
  options: [{ value: "Tidak sama sekali", score: 0 }, { value: "Setiap hari", score: 5 }],
};
const comfort: SurveyQuestion = { key: "comfort", label: "Kenyamanan", type: "scale", min: 1, max: 10, higherIsBetter: true };
const factors: SurveyQuestion = { key: "factors", label: "Alasan senang", type: "multi", options: [{ value: "Job-Related", label: "Pekerjaannya sendiri" }, { value: "Work Environment" }] };
const feedback: SurveyQuestion = { key: "feedback", label: "Usulan", type: "text" };
const survey = { questions: [happiness, factors, feedback, comfort] };

const resp = (period: string, answers: Record<string, string | number | string[]>) => ({ period, answers });

describe("summarize (cermin pi_survey_summary)", () => {
  const rs = [
    resp("2026-08-01", { happiness: "Bahagia", factors: ["Job-Related", "Work Environment"], feedback: "Libur ditambah", comfort: 8 }),
    resp("2026-08-01", { happiness: "Tidak Bahagia", factors: ["Job-Related"], comfort: 6 }),
    resp("2026-08-01", { happiness: "Bahagia" }),
    resp("2026-09-01", { happiness: "Sangat Bahagia" }),
  ];
  const out = summarize(survey, rs);

  it("menghitung per periode, urut naik, dan pertanyaan tertulis tidak pernah masuk", () => {
    expect(out.map((p) => p.period)).toEqual(["2026-08-01", "2026-09-01"]);
    expect(out[0].questions.happiness).toEqual({ answered: 3, counts: { Bahagia: 2, "Tidak Bahagia": 1 } });
    expect(out[0].questions.feedback).toBeUndefined();
  });

  it("pilihan ganda: answered = jumlah orang, counts boleh melebihinya", () => {
    expect(out[0].questions.factors).toEqual({ answered: 2, counts: { "Job-Related": 2, "Work Environment": 1 } });
  });

  it("periode < 3 jawaban disembunyikan rinciannya, jumlahnya tetap dilaporkan", () => {
    expect(out[1]).toEqual({ period: "2026-09-01", n: 1, suppressed: true, questions: {} });
  });
});

describe("questionAverage", () => {
  it("pilihan memakai skor opsi; skala memakai angkanya", () => {
    expect(questionAverage(happiness, { answered: 3, counts: { Bahagia: 2, "Tidak Bahagia": 1 } })).toEqual({ avg: 8 / 3, n: 3 });
    expect(questionAverage(comfort, { answered: 2, counts: { "8": 1, "6": 1 } })).toEqual({ avg: 7, n: 2 });
  });

  it("jawaban tanpa skor dikeluarkan dari pembagi, bukan dihitung nol", () => {
    expect(questionAverage(happiness, { answered: 2, counts: { Bahagia: 1, "Lain-lain": 1 } })).toEqual({ avg: 3, n: 1 });
  });

  it("pertanyaan tertulis / tanpa data tidak punya rata-rata", () => {
    expect(questionAverage(feedback, { answered: 1, counts: { x: 1 } })).toEqual({ avg: null, n: 0 });
    expect(questionAverage(happiness, undefined)).toEqual({ avg: null, n: 0 });
  });
});

describe("trend & lastChange", () => {
  const p = (period: string, counts: Record<string, number>, suppressed = false): PeriodSummary =>
    ({ period, n: suppressed ? 1 : 3, suppressed, questions: suppressed ? {} : { stress: { answered: 3, counts } } });
  const points = trend(stress, [p("2026-06-01", { "Setiap hari": 3 }), p("2026-07-01", {}, true), p("2026-08-01", { "Tidak sama sekali": 3 })]);

  it("periode tersembunyi tetap muncul tanpa angka", () => {
    expect(points.map((x) => x.avg)).toEqual([5, null, 0]);
    expect(points[1].suppressed).toBe(true);
  });

  it("membandingkan dengan titik terakhir yang punya angka dan memperhitungkan arah", () => {
    const c = lastChange(stress, points);
    expect(c.previous?.period).toBe("2026-06-01");
    expect(c.delta).toBe(-5);
    expect(c.better).toBe(true); // stres turun = membaik
  });

  it("tanpa titik pembanding tidak ada kesimpulan", () => {
    expect(lastChange(stress, points.slice(0, 1))).toMatchObject({ delta: null, better: null });
  });
});

describe("distribution", () => {
  it("urut sesuai opsi, opsi kosong tetap tampil, persen terhadap penjawab", () => {
    const d = distribution(happiness, { answered: 4, counts: { Bahagia: 3, "Sangat Bahagia": 1 } });
    expect(d.map((r) => [r.value, r.count])).toEqual([["Sangat Tidak Bahagia", 0], ["Tidak Bahagia", 0], ["Bahagia", 3], ["Sangat Bahagia", 1]]);
    expect(d[2].pct).toBe(75);
  });

  it("pilihan ganda: urut terbanyak, label opsi dipakai, nilai di luar opsi ikut", () => {
    const d = distribution(factors, { answered: 2, counts: { "Job-Related": 2, Lain: 1 } });
    expect(d.map((r) => [r.label, r.pct])).toEqual([["Pekerjaannya sendiri", 100], ["Lain", 50]]);
  });

  it("skala menampilkan setiap angka dari min sampai max", () => {
    expect(distribution({ ...comfort, max: 3 }, { answered: 1, counts: { "2": 1 } }).map((r) => r.count)).toEqual([0, 1, 0]);
  });
});

const action = (id: string, period: string, theme: string, status: SurveyAction["status"] = "belum"): SurveyAction =>
  ({ id, survey_id: "s", period, title: `Butir ${id}`, theme, pic: null, plan: null, result: null, status, source: null });

describe("recurringThemes", () => {
  const list = [
    action("1", "2026-02-01", "libur"), action("2", "2026-03-01", "libur"), action("3", "2026-06-01", "libur"),
    action("4", "2026-02-01", "lembur", "selesai"), action("5", "2026-04-01", "lembur", "selesai"),
    action("6", "2026-04-01", "fasilitas"),
    action("7", "2026-02-01", "lainnya"), action("8", "2026-03-01", "lainnya"),
    action("9", "2026-03-01", "gaji & benefit"), action("10", "2026-04-01", "gaji & benefit", "berjalan"),
  ];
  const out = recurringThemes(list);

  it("hanya tema ≥ 2 periode yang masih terbuka; terbanyak periode di atas", () => {
    expect(out.map((t) => t.theme)).toEqual(["libur", "gaji & benefit"]);
    expect(out[0]).toMatchObject({ periods: ["2026-02-01", "2026-03-01", "2026-06-01"], open: 3, total: 3 });
  });

  it("butir terbaru dipakai sebagai contoh", () => {
    expect(out[0].latest.id).toBe("3");
  });
});

describe("periodsWithoutActions", () => {
  it("periode survei setelah action terakhir yang belum punya butir", () => {
    const s = ["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"].map((period) => ({ period, n: 5, suppressed: false, questions: {} }));
    expect(periodsWithoutActions(s, [action("1", "2026-06-01", "libur")])).toEqual(["2026-07-01", "2026-08-01"]);
    expect(periodsWithoutActions(s, [])).toEqual([]);
  });
});

describe("groupAverage", () => {
  it("rata-rata per kelompok, terendah di atas; tanpa kelompok jadi 'Tidak diisi'", () => {
    const rs: { answers: Record<string, string | number> }[] = [{ answers: { spv: "Irfan", comfort: 9 } }, { answers: { spv: "Irfan", comfort: 7 } }, { answers: { spv: "Doni", comfort: 4 } }, { answers: { comfort: 6 } }];
    expect(groupAverage(comfort, rs, "spv")).toEqual([
      { group: "Doni", avg: 4, n: 1 }, { group: "Tidak diisi", avg: 6, n: 1 }, { group: "Irfan", avg: 8, n: 2 },
    ]);
  });
});

describe("periodLabel", () => {
  it("bulan bahasa Indonesia", () => {
    expect(periodLabel("2026-09-01")).toBe("September 2026");
  });
});

/* ─── Tahap 2: KPI, formulir publik, sinyal, apresiasi ─── */
import { appreciationCounts, isVisible, kpi, kpiBetter, kpiTrend, signals, validateSubmission } from "./pulse";

const happyK: SurveyQuestion = { ...happiness, favorable: ["Bahagia", "Sangat Bahagia"], kpiLabel: "Indeks bahagia", required: true };
const stressK: SurveyQuestion = {
  key: "stress", label: "Frekuensi stres", type: "choice", required: true, risk: ["2 - 3x dalam seminggu", "Setiap hari"], kpiLabel: "Stres tinggi",
  options: [{ value: "Tidak sama sekali" }, { value: "2 - 3x dalam seminggu" }, { value: "Setiap hari" }],
};
const comfortK: SurveyQuestion = { ...comfort, favorableMin: 8, kpiLabel: "Nyaman" };

describe("kpi (% favorable / % risiko)", () => {
  it("favorable menghitung pilihan baik terhadap yang menjawab", () => {
    expect(kpi(happyK, { answered: 4, counts: { Bahagia: 2, "Sangat Bahagia": 1, "Tidak Bahagia": 1 } })).toEqual({ pct: 75, hits: 3, n: 4, kind: "favorable" });
  });
  it("risiko menghitung pilihan berisiko; ambang skala untuk pertanyaan 1–10", () => {
    expect(kpi(stressK, { answered: 5, counts: { "Setiap hari": 1, "2 - 3x dalam seminggu": 1, "Tidak sama sekali": 3 } })?.pct).toBe(40);
    expect(kpi(comfortK, { answered: 4, counts: { "7": 1, "8": 2, "10": 1 } })?.pct).toBe(75);
  });
  it("tanpa definisi KPI = null; tanpa jawaban = pct null", () => {
    expect(kpi(happiness, { answered: 1, counts: { Bahagia: 1 } })).toBeNull();
    expect(kpi(happyK, undefined)).toEqual({ pct: null, hits: 0, n: 0, kind: "favorable" });
  });
  it("arah kabar baik: favorable naik baik, risiko naik buruk", () => {
    expect(kpiBetter(happyK, 5)).toBe(true);
    expect(kpiBetter(stressK, 5)).toBe(false);
  });
  it("tren melewati periode tersembunyi tanpa angka", () => {
    const t = kpiTrend(happyK, [{ period: "2026-08-01", n: 1, suppressed: true, questions: {} }]);
    expect(t).toEqual([{ period: "2026-08-01", pct: null, n: 0, suppressed: true }]);
  });
});

describe("isVisible & validateSubmission", () => {
  const reason: SurveyQuestion = { key: "reason", label: "Alasan", type: "text", showIf: { key: "stress", notIn: ["Tidak sama sekali"] } };
  const activity: SurveyQuestion = { key: "activity", label: "Kegiatan", type: "multi", options: [{ value: "Karaoke" }, { value: "Olahraga" }] };
  const s = { questions: [happyK, stressK, reason, activity, comfortK] };

  it("syarat tampil: notIn & in", () => {
    expect(isVisible(reason, { stress: "Tidak sama sekali" })).toBe(false);
    expect(isVisible(reason, { stress: "Setiap hari" })).toBe(true);
    expect(isVisible(reason, {})).toBe(false);
    expect(isVisible({ ...reason, showIf: { key: "stress", in: ["Setiap hari"] } }, { stress: "Setiap hari" })).toBe(true);
  });

  it("menyimpan yang sah saja: key asing dibuang, multi disaring ke opsi, jawaban tersembunyi dibuang", () => {
    const r = validateSubmission(s, { happiness: "Bahagia", stress: "Tidak sama sekali", reason: "ikut terkirim", activity: ["Karaoke", "Hack", "Karaoke"], comfort: "9", x: "asing" });
    expect(r.errors).toEqual([]);
    expect(r.answers).toEqual({ happiness: "Bahagia", stress: "Tidak sama sekali", activity: ["Karaoke"], comfort: 9 });
  });

  it("wajib kosong, pilihan tak dikenal, dan skala di luar rentang = galat", () => {
    const r = validateSubmission(s, { happiness: "Luar biasa", comfort: 11 });
    expect(r.errors).toEqual(["Rasa bahagia: pilihan tidak dikenal", "Rasa bahagia wajib diisi", "Frekuensi stres wajib diisi", "Kenyamanan: nilai di luar rentang"]);
  });

  it("teks dipangkas ke batas panjang", () => {
    const r = validateSubmission({ questions: [{ key: "t", label: "T", type: "text" }] }, { t: "a".repeat(5000) });
    expect((r.answers.t as string).length).toBe(2000);
  });
});

describe("signals", () => {
  const surv = { questions: [happyK, stressK], headline: ["happiness", "stress"] };
  const P = (period: string, h: Record<string, number>, st: Record<string, number>): PeriodSummary => ({
    period, n: 10, suppressed: false,
    questions: { happiness: { answered: 10, counts: h }, stress: { answered: 10, counts: st } },
  });
  const summaries = [P("2026-08-01", { Bahagia: 9, "Tidak Bahagia": 1 }, { "Tidak sama sekali": 9, "Setiap hari": 1 }), P("2026-09-01", { Bahagia: 6, "Tidak Bahagia": 4 }, { "Tidak sama sekali": 9, "Setiap hari": 1 })];

  it("pergeseran KPI ≥ 10 poin ditandai, yang memburuk berprioritas tinggi", () => {
    const s = signals({ survey: surv, summaries, period: "2026-09-01", actions: [action("1", "2026-09-01", "libur")] });
    expect(s[0]).toMatchObject({ id: "shift-happiness", severity: "tinggi", title: "Indeks bahagia turun 30 poin" });
    expect(s.find((x) => x.id === "shift-stress")).toBeUndefined();
  });

  it("kelompok yang tertinggal ≥ 15 poin dari keseluruhan", () => {
    const seg = { period: "2026-09-01", hidden: 1, groups: { "> 4 Tahun": { n: 3, questions: { stress: { answered: 3, counts: { "Setiap hari": 2, "Tidak sama sekali": 1 } } } } } };
    const s = signals({ survey: surv, summaries, period: "2026-09-01", actions: [], segments: seg, segmentLabel: "Lama kerja" });
    expect(s.find((x) => x.id.startsWith("seg-stress"))?.title).toBe("Lama kerja > 4 Tahun: Stres tinggi 67%");
  });

  it("partisipasi rendah, periode tanpa tindak lanjut, terlalu banyak butir tanpa fokus, keluhan ≥ 3 bulan", () => {
    const many = Array.from({ length: 11 }, (_, i) => action(String(i), ["2026-02-01", "2026-03-01", "2026-04-01"][i % 3], "libur"));
    const ids = signals({ survey: surv, summaries, period: "2026-09-01", actions: many, targetCount: 20 }).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["participation", "no-action", "no-focus", "recurring"]));
  });

  it("ada fokus = tidak ada peringatan 'tanpa fokus'", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ ...action(String(i), "2026-09-01", "libur"), is_focus: i === 0 }));
    expect(signals({ survey: surv, summaries, period: "2026-09-01", actions: many }).map((x) => x.id)).not.toContain("no-focus");
  });
});

describe("appreciationCounts", () => {
  const staff = ["Deni Ramdani", "Ilal Marfudi Agustiawan (Billy)", "Sudarti", "Irfan", "Irfan Hakim"];
  it("menyamakan ejaan ke master karyawan, satu orang dihitung sekali per jawaban, 'semua' dilewati", () => {
    expect(appreciationCounts(["Billy setiawan, Deni ramdani", "deni, Deni Ramdani", "Sudarti & semua tim", "irfan"], staff)).toEqual([
      { name: "Deni Ramdani", count: 2 }, { name: "Ilal Marfudi Agustiawan (Billy)", count: 1 }, { name: "Irfan", count: 1 }, { name: "Sudarti", count: 1 },
    ]);
  });
});

/* ─── Tahap 3: jabatan, rapor SPV, 360, tren per orang ─── */
import { build360, jabatanGroup, personTrends, spvScorecard, type SegmentPeriod, type SurveyResponse } from "./pulse";

describe("jabatanGroup", () => {
  it("memetakan jabatan bebas ke kelompok yang bisa dibandingkan", () => {
    expect(jabatanGroup("Store Supervisor")).toBe("Supervisor");
    expect(jabatanGroup("Customer Service")).toBe("Admin & CS");
    expect(jabatanGroup("Maintenance & MEP Technician")).toBe("Produksi & teknik");
    expect(jabatanGroup("Host Live Streaming")).toBe("Host live");
    expect(jabatanGroup("Visual Merchandiser")).toBe("Marketing, VM & HR");
    expect(jabatanGroup("")).toBe("Tidak tercatat");
    expect(jabatanGroup("Sopir")).toBe("Tidak tercatat");
  });
});

describe("spvScorecard", () => {
  const scale = (key: string): SurveyQuestion => ({ key, label: key, type: "scale", min: 1, max: 5, favorableMin: 4 });
  const s = { questions: [scale("reach"), scale("helps"), { key: "followed", label: "f", type: "choice" as const, favorable: ["Ya, diselesaikan"] }] };
  const seg = (groups: SegmentPeriod["groups"], period = "2026-09-01"): SegmentPeriod => ({ period, hidden: 0, groups });
  const cur = seg({
    Winda: { n: 4, questions: { reach: { answered: 4, counts: { "5": 2, "2": 2 } }, helps: { answered: 4, counts: { "4": 4 } }, followed: { answered: 2, counts: { "Ya, diselesaikan": 1, "Belum ada tindak lanjut": 1 } } } },
    Rangga: { n: 3, questions: { reach: { answered: 3, counts: { "5": 3 } }, helps: { answered: 3, counts: { "5": 3 } } } },
  });
  const prev = seg({ Winda: { n: 3, questions: { reach: { answered: 3, counts: { "5": 3 } }, helps: { answered: 3, counts: { "5": 3 } } } } }, "2026-08-01");
  const out = spvScorecard(s, cur, prev, { Winda: 2, Rangga: 3 }, ["reach", "helps"]);

  it("skor terendah di atas; skor = rata-rata skala", () => {
    expect(out.map((r) => r.spv)).toEqual(["Winda", "Rangga"]);
    expect(out[0].score).toBe(3.75); // reach 3.5, helps 4
    expect(out[0].scorePrev).toBe(5);
  });

  it("partisipasi > 100% ditampilkan apa adanya; skala terlemah & tindak lanjut", () => {
    expect(out[0].participation).toBe(200);
    expect(out[0].weakest).toEqual({ key: "reach", pct: 50 });
    expect(out[0].followed).toBe(50);
    expect(out[1].followed).toBeNull();
  });

  it("tanpa data periode = kosong", () => {
    expect(spvScorecard(s, null, null, {}, ["reach"])).toEqual([]);
  });
});

describe("build360", () => {
  const cfg = { leader: "Irfan", targets: { b1: "Doni", b2: null } };
  const rs: { period: string; respondent_name: string; answers: Record<string, string | number> }[] = [
    { period: "2026-08-01", respondent_name: "Rangga", answers: { rater: "Rangga", leader_a: 4, leader_b: 2, leader_strength: "Membantu", p1_x: 4, p1_y: 2, p1_improve: "Lebih teliti", p2_x: 5, p2_y: 5 } },
    { period: "2026-08-01", respondent_name: "Doni", answers: { rater: "Doni", leader_a: 2, leader_b: 2, leader_improve: "-", p1_x: 5, p1_y: 5, p2_x: 3, p2_y: 3 } },
  ];
  const out = build360(cfg, rs, ["x", "y"], ["leader_a", "leader_b"]);

  it("leader: rata-rata per penilai lalu antar-penilai; teks '-' dibuang", () => {
    const p = out.leader.periods["2026-08-01"];
    expect(p.byRater).toEqual([{ rater: "Rangga", avg: 3 }, { rater: "Doni", avg: 2 }]);
    expect(p.avg).toBe(2.5);
    expect(p.strengths).toEqual([{ rater: "Rangga", text: "Membantu" }]);
    expect(p.improvements).toEqual([]);
  });

  it("penilaian diri dipisah dari rata-rata rekan", () => {
    const doni = out.targets.find((t) => t.block === "b1")!.periods["2026-08-01"];
    expect(doni.self).toBe(5);
    expect(doni.raters).toBe(1);
    expect(doni.avg).toBe(3);
    expect(doni.items).toEqual({ x: 4, y: 2 });
  });

  it("blok tanpa nama tetap muncul dan semua penilai dihitung", () => {
    const b2 = out.targets.find((t) => t.block === "b2")!;
    expect(b2.name).toBeNull();
    expect(b2.periods["2026-08-01"].raters).toBe(2);
    expect(b2.periods["2026-08-01"].avg).toBe(4);
  });
});

describe("personTrends", () => {
  const sv = { questions: [happyK, stressK], headline: ["happiness", "stress"] };
  const r = (id: string, period: string, h: string, st: string, extra: Partial<SurveyResponse> = {}): SurveyResponse =>
    ({ id, survey_id: "s", period, submitted_at: null, respondent_name: "Ani", respondent_email: "ani@x", employee_id: null, answers: { happiness: h, stress: st, jabatan: "Admin & CS" }, ...extra });
  const out = personTrends(sv, [
    r("1", "2026-07-01", "Bahagia", "Setiap hari"),
    r("2", "2026-08-01", "Tidak Bahagia", "Setiap hari"),
    r("3", "2026-09-01", "Tidak Bahagia", "Tidak sama sekali"),
    r("4", "2026-09-01", "Bahagia", "Setiap hari", { excluded: true }),
    r("5", "2026-09-01", "Bahagia", "Tidak sama sekali", { respondent_email: "budi@x", respondent_name: "Budi" }),
  ]);

  it("mengelompokkan per orang, urut bulan, dan melewati isian yang dikeluarkan", () => {
    expect(out.map((p) => p.name)).toEqual(["Ani", "Budi"]);
    expect(out[0].points.map((p) => p.period)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    expect(out[0].jabatan).toBe("Admin & CS");
  });

  it("menandai risiko ≥ 2 bulan berturut-turut", () => {
    expect(out[0].alerts).toEqual(["Tidak indeks bahagia 2 bulan berturut-turut", "Stres tinggi 2 bulan berturut-turut"]);
    expect(out[1].alerts).toEqual([]);
  });
});
