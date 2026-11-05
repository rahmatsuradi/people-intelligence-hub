/* ═══════════════════════════════════════════════════════════════════════════
   Pengingat survei lewat WhatsApp — SEMI-OTOMATIS (supabase/survey-reminders.sql).

   Web menghitung siapa yang belum mengisi dan kapan gilirannya diingatkan; HR menekan
   "Kirim WA" yang membuka WhatsApp dengan pesan siap kirim (wa.me). Tidak ada layanan
   pengirim pihak ketiga, jadi tidak ada biaya dan nomor WA HR tidak berisiko diblokir.

   Aturan (permintaan HR Lencir, 3 Nov 2026):
     • undangan pertama dikirim begitu link dibuat;
     • belum mengisi 1 hari setelah pesan terakhir → diingatkan lagi;
     • 2 hari terakhir sebelum batas isi → diingatkan tiap 3 jam;
     • pesan hanya dikirim 08.00–20.00 WIB; yang jatuh di luar itu menunggu 08.00.

   Fungsi murni, diuji di pulse-remind.test.ts. Akses database di bagian bawah.
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../supabase";
import { getActiveCompanyId } from "../payroll/company-profile";
import { generateSurveyToken } from "./pulse";

export const REMIND = { dailyGapHours: 24, finalGapHours: 3, finalWindowHours: 48, startHour: 8, endHour: 20 } as const;

const HOUR = 3_600_000;
const WIB = 7 * HOUR;

/** Nomor WA → format internasional tanpa "+" (62812…). null bila bukan nomor HP Indonesia yang masuk akal. */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("620")) d = "62" + d.slice(3); // "+62 (0)812…" / "+62 0812…" — nol di depan ikut tertulis
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^628\d{7,11}$/.test(d) ? d : null;
}

/** Link wa.me. Tanpa nomor = WhatsApp menanyakan chat tujuan (dipakai untuk grup). */
export function waLink(phone: string | null, text: string): string {
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}

/** Geser waktu ke jam kirim yang sopan (08.00–20.00 WIB). */
export function toSendWindow(at: Date): Date {
  const w = new Date(at.getTime() + WIB); // jam dinding WIB dibaca lewat getUTC*
  const minutes = w.getUTCHours() * 60 + w.getUTCMinutes();
  const dayStart = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - WIB;
  if (minutes < REMIND.startHour * 60) return new Date(dayStart + REMIND.startHour * HOUR);
  if (minutes > REMIND.endHour * 60) return new Date(dayStart + 24 * HOUR + REMIND.startHour * HOUR);
  return at;
}

export type ReminderStage = "undangan" | "harian" | "ketat";

export interface ReminderState {
  /** done = sudah mengisi; closed = link lewat batas; none = tidak ada pengingat lagi sebelum batas;
   *  due = waktunya dikirim sekarang; wait = belum waktunya. */
  state: "done" | "closed" | "none" | "due" | "wait";
  at: Date | null;
  stage: ReminderStage | null;
  sent: number;
}

/**
 * Kapan orang ini perlu dikirimi pesan berikutnya. `sends` = waktu HR menekan "Kirim WA"
 * untuk orang ini; tanpa batas isi (closesAt null) pengingat tetap harian.
 */
export function nextReminder(p: { sends: (string | Date)[]; closesAt: string | Date | null; responded: boolean; now: Date }): ReminderState {
  const sent = p.sends.length;
  if (p.responded) return { state: "done", at: null, stage: null, sent };
  const close = p.closesAt ? new Date(p.closesAt) : null;
  if (close && p.now > close) return { state: "closed", at: null, stage: null, sent };
  const finalStart = close ? new Date(close.getTime() - REMIND.finalWindowHours * HOUR) : null;

  // Saat paling awal pesan berikutnya boleh keluar, SEBELUM jam kirim.
  let cand = p.now;
  if (sent) {
    const last = new Date(Math.max(...p.sends.map((s) => new Date(s).getTime())));
    const inFinal = !!finalStart && last >= finalStart;
    cand = new Date(last.getTime() + (inFinal ? REMIND.finalGapHours : REMIND.dailyGapHours) * HOUR);
    // Pesan terakhir tercatat malam hari: pengingat harian jatuh paling lambat 20.00 hari itu, bukan lompat sehari.
    if (!inFinal) cand = clampToDayEnd(cand);
    // Pengingat harian yang melewati awal 2 hari terakhir dimajukan ke awal masa ketat.
    if (finalStart && !inFinal && cand > finalStart) cand = new Date(Math.max(finalStart.getTime(), last.getTime() + REMIND.finalGapHours * HOUR));
  }
  // Yang sudah lewat waktunya baru boleh dikirim SEKARANG kalau sekarang masih jam kirim; kalau tidak, menunggu 08.00.
  const at = toSendWindow(cand < p.now ? p.now : cand);
  // Tahap pesan mengikuti waktu pesan benar-benar keluar, bukan jadwal lamanya.
  const stage: ReminderStage = !sent ? "undangan" : finalStart && at >= finalStart ? "ketat" : "harian";
  if (close && at > close) return { state: "none", at: null, stage: null, sent };
  return { state: at <= p.now ? "due" : "wait", at, stage, sent };
}

