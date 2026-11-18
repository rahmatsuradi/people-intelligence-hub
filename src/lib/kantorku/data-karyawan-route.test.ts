/* /api/data-karyawan dengan database tiruan di memori — memastikan link pribadi tidak
   membocorkan data sensitif, isian tidak menimpa master, dan dokumen diperiksa di server.
   Semua orang di sini fiktif. */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const h = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const uploads: { path: string; bytes: number; type: string }[] = [];
  const REL: Record<string, Record<string, [string, string]>> = { pi_employee_profiles: { pi_outlets: ["outlet_id", "pi_outlets"] } };
  type Result = { data: unknown; error: unknown; count?: number };
  class Q implements PromiseLike<Result> {
    private op: "select" | "insert" | "update" = "select";
    private filters: ((r: Row) => boolean)[] = [];
    private payload: Row | Row[] | null = null;
    private cols = "*";
    private returning = false;
    private head = false;
    private max = Infinity;
    constructor(private table: string) {}
    select(cols = "*", o?: { head?: boolean }) { this.cols = cols; this.head = !!o?.head; if (this.op !== "select") this.returning = true; return this; }
    insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
    update(p: Row) { this.op = "update"; this.payload = p; return this; }
    eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
    order() { return this; }
    limit(n: number) { this.max = n; return this; }
    private shape(r: Row): Row {
      const out = { ...r };
      for (const [rel, [fk, tbl]] of Object.entries(REL[this.table] ?? {})) if (this.cols.includes(`${rel}(`)) out[rel] = (tables[tbl] ?? []).find((x) => x.id === r[fk]) ?? null;
      return out;
    }
    private exec(): Result {
      const all = (tables[this.table] ??= []);
      if (this.op === "insert") {
        const made = ((Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]).map((r) => ({ id: crypto.randomUUID(), ...r }));
        all.push(...made);
        return { data: this.returning ? made : null, error: null };
      }
      const hit = all.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") { for (const r of hit) Object.assign(r, this.payload); return { data: null, error: null }; }
      if (this.head) return { data: null, error: null, count: hit.length };
      return { data: hit.slice(0, this.max).map((r) => this.shape(r)), error: null };
    }
    maybeSingle() { const r = this.exec(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }); }
    single() { const r = this.exec(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }); }
    then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.exec()).then(ok, bad);
    }
  }
  const storage = { from: () => ({ upload: async (path: string, bytes: Buffer, o: { contentType: string }) => { uploads.push({ path, bytes: bytes.length, type: o.contentType }); return { data: { path }, error: null }; } }) };
  return { tables, uploads, fake: { from: (t: string) => new Q(t), storage } };
});
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: h.fake }));

import * as route from "../../app/api/data-karyawan/route";

const TENANT = "00000000-0000-4000-8000-000000000001";
const PERSONAL = "a".repeat(48);
const GENERAL = "b".repeat(48);
const CLOSED = "c".repeat(48);
const EMP = "e0000000-0000-4000-8000-000000000001";
let ip = 0;

