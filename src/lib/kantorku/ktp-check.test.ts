// Nama & NIK di sini FIKTIF (aturan repo: data uji tidak boleh memuat data karyawan asli).
import { describe, expect, it } from "vitest";
import {
  checkAgainstKtp, digitDiff, holderMatchesKtpName, mergeKtpFlags, nearName, needsConfirmation, nikBirth, normName, parseKtpReading, sameName,
  type KtpReading,
} from "./ktp-check";

const reading = (o: Partial<KtpReading>): KtpReading => ({ readable: true, nik: null, name: null, birthDate: null, checkedAt: "2026-11-21T10:00:00Z", ...o });

// Perempuan lahir 13-12-2006 → tanggal 13 + 40 = 53 → digit 7–12 "531206".
const ANSWERS = {
  nik: "3201015312060007", full_name: "Dewi Lestari Anggraeni", birth_date: "2006-12-13", gender: "Perempuan", account_holder: "DEWI LESTARI ANGGRAENI",
};

describe("nikBirth", () => {
  it("membaca tanggal lahir & jenis kelamin dari NIK", () => {
    expect(nikBirth("3201015312060007")).toEqual({ day: 13, month: 12, yy: 6, female: true });
    expect(nikBirth("3201011305990003")).toEqual({ day: 13, month: 5, yy: 99, female: false });
  });
  it("NIK yang bukan 16 digit atau tanggalnya mustahil = null", () => {
    expect(nikBirth("320101531206")).toBeNull();
    expect(nikBirth("3201019913060007")).toBeNull(); // tanggal 99
    expect(nikBirth(null)).toBeNull();
  });
});

describe("nama", () => {
  it("normName membuang tanda baca & spasi ganda", () => {
    expect(normName("  dewi,  lestari-anggraeni ")).toBe("DEWI LESTARI ANGGRAENI");
    expect(sameName("Dewi Lestari", "DEWI  LESTARI")).toBe(true);
  });
  it("beda satu huruf = mirip (salah ketik), nama lain = tidak mirip", () => {
    expect(nearName("Sari Riyanti", "SARI RIANTI")).toBe(true);
    expect(nearName("Dewi Lestari", "Rina Kartika")).toBe(false);
    expect(nearName("JAMAITUL HASANAH", "Jamiatul Hasanan")).toBe(true); // huruf tertukar + salah ketik
    expect(nearName("ANDI SAPUTRA", "ANDI")).toBe(false);
    expect(nearName("RINA KARTIKA", "RIKA KARTINI")).toBe(false);          // terlalu banyak beda = orang lain
  });
  it("pemilik rekening: terpotong & inisial diterima, salah ketik ditolak", () => {
    expect(holderMatchesKtpName("DEWI LESTARI ANGGRAENI", "DEWI LESTARI ANGGRAENI")).toBe(true);
    expect(holderMatchesKtpName("DEWI LESTARI ANGG", "DEWI LESTARI ANGGRAENI")).toBe(true); // dipotong bank
    expect(holderMatchesKtpName("DEWI L ANGGRAENI", "DEWI LESTARI ANGGRAENI")).toBe(true);  // inisial
    expect(holderMatchesKtpName("Dewi", "DEWI LESTARI ANGGRAENI")).toBe(true);              // terpotong
    expect(holderMatchesKtpName("Sari Rianti", "SARI RIYANTI")).toBe(false);                // salah ketik
    expect(holderMatchesKtpName("Sari Narisa Amri", "SARI NARIS AMRI")).toBe(false);        // lebih panjang dari KTP
    expect(holderMatchesKtpName("Budi Santoso", "DEWI LESTARI")).toBe(false);
  });
  it("digitDiff", () => {
    expect(digitDiff("1234", "1235")).toBe(1);
    expect(digitDiff("1234", "123")).toBe(4);
  });
});