/** Waktu yang jatuh setelah 20.00 WIB ditarik mundur ke 20.00 hari yang sama. */
function clampToDayEnd(at: Date): Date {
  const w = new Date(at.getTime() + WIB);
  if (w.getUTCHours() * 60 + w.getUTCMinutes() <= REMIND.endHour * 60) return at;
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - WIB + REMIND.endHour * HOUR);
}

const dateLabel = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" });
const timeLabel = (d: string | Date) => new Date(d).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

const wibDay = (d: Date) => Math.floor((d.getTime() + WIB) / (24 * HOUR));

/** "ditutup hari ini pukul 23.59 WIB" / "ditutup besok …" / "ditutup Selasa, 10 November pukul …" — hari menurut kalender WIB. */
export function closingPhrase(closesAt: string | Date, now: Date): string {
  const close = new Date(closesAt);
  const clock = `pukul ${timeLabel(close)} WIB`;
  const days = wibDay(close) - wibDay(now);
  if (days <= 0) return `ditutup hari ini ${clock}`;
  if (days === 1) return `ditutup besok ${clock}`;
  return `ditutup ${dateLabel(close)} ${clock}`;
}

export interface MessageCtx { name: string; title: string; month: string; link: string; closesAt: string | null; now: Date; brand: string }

/** Pesan pribadi. Nadanya naik bertahap: undangan → pengingat harian → pengingat 2 hari terakhir. */
export function personalMessage(stage: ReminderStage, c: MessageCtx): string {
  const batas = c.closesAt ? `Batas pengisian: ${dateLabel(c.closesAt)} pukul ${timeLabel(c.closesAt)} WIB.` : "";
  if (stage === "undangan") {
    return `Halo ${c.name} 👋\n\nYuk isi *${c.title} ${c.month}* (±3 menit) lewat link pribadimu ini:\n${c.link}\n\n` +
      `Jawabanmu hanya dibaca tim HR dan dipakai untuk memperbaiki tempat kerja kita. ${batas}\n\nTerima kasih 🙏`;
  }
  if (stage === "harian") {
    return `Halo ${c.name}, pengingat ya 🙂\n\n*${c.title} ${c.month}* belum kamu isi. Cuma ±3 menit:\n${c.link}\n\n${batas}\n\nTerima kasih!`;
  }
  const closing = c.closesAt ? closingPhrase(c.closesAt, c.now) : "ditutup sebentar lagi";
  return `Halo ${c.name}, *${c.title} ${c.month}* ${closing} ⏰\n\nKamu belum mengisi — mohon diisi sekarang ya, ±3 menit:\n${c.link}\n\nTerima kasih 🙏`;
}

