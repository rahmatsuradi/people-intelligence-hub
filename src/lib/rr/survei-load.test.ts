/* ═══════════════════════════════════════════════════════════════════════════
   Uji beban formulir survei publik (/api/survei) untuk SEMUA jenis survei: Pulse Lencir,
   Pulse Rica Rico, Feedback SPG → SPV, dan 360 SPV. Ratusan orang mengisi bersamaan lewat
   handler yang sama dengan yang dipakai web; database diganti tiruan di memori (termasuk
   indeks unik jawaban) supaya tes ini tidak menyentuh data asli.

   Definisi Lencir dibaca dari supabase/lencir-pulse-survey.sql (definisi nyata). Definisi
   SPG→SPV dan 360 disusun dari bentuk yang dipakai kodenya (skala 1–5, blok 1–7, showIf,
   pertanyaan tersembunyi) dengan nama fiktif — definisi aslinya ada di database Rica Rico.
   ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { isVisible, validateSubmission, type AnswerValue, type SurveyQuestion } from "./pulse";
import { surveyLinkPath, surveyLinkSlug } from "./survey-link";

type Row = Record<string, unknown>;

const h = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const REL: Record<string, Record<string, [string, string]>> = {
    pi_survey_campaigns: { pi_surveys: ["survey_id", "pi_surveys"] },
    pi_survey_invites: { pi_survey_recipients: ["recipient_id", "pi_survey_recipients"] },
  };
  type Result = { data: unknown; error: unknown };
  class Q implements PromiseLike<Result> {
    private op: "select" | "insert" | "update" = "select";
    private filters: ((r: Row) => boolean)[] = [];
    private payload: Row | Row[] | null = null;
    private cols = "*";
    private returning = false;
    constructor(private table: string) {}
    select(cols = "*") { this.cols = cols; if (this.op !== "select") this.returning = true; return this; }
    insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
    update(p: Row) { this.op = "update"; this.payload = p; return this; }
    eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
    neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
    in(k: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[k])); return this; }
    private sortBy: [string, boolean] | null = null;
    private max = Infinity;
    order(k: string, o?: { ascending?: boolean }) { this.sortBy = [k, o?.ascending !== false]; return this; }
    limit(n: number) { this.max = n; return this; }
    private shape(r: Row): Row {
      const out = { ...r };
      for (const [rel, [fk, tbl]] of Object.entries(REL[this.table] ?? {})) {
        if (this.cols.includes(`${rel}(`)) out[rel] = (tables[tbl] ?? []).find((x) => x.id === r[fk]) ?? null;
      }
      return out;
    }
    private exec(): Result {
      const all = (tables[this.table] ??= []);
      if (this.op === "insert") {
        const made: Row[] = [];
        for (const r of (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]) {
          const row: Row = { id: crypto.randomUUID(), excluded: false, flags: [], ...r };
          if (this.table === "pi_survey_responses") { // indeks unik database: (survey_id, submitted_at, email ?? nama)
            const key = (x: Row) => `${x.survey_id}|${x.submitted_at}|${x.respondent_email ?? x.respondent_name}`;
            if (all.some((x) => key(x) === key(row))) return { data: null, error: { code: "23505", message: "duplicate key value" } };
          }
          all.push(row); made.push(row);
        }
        return { data: this.returning ? made.map((m) => this.shape(m)) : null, error: null };
      }
      const hit = all.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") { for (const r of hit) Object.assign(r, this.payload); return { data: null, error: null }; }
      if (this.sortBy) { const [k, asc] = this.sortBy; hit.sort((a, b) => String(a[k]).localeCompare(String(b[k])) * (asc ? 1 : -1)); }
      return { data: hit.slice(0, this.max).map((r) => this.shape(r)), error: null };
    }
    maybeSingle() { const r = this.exec(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }); }
    single() {
      const r = this.exec();
      const one = (r.data as Row[] | null)?.[0] ?? null;
      return Promise.resolve({ data: one, error: r.error ?? (one ? null : { code: "PGRST116", message: "no rows" }) });
    }
    then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.exec()).then(ok, bad);
    }
  }
  return { tables, fake: { from: (t: string) => new Q(t) } };
});
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: h.fake }));

import * as route from "../../app/api/survei/route";

/* ── Data uji ── */

