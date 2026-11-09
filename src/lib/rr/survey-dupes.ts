/* ═══════════════════════════════════════════════════════════════════════════
   Isian ganda dari formulir web. Aturannya sama dengan saat impor: tidak ada yang dihapus,
   isian lama ditandai dan tidak dihitung, isian terakhir yang dipakai.

   - SPG → SPV: orang sama + outlet sama + kontak sama. Orang sama di outlet berbeda = SPG backup.
   - 360: penilai yang sama, dengan nama ATAU kontak yang sama (penilai sendiri yang mengisi ulang).
   - Survei lain: kontak sama DAN nama cocok (utuh, atau kata pertama sama).

   Yang hanya cocok sebagian (nama sama tapi kontak beda, kontak sama tapi nama beda, penilai sama
   tapi nama dan kontak beda) bisa dua orang berbeda — misalnya HP dan nomor dipinjam — jadi TIDAK
   dikeluarkan otomatis: isian barunya diberi tanda cek_isian_ganda supaya HR yang memutuskan.

   Hanya isian yang LEBIH TUA yang dikeluarkan, supaya dua kiriman bersamaan tidak saling mengeluarkan.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { SurveyConfig } from "./pulse";
import { normalizePhone } from "./pulse-remind";

export interface OtherEntry {
  id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string | null;
  flags: string[] | null;
  store?: string | null;
  rater?: string | null;
}

export interface NewEntry {
  id: string;
  name: string;
  /** Email undangan atau kontak yang diketik, sama dengan yang tersimpan di respondent_email. */
  contact: string;
  submittedAt: string;
  store?: string | null;
  rater?: string | null;
  /** false = isian ini boleh ditandai, tapi tidak boleh mengeluarkan isian lain (mis. link pribadi dipakai orang lain). */
  mayReplace?: boolean;
}

export interface DuplicateResult {
  /** Isian lama yang harus dikeluarkan beserta tanda yang ditambahkan. */
  replaced: { id: string; flag: string }[];
  /** Tanda untuk isian yang baru masuk. */
  selfFlags: string[];
}

const letters = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const firstWord = (s: string | null | undefined) => letters((s ?? "").trim().split(/\s+/)[0]);
const alnum = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Email dibandingkan apa adanya; hanya yang bukan email dibaca sebagai nomor HP. */
const contactKey = (s: string | null | undefined) => {
  const v = (s ?? "").trim().toLowerCase();
  return v.includes("@") ? v : normalizePhone(v) ?? v;
};

/** Isian `o` tersimpan lebih dulu daripada isian `mine` (cap waktu, lalu id bila sama persis). */
export function isOlderThan(o: Pick<OtherEntry, "id" | "submitted_at">, mine: Pick<NewEntry, "id" | "submittedAt">): boolean {
  const t = Date.parse(o.submitted_at ?? "");
  const m = Date.parse(mine.submittedAt);
  return t < m || (t === m && o.id < mine.id);
}

export function findDuplicates(kind: SurveyConfig["kind"], mine: NewEntry, others: OtherEntry[]): DuplicateResult {
  const fullName = letters(mine.name);
  const first = firstWord(mine.name);
  const contact = contactKey(mine.contact);
  const mayReplace = mine.mayReplace !== false;

  const replaced: DuplicateResult["replaced"] = [];
  let needsReview = false;
  const decide = (o: OtherEntry, same: boolean, partly: boolean, flag: string) => {
    if (same && mayReplace) { if (isOlderThan(o, mine)) replaced.push({ id: o.id, flag }); }
    else if (same || partly) needsReview = true;
  };

  for (const o of others) {
    const sameFull = !!fullName && letters(o.respondent_name) === fullName;
    const nameMatch = sameFull || (first.length >= 3 && firstWord(o.respondent_name) === first);
    const sameContact = !!contact && contactKey(o.respondent_email) === contact;
    if (kind === "spv_report") {
      if (!sameFull || alnum(o.store) !== alnum(mine.store)) continue;
      decide(o, sameContact, true, "isian_ganda_outlet_sama");
    } else if (kind === "360") {
      if (!mine.rater || o.rater !== mine.rater) continue;
      decide(o, nameMatch || sameContact, true, "isian_ganda");
    } else {
      decide(o, sameContact && nameMatch, sameContact || sameFull, "isian_ganda");
    }
  }

  const selfFlags = [
    ...(kind === "spv_report" && replaced.length ? ["punya_isian_ganda_outlet_sama"] : []),
    ...(needsReview ? ["cek_isian_ganda"] : []),
  ];
  return { replaced, selfFlags };
}
