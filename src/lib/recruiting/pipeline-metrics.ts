/* ═══════════════════════════════════════════════════════════════════════════
   Metrik pipeline rekrutmen — fungsi murni. Input kandidat + lowongan → angka.

   Prinsip yang dipegang seluruh file ini:

   1. DATA YANG TIDAK ADA TIDAK DIKARANG. Kandidat tanpa riwayat tahap tidak
      dihitung nol hari; ia dikeluarkan dari perhitungan dan jumlahnya
      dilaporkan lewat `basedOn`. Kalau tidak, kandidat lama yang tidak pernah
      disentuh justru akan terlihat sebagai "diproses paling cepat".

   2. MEDIAN, BUKAN RATA-RATA, untuk durasi. Satu kandidat yang menggantung
      delapan bulan akan menarik rata-rata sampai metriknya tidak berarti.
      Median tahan terhadap kasus ekstrem semacam itu, dan itu lazim dipakai di
      pelaporan time-to-hire.

   3. KONVERSI DIHITUNG KUMULATIF. "Berapa persen pelamar yang sampai tahap
      wawancara" lebih berguna daripada rasio antar-tahap yang berdiri sendiri,
      karena kandidat bisa melompati tahap (mis. langsung wawancara).

   4. PEMBAGI NOL SELALU DIJAGA. Perusahaan yang belum pernah merekrut siapa
      pun harus melihat "belum ada data", bukan NaN atau 0%.
═══════════════════════════════════════════════════════════════════════════ */

import type { CandidateRecord, JobRequisition, PipelineStage, StageEvent } from "../store";
import { PIPELINE_STAGES, STAGE_LABELS } from "../store";

const DAY_MS = 86_400_000;

/** Urutan maju pipeline. `rejected` sengaja di luar urutan — penolakan bisa
 *  terjadi dari tahap mana pun, jadi ia bukan tahap ke-tujuh melainkan jalan keluar. */
export const FORWARD_STAGES: PipelineStage[] = PIPELINE_STAGES;

export function stageIndex(stage: PipelineStage): number {
  return FORWARD_STAGES.indexOf(stage);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return (b - a) / DAY_MS;
}

/** Median. Mengembalikan null untuk daftar kosong — bukan 0, karena "belum ada
 *  data" dan "nol hari" adalah dua pernyataan yang sangat berbeda. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function history(c: CandidateRecord): StageEvent[] {
  return (c.stageHistory ?? []).filter((e) => e && typeof e.at === "string");
}

function hasHistory(c: CandidateRecord): boolean {
  return history(c).length > 0;
}

/* ─── 1. Corong konversi ─── */

export interface FunnelStep {
  stage: PipelineStage;
  label: string;
  /** Jumlah kandidat yang PERNAH mencapai tahap ini (bukan yang sedang di sini). */
  reached: number;
  /** Jumlah yang sedang berada di tahap ini sekarang. */
  current: number;
  /** % dari total pelamar yang berhasil mencapai tahap ini. */
  reachedPct: number;
  /** % yang lanjut dari tahap sebelumnya ke tahap ini. null pada tahap pertama. */
  stepConversionPct: number | null;
}

/** Apakah kandidat pernah mencapai tahap tertentu.
 *  Dipakai dua sumber bukti: riwayat tahap (paling akurat) DAN posisi tahapnya
 *  sekarang. Yang kedua penting supaya kandidat lama tanpa riwayat tetap
 *  terhitung di corong — corong hanya butuh "pernah sampai", bukan kapan. */
export function everReached(c: CandidateRecord, stage: PipelineStage): boolean {
  if (history(c).some((e) => e.stage === stage)) return true;
  const target = stageIndex(stage);
  const now = stageIndex(c.stage);
  if (target === -1) return false;
  // Kandidat 'rejected' tidak punya posisi di urutan maju; hanya riwayatnya
  // yang bisa membuktikan sejauh mana ia sempat melangkah.
  if (now === -1) return false;
  return now >= target;
}

export function buildFunnel(candidates: CandidateRecord[]): FunnelStep[] {
  const total = candidates.length;
  let prevReached: number | null = null;

  return FORWARD_STAGES.map((stage) => {
    const reached = candidates.filter((c) => everReached(c, stage)).length;
    const current = candidates.filter((c) => c.stage === stage).length;
    const step: FunnelStep = {
      stage,
      label: STAGE_LABELS[stage],
      reached,
      current,
      reachedPct: total === 0 ? 0 : Math.round((reached / total) * 100),
      stepConversionPct:
        prevReached === null ? null : prevReached === 0 ? 0 : Math.round((reached / prevReached) * 100),
    };
    prevReached = reached;
    return step;
  });
}

