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