describe("checkAgainstKtp", () => {
  it("isian cocok dengan NIK & KTP → tanpa masalah", () => {
    const r = reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI", birthDate: "2006-12-13" });
    expect(checkAgainstKtp(ANSWERS, r)).toEqual([]);
  });

  it("tanpa foto KTP: tanggal lahir & jenis kelamin di NIK tetap dicek", () => {
    const issues = checkAgainstKtp({ ...ANSWERS, birth_date: "2006-12-31", gender: "Laki-laki" }, null);
    expect(issues.map((i) => i.flag)).toEqual(["nik_tanggal_lahir_beda", "nik_jenis_kelamin_beda"]);
    expect(needsConfirmation(issues)).toBe(true);
  });

  it("tanpa foto KTP: pemilik rekening salah ketik dibanding nama lengkap tetap tertangkap", () => {
    const issues = checkAgainstKtp({ ...ANSWERS, full_name: "Sari Riyanti", account_holder: "Sari Rianti", nik: undefined }, null);
    expect(issues.map((i) => [i.flag, i.field])).toEqual([["rekening_nama_beda_ktp", "account_holder"]]);
    expect(needsConfirmation(issues)).toBe(true);
  });

  it("KTP orang lain (kasus 21 Nov 2026): NIK & nama jauh berbeda → minta konfirmasi", () => {
    const other = reading({ nik: "3201014412030004", name: "RINA KARTIKA", birthDate: "2003-12-04" });
    const issues = checkAgainstKtp(ANSWERS, other);
    const flags = issues.map((i) => i.flag);
    expect(flags).toContain("ktp_nik_beda");
    expect(flags).toContain("ktp_nama_beda");
    expect(flags).not.toContain("ktp_tanggal_lahir_beda"); // tanggal isian cocok dengan NIK isian
    expect(issues.find((i) => i.flag === "ktp_nama_beda")!.message).toMatch(/KTP Anda sendiri/);
    expect(needsConfirmation(issues)).toBe(true);
  });

  /* Salah baca foto yang ditemukan pada 22 isian asli pertama — ditiru dengan nama fiktif. */
  it("nama terbaca dengan huruf tertukar / spasi hilang = salah baca, tidak ditandai", () => {
    for (const misread of ["DWEI LESTARI ANGGRAENI", "DEWI LESTARIANGGRAENI", "DEWI LESTARI ANGGRAEINI"])
      expect(checkAgainstKtp(ANSWERS, reading({ nik: ANSWERS.nik, name: misread }))).toEqual([]);
  });
  it("tanggal lahir di foto terbaca beda satu angka, padahal isian cocok dengan NIK → tidak ditandai", () => {
    expect(checkAgainstKtp(ANSWERS, reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI", birthDate: "2006-12-18" }))).toEqual([]);
  });
  it("tanggal lahir isian salah (tidak cocok dengan NIK maupun foto) → ditandai dua-duanya", () => {
    const issues = checkAgainstKtp({ ...ANSWERS, birth_date: "2006-10-13" }, reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI", birthDate: "2006-12-13" }));
    expect(issues.map((i) => i.flag)).toEqual(["nik_tanggal_lahir_beda", "ktp_tanggal_lahir_beda"]);
  });
  it("NIK lama yang memang tidak menyandi tanggal lahir — foto memperlihatkan NIK & tanggal yang sama → tidak ditandai", () => {
    const a = { ...ANSWERS, nik: "3201010101900007", birth_date: "1990-04-16", gender: "Laki-laki", full_name: "Budi Santoso", account_holder: "BUDI SANTOSO" };
    expect(checkAgainstKtp(a, null).map((i) => i.flag)).toEqual(["nik_tanggal_lahir_beda"]);
    expect(checkAgainstKtp(a, reading({ nik: a.nik, name: "BUDI SANTOSO", birthDate: "1990-04-16" }))).toEqual([]);
  });

  it("NIK di foto beda satu angka: ditandai untuk HR; menahan kiriman hanya bila NIK isian juga tidak cocok dengan tanggal lahir", () => {
    const ocr = reading({ nik: "3201015312060008", name: "DEWI LESTARI ANGGRAENI" });
    const ok = checkAgainstKtp(ANSWERS, ocr);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toMatchObject({ flag: "ktp_nik_beda_satu_digit", field: "nik", confirm: false });
    expect(needsConfirmation(ok)).toBe(false);
    const typo = checkAgainstKtp({ ...ANSWERS, nik: "3201015312070007" }, reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI" }));
    expect(needsConfirmation(typo)).toBe(true);
  });

  it("pemilik rekening salah ketik → diarahkan ke kolom pemilik rekening", () => {
    const issues = checkAgainstKtp({ ...ANSWERS, account_holder: "Dewi Lestari Anggraini" }, reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI" }));
    expect(issues.map((i) => [i.flag, i.field])).toEqual([["rekening_nama_beda_ktp", "account_holder"]]);
  });
  it("pemilik rekening sama dengan nama lengkap, nama di foto salah baca → tidak ditandai", () => {
    expect(checkAgainstKtp(ANSWERS, reading({ nik: ANSWERS.nik, name: "DEWI LESTRAI ANGGRAENI" }))).toEqual([]);
  });

  it("foto bukan KTP / tidak terbaca → satu masalah saja", () => {
    const issues = checkAgainstKtp(ANSWERS, reading({ readable: false }));
    expect(issues.map((i) => i.flag)).toEqual(["ktp_tidak_terbaca"]);
  });

  it("isian yang tidak diketik (link pribadi) tidak dibandingkan", () => {
    expect(checkAgainstKtp({ full_name: "Dewi Lestari Anggraeni" }, reading({ nik: "3201014412030004", name: "DEWI LESTARI ANGGRAENI" }))).toEqual([]);
  });
});

describe("mergeKtpFlags", () => {
  it("mengganti tanda KTP lama, tanda lain tetap", () => {
    const issues = checkAgainstKtp({ ...ANSWERS, account_holder: "Budi" }, reading({ nik: ANSWERS.nik, name: "DEWI LESTARI ANGGRAENI" }));
    expect(mergeKtpFlags(["cocok_nik", "ktp_belum_dicek", "ktp_nik_beda"], issues)).toEqual(["cocok_nik", "rekening_nama_beda_ktp"]);
    expect(mergeKtpFlags(["link_umum"], [], true)).toEqual(["link_umum", "ktp_belum_dicek"]);
  });
});

describe("parseKtpReading", () => {
  it("merapikan jawaban model", () => {
    const r = parseKtpReading({ adalah_ktp: true, nik: "3201 0153 1206 0007", nama: "dewi lestari  anggraeni", tanggal_lahir: "13-12-2006" }, "t");
    expect(r).toMatchObject({ readable: true, nik: "3201015312060007", name: "DEWI LESTARI ANGGRAENI", birthDate: "2006-12-13" });
  });
  it("NIK tidak 16 digit & tanggal mustahil = null, bukan tebakan", () => {
    const r = parseKtpReading({ nik: "32010153120600", nama: "DEWI", tanggal_lahir: "31-02-2006" }, "t");
    expect(r.nik).toBeNull();
    expect(r.birthDate).toBeNull();
    expect(r.readable).toBe(true);
  });
  it("bukan KTP / jawaban rusak = tidak terbaca", () => {
    expect(parseKtpReading({ adalah_ktp: false, nik: "3201015312060007" }, "t").readable).toBe(false);
    expect(parseKtpReading(null, "t").readable).toBe(false);
    expect(parseKtpReading("teks", "t").readable).toBe(false);
  });
});