/* ─── 2. Kecepatan per tahap ─── */

export interface StageVelocity {
  stage: PipelineStage;
  label: string;
  /** Median hari yang dihabiskan kandidat DI tahap ini sebelum pindah. */
  medianDays: number | null;
  /** Jumlah kandidat yang datanya dipakai — pembaca berhak tahu basisnya. */
  basedOn: number;
}

/** Lama tiap kandidat tertahan di suatu tahap, dari riwayatnya.
 *  Hanya perpindahan yang SUDAH terjadi yang dihitung; kandidat yang masih
 *  duduk di tahap tersebut dihitung terpisah lewat findStalled(). */
export function buildStageVelocity(candidates: CandidateRecord[]): StageVelocity[] {
  const durations = new Map<PipelineStage, number[]>();

  for (const c of candidates) {
    const h = history(c);
    for (let i = 0; i < h.length - 1; i++) {
      const days = daysBetween(h[i].at, h[i + 1].at);
      if (days < 0) continue; // riwayat rusak — abaikan, jangan hitung negatif
      const list = durations.get(h[i].stage) ?? [];
      list.push(days);
      durations.set(h[i].stage, list);
    }
  }

  return FORWARD_STAGES.map((stage) => {
    const list = durations.get(stage) ?? [];
    const m = median(list);
    return {
      stage,
      label: STAGE_LABELS[stage],
      medianDays: m === null ? null : round1(m),
      basedOn: list.length,
    };
  });
}

/* ─── 3. Time to hire ─── */

export interface TimeToHire {
  medianDays: number | null;
  fastestDays: number | null;
  slowestDays: number | null;
  /** Jumlah kandidat hired yang punya riwayat lengkap. */
  basedOn: number;
  /** Kandidat hired yang riwayatnya tidak ada sehingga tidak bisa dihitung. */
  excludedNoHistory: number;
}

/** Hari dari kandidat masuk pipeline sampai berstatus hired.
 *  Memakai entri riwayat pertama sebagai titik awal, bukan createdAt — kandidat
 *  bisa saja dimasukkan ke sistem jauh setelah ia melamar. */
export function computeTimeToHire(candidates: CandidateRecord[]): TimeToHire {
  const hired = candidates.filter((c) => c.stage === "hired");
  const days: number[] = [];
  let excluded = 0;

  for (const c of hired) {
    const h = history(c);
    const hiredEvent = h.find((e) => e.stage === "hired");
    if (h.length === 0 || !hiredEvent) {
      excluded++;
      continue;
    }
    const d = daysBetween(h[0].at, hiredEvent.at);
    if (d >= 0) days.push(d);
    else excluded++;
  }

  const m = median(days);
  return {
    medianDays: m === null ? null : round1(m),
    fastestDays: days.length ? round1(Math.min(...days)) : null,
    slowestDays: days.length ? round1(Math.max(...days)) : null,
    basedOn: days.length,
    excludedNoHistory: excluded,
  };
}

/* ─── 4. Time to fill per lowongan ─── */

export interface ReqFillStatus {
  reqId: string;
  title: string;
  department: string;
  headcount: number;
  hiredCount: number;
  /** Hari sejak lowongan dibuka. */
  openDays: number;
  /** Hari sampai posisi terpenuhi penuh. null bila belum terpenuhi. */
  filledInDays: number | null;
  /** Kandidat aktif (belum hired/rejected) di lowongan ini. */
  activePipeline: number;
  /** Hari tersisa menuju target. Negatif = sudah lewat target. */
  daysToTarget: number | null;
  status: "terpenuhi" | "berjalan" | "lewat_target" | "tanpa_kandidat";
}