const get = (token: string) => route.GET(new NextRequest(`http://x/api/data-karyawan?token=${token}`, { headers: { "x-forwarded-for": `10.0.0.${++ip}` } }));
const post = (body: unknown) => route.POST(new NextRequest("http://x/api/data-karyawan", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.0.1.${++ip}` } }));
const jpeg = (n: number) => `data:image/jpeg;base64,${Buffer.alloc(n, 1).toString("base64")}`;
const docs = { ktp: { type: "image/jpeg", data: jpeg(2000) }, kk: { type: "image/jpeg", data: jpeg(2000) }, photo: { type: "image/png", data: jpeg(1000) } };

const answers = () => ({
  full_name: "Rara Fiktif", nik: "3171000000000009", birth_place: "Bekasi", birth_date: "1999-05-06", gender: "Perempuan", religion: "Islam",
  marital_status: "Kawin", dependents: "1", mother_name: "Ibu Fiktif", phone: "081299990000", email: "rara@example.com", address: "Jl. Fiktif 3",
  emergency_name: "Kakak Fiktif", emergency_phone: "081288880000", emergency_relation: "Saudara kandung", education_level: "SMA/SMK",
  education_institution: "SMA Fiktif", join_date: "2026-11-02", position: "SPG", department: "SPG", outlet: "Outlet Fiktif", supervisor_name: "SPV Fiktif",
  bank_code: "bca", bank_account: "9876543210", account_holder: "RARA FIKTIF",
});

beforeEach(() => {
  for (const k of Object.keys(h.tables)) delete h.tables[k];
  h.uploads.length = 0;
  h.tables.pi_employee_data_links = [
    { id: "L1", tenant_id: TENANT, token: PERSONAL, employee_id: EMP, status: "open", expires_at: null },
    { id: "L2", tenant_id: TENANT, token: GENERAL, employee_id: null, status: "open", expires_at: null },
    { id: "L3", tenant_id: TENANT, token: CLOSED, employee_id: null, status: "closed", expires_at: null },
  ];
  h.tables.pi_outlets = [{ id: "O1", tenant_id: TENANT, name: "Outlet Fiktif", status: "active" }];
  h.tables.pi_employees = [{ id: EMP, tenant_id: TENANT, full_name: "Sari Fiktif", nik: "3171000000000001", npwp: null, join_date: "2025-01-02", position: "SPG", bank_account: "1112223334", status: "active" }];
  h.tables.pi_employee_profiles = [{ employee_id: EMP, outlet_id: "O1", phone: "6281200001111", address: "Jl. Rahasia 1", mother_name: "Ibu Rahasia", birth_date: "2000-01-01", gender: "Perempuan", bank_name: "BCA", ktp_url: "https://drive.example/ktp", kk_url: null, photo_url: null }];
  h.tables.pi_employee_hris = [];
});

describe("GET /api/data-karyawan", () => {
  it("link pribadi: data kerja ditampilkan, data sensitif hanya tanda + 4 digit", async () => {
    const r = await get(PERSONAL);
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.mode).toBe("pribadi");
    expect(j.prefill).toMatchObject({ full_name: "Sari Fiktif", outlet: "Outlet Fiktif", bank_code: "bca", gender: "Perempuan" });
    const body = JSON.stringify(j);
    for (const secret of ["3171000000000001", "1112223334", "6281200001111", "Jl. Rahasia 1", "Ibu Rahasia", "2000-01-01"]) expect(body).not.toContain(secret);
    expect(j.recorded).toMatchObject({ nik: "•••• 0001", bank_account: "•••• 3334", address: "tercatat", mother_name: "tercatat" });
    expect(j.docs).toEqual({ ktp: true, kk: false, photo: false });
    expect(j.departments).toContain("SPG"); // dari template KantorKu bawaan
  });
  it("link umum kosong; link tertutup & token asing ditolak", async () => {
    const j = await (await get(GENERAL)).json();
    expect(j).toMatchObject({ mode: "umum", prefill: {}, recorded: {} });
    expect((await get(CLOSED)).status).toBe(410);
    expect((await get("zzz")).status).toBe(404);
  });
});

describe("POST /api/data-karyawan", () => {
  it("link umum: isian + dokumen tersimpan sebagai 'baru', master tidak berubah", async () => {
    const r = await post({ token: GENERAL, answers: answers(), files: docs });
    expect(r.status).toBe(200);
    const [s] = h.tables.pi_employee_data_submissions;
    expect(s).toMatchObject({ employee_id: null, link_id: "L2" });
    expect(s).not.toHaveProperty("status"); // bawaan database = 'baru'; formulir tidak bisa mengaturnya
    expect((s.answers as Row).nik).toBe("3171000000000009");
    expect((s.answers as Row).phone).toBe("6281299990000");
    expect(s.flags).toEqual(["link_umum"]);
    expect(Object.keys(s.files as Row).sort()).toEqual(["kk", "ktp", "photo"]);
    expect(h.uploads.map((u) => u.path)).toEqual(expect.arrayContaining([`${TENANT}/${s.id}/ktp.jpg`, `${TENANT}/${s.id}/photo.png`]));
    expect(h.tables.pi_employees).toHaveLength(1);
    expect(h.tables.pi_employees[0].full_name).toBe("Sari Fiktif");
  });
  it("link umum dengan NIK yang sudah ada → dicocokkan, ditandai", async () => {
    await post({ token: GENERAL, answers: { ...answers(), nik: "3171000000000001" }, files: docs });
    const [s] = h.tables.pi_employee_data_submissions;
    expect(s.employee_id).toBe(EMP);
    expect(s.flags).toEqual(expect.arrayContaining(["cocok_nik", "link_umum"]));
  });
  it("link pribadi: data sensitif yang sudah tercatat boleh dikosongkan; dokumen yang ada tidak wajib", async () => {
    const a: Record<string, string> = answers();
    for (const k of ["nik", "phone", "address", "mother_name", "bank_account", "birth_date"]) delete a[k];
    const r = await post({ token: PERSONAL, answers: a, files: { kk: docs.kk, photo: docs.photo } });
    expect(r.status).toBe(200);
    const [s] = h.tables.pi_employee_data_submissions;
    expect(s.employee_id).toBe(EMP);
    expect(s.answers).not.toHaveProperty("nik");
  });
  it("link pribadi dipakai dengan NIK orang lain → ditandai", async () => {
    h.tables.pi_employees.push({ id: "E2", tenant_id: TENANT, full_name: "Orang Lain", nik: "3171000000000009" });
    await post({ token: PERSONAL, answers: answers(), files: docs });
    expect(h.tables.pi_employee_data_submissions[0].flags).toContain("nik_milik_karyawan_lain");
  });
  it("menolak isian tidak lengkap, dokumen bukan gambar/PDF, dan berkas terlalu besar", async () => {
    const a: Record<string, string> = answers(); delete a.nik;
    const r = await post({ token: GENERAL, answers: a, files: { ktp: { type: "text/html", data: jpeg(10) }, kk: { type: "image/jpeg", data: jpeg(2_000_000) } } });
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.errors).toMatchObject({ nik: "Wajib diisi", ktp: expect.stringMatching(/foto/), kk: expect.stringMatching(/besar/), photo: "Wajib diunggah" });
    expect(h.tables.pi_employee_data_submissions ?? []).toHaveLength(0);
  });
  it("isian jebakan bot diabaikan diam-diam", async () => {
    expect((await post({ token: GENERAL, answers: answers(), files: docs, website: "http://spam" })).status).toBe(200);
    expect(h.tables.pi_employee_data_submissions ?? []).toHaveLength(0);
  });
});

describe("beban: link pribadi massal diisi bersamaan", () => {
  it("320 karyawan membuka lalu mengirim pada saat yang sama dari satu IP (Wi-Fi/CGNAT) — semuanya tersimpan", async () => {
    const N = 320;
    const ipSama = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < N; i++) {
      const id = `e1000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      h.tables.pi_employees.push({ id, tenant_id: TENANT, full_name: `Karyawan Fiktif ${i}`, nik: null, npwp: null, join_date: "2026-01-02", position: "SPG", bank_account: null, status: "active" });
      h.tables.pi_employee_profiles.push({ employee_id: id, outlet_id: "O1", phone: null, address: null, mother_name: null, birth_date: null, gender: "Perempuan", bank_name: null, ktp_url: null, kk_url: null, photo_url: null });
      h.tables.pi_employee_data_links.push({ id: `LP${i}`, tenant_id: TENANT, token: "f" + i.toString(16).padStart(47, "0"), employee_id: id, status: "open", expires_at: null });
    }
    const tokens = Array.from({ length: N }, (_, i) => "f" + i.toString(16).padStart(47, "0"));
    const opened = await Promise.all(tokens.map((t) => route.GET(new NextRequest(`http://x/api/data-karyawan?token=${t}`, { headers: ipSama }))));
    expect(opened.map((r) => r.status).filter((s) => s !== 200)).toEqual([]);
    const sent = await Promise.all(tokens.map((t, i) => route.POST(new NextRequest("http://x/api/data-karyawan", {
      method: "POST", headers: { "content-type": "application/json", ...ipSama },
      body: JSON.stringify({ token: t, answers: { ...answers(), full_name: `Karyawan Fiktif ${i}`, nik: `31710000${String(10000000 + i)}`.slice(0, 16) }, files: docs }),
    }))));
    expect(sent.map((r) => r.status).filter((s) => s !== 200)).toEqual([]);
    expect(h.tables.pi_employee_data_submissions).toHaveLength(N);
    expect(new Set(h.tables.pi_employee_data_submissions.map((s) => s.link_id)).size).toBe(N);
    expect(h.uploads).toHaveLength(N * 3);
  });
});

describe("link umum beralamat rapi", () => {
  it("token terbaca dikenali; token pribadi tetap hex; token ngawur ditolak", async () => {
    h.tables.pi_employee_data_links.push({ id: "L9", tenant_id: TENANT, token: "data-karyawan-rica-rico", employee_id: null, status: "open", expires_at: null });
    expect((await get("data-karyawan-rica-rico")).status).toBe(200);
    expect((await get("Data_Karyawan!")).status).toBe(404);
    expect((await get("tidak-ada-link-ini")).status).toBe(404);
    const r = await post({ token: "data-karyawan-rica-rico", answers: answers(), files: docs });
    expect(r.status).toBe(200);
  });
});
