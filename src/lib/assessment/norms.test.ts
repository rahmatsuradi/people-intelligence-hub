import { describe, it, expect } from "vitest";
import {
  applyNorms,
  buildNormGroupFromSample,
  MIN_LOCAL_NORM_N,
  NORM_DEMO_UMUM,
  normalCdf,
  pickNormGroupForDate,
  stenToBand,
  toPercentile,
  toStanine,
  toSten,
  toTScore,
  toZ,
} from "./norms";
import type { NormGroup, RawScaleScore } from "./types";

describe("normalCdf", () => {
  it("bernilai 0,5 tepat pada z = 0", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it("cocok dengan nilai tabel normal baku yang sudah dikenal", () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 3);
  });

  it("simetris terhadap nol", () => {
    for (const z of [0.3, 1.1, 2.4]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });
});

describe("toZ", () => {
  it("menghitung deviasi baku dari mean", () => {
    expect(toZ(40, 30, 5)).toBe(2);
    expect(toZ(25, 30, 5)).toBe(-1);
    expect(toZ(30, 30, 5)).toBe(0);
  });

  it("mengembalikan 0 bila SD nol atau tidak valid — bukan Infinity", () => {
    // SD nol berarti norma tidak membedakan siapa pun. Membiarkan pembagian nol
    // akan menghasilkan Infinity, lalu sten NaN yang tampil sebagai skor.
    expect(toZ(40, 30, 0)).toBe(0);
    expect(toZ(40, 30, -1)).toBe(0);
    expect(toZ(40, 30, NaN)).toBe(0);
  });
});

describe("konversi skor standar", () => {
  it("sten: rata-rata = 5 atau 6, dan dibatasi 1-10", () => {
    expect(toSten(0)).toBe(6);     // 5,5 dibulatkan ke atas
    expect(toSten(-0.25)).toBe(5);
    expect(toSten(2.25)).toBe(10);
    expect(toSten(5)).toBe(10);    // dibatasi di atas
    expect(toSten(-5)).toBe(1);    // dibatasi di bawah
  });

  it("T-score: M=50, SD=10", () => {
    expect(toTScore(0)).toBe(50);
    expect(toTScore(1)).toBe(60);
    expect(toTScore(-1.5)).toBe(35);
  });

  it("stanine: M=5, SD=2, dibatasi 1-9", () => {
    expect(toStanine(0)).toBe(5);
    expect(toStanine(1)).toBe(7);
    expect(toStanine(9)).toBe(9);
    expect(toStanine(-9)).toBe(1);
  });

  it("persentil dipotong pada 1 dan 99, tidak pernah 0 atau 100", () => {
    expect(toPercentile(0)).toBe(50);
    expect(toPercentile(6)).toBe(99);
    expect(toPercentile(-6)).toBe(1);
  });

  it("memetakan sten ke kategori yang benar", () => {
    expect(stenToBand(1)).toBe("sangat_rendah");
    expect(stenToBand(2)).toBe("sangat_rendah");
    expect(stenToBand(4)).toBe("rendah");
    expect(stenToBand(5)).toBe("rata_rata");
    expect(stenToBand(6)).toBe("rata_rata");
    expect(stenToBand(8)).toBe("tinggi");
    expect(stenToBand(10)).toBe("sangat_tinggi");
  });
});

describe("pickNormGroupForDate", () => {
  const groups: NormGroup[] = [
    { ...NORM_DEMO_UMUM, id: "N-2025", effectiveDate: "2025-01-01" },
    { ...NORM_DEMO_UMUM, id: "N-2026", effectiveDate: "2026-01-01" },
    { ...NORM_DEMO_UMUM, id: "N-2027", effectiveDate: "2027-01-01" },
  ];

  it("memilih norma berlaku terbaru yang tidak melewati tanggal asesmen", () => {
    expect(pickNormGroupForDate(groups, "2026-06-15")!.id).toBe("N-2026");
    expect(pickNormGroupForDate(groups, "2025-12-31")!.id).toBe("N-2025");
  });

  it("tidak memakai norma yang belum berlaku pada tanggal tersebut", () => {
    // Ini yang menjaga laporan lama tetap bisa dihitung ulang dengan angka yang sama.
    expect(pickNormGroupForDate(groups, "2026-12-31")!.id).toBe("N-2026");
  });

  it("mengembalikan null bila belum ada norma yang berlaku", () => {
    expect(pickNormGroupForDate(groups, "2024-05-01")).toBeNull();
  });

  it("menerima timestamp ISO lengkap, bukan hanya tanggal", () => {
    expect(pickNormGroupForDate(groups, "2026-06-15T08:30:00.000Z")!.id).toBe("N-2026");
  });

  it("dapat dibatasi ke satu groupId tertentu", () => {
    expect(pickNormGroupForDate(groups, "2027-06-01", "N-2025")!.id).toBe("N-2025");
  });
});