const TENANT = "00000000-0000-4000-8000-000000000001";
const rnd = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const token = (n: number) => `tok${String(n).padStart(3, "0")}`.padEnd(32, "x");
let ipN = 0;
const nextIp = () => `10.1.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;

const choice = (key: string, label: string, values: string[], extra: Partial<SurveyQuestion> = {}): SurveyQuestion =>
  ({ key, label, type: "choice", options: values.map((value) => ({ value })), ...extra });
const scale = (key: string, label: string, extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({ key, label, type: "scale", min: 1, max: 5, ...extra });
const text = (key: string, label: string, extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({ key, label, type: "text", ...extra });

function lencirDefinition(): SurveyQuestion[] {
  const sql = readFileSync(new URL("../../../supabase/lencir-pulse-survey.sql", import.meta.url), "utf-8");
  return JSON.parse(/\$q\$([\s\S]*?)\$q\$/.exec(sql)![1]) as SurveyQuestion[];
}
/** Pulse Rica Rico: pertanyaan yang sama + kelompok jabatan tersembunyi yang diisi server dari master karyawan. */
const ricaPulseDefinition = (): SurveyQuestion[] => [...lencirDefinition(), text("jabatan", "Kelompok jabatan", { hidden: true })];

const SPV = ["SPV A", "SPV B", "SPV C", "SPV D", "SPV E", "SPV F"];
function spgDefinition(): SurveyQuestion[] {
  return [
    choice("store", "Outlet kamu", Array.from({ length: 110 }, (_, i) => `Outlet ${i + 1}`), { required: true }),
    choice("spv", "SPV area kamu", SPV, { required: true }),
    choice("joined_since", "Sudah berapa lama jadi SPG?", ["< 6 bulan", "6–12 bulan", "> 1 tahun"], { required: true }),
    choice("work_hours", "Jam kerja per hari", ["≤ 8 jam", "9–10 jam", "11–12 jam", "> 12 jam"]),
    ...["reach", "respond", "helps", "direction", "respect", "comfort"].map((k) => scale(k, `Nilai ${k}`, { required: true })),
    choice("followed", "Kendala yang dilaporkan ditindaklanjuti?", ["Ya, diselesaikan", "Ya, belum selesai", "Tidak"], { favorable: ["Ya, diselesaikan"] }),
    choice("unresolved", "Masih ada kendala tanpa solusi?", ["Ya", "Tidak"], { showIf: { key: "followed", in: ["Ya, belum selesai", "Tidak"] } }),
    text("unresolved_detail", "Ceritakan kendalanya", { showIf: { key: "unresolved", in: ["Ya"] } }),
    text("suggestion", "Masukan untuk SPV"),
  ];
}
function threeSixtyDefinition(): SurveyQuestion[] {
  const items = ["komunikasi", "kepemimpinan", "kerja sama", "tanggung jawab", "inisiatif", "empati"];
  const q: SurveyQuestion[] = [choice("rater", "Nama kamu (penilai)", ["Penilai 1", "Penilai 2", "Penilai 3", "Penilai 4", "Penilai 5", "Penilai 6", "Penilai 7"], { required: true })];
  for (const [i, k] of items.slice(0, 5).entries()) q.push(scale(`l${i + 1}_${k}`, `Leader: ${k}`, { required: true }));
  q.push(text("leader_strength", "Kekuatan Leader"), text("leader_improve", "Yang perlu diperbaiki dari Leader"));
  for (let b = 1; b <= 7; b++) {
    for (const k of items) q.push(scale(`p${b}_${k}`, `Rekan ${b}: ${k}`, { showIf: { key: "rater", notIn: [`Penilai ${b}`] } }));
    q.push(text(`p${b}_strength`, `Kekuatan rekan ${b}`), text(`p${b}_improve`, `Perbaikan rekan ${b}`));
  }
  return q;
}

/** Jawaban acak yang sah, mengikuti aturan formulir: hanya pertanyaan yang tampil yang dijawab. */
function fill(questions: SurveyQuestion[], r: () => number): Record<string, AnswerValue> {
  const a: Record<string, AnswerValue> = {};
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  for (const q of questions) {
    if (!isVisible(q, a)) continue;
    if (!q.required && r() < 0.2) continue;
    if (q.type === "choice") a[q.key] = pick(q.options!).value;
    else if (q.type === "multi") a[q.key] = [...new Set(Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(q.options!).value))];
    else if (q.type === "scale") a[q.key] = (q.min ?? 1) + Math.floor(r() * ((q.max ?? 5) - (q.min ?? 1) + 1));
    else a[q.key] = `Komentar ${Math.floor(r() * 1e6)} — “uji” 🙂 ${"kata ".repeat(Math.floor(r() * 40))}`.trim();
  }
  return a;
}

const SUITES = [
  { name: "Pulse Check Lencir (definisi asli dari SQL)", key: "pulse_bulanan", brand: "Lencir", questions: lencirDefinition },
  { name: "Pulse Check Rica Rico", key: "pulse_bulanan", brand: "Rica Rico", questions: ricaPulseDefinition },
  { name: "Feedback SPG → SPV", key: "feedback_spg_bulanan", brand: "Rica Rico", questions: spgDefinition },
  { name: "Feedback 360 SPV", key: "feedback_360", brand: "Rica Rico", questions: threeSixtyDefinition },
];

let seq = 0;
function seed(def: SurveyQuestion[], key: string, over: Row = {}) {
  const n = ++seq;
  const survey = { id: `survey-${n}`, tenant_id: TENANT, key, title: `Survei uji ${n}`, description: "uji", questions: def, config: {} };
  const campaign = { id: `camp-${n}`, tenant_id: TENANT, survey_id: survey.id, period: "2026-10-01", token: token(n), status: "open", closes_at: new Date(Date.now() + 5 * 864e5).toISOString(), ...over };
  (h.tables.pi_surveys ??= []).push(survey as Row);
  (h.tables.pi_survey_campaigns ??= []).push(campaign as Row);
  return { survey, campaign };
}
const responsesOf = (campaignId: string) => (h.tables.pi_survey_responses ?? []).filter((x) => x.campaign_id === campaignId);

const call = (method: "GET" | "POST", ip: string, body?: Row, qs = "") =>
  method === "POST"
    ? route.POST(new NextRequest("http://localhost/api/survei", { method, headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }))
    : route.GET(new NextRequest(`http://localhost/api/survei${qs}`, { headers: { "x-forwarded-for": ip } }));