export function buildReqStatus(
  reqs: JobRequisition[],
  candidates: CandidateRecord[],
  now: Date = new Date(),
): ReqFillStatus[] {
  const nowIso = now.toISOString();

  return reqs.map((r) => {
    const mine = candidates.filter((c) => c.jobReqId === r.id);
    const hired = mine.filter((c) => c.stage === "hired");
    const active = mine.filter((c) => c.stage !== "hired" && c.stage !== "rejected");

    // Terpenuhi = jumlah hired sudah mencapai headcount yang diminta.
    const isFilled = r.headcount > 0 && hired.length >= r.headcount;
    let filledInDays: number | null = null;
    if (isFilled) {
      // Waktu sampai hire terakhir yang menutup kebutuhan.
      const hireDates = hired
        .map((c) => history(c).find((e) => e.stage === "hired")?.at)
        .filter((d): d is string => Boolean(d))
        .sort();
      const closing = hireDates[r.headcount - 1] ?? hireDates[hireDates.length - 1];
      if (closing) filledInDays = round1(daysBetween(r.createdAt, closing));
    }

    const daysToTarget = r.targetDate ? round1(daysBetween(nowIso, `${r.targetDate}T00:00:00.000Z`)) : null;

    const status: ReqFillStatus["status"] = isFilled
      ? "terpenuhi"
      : mine.length === 0
        ? "tanpa_kandidat"
        : daysToTarget !== null && daysToTarget < 0
          ? "lewat_target"
          : "berjalan";

    return {
      reqId: r.id,
      title: r.title,
      department: r.department,
      headcount: r.headcount,
      hiredCount: hired.length,
      openDays: round1(daysBetween(r.createdAt, nowIso)),
      filledInDays,
      activePipeline: active.length,
      daysToTarget,
      status,
    };
  });
}

/* ─── 5. Efektivitas sumber kandidat ─── */

export interface SourceStat {
  source: string;
  candidates: number;
  interviewed: number;
  hired: number;
  /** % kandidat dari sumber ini yang berakhir diterima. */
  hireRatePct: number;
  /** Rata-rata skor CV kandidat dari sumber ini. null bila belum ada yang dianalisis. */
  avgCvScore: number | null;
}

/** Sumber mana yang benar-benar menghasilkan karyawan, bukan sekadar ramai.
 *  Sumber dengan 200 pelamar dan 0 hire lebih buruk daripada sumber dengan 5
 *  pelamar dan 2 hire — dan tanpa tabel ini, yang pertama justru terlihat sukses. */
export function buildSourceStats(candidates: CandidateRecord[]): SourceStat[] {
  const map = new Map<string, CandidateRecord[]>();
  for (const c of candidates) {
    const key = (c.source || "Tidak diketahui").trim();
    map.set(key, [...(map.get(key) ?? []), c]);
  }

  return [...map.entries()]
    .map(([source, list]) => {
      const hired = list.filter((c) => c.stage === "hired").length;
      const interviewed = list.filter((c) => everReached(c, "interviewed")).length;
      const scores = list.map((c) => c.cvAnalysis?.overallScore).filter((s): s is number => typeof s === "number");
      return {
        source,
        candidates: list.length,
        interviewed,
        hired,
        hireRatePct: list.length === 0 ? 0 : Math.round((hired / list.length) * 100),
        avgCvScore: scores.length === 0 ? null : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      };
    })
    .sort((a, b) => b.hired - a.hired || b.candidates - a.candidates);
}

/* ─── 6. Kandidat mandek ─── */

export interface StalledCandidate {
  id: string;
  name: string;
  position: string;
  stage: PipelineStage;
  stageLabel: string;
  daysInStage: number;
  /** Ambang yang dilewati, untuk ditampilkan sebagai alasan. */
  thresholdDays: number;
}

/** Ambang "terlalu lama" per tahap. Angka ini pilihan praktis, bukan standar
 *  industri: tahap awal harus bergerak cepat karena kandidat bagus diambil
 *  perusahaan lain dalam hitungan hari, sedangkan tahap penawaran wajar lebih
 *  lama karena melibatkan negosiasi. */
export const STALL_THRESHOLD_DAYS: Record<PipelineStage, number> = {
  applied: 7,
  screened: 7,
  work_sample: 10,
  interviewed: 7,
  offered: 14,
  hired: Number.POSITIVE_INFINITY,
  rejected: Number.POSITIVE_INFINITY,
};

/** Kandidat yang tertahan melewati ambang tahapnya.
 *  Inilah metrik yang paling sering menyelamatkan proses rekrutmen satu orang HR:
 *  kandidat jarang hilang karena ditolak, mereka hilang karena didiamkan. */
export function findStalled(candidates: CandidateRecord[], now: Date = new Date()): StalledCandidate[] {
  const nowIso = now.toISOString();

  return candidates
    .map((c): StalledCandidate | null => {
      if (c.stage === "hired" || c.stage === "rejected") return null;
      const h = history(c);
      // Tanpa riwayat, pakai updatedAt sebagai perkiraan terakhir kali disentuh.
      // Ini perkiraan yang dinyatakan, bukan angka yang berpura-pura presisi.
      const since = h.length > 0 ? h[h.length - 1].at : c.updatedAt;
      if (!since) return null;
      const daysInStage = daysBetween(since, nowIso);
      const threshold = STALL_THRESHOLD_DAYS[c.stage];
      if (!Number.isFinite(threshold) || daysInStage <= threshold) return null;
      return {
        id: c.id,
        name: c.name,
        position: c.position,
        stage: c.stage,
        stageLabel: STAGE_LABELS[c.stage],
        daysInStage: round1(daysInStage),
        thresholdDays: threshold,
      };
    })
    .filter((x): x is StalledCandidate => x !== null)
    .sort((a, b) => b.daysInStage - a.daysInStage);
}