describe("applyNorms", () => {
  const raw = (scaleId: string, value: number): RawScaleScore => ({
    scaleId: scaleId as RawScaleScore["scaleId"],
    raw: value,
    answered: 10,
    itemCount: 10,
    maxPossible: 50,
  });

  it("mengubah skor mentah menjadi sten/persentil/T yang konsisten satu sama lain", () => {
    // C: mean 36, sd 5.5 -> raw 41.5 = z 1.0
    const { scores } = applyNorms([raw("C", 41.5)], NORM_DEMO_UMUM);
    const c = scores[0];
    expect(c.z).toBe(1);
    expect(c.sten).toBe(8);      // 5,5 + 2 = 7,5 -> 8
    expect(c.tScore).toBe(60);
    expect(c.percentile).toBe(84);
    expect(c.band).toBe("tinggi");
    expect(c.normId).toBe(NORM_DEMO_UMUM.id);
  });

  it("skor tepat di mean menghasilkan kategori rata-rata", () => {
    const { scores } = applyNorms([raw("C", 36)], NORM_DEMO_UMUM);
    expect(scores[0].percentile).toBe(50);
    expect(scores[0].band).toBe("rata_rata");
  });

  it("melaporkan skala tanpa norma sebagai missing, bukan memberinya skor karangan", () => {
    const { scores, missingNorms } = applyNorms(
      [raw("C", 36), raw("SJT_TOTAL" as string, 48), { ...raw("C", 1), scaleId: "TIDAK_ADA" as RawScaleScore["scaleId"] }],
      NORM_DEMO_UMUM,
    );
    expect(scores.map((s) => s.scaleId)).toEqual(["C", "SJT_TOTAL"]);
    expect(missingNorms).toEqual(["TIDAK_ADA"]);
  });
});

describe("buildNormGroupFromSample", () => {
  const meta = { id: "N-LOKAL", label: "Norma lokal", effectiveDate: "2026-08-01" };

  const sample = (n: number, values: number[]) =>
    Array.from({ length: n }, (_, i) => ({ scaleId: "C" as const, raw: values[i % values.length] }));

  it("menolak membangun norma dari sampel yang terlalu kecil", () => {
    // Norma dari 12 orang lebih menyesatkan daripada tidak ada norma.
    expect(buildNormGroupFromSample(sample(12, [30, 35, 40]), meta)).toBeNull();
  });

  it("membangun norma setelah jumlah sampel mencukupi", () => {
    const g = buildNormGroupFromSample(sample(MIN_LOCAL_NORM_N, [30, 35, 40, 45]), meta);
    expect(g).not.toBeNull();
    expect(g!.provenance).toBe("local_sample");
    expect(g!.sampleSize).toBe(MIN_LOCAL_NORM_N);
    expect(g!.entries[0].scaleId).toBe("C");
  });

  it("memakai pembagi n-1 (SD sampel), bukan n (SD populasi)", () => {
    // Data 2,4,4,4,5,5,7,9 -> mean 5 ; jumlah kuadrat simpangan 32.
    // SD sampel  = sqrt(32/7) = 2,138  <- yang benar untuk data sampel
    // SD populasi = sqrt(32/8) = 2,000  <- akan salah di sini
    const rows = [2, 4, 4, 4, 5, 5, 7, 9].map((raw) => ({ scaleId: "C" as const, raw }));
    const g = buildNormGroupFromSample(rows, meta, 8)!; // minN diturunkan khusus untuk uji ini
    expect(g.entries[0].mean).toBe(5);
    expect(g.entries[0].sd).toBeCloseTo(2.138, 2);
  });

  it("menghitung mean dan SD dari sampel besar", () => {
    const g = buildNormGroupFromSample(sample(200, [2, 4, 4, 4, 5, 5, 7, 9]), meta)!;
    expect(g.entries[0].mean).toBeCloseTo(5, 1);
    expect(g.entries[0].sd).toBeCloseTo(2.0, 1);
  });

  it("melewati skala yang seluruh pesertanya berskor identik (SD nol)", () => {
    const rows = Array.from({ length: 150 }, () => ({ scaleId: "C" as const, raw: 30 }));
    expect(buildNormGroupFromSample(rows, meta)).toBeNull();
  });
});

describe("norma bawaan", () => {
  it("setiap baris norma punya SD positif", () => {
    for (const e of NORM_DEMO_UMUM.entries) {
      expect(e.sd).toBeGreaterThan(0);
    }
  });

  it("ditandai sintetis dengan sampleSize nol — klaimnya tidak boleh dinaikkan diam-diam", () => {
    expect(NORM_DEMO_UMUM.provenance).toBe("synthetic_demo");
    expect(NORM_DEMO_UMUM.sampleSize).toBe(0);
  });
});