/* ── Tes ── */

describe.each(SUITES)("$name", ({ key, brand, questions }) => {
  const def = questions();

  it("link ber-nama bisa dibuka: token diambil dari bagian akhir link", async () => {
    const { survey, campaign } = seed(def, key);
    const path = surveyLinkPath({ key, title: String(survey.title), config: {} }, brand, String(campaign.token));
    expect(path).toMatch(/^\/survei\/[a-z0-9-]+\/tok\d+x+$/);
    const res = await call("GET", nextIp(), undefined, `?token=${path.split("/").pop()}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(def.length);
    // Yang dikirim ke peserta hanya yang dibutuhkan formulir — bukan skor/ambang penilaian.
    expect(JSON.stringify(body.questions)).not.toMatch(/"(score|favorable|risk|kpiLabel|kpiHint|higherIsBetter)"/);
  });

  it("200 orang mengisi BERSAMAAN dari satu wifi (satu IP): semua berhasil dan semua tersimpan benar", async () => {
    const { survey, campaign } = seed(def, key);
    const r = rnd(7);
    const jobs = Array.from({ length: 200 }, (_, i) => {
      const answers = fill(def, r);
      return { name: `Peserta Uji ${i + 1}`, answers };
    });
    const ip = nextIp();
    const results = await Promise.all(jobs.map((j) => call("POST", ip, { token: campaign.token, name: j.name, answers: j.answers }).then(async (res) => ({ status: res.status, body: await res.json() }))));

    expect(results.filter((x) => x.status !== 200)).toEqual([]);
    expect(results.every((x) => x.body.ok === true)).toBe(true);
    const saved = responsesOf(String(campaign.id));
    expect(saved).toHaveLength(200);
    expect(new Set(saved.map((x) => x.respondent_name)).size).toBe(200);

    const byName = new Map(saved.map((x) => [x.respondent_name as string, x]));
    for (const j of jobs) {
      const row = byName.get(j.name)!;
      expect(row.survey_id).toBe(survey.id);
      expect(row.period).toBe("2026-10-01");
      expect(row.excluded).toBe(false);
      // Jawaban tersimpan = jawaban yang dikirim untuk pertanyaan yang tampil (+ jabatan yang diisi server, bila ada).
      const { jabatan, ...stored } = row.answers as Record<string, AnswerValue>;
      expect(stored).toEqual(j.answers);
      if (def.some((q) => q.key === "jabatan")) expect(jabatan).toBe("Tidak tercatat");
      expect(validateSubmission(survey as never, stored).errors).toEqual([]);
    }
  });

  it("peserta dari banyak tempat berbeda (outlet/rumah, IP berbeda) juga lancar", async () => {
    const { campaign } = seed(def, key);
    const r = rnd(11);
    const results = await Promise.all(Array.from({ length: 150 }, (_, i) =>
      call("POST", nextIp(), { token: campaign.token, name: `Orang ${i + 1}`, answers: fill(def, r) }).then((res) => res.status)));
    expect(results.every((s) => s === 200)).toBe(true);
    expect(responsesOf(String(campaign.id))).toHaveLength(150);
  });

  it("jawaban yang salah ditolak jelas (400), tidak membuat error server", async () => {
    const { campaign } = seed(def, key);
    const required = def.find((q) => q.required && q.type === "choice")!;
    const ip = nextIp();
    const cases: [string, Row, number][] = [
      ["tanpa nama", { token: campaign.token, name: "", answers: {} }, 400],
      ["pilihan di luar opsi", { token: campaign.token, name: "Uji Salah", answers: { ...fill(def, rnd(3)), [required.key]: "BUKAN OPSI" } }, 400],
      ["pertanyaan wajib kosong", { token: campaign.token, name: "Uji Kosong", answers: {} }, 400],
    ];
    for (const [, body, status] of cases) expect((await call("POST", ip, body)).status).toBe(status);
    expect(responsesOf(String(campaign.id))).toHaveLength(0);
  });

  it("link yang sudah ditutup 410, link asing 404", async () => {
    const closed = seed(def, key, { status: "closed" });
    expect((await call("POST", nextIp(), { token: closed.campaign.token, name: "Uji Tutup", answers: fill(def, rnd(5)) })).status).toBe(410);
    expect((await call("GET", nextIp(), undefined, `?token=${closed.campaign.token}`)).status).toBe(410);
    expect((await call("GET", nextIp(), undefined, "?token=tokenyangtidakada1234567890")).status).toBe(404);
    expect((await call("GET", nextIp(), undefined, "?token=../../etc/passwd")).status).toBe(404);
  });
});

describe("kerja bersamaan lainnya", () => {
  const def = lencirDefinition();

  it("kelompok jabatan diisi dari master karyawan dan 200 karyawan di master tidak memperlambat/mengacaukan", async () => {
    const { campaign } = seed(def.concat(text("jabatan", "Kelompok jabatan", { hidden: true })), "pulse_bulanan");
    // Nama hanya huruf (angka dibuang saat mencocokkan nama, seperti nama asli).
    const alpha = (i: number) => String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26));
    h.tables.pi_employees = Array.from({ length: 200 }, (_, i) => ({ id: `emp-${i}`, tenant_id: TENANT, full_name: `Pegawai Uji ${alpha(i)}`, position: i % 2 ? "Store Supervisor" : "Customer Service" }));
    const r = rnd(21);
    const res = await Promise.all(Array.from({ length: 120 }, (_, i) =>
      call("POST", nextIp(), { token: campaign.token, name: `Pegawai Uji ${alpha(i)}`, answers: fill(def, r) }).then((x) => x.status)));
    expect(res.every((s) => s === 200)).toBe(true);
    const saved = responsesOf(String(campaign.id));
    expect(saved).toHaveLength(120);
    for (const row of saved) {
      const code = String(row.respondent_name).split(" ").pop()!;
      const i = (code.charCodeAt(0) - 97) * 26 + (code.charCodeAt(1) - 97);
      expect(row.employee_id).toBe(`emp-${i}`);
      expect((row.answers as Row).jabatan).toBe(i % 2 ? "Supervisor" : "Admin & CS");
    }
    h.tables.pi_employees = [];
  });

  it("link pribadi: 60 orang mengisi bersamaan, tiap undangan tercatat sudah mengisi", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    const recipients = Array.from({ length: 60 }, (_, i) => ({ id: `rec-${campaign.id}-${i}`, tenant_id: TENANT, name: `Nama${i}`, full_name: `Nama Lengkap${i}`, email: `n${i}@uji.test` }));
    const invites = recipients.map((rc, i) => ({ id: `inv-${campaign.id}-${i}`, tenant_id: TENANT, campaign_id: campaign.id, recipient_id: rc.id, token: `inv${campaign.id}${i}`.replace(/[^a-z0-9]/g, "").padEnd(24, "z"), response_id: null }));
    (h.tables.pi_survey_recipients ??= []).push(...(recipients as Row[]));
    (h.tables.pi_survey_invites ??= []).push(...(invites as Row[]));
    const r = rnd(31);
    const ip = nextIp();
    const res = await Promise.all(invites.map((inv, i) =>
      call("POST", ip, { token: campaign.token, invite: inv.token, name: i % 2 ? `Nama Lengkap${i}` : `Nama${i}`, answers: fill(def, r) }).then((x) => x.status)));
    expect(res.every((s) => s === 200)).toBe(true);
    const saved = responsesOf(String(campaign.id));
    expect(saved).toHaveLength(60);
    expect(h.tables.pi_survey_invites.filter((x) => x.campaign_id === campaign.id && x.response_id).length).toBe(60);
    expect(saved.every((x) => (x.respondent_email as string).endsWith("@uji.test") && !(x.flags as string[]).length)).toBe(true);
  });

  it("link pribadi diteruskan ke orang lain: jawaban pemilik link TIDAK tergantikan", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    const rc = { id: `rec-${campaign.id}`, tenant_id: TENANT, name: "Pemilik", full_name: "Pemilik Link", email: "pemilik@uji.test" };
    const inv = { id: `inv-${campaign.id}`, tenant_id: TENANT, campaign_id: campaign.id, recipient_id: rc.id, token: "pemiliklinktokenuji00000".padEnd(24, "0"), response_id: null };
    (h.tables.pi_survey_recipients ??= []).push(rc as Row);
    (h.tables.pi_survey_invites ??= []).push(inv as Row);
    const r = rnd(41);
    const ip = nextIp();
    await call("POST", ip, { token: campaign.token, invite: inv.token, name: "Pemilik Link", answers: fill(def, r) });
    const intruder = await call("POST", ip, { token: campaign.token, invite: inv.token, name: "Orang Lain", answers: fill(def, r) });
    expect(intruder.status).toBe(200); // jawabannya tetap diterima…
    const rows = responsesOf(String(campaign.id));
    expect(rows).toHaveLength(2);
    expect(rows.find((x) => x.respondent_name === "Orang Lain")!.flags).toContain("link_pribadi_nama_beda"); // …tapi ditandai untuk HR
    expect(rows.find((x) => x.respondent_name === "Pemilik Link")!.excluded).toBe(false); // dan tidak menggeser jawaban pemilik
    expect(h.tables.pi_survey_invites.find((x) => x.id === inv.id)!.response_id).toBe(rows.find((x) => x.respondent_name === "Pemilik Link")!.id);
  });

  it("mengisi ulang lewat link pribadi, atau lewat link grup lalu pribadi: isian terakhir dihitung, tidak ada yang dihapus", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    const rc = { id: `rec-${campaign.id}`, tenant_id: TENANT, name: "Dua Kali", full_name: "Dua Kali Isi", email: "duakali@uji.test" };
    const inv = { id: `inv-${campaign.id}`, tenant_id: TENANT, campaign_id: campaign.id, recipient_id: rc.id, token: "duakaliisitokenuji00000".padEnd(24, "0"), response_id: null };
    (h.tables.pi_survey_recipients ??= []).push(rc as Row);
    (h.tables.pi_survey_invites ??= []).push(inv as Row);
    const r = rnd(51);
    const ip = nextIp();
    await call("POST", ip, { token: campaign.token, name: "Dua Kali Isi", contact: "duakali@uji.test", answers: fill(def, r) }); // link grup, email sama
    await call("POST", ip, { token: campaign.token, invite: inv.token, name: "Dua Kali Isi", answers: fill(def, r) }); // lalu link pribadi
    await call("POST", ip, { token: campaign.token, invite: inv.token, name: "Dua Kali Isi", answers: fill(def, r) }); // dan sekali lagi
    const rows = responsesOf(String(campaign.id)).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
    expect(rows).toHaveLength(3); // tidak ada yang dihapus
    expect(rows.filter((x) => !x.excluded)).toHaveLength(1); // hanya satu yang dihitung
    expect(rows.at(-1)!.excluded).toBe(false); // yaitu yang terakhir
    expect(rows.slice(0, 2).every((x) => x.excluded && (x.flags as string[]).includes("isian_ganda"))).toBe(true);
  });

  it("'pilih maksimal 3' pada definisi asli Lencir: 4 pilihan ditolak, 3 diterima", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    const q = def.find((x) => x.key === "engagement_activity")!;
    const vals = q.options!.map((o) => o.value);
    const base = fill(def.filter((x) => x.required), rnd(71));
    const ip = nextIp();
    expect((await call("POST", ip, { token: campaign.token, name: "Pilih Banyak", answers: { ...base, engagement_activity: vals.slice(0, 4) } })).status).toBe(400);
    expect((await call("POST", ip, { token: campaign.token, name: "Pilih Pas", answers: { ...base, engagement_activity: vals.slice(0, 3) } })).status).toBe(200);
    expect(responsesOf(String(campaign.id))).toHaveLength(1);
  });

  it("link pendek bernama: membuka bulan terbuka terbaru, dan jawaban masuk ke bulan itu", async () => {
    const lama = seed(def, "survei_uji_slug", { period: "2026-09-01" });
    const baru = seed(def, "survei_uji_slug", { period: "2026-10-01", survey_id: lama.survey.id });
    const ditutup = seed(def, "survei_uji_slug", { period: "2026-11-01", survey_id: lama.survey.id, status: "closed" });
    const slug = surveyLinkSlug({ key: lama.survey.key, title: lama.survey.title, config: {} }, "Rica Rico");
    const res = await call("GET", nextIp(), undefined, `?token=${slug}`);
    expect(res.status).toBe(200);
    expect((await res.json()).period).toBe("2026-10-01");
    const r = rnd(81);
    const sent = await call("POST", nextIp(), { token: slug, name: "Lewat Link Pendek", answers: fill(def, r) });
    expect(sent.status).toBe(200);
    expect(responsesOf(String(baru.campaign.id))).toHaveLength(1);
    expect(responsesOf(String(lama.campaign.id))).toHaveLength(0);
    expect(responsesOf(String(ditutup.campaign.id))).toHaveLength(0);
  });

  it("link pendek: semua bulan ditutup = 410, nama asing = 404", async () => {
    const tutup = seed(def, "survei_uji_tutup", { status: "closed" });
    const slug = surveyLinkSlug({ key: tutup.survey.key, title: tutup.survey.title, config: {} }, "Rica Rico");
    expect((await call("GET", nextIp(), undefined, `?token=${slug}`)).status).toBe(410);
    expect((await call("GET", nextIp(), undefined, "?token=form-yang-tidak-ada")).status).toBe(404);
  });

  it("kiriman dengan nama sama di milidetik yang sama (klik ganda / dua orang bernama sama) tidak gagal", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    try {
      const r = rnd(61);
      const res = await Promise.all(Array.from({ length: 3 }, () => call("POST", nextIp(), { token: campaign.token, name: "Nama Kembar", answers: fill(def, r) }).then((x) => x.status)));
      expect(res).toEqual([200, 200, 200]);
      const rows = responsesOf(String(campaign.id));
      expect(rows).toHaveLength(3);
      expect(new Set(rows.map((x) => x.submitted_at)).size).toBe(3); // waktu digeser 1 ms agar lolos indeks unik
    } finally { vi.useRealTimers(); }
  });

  it("batas kecepatan per IP: cukup longgar untuk satu kantor, tetap menahan banjir dari satu sumber", async () => {
    const { campaign } = seed(def, "pulse_bulanan");
    const { max } = route.THROTTLE.post;
    expect(max).toBeGreaterThanOrEqual(100); // batas lama 8 menolak orang ke-9 dari wifi kantor yang sama
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < max + 5; i++) statuses.push((await call("POST", ip, { token: campaign.token, name: "Banjir", website: "bot", answers: {} })).status);
    expect(statuses.slice(0, max).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(max).every((s) => s === 429)).toBe(true);
    expect((await call("POST", nextIp(), { token: campaign.token, name: "Orang Biasa", website: "bot", answers: {} })).status).toBe(200); // IP lain tidak terpengaruh
    expect(responsesOf(String(campaign.id))).toHaveLength(0); // isian jebakan bot tidak tersimpan
  });
});
