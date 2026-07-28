// Masking data pribadi untuk slip gaji (UU PDP No. 27/2022 — minimalisasi data & pengamanan,
// Pasal 35-36). UU PDP tidak mewajibkan teknik masking spesifik; last-4 / blok-tengah adalah
// praktik pemenuhan lazim. Nilai penuh HANYA dipakai untuk pelaporan resmi (1721-A1, BPJS),
// tidak pernah ditampilkan di slip. Di server production, data mentah disimpan terenkripsi di DB.

const EMPTY = "—";

// NIK KTP 16 digit -> tampilkan 4 depan + 4 belakang, 8 tengah di-mask: 3201********0001.
export function maskNik(nik: string | null | undefined): string {
  if (!nik) return EMPTY;
  const digits = nik.replace(/\D/g, "");
  if (digits.length !== 16) return EMPTY; // format tak dikenal -> jangan bocorkan apa pun
  return `${digits.slice(0, 4)}${"*".repeat(8)}${digits.slice(-4)}`;
}

// NPWP -> ungkap 2 digit pertama + 3 digit terakhir, sisanya di-mask, separator dipertahankan:
// 09.111.222.3-011.000 -> 09.***.***.*-***.000
export function maskNpwp(npwp: string | null | undefined): string {
  if (!npwp) return EMPTY;
  const digitPositions: number[] = [];
  for (let i = 0; i < npwp.length; i++) {
    if (/\d/.test(npwp[i])) digitPositions.push(i);
  }
  if (digitPositions.length < 6) return EMPTY;
  const revealStart = new Set(digitPositions.slice(0, 2));
  const revealEnd = new Set(digitPositions.slice(-3));
  return npwp
    .split("")
    .map((ch, i) => {
      if (!/\d/.test(ch)) return ch; // pertahankan '.' dan '-'
      if (revealStart.has(i) || revealEnd.has(i)) return ch;
      return "*";
    })
    .join("");
}

// Nomor rekening -> hanya 4 digit terakhir terlihat (data keuangan = data pribadi SPESIFIK,
// proteksi paling ketat): 1234567890 -> ******7890.
export function maskBankAccount(account: string | null | undefined): string {
  if (!account) return EMPTY;
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return EMPTY;
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
