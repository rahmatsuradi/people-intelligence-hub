/* Uji alur /api/pulse-insight ujung-ke-ujung dengan database & Groq tiruan:
   langkah "tema" per bagian → insight akhir dengan masalah_utama. Nama fiktif. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const prompts: { prompt: string; maxTokens?: number }[] = [];
  class Q {
    private filters: ((r: Row) => boolean)[] = [];
    private upserted: Row | null = null;
    constructor(private t: string) {}
    select() { return this; }
    eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
    in(k: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[k])); return this; }
    order() { return this; }
    range() { return this; }
    upsert(row: Row) { this.upserted = { id: "ins1", ...row }; tables[this.t] = [this.upserted]; return this; }
    private rows() { return (tables[this.t] ?? []).filter((r) => this.filters.every((f) => f(r))); }
    async maybeSingle() { return { data: this.rows()[0] ?? null, error: null }; }
    async single() { return { data: this.upserted ?? this.rows()[0], error: null }; }
    then<A>(ok: (v: { data: Row[]; error: null }) => A) { return Promise.resolve({ data: this.rows(), error: null }).then(ok); }
  }
  return { tables, prompts, fake: { from: (t: string) => new Q(t) } };
});
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: h.fake }));
vi.mock("@/lib/require-hr", () => ({ requireHr: async () => ({ id: "hr1" }) }));
vi.mock("@/lib/cv-groq", () => ({
  GROQ_MODEL: "tiruan",
  callGroq: async (prompt: string, _a: number, opts: { maxTokens?: number } = {}) => {
    h.prompts.push({ prompt, maxTokens: opts.maxTokens });
    if (prompt.includes("Kelompokkan MASALAH")) {
      // AI tiruan: tandai berdasarkan kata kunci; tema baru hanya di bagian pertama.
      const first = !prompt.includes("TEMA YANG SUDAH ADA");
      const tag: Record<string, string[]> = {};
      for (const line of prompt.split("\n")) {
        const m = line.match(/^#(\d+) (.*)$/);
        if (!m) continue;
        for (const part of m[2].split(/ (?=\[[A-Z]\] )/)) {
          const pm = part.match(/^\[([A-Z])\] (.*)$/);
          if (!pm) continue;
          const ids = [/libur/i.test(pm[2]) ? (first ? "B1" : "T1") : "", /chat/i.test(pm[2]) ? (first ? "B2" : "T2") : ""].filter(Boolean);
          if (ids.length) tag[`#${m[1]}${pm[1]}`] = ids;
        }
      }
      const tema_baru = first ? [{ id: "B1", nama: "Libur 4x sebulan", definisi: "minta libur", pemilik: "perusahaan", kategori: "Company Benefit" }, { id: "B2", nama: "SPV lambat balas chat", definisi: "chat", pemilik: "spv", kategori: "Kinerja SPV" }] : [];
      return { content: JSON.stringify({ tema_baru, tag }), remainingTokens: 1500, resetSeconds: 40 };
    }
    return {
      content: JSON.stringify({
        ringkasan: "Ringkas.", temuan: [{ judul: "Libur", bukti: "60 orang", dampak: "-" }],
        masalah_utama: [{ id: "T1", judul: "SPG minta libur 4x sebulan", inti: "Libur 2x terasa kurang.", contoh: ["libur seminggu sekali"], usulan: "HR kaji jadwal.", berulang: true, jumlah: 999 }],
        tema_komentar: [{ tema: "SPV ramah", jumlah: 0, sentimen: "positif", inti: "ramah" }], rekomendasi: [], catatan_data: [],
      }),
      remainingTokens: 4000, resetSeconds: 10,
    };
  },
}));

import { POST } from "@/app/api/pulse-insight/route";

const SURVEY = "s1";
const spvs = ["Budi", "Citra", "Dodi"];
beforeEach(() => {
  h.prompts.length = 0;
  h.tables.pi_surveys = [{ id: SURVEY, tenant_id: "t", key: "feedback_spg_bulanan", title: "Feedback SPG", audience: "SPG", headline: [], segments: ["spv"], config: { kind: "spv_report" }, questions: [
    { key: "spv", label: "Nama SPV Area", type: "text" },
    { key: "good", label: "Apa yang sudah dilakukan SPV dengan baik?", type: "text" },
    { key: "improve", label: "Apa yang perlu ditingkatkan oleh SPV?", type: "text" },
    { key: "company", label: "Masukan lain untuk perusahaan?", type: "text" },
  ] }];
  h.tables.pi_survey_responses = Array.from({ length: 150 }, (_, i) => ({
    id: `r${String(i).padStart(3, "0")}`, survey_id: SURVEY, period: "2026-10-01", excluded: false, respondent_name: `Pengisi ${i}`,
    answers: {
      spv: spvs[i % 3], good: "SPV ramah dan sering datang ke outlet",
      improve: i % 4 === 0 ? "Tolong balas chat lebih cepat kalau ada kendala di outlet, kami sering menunggu lama sekali" : "tidak ada",
      company: i % 5 < 2 ? "Mohon libur seminggu sekali jadi 4x sebulan karena kerja 12 jam sangat melelahkan, terima kasih banyak" : "-",
    },
  }));
  h.tables.pi_survey_actions = [{ survey_id: SURVEY, title: "Libur 4x sebulan", theme: "libur", status: "belum", period: "2026-06-01" }];
  h.tables.pi_survey_campaigns = [];
  h.tables.pi_employees = [{ tenant_id: "t", full_name: "Budi Santoso" }];
  h.tables.pi_survey_insights = [];
});

const post = (body: Record<string, unknown>) => POST(new NextRequest("http://x/api/pulse-insight", { method: "POST", body: JSON.stringify({ surveyId: SURVEY, period: "2026-10-01", ...body }) }));
const estTokens = (p: { prompt: string; maxTokens?: number }) => Math.ceil(p.prompt.length / 3) + (p.maxTokens ?? 2600);

describe("/api/pulse-insight — masalah utama dari semua komentar", () => {
  it("membaca semua bagian, menghitung pasti, dan setiap permintaan muat 8.000 token/menit", async () => {
    let state: unknown = null;
    let batch = 0, batches = 1;
    const waits: number[] = [];
    while (batch < batches) {
      const res = await post({ step: "tema", batch, state });
      const j = await res.json();
      expect(res.status).toBe(200);
      batches = j.batches; state = j.state; waits.push(j.waitSeconds); batch++;
    }
    expect(batches).toBeGreaterThanOrEqual(1);
    expect(waits.every((w) => w === 42)).toBe(true);

    const res = await post({ state });
    const { insight } = await res.json();
    const m = insight.content.masalah_utama;
    // libur: i%5<2 → 60 dari 150; chat: i%4==0 → 38 dari 150. Angka AI (999) diabaikan.
    expect(m.map((t: { judul: string; jumlah: number; persen: number }) => [t.judul, t.jumlah, t.persen])).toEqual([["SPG minta libur 4x sebulan", 60, 40], ["SPV lambat balas chat", 38, 25]]);
    expect(m[0].per_kelompok.map((g: { grup: string; n: number }) => g.n)).toEqual([50, 50, 50]);
    expect(insight.content.masalah_dasar).toMatchObject({ responden: 150, kelompok_label: "SPV area", tanpa_tema: 0 });
    expect(insight.content.tema_komentar[0].sentimen).toBe("positif");
    expect(m.map((t: { kategori: string }) => t.kategori)).toEqual(["Company Benefit", "Kinerja SPV"]);
    // Peta per komentar: komentar libur ditandai di pertanyaan "company", chat di "improve" — tidak tertukar.
    const peta = insight.content.masalah_peta as { tags: Record<string, string[]> };
    const keysOf = (t: string) => Object.keys(peta.tags).filter((k) => peta.tags[k].includes(t));
    expect(keysOf("T1").length).toBe(60);
    expect(keysOf("T1").every((k) => k.endsWith(":company"))).toBe(true);
    expect(keysOf("T2").length).toBe(38);
    expect(keysOf("T2").every((k) => k.endsWith(":improve"))).toBe(true);

    for (const p of h.prompts) expect(estTokens(p)).toBeLessThan(8000);
    const final = h.prompts.at(-1)!.prompt;
    expect(final).toContain("Libur 4x sebulan — 60 orang (40%)");
    expect(final).not.toContain("Pengisi 1");
  });

  it("tanpa state: insight dibuat dengan cara lama, tanpa masalah_utama", async () => {
    const res = await post({});
    const { insight } = await res.json();
    expect(insight.content.masalah_utama).toBeUndefined();
    expect(h.prompts).toHaveLength(1);
  });
});
