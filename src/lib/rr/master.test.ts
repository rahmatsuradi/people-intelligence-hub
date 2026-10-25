import { describe, expect, it } from "vitest";
import { activeSpgByOutlet, countBy, filterEmployees, summarizeFlags, vacantOutlets, type MasterEmployee, type Outlet, type WorkGroup } from "./master";

function emp(id: string, over: Partial<MasterEmployee> = {}, prof: { group?: WorkGroup; outlet?: string | null; spv?: string; flags?: string[]; nick?: string } = {}): MasterEmployee {
  return {
    id, full_name: `Karyawan ${id}`, nik: null, join_date: null, employment_type: "PKWT", position: null, bank_account: null, status: "active",
    profile: {
      employee_id: id, work_group: prof.group ?? "spg", outlet_id: prof.outlet ?? null, placement_note: null, supervisor_name: prof.spv ?? null,
      legal_entity: null, employment_label: null, nickname: prof.nick ?? null, gender: null, birth_place: null, birth_date: null, religion: null,
      blood_type: null, marital_status: null, mother_name: null, phone: null, email: null, address: null, emergency_name: null,
      emergency_phone: null, emergency_relation: null, education_level: null, education_institution: null, education_major: null,
      bank_name: null, ktp_url: null, kk_url: null, photo_url: null, data_flags: prof.flags ?? [], source: null,
    },
    ...over,
  };
}

const outlet = (id: string, status: Outlet["status"] = "active"): Outlet =>
  ({ id, name: `Outlet ${id}`, area: "Jakarta 1", spv_name: "Irfan", location_type: null, status, source: null, notes: null });

describe("filterEmployees", () => {
  const list = [
    emp("1", {}, { group: "spg", outlet: "o1", spv: "Irfan", flags: ["nik_tidak_16_digit"] }),
    emp("2", { status: "resigned" }, { group: "spg", outlet: "o1", spv: "Irfan" }),
    emp("3", {}, { group: "produksi", spv: "Deni", nick: "Hasan" }),
  ];

  it("menyaring per kelompok, status, outlet, dan atasan sekaligus", () => {
    expect(filterEmployees(list, { group: "spg", status: "active", outletId: "o1", supervisor: "Irfan" }).map((e) => e.id)).toEqual(["1"]);
  });

  it("pencarian ikut membaca nama panggilan dan nama outlet", () => {
    expect(filterEmployees(list, { search: "hasan" }).map((e) => e.id)).toEqual(["3"]);
    expect(filterEmployees(list, { search: "outlet o1" }, (id) => (id ? `Outlet ${id}` : "")).map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("'__any__' = hanya yang punya tanda; nama tanda = tanda itu saja", () => {
    expect(filterEmployees(list, { flag: "__any__" }).map((e) => e.id)).toEqual(["1"]);
    expect(filterEmployees(list, { flag: "nik_tidak_16_digit" }).map((e) => e.id)).toEqual(["1"]);
    expect(filterEmployees(list, { flag: "tanpa_data_pribadi" })).toEqual([]);
  });

  it("filter kosong mengembalikan semua", () => {
    expect(filterEmployees(list, {})).toHaveLength(3);
  });
});

describe("summarizeFlags", () => {
  it("menghitung per tanda, urut terbanyak, dan mengabaikan karyawan resign", () => {
    const list = [
      emp("1", {}, { flags: ["a", "b"] }),
      emp("2", {}, { flags: ["a"] }),
      emp("3", { status: "resigned" }, { flags: ["a", "b", "c"] }),
    ];
    expect(summarizeFlags(list)).toEqual([{ flag: "a", count: 2 }, { flag: "b", count: 1 }]);
  });
});

describe("outlet lowong", () => {
  it("hanya SPG aktif yang dihitung; outlet tutup tidak dianggap lowong", () => {
    const list = [
      emp("1", {}, { group: "spg", outlet: "o1" }),
      emp("2", { status: "resigned" }, { group: "spg", outlet: "o2" }),
      emp("3", {}, { group: "spv", outlet: "o3" }),
    ];
    expect([...activeSpgByOutlet(list).entries()]).toEqual([["o1", 1]]);
    const outlets = [outlet("o1"), outlet("o2"), outlet("o3"), outlet("o4", "closed")];
    expect(vacantOutlets(outlets, list).map((o) => o.id)).toEqual(["o2", "o3"]);
  });
});

describe("countBy", () => {
  it("nilai kosong dikelompokkan sebagai '—', bukan dibuang", () => {
    expect(countBy([{ k: "A" }, { k: null }, { k: "A" }], (x) => x.k)).toEqual([{ key: "A", count: 2 }, { key: "—", count: 1 }]);
  });
});
