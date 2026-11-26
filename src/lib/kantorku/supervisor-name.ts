/**
 * Merapikan isian "Nama atasan langsung" dari formulir.
 *
 * Kolom ini teks bebas, jadi SPG mengetik "Pak fikih", "FIKIH ALFAN", "Fikih Alfan (SPV)" untuk
 * orang yang sama — di master ada 70 ejaan berbeda untuk ±10 atasan, dan hitungan per SPV meleset.
 * Fungsi ini mencocokkan ketikan ke daftar SPV yang sudah ada di master.
 *
 * Aturan: hanya merapikan bila COCOK KE TEPAT SATU atasan. Tidak cocok atau ambigu → ketikan
 * dipertahankan apa adanya (dirapikan spasinya saja), tidak ditebak. Fungsi murni.
 */

export interface KnownSupervisor {
  fullName: string;
  nickname?: string | null;
}

export interface SupervisorMatch {
  /** Nilai yang disimpan ke master. */
  value: string;
  /** true bila nilainya diganti ke nama baku di master. */
  matched: boolean;
}

/** Sapaan dan keterangan yang bukan bagian nama. */
const NOISE = new Set([
  "pak", "pa", "bapak", "bpk", "bu", "ibu", "mas", "mba", "mbak", "kak",
  "spv", "supervisor", "koordinator", "koor", "area", "manager", "jakarta", "leader",
]);

const tokens = (s: string): string[] =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);

const nameTokens = (s: string): string[] => tokens(s).filter((t) => !NOISE.has(t));

/** Jarak edit (Levenshtein) untuk kata pendek. */
function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Dua kata dianggap sama: persis, beda satu huruf (Tedi/Tedy/Teddy — y=i, huruf ganda dilipat), atau yang pendek adalah awalan yang panjang (Paul/Paulus) — hanya untuk kata ≥ 4 huruf. */
const sameWord = (a0: string, b0: string): boolean => {
  if (a0 === b0) return true;
  // Ejaan Indonesia: y/i dan huruf ganda tidak membedakan orang (Tedy/Teddy/Tedi).
  const fold = (w: string) => w.replace(/y/g, "i").replace(/(.)\1+/g, "$1");
  const a = fold(a0), b = fold(b0);
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  // Huruf pertama harus sama: salah ketik jarang di huruf pertama, sedangkan Dedi/Tedi adalah dua orang.
  if (a[0] !== b[0]) return false;
  return distance(a, b) <= 1 || a.startsWith(b) || b.startsWith(a);
};

const titleCase = (s: string): string =>
  s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

/** Nama baku di master: nama panggilan bila ada, kalau tidak kata pertama nama lengkap. */
export function canonicalLabel(s: KnownSupervisor): string {
  const nick = (s.nickname ?? "").trim();
  if (nick) return titleCase(nick);
  const first = nameTokens(s.fullName)[0] ?? s.fullName.trim().split(/\s+/)[0] ?? "";
  return titleCase(first);
}

export function canonicalSupervisor(typed: string, known: KnownSupervisor[]): SupervisorMatch {
  const original = typed.replace(/\s+/g, " ").trim();
  const t = nameTokens(original);
  if (!t.length) return { value: original, matched: false };

  const hits = new Set<string>();
  for (const k of known) {
    const label = canonicalLabel(k);
    if (!label) continue;
    const full = nameTokens(k.fullName);
    const nick = nameTokens(k.nickname ?? "");
    const first = full[0];
    // (a) kata pertama ketikan = nama panggilan / kata pertama nama lengkap ("Pak fikih", "Fikih Alfan (SPV)")
    const byFirst = [...nick, ...(first ? [first] : [])].some((w) => sameWord(t[0], w));
    // (b) ≥ 2 kata ketikan cocok dengan kata di nama lengkap ("Muhammad Tri Rhomadhoni")
    const overlap = t.filter((w) => full.some((f) => sameWord(w, f))).length;
    if (byFirst || (t.length >= 2 && overlap >= 2)) hits.add(label);
  }
  if (hits.size === 1) {
    const value = [...hits][0];
    return { value, matched: value !== original };
  }
  return { value: original, matched: false };
}
