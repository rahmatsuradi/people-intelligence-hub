import { describe, expect, it } from "vitest";
import { closingPhrase, groupMessage, nextReminder, normalizePhone, personalMessage, respondedRecipients, toSendWindow, waLink } from "./pulse-remind";

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
  it("nol di depan yang ikut tertulis setelah kode negara: +62 (0)812… / +62 0812…", () => {
    expect(normalizePhone("+62 (0)812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("+62 0812-3456-7890")).toBe("6281234567890");
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

  it("yang terlambat TIDAK tampil 'kirim sekarang' di luar jam kirim — menunggu 08.00", () => {
    const sends = [t("2026-11-04T19:00:00")]; // jatuh tempo 5 Nov 19.00
    expect(nextReminder({ sends, closesAt, responded: false, now: t("2026-11-05T19:30:00") }).state).toBe("due");
    for (const now of ["2026-11-05T21:30:00", "2026-11-06T02:00:00", "2026-11-06T07:00:00"]) {
      const r = nextReminder({ sends, closesAt, responded: false, now: t(now) });
      expect(r.state).toBe("wait");
      expect(r.at).toEqual(t("2026-11-06T08:00:00"));
    }
    expect(nextReminder({ sends, closesAt, responded: false, now: t("2026-11-06T08:00:00") }).state).toBe("due");
  });

  it("pesan terakhir tercatat malam hari tidak membuat pengingat harian melompat sehari", () => {
    // Dicatat 4 Nov 21.00 (klik terlambat): pengingat berikutnya 5 Nov 20.00, bukan 6 Nov 08.00.
    const r = nextReminder({ sends: [t("2026-11-04T21:00:00")], closesAt, responded: false, now: t("2026-11-05T09:00:00") });
    expect(r.state).toBe("wait");
    expect(r.at).toEqual(t("2026-11-05T20:00:00"));
  });

  it("2 hari terakhir → tiap 3 jam, dan pengingat harian dimajukan ke awal masa ketat", () => {
    const shift = nextReminder({ sends: [t("2026-11-08T10:00:00")], closesAt, responded: false, now: t("2026-11-08T12:00:00") });
    expect(shift.at).toEqual(t("2026-11-09T08:00:00"));
    expect(shift.stage).toBe("ketat");
    const r = nextReminder({ sends: [t("2026-11-09T08:00:00"), t("2026-11-08T10:00:00")], closesAt, responded: false, now: t("2026-11-09T09:00:00") });
    expect(r).toMatchObject({ state: "wait", stage: "ketat" });
    expect(r.at).toEqual(t("2026-11-09T11:00:00"));
    expect(nextReminder({ sends: [t("2026-11-09T17:00:00")], closesAt, responded: false, now: t("2026-11-09T18:00:00") }).at).toEqual(t("2026-11-09T20:00:00"));
    expect(nextReminder({ sends: [t("2026-11-09T20:00:00")], closesAt, responded: false, now: t("2026-11-09T21:00:00") }).at).toEqual(t("2026-11-10T08:00:00"));
  });

  it("pengingat harian yang terlambat dan baru tampil di 2 hari terakhir memakai pesan 'ketat'", () => {
    // Terakhir dikirim 7 Nov 19.00 (belum masa ketat); jatuh tempo 8 Nov 19.00; HR baru membuka 9 Nov 10.00.
    const r = nextReminder({ sends: [t("2026-11-07T19:00:00")], closesAt, responded: false, now: t("2026-11-09T10:00:00") });
    expect(r).toMatchObject({ state: "due", stage: "ketat" });
  });

  it("pengingat berikutnya setelah batas isi → tidak ada lagi", () => {
    expect(nextReminder({ sends: [t("2026-11-10T20:00:00")], closesAt, responded: false, now: t("2026-11-10T21:00:00") }).state).toBe("none");
    // Terlambat dan sekarang sudah malam di hari terakhir: 08.00 berikutnya melewati batas.
    expect(nextReminder({ sends: [t("2026-11-10T17:00:00")], closesAt, responded: false, now: t("2026-11-10T23:00:00") }).state).toBe("none");
  });

  it("tanpa batas isi → tetap harian", () => {
    const r = nextReminder({ sends: [t("2026-11-03T09:00:00")], closesAt: null, responded: false, now: t("2026-11-03T10:00:00") });
    expect(r).toMatchObject({ stage: "harian" });
    expect(r.at).toEqual(t("2026-11-04T09:00:00"));
  });
});

describe("pesan", () => {
  const ctx = { name: "Ani", title: "Pulse Check Bulanan", month: "Oktober 2026", link: "https://x/survei/abc/def?u=ghi", closesAt: t("2026-11-10T23:59:00").toISOString(), now: t("2026-11-10T14:00:00"), brand: "Lencir" };
  it("closingPhrase memakai hari kalender WIB, bukan pembulatan jam", () => {
    expect(closingPhrase(ctx.closesAt, t("2026-11-10T08:00:00"))).toBe("ditutup hari ini pukul 23.59 WIB");
    expect(closingPhrase(ctx.closesAt, t("2026-11-09T23:30:00"))).toBe("ditutup besok pukul 23.59 WIB");
    expect(closingPhrase(ctx.closesAt, t("2026-11-08T08:00:00"))).toMatch(/^ditutup Selasa, 10 November pukul 23\.59 WIB$/);
  });
  it("nadanya naik bertahap dan selalu memuat link pribadi", () => {
    expect(personalMessage("undangan", ctx)).toContain("Halo Ani");
    expect(personalMessage("harian", ctx)).toContain("belum kamu isi");
    expect(personalMessage("ketat", ctx)).toContain("ditutup hari ini pukul 23.59 WIB");
    for (const s of ["undangan", "harian", "ketat"] as const) expect(personalMessage(s, ctx)).toContain(ctx.link);
  });
  it("pesan grup tidak menyebut nama", () => {
    const g = groupMessage({ ...ctx, filled: 7, total: 20 });
    expect(g).toContain("7 dari 20");
    expect(g).toContain("ditutup hari ini");
    expect(g).not.toContain("Ani");
  });
});

describe("respondedRecipients", () => {
  // Nama fiktif — data karyawan asli tidak boleh masuk repo.
  const people = [
    { id: "1", name: "Ani", full_name: "Ani Lestari Contoh" },
    { id: "2", name: "Budi", full_name: "Budi Santoso Contoh" },
    { id: "3", name: "Cici", full_name: "Citra Contoh" },
    { id: "4", name: "Dedi", full_name: "Dedi Pratama" },
    { id: "5", name: "Dedi S", full_name: "Dedi Saputra" },
  ];
  it("link pribadi, nama lengkap, panggilan, atau kata pertama yang unik", () => {
    const done = respondedRecipients(people, [{ recipient_id: "3", response_id: "r1" }], [
      { respondent_name: "ani lestari contoh" }, { respondent_name: "Budi" },
    ]);
    expect([...done].sort()).toEqual(["1", "2", "3"]);
  });
  it("nama yang cocok ke beberapa orang tidak ditebak", () => {
    expect(respondedRecipients(people, [], [{ respondent_name: "Dedi" }]).size).toBe(0);
  });
  it("kata pertama saja tidak cukup bila kata lainnya bukan bagian dari nama orang itu", () => {
    // "Ani Wijaya" adalah orang lain: jangan menandai Ani Lestari sebagai sudah mengisi.
    expect(respondedRecipients(people, [], [{ respondent_name: "Ani Wijaya" }]).size).toBe(0);
    // Singkatan/awalan nama masih dikenali.
    expect([...respondedRecipients(people, [], [{ respondent_name: "Ani L." }])]).toEqual(["1"]);
    expect([...respondedRecipients(people, [], [{ respondent_name: "Budi Santoso" }])]).toEqual(["2"]);
  });
  it("email yang diketik di kolom kontak tidak dipakai (bisa email orang lain)", () => {
    expect(respondedRecipients(people, [], [{ respondent_name: "Seseorang" }]).size).toBe(0);
  });
});