/* ─── 7. Ringkasan ─── */

export interface PipelineSummary {
  totalCandidates: number;
  activePipeline: number;
  hired: number;
  rejected: number;
  openReqs: number;
  /** Kandidat aktif per lowongan aktif — indikator apakah pipeline cukup tebal. */
  candidatesPerOpenReq: number | null;
  offerAcceptRatePct: number | null;
  offerBasedOn: number;
  timeToHire: TimeToHire;
  stalledCount: number;
  /** Kandidat tanpa riwayat tahap — batas keandalan seluruh metrik kecepatan. */
  withoutHistory: number;
}

export function buildSummary(
  candidates: CandidateRecord[],
  reqs: JobRequisition[],
  now: Date = new Date(),
): PipelineSummary {
  const hired = candidates.filter((c) => c.stage === "hired").length;
  const rejected = candidates.filter((c) => c.stage === "rejected").length;
  const active = candidates.filter((c) => c.stage !== "hired" && c.stage !== "rejected").length;
  const openReqs = reqs.filter((r) => r.status === "active").length;

  // Offer acceptance: dari yang pernah sampai tahap offered, berapa yang jadi hired.
  const everOffered = candidates.filter((c) => everReached(c, "offered"));
  const acceptedFromOffer = everOffered.filter((c) => c.stage === "hired").length;

  return {
    totalCandidates: candidates.length,
    activePipeline: active,
    hired,
    rejected,
    openReqs,
    candidatesPerOpenReq: openReqs === 0 ? null : round1(active / openReqs),
    offerAcceptRatePct: everOffered.length === 0 ? null : Math.round((acceptedFromOffer / everOffered.length) * 100),
    offerBasedOn: everOffered.length,
    timeToHire: computeTimeToHire(candidates),
    stalledCount: findStalled(candidates, now).length,
    withoutHistory: candidates.filter((c) => !hasHistory(c)).length,
  };
}

/* ─── 8. Deteksi hambatan ─── */

export interface Bottleneck {
  stage: PipelineStage;
  label: string;
  reason: string;
  severity: "tinggi" | "sedang";
}

/** Menandai tahap yang paling menghambat, dari dua gejala berbeda:
 *  konversi yang anjlok (banyak kandidat gugur di satu titik) dan durasi yang
 *  jauh di atas tahap lain (kandidat menunggu terlalu lama). */
export function detectBottlenecks(funnel: FunnelStep[], velocity: StageVelocity[]): Bottleneck[] {
  const out: Bottleneck[] = [];

  for (const step of funnel) {
    // Tahap pertama tidak punya konversi masuk; tahap tanpa kandidat tidak
    // memberi bukti apa pun dan tidak layak dituduh sebagai hambatan.
    if (step.stepConversionPct === null || step.reached === 0) continue;
    if (step.stepConversionPct < 25) {
      out.push({
        stage: step.stage,
        label: step.label,
        reason: `Hanya ${step.stepConversionPct}% kandidat yang lolos ke tahap ini — mayoritas gugur di sini.`,
        severity: "tinggi",
      });
    }
  }

  const withData = velocity.filter((v) => v.medianDays !== null && v.basedOn >= 2);
  if (withData.length >= 2) {
    for (const v of withData) {
      const d = v.medianDays as number;
      // Pembandingnya adalah median tahap LAIN, bukan median seluruh tahap.
      // Kalau tahap yang sedang diperiksa ikut masuk pembanding, ia menaikkan
      // ambangnya sendiri dan justru menyamarkan diri — makin parah
      // keterlambatannya, makin sulit ia terdeteksi.
      const others = withData.filter((x) => x.stage !== v.stage).map((x) => x.medianDays as number);
      const baseline = median(others);
      if (baseline === null || baseline <= 0) continue;
      // Dua kali lipat DAN minimal seminggu: menahan tahap yang sebenarnya
      // cepat (0,5 hari vs 0,2 hari) dituduh sebagai hambatan.
      if (d >= baseline * 2 && d >= 7) {
        out.push({
          stage: v.stage,
          label: v.label,
          reason: `Kandidat tertahan ${d} hari di tahap ini — jauh di atas tahap lain (${round1(baseline)} hari).`,
          severity: "sedang",
        });
      }
    }
  }

  return out;
}
