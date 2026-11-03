import { describe, expect, it } from "vitest";
import { groupMessage, nextReminder, normalizePhone, personalMessage, respondedRecipients, toSendWindow, waLink } from "./pulse-remind";

// Waktu ditulis dalam WIB (+07:00) supaya mudah dibaca.
const t = (s: string) => new Date(`${s}+07:00`);

describe("normalizePhone", () => {
  it("menyeragamkan nomor HP Indonesia ke 62…", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 789")).toBe("628123456789");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
    expect(normalizePhone("021-555-1234")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("waLink tanpa nomor membiarkan WhatsApp menanyakan tujuan (untuk grup)", () => {
    expect(waLink(null, "a b")).toBe("https://wa.me/?text=a%20b");
    expect(waLink("6281234567890", "x")).toBe("https://wa.me/6281234567890?text=x");
  });
});

describe("toSendWindow", () => {
  it("hanya 08.00–20.00 WIB", () => {
    expect(toSendWindow(t("2026-11-03T10:15:00"))).toEqual(t("2026-11-03T10:15:00"));
    expect(toSendWindow(t("2026-11-03T06:00:00"))).toEqual(t("2026-11-03T08:00:00"));
    expect(toSendWindow(t("2026-11-03T20:00:00"))).toEqual(t("2026-11-03T20:00:00"));
    expect(toSendWindow(t("2026-11-03T21:30:00"))).toEqual(t("2026-11-04T08:00:00"));
    expect(toSendWindow(t("2026-11-03T23:59:00"))).toEqual(t("2026-11-04T08:00:00"));
  });
});

describe("nextReminder", () => {
  const closesAt = t("2026-11-10T23:59:00"); // masa ketat mulai 8 Nov 23:59

  it("belum pernah dikirim → undangan sekarang (atau 08.00 bila malam)", () => {
    expect(nextReminder({ sends: [], closesAt, responded: false, now: t("2026-11-03T09:00:00") })).toMatchObject({ state: "due", stage: "undangan" });
    const night = nextReminder({ sends: [], closesAt, responded: false, now: t("2026-11-03T22:00:00") });
    expect(night).toMatchObject({ state: "wait", stage: "undangan" });
    expect(night.at).toEqual(t("2026-11-04T08:00:00"));
  });

  it("sudah mengisi atau lewat batas → tidak ada pengingat", () => {
    expect(nextReminder({ sends: [t("2026-11-03T09:00:00")], closesAt, responded: true, now: t("2026-11-05T09:00:00") }).state).toBe("done");
    expect(nextReminder({ sends: [], closesAt, responded: false, now: t("2026-11-11T09:00:00") }).state).toBe("closed");
  });

  it("belum mengisi 1 hari setelah pesan terakhir → pengingat harian", () => {
    const r = nextReminder({ sends: [t("2026-11-03T09:00:00")], closesAt, responded: false, now: t("2026-11-03T15:00:00") });
    expect(r).toMatchObject({ state: "wait", stage: "harian", sent: 1 });
    expect(r.at).toEqual(t("2026-11-04T09:00:00"));
    expect(nextReminder({ sends: [t("2026-11-03T09:00:00")], closesAt, responded: false, now: t("2026-11-04T09:30:00") }).state).toBe("due");
  });

  it("pengingat harian yang jatuh malam ditahan ke 08.00", () => {
    const r = nextReminder({ sends: [t("2026-11-03T19:30:00")], closesAt, responded: false, now: t("2026-11-04T10:00:00") });
    expect(r.at).toEqual(t("2026-11-04T19:30:00"));
    const late = nextReminder({ sends: [t("2026-11-03T20:00:00")], closesAt, responded: false, now: t("2026-11-04T10:00:00") });
    expect(late.at).toEqual(t("2026-11-04T20:00:00"));
  });

  it("2 hari terakhir → tiap 3 jam, dan pengingat harian dimajukan ke awal masa ketat", () => {
    // Pesan terakhir 8 Nov 10.00: +24 jam melewati awal masa ketat (8 Nov 23.59) → dimajukan, lalu ditahan ke 08.00.
    const shift = nextReminder({ sends: [t("2026-11-08T10:00:00")], closesAt, responded: false, now: t("2026-11-08T12:00:00") });
    expect(shift.at).toEqual(t("2026-11-09T08:00:00"));
    expect(shift.stage).toBe("ketat");
    const r = nextReminder({ sends: [t("2026-11-09T08:00:00"), t("2026-11-08T10:00:00")], closesAt, responded: false, now: t("2026-11-09T09:00:00") });
    expect(r).toMatchObject({ state: "wait", stage: "ketat" });
    expect(r.at).toEqual(t("2026-11-09T11:00:00"));
    // 17.00 → 20.00 masih boleh; 20.00 → 23.00 ditahan ke 08.00 besok.
    expect(nextReminder({ sends: [t("2026-11-09T17:00:00")], closesAt, responded: false, now: t("2026-11-09T18:00:00") }).at).toEqual(t("2026-11-09T20:00:00"));
    expect(nextReminder({ sends: [t("2026-11-09T20:00:00")], closesAt, responded: false, now: t("2026-11-09T21:00:00") }).at).toEqual(t("2026-11-10T08:00:00"));
  });

  it("pengingat berikutnya setelah batas isi → tidak ada lagi", () => {
    expect(nextReminder({ sends: [t("2026-11-10T20:00:00")], closesAt, responded: false, now: t("2026-11-10T21:00:00") }).state).toBe("none");
  });

  it("tanpa batas isi → tetap harian", () => {
    const r = nextReminder({ sends: [t("2026-11-03T09:00:00")], closesAt: null, responded: false, now: t("2026-11-03T10:00:00") });
    expect(r).toMatchObject({ stage: "harian" });
    expect(r.at).toEqual(t("2026-11-04T09:00:00"));
  });
});

describe("pesan", () => {
  const ctx = { name: "Kia", title: "Pulse Check Bulanan", month: "Oktober 2026", link: "https://x/survei/abc?u=def", closesAt: t("2026-11-10T23:59:00").toISOString(), now: t("2026-11-10T14:00:00"), brand: "Lencir" };
  it("nadanya naik bertahap dan selalu memuat link pribadi", () => {
    expect(personalMessage("undangan", ctx)).toContain("Halo Kia");
    expect(personalMessage("harian", ctx)).toContain("belum kamu isi");
    expect(personalMessage("ketat", ctx)).toContain("tinggal 10 jam");
    for (const s of ["undangan", "harian", "ketat"] as const) expect(personalMessage(s, ctx)).toContain(ctx.link);
  });
  it("pesan grup tidak menyebut nama", () => {
    const g = groupMessage({ ...ctx, filled: 7, total: 20 });
    expect(g).toContain("7 dari 20");
    expect(g).not.toContain("Kia");
  });
});

describe("respondedRecipients", () => {
  const people = [
    { id: "1", name: "Kia", full_name: "Zakiyah Khoirunnisa" },
    { id: "2", name: "Putri", full_name: "Elisa Ananda Putri" },
    { id: "3", name: "Riri", full_name: "Rikotul Kabiyah" },
    { id: "4", name: "Rizki", full_name: "Rizki Ramadhan" },
    { id: "5", name: "Rizki S", full_name: "Rizki Saputra" },
  ];
  it("link pribadi, nama lengkap, panggilan, atau kata pertama yang unik", () => {
    const done = respondedRecipients(people, [{ recipient_id: "3", response_id: "r1" }], [
      { respondent_name: "zakiyah khoirunnisa" }, { respondent_name: "Putri" },
    ]);
    expect([...done].sort()).toEqual(["1", "2", "3"]);
  });
  it("nama yang cocok ke beberapa orang tidak ditebak", () => {
    expect(respondedRecipients(people, [], [{ respondent_name: "Rizki" }]).size).toBe(0);
  });
  it("email yang sama dikenali walau nama yang diketik berbeda", () => {
    const withEmail = [...people, { id: "6", name: "Aya", full_name: "Dessy Fadia Haya", email: "cs@lencir.test" }];
    expect([...respondedRecipients(withEmail, [], [{ respondent_name: "Dessy F.", respondent_email: " CS@lencir.test " }])]).toEqual(["6"]);
  });
});
