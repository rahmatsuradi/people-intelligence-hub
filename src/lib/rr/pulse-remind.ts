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

  let at: Date;
  let stage: ReminderStage;
  if (!sent) {
    at = toSendWindow(p.now);
    stage = "undangan";
  } else {
    const last = new Date(Math.max(...p.sends.map((s) => new Date(s).getTime())));
    const inFinal = !!finalStart && last >= finalStart;
    let cand = new Date(last.getTime() + (inFinal ? REMIND.finalGapHours : REMIND.dailyGapHours) * HOUR);
    // Pengingat harian yang melewati awal 2 hari terakhir dimajukan ke awal masa ketat.
    if (finalStart && !inFinal && cand > finalStart) cand = new Date(Math.max(finalStart.getTime(), last.getTime() + REMIND.finalGapHours * HOUR));
    at = toSendWindow(cand);
    stage = finalStart && at >= finalStart ? "ketat" : "harian";
  }
  if (close && at > close) return { state: "none", at: null, stage: null, sent };
  return { state: at <= p.now ? "due" : "wait", at, stage, sent };
}

const dateLabel = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" });
const timeLabel = (d: string | Date) => new Date(d).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

/** "tinggal 5 jam" / "tinggal 2 hari" menuju batas isi. */
export function timeLeft(closesAt: string | Date, now: Date): string {
  const h = Math.max(0, (new Date(closesAt).getTime() - now.getTime()) / HOUR);
  return h < 24 ? `tinggal ${Math.max(1, Math.round(h))} jam` : `tinggal ${Math.round(h / 24)} hari`;
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
  const left = c.closesAt ? timeLeft(c.closesAt, c.now) : "sebentar lagi";
  return `Halo ${c.name}, ${left} lagi *${c.title} ${c.month}* ditutup ⏰\n\nKamu belum mengisi — mohon diisi sekarang ya, ±3 menit:\n${c.link}\n\nTerima kasih 🙏`;
}

/** Pesan grup: tanpa menyebut nama siapa yang belum mengisi. */
export function groupMessage(c: Omit<MessageCtx, "name"> & { filled: number; total: number }): string {
  const batas = c.closesAt ? `\n\nBatas pengisian: ${dateLabel(c.closesAt)} pukul ${timeLabel(c.closesAt)} WIB.` : "";
  if (!c.filled) {
    return `Halo rekan-rekan ${c.brand} 👋\n\nYuk isi *${c.title} ${c.month}* (±3 menit) lewat link ini:\n${c.link}\n\n` +
      `Jawabanmu hanya dibaca tim HR. Owner hanya melihat ringkasan angka tanpa nama.${batas}\n\nTerima kasih 🙏`;
  }
  const left = c.closesAt ? `, ${timeLeft(c.closesAt, c.now)} lagi` : "";
  return `Halo rekan-rekan ${c.brand} 👋\n\nTerima kasih untuk ${c.filled} dari ${c.total} orang yang sudah mengisi *${c.title} ${c.month}* 🙌\n\n` +
    `Yang belum, yuk isi sekarang${left} (±3 menit):\n${c.link}${batas}`;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Siapa yang sudah mengisi link ini: lewat link pribadinya (invite.response_id), lewat email
 * yang sama, atau lewat link grup dengan nama yang cocok tepat ke SATU orang (nama lengkap,
 * nama panggilan, atau kata pertama yang unik). Nama yang cocok ke beberapa orang tidak ditebak.
 */
export function respondedRecipients(
  recipients: { id: string; name: string; full_name: string | null; email?: string | null }[],
  invites: { recipient_id: string; response_id: string | null }[],
  responses: { respondent_name: string | null; respondent_email?: string | null }[],
): Set<string> {
  const done = new Set(invites.filter((i) => i.response_id).map((i) => i.recipient_id));
  const byEmail = new Map(recipients.filter((r) => r.email?.trim()).map((r) => [r.email!.trim().toLowerCase(), r.id]));
  const keys = new Map<string, string[]>();
  const add = (k: string, id: string) => { if (k) keys.set(k, [...new Set([...(keys.get(k) ?? []), id])]); };
  for (const r of recipients) {
    add(norm(r.full_name), r.id);
    add(norm(r.name), r.id);
    add(norm(r.full_name).split(" ")[0], r.id);
    add(norm(r.name).split(" ")[0], r.id);
  }
  for (const resp of responses) {
    const email = byEmail.get((resp.respondent_email ?? "").trim().toLowerCase());
    if (email) { done.add(email); continue; }
    const n = norm(resp.respondent_name);
    const hit = keys.get(n)?.length === 1 ? keys.get(n)! : keys.get(n.split(" ")[0])?.length === 1 ? keys.get(n.split(" ")[0])! : null;
    if (hit) done.add(hit[0]);
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