/** Pesan grup: tanpa menyebut nama siapa yang belum mengisi. */
export function groupMessage(c: Omit<MessageCtx, "name"> & { filled: number; total: number }): string {
  const batas = c.closesAt ? `\n\nBatas pengisian: ${dateLabel(c.closesAt)} pukul ${timeLabel(c.closesAt)} WIB.` : "";
  if (!c.filled) {
    return `Halo rekan-rekan ${c.brand} 👋\n\nYuk isi *${c.title} ${c.month}* (±3 menit) lewat link ini:\n${c.link}\n\n` +
      `Jawabanmu hanya dibaca tim HR. Owner hanya melihat ringkasan angka tanpa nama.${batas}\n\nTerima kasih 🙏`;
  }
  const closing = c.closesAt ? ` — ${closingPhrase(c.closesAt, c.now)}` : "";
  return `Halo rekan-rekan ${c.brand} 👋\n\nTerima kasih untuk ${c.filled} dari ${c.total} orang yang sudah mengisi *${c.title} ${c.month}* 🙌\n\n` +
    `Yang belum, yuk isi sekarang (±3 menit)${closing}:\n${c.link}`;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Siapa yang sudah mengisi link ini: lewat link pribadinya (invite.response_id — pasti), atau
 * lewat link grup dengan nama yang diketik. Kesalahan "dianggap sudah mengisi" lebih buruk daripada
 * "dianggap belum" (pengingatnya berhenti diam-diam), jadi pencocokan nama sengaja ketat:
 *   1. nama lengkap atau nama panggilan, utuh, yang cocok ke SATU orang;
 *   2. kata pertama yang cocok ke SATU orang, DAN kata-kata lainnya yang diketik masih bagian dari
 *      nama orang itu (awalan boleh, mis. "Ani L." untuk "Ani Lestari").
 * Email yang diketik di kolom kontak tidak dipakai (bisa saja email orang lain).
 */
export function respondedRecipients(
  recipients: { id: string; name: string; full_name: string | null }[],
  invites: { recipient_id: string; response_id: string | null }[],
  responses: { respondent_name: string | null }[],
): Set<string> {
  const done = new Set(invites.filter((i) => i.response_id).map((i) => i.recipient_id));
  const whole = new Map<string, Set<string>>();
  const first = new Map<string, Set<string>>();
  const tokens = new Map<string, string[]>();
  const put = (m: Map<string, Set<string>>, k: string, id: string) => { if (k) m.set(k, (m.get(k) ?? new Set()).add(id)); };
  for (const r of recipients) {
    const parts = [norm(r.full_name), norm(r.name)].filter(Boolean);
    for (const p of parts) { put(whole, p, r.id); put(first, p.split(" ")[0], r.id); }
    tokens.set(r.id, [...new Set(parts.flatMap((p) => p.split(" ")))]);
  }
  const only = (s: Set<string> | undefined) => (s?.size === 1 ? [...s][0] : null);
  for (const resp of responses) {
    const n = norm(resp.respondent_name);
    if (!n) continue;
    // Satu kata yang sama dengan kata pertama orang lain ("Dedi" untuk Dedi P. dan Dedi S.) = ambigu.
    let id = only(new Set([...(whole.get(n) ?? []), ...(first.get(n) ?? [])]));
    if (!id) {
      const words = n.split(" ");
      const cand = only(first.get(words[0]));
      if (cand && words.slice(1).every((w) => tokens.get(cand)!.some((t) => t.startsWith(w)))) id = cand;
    }
    if (id) done.add(id);
  }
  return done;
}

/* ─── Database (khusus HR, dijaga RLS) ─── */

export interface Recipient { id: string; name: string; full_name: string | null; email: string | null; phone: string | null; divisi: string | null; active: boolean; note: string | null }
export interface Invite { id: string; recipient_id: string; token: string; response_id: string | null }
export interface WaLog { invite_id: string | null; kind: "pribadi" | "grup"; sent_at: string }
export interface ReminderData { recipients: Recipient[]; invites: Invite[]; logs: WaLog[]; responses: { respondent_name: string | null; respondent_email: string | null }[] }

/** null = tabel pengingat belum dipasang di database ini (supabase/survey-reminders.sql). */
export async function loadReminderData(campaignId: string): Promise<ReminderData | null> {
  if (!supabase) return null;
  const rec = await supabase.from("pi_survey_recipients").select("id, name, full_name, email, phone, divisi, active, note")
    .eq("tenant_id", getActiveCompanyId()).order("name");
  if (rec.error) {
    if (rec.error.code === "42P01" || rec.error.code === "PGRST205") return null;
    throw new Error(rec.error.message);
  }
  const [inv, log, resp] = await Promise.all([
    supabase.from("pi_survey_invites").select("id, recipient_id, token, response_id").eq("campaign_id", campaignId),
    supabase.from("pi_survey_wa_log").select("invite_id, kind, sent_at").eq("campaign_id", campaignId).order("sent_at"),
    supabase.from("pi_survey_responses").select("respondent_name, respondent_email").eq("campaign_id", campaignId),
  ]);
  const err = inv.error ?? log.error ?? resp.error;
  if (err) throw new Error(err.message);
  return { recipients: (rec.data ?? []) as Recipient[], invites: (inv.data ?? []) as Invite[], logs: (log.data ?? []) as WaLog[], responses: resp.data ?? [] };
}

/** Link pribadi untuk penerima aktif yang belum punya. */
export async function ensureInvites(campaignId: string, recipientIds: string[]): Promise<string | null> {
  if (!supabase || !recipientIds.length) return null;
  const { error } = await supabase.from("pi_survey_invites").upsert(
    recipientIds.map((recipient_id) => ({ tenant_id: getActiveCompanyId(), campaign_id: campaignId, recipient_id, token: generateSurveyToken() })),
    { onConflict: "campaign_id,recipient_id", ignoreDuplicates: true });
  return error ? error.message : null;
}

export async function logWaSend(campaignId: string, inviteId: string | null): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_wa_log").insert({ tenant_id: getActiveCompanyId(), campaign_id: campaignId, invite_id: inviteId, kind: inviteId ? "pribadi" : "grup" });
  return error ? error.message : null;
}

export async function saveRecipient(r: Partial<Recipient> & { name: string }): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  // Nomor hanya ikut disimpan bila memang diubah — mencentang aktif/nonaktif tidak boleh menghapusnya.
  const row: Record<string, unknown> = { ...r, name: r.name.trim(), tenant_id: getActiveCompanyId(), updated_at: new Date().toISOString() };
  if ("phone" in r) row.phone = r.phone ? normalizePhone(r.phone) ?? r.phone.trim() : null;
  const { error } = r.id
    ? await supabase.from("pi_survey_recipients").update(row).eq("id", r.id)
    : await supabase.from("pi_survey_recipients").insert({ ...row, source: "Diisi HR di aplikasi" });
  if (error?.code === "23505") return `Nama "${r.name}" sudah ada di daftar.`;
  return error ? error.message : null;
}
