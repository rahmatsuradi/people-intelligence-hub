"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { periodLabel, type Campaign, type Survey } from "@/lib/rr/pulse";
import {
  ensureInvites, groupMessage, loadReminderData, logWaSend, nextReminder, normalizePhone, personalMessage, respondedRecipients, saveRecipient, waLink,
  type Recipient, type ReminderData, type ReminderState,
} from "@/lib/rr/pulse-remind";
import { INSTANCE } from "@/lib/instance";

const when = (d: Date) => d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STAGE: Record<string, string> = { undangan: "Undangan", harian: "Pengingat", ketat: "Pengingat 2 hari terakhir" };

interface Row { r: Recipient; inviteId: string | null; link: string; phone: string | null; st: ReminderState; last: Date | null }

/**
 * Pengingat WA semi-otomatis untuk satu link survei: siapa yang belum mengisi, siapa yang
 * gilirannya diingatkan sekarang, dan tombol yang membuka WhatsApp dengan pesan siap kirim.
 * Aturan jadwal: nextReminder() di pulse-remind.ts.
 */
export function Reminders({ survey, campaign, link }: { survey: Survey; campaign: Campaign; link: string }) {
  // null = tabel pengingat belum dipasang; galat lain hanya ditampilkan, data yang sudah ada tidak dibuang.
  const [data, setData] = useState<ReminderData | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "" });
  const sending = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      let d = await loadReminderData(campaign.id);
      const missing = d ? d.recipients.filter((r) => r.active && !d!.invites.some((i) => i.recipient_id === r.id)).map((r) => r.id) : [];
      if (d && missing.length) {
        const err = await ensureInvites(campaign.id, missing);
        if (err) toast(err, "error");
        d = await loadReminderData(campaign.id);
      }
      setData(d);
      setLoadError("");
    } catch (e) { setLoadError((e as Error).message); }
  }, [campaign.id]);

  useEffect(() => { load(); }, [load]);
  // Segarkan tiap menit dan saat HR kembali dari WhatsApp, supaya yang baru mengisi/baru dikirimi tidak tampil "kirim sekarang".
  useEffect(() => {
    const tick = () => { setNow(new Date()); load(); };
    const t = setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const done = respondedRecipients(data.recipients, data.invites, data.responses);
    const order = { due: 0, wait: 1, none: 2, closed: 3, done: 4 } as const;
    return data.recipients.filter((r) => r.active).map((r) => {
      const inv = data.invites.find((i) => i.recipient_id === r.id) ?? null;
      const sends = data.logs.filter((l) => inv && l.invite_id === inv.id).map((l) => l.sent_at);
      const st = nextReminder({ sends, closesAt: campaign.closes_at, responded: done.has(r.id), now });
      return { r, inviteId: inv?.id ?? null, link: inv ? `${link}?u=${inv.token}` : link, phone: normalizePhone(r.phone), st, last: sends.length ? new Date(sends[sends.length - 1]) : null };
    }).sort((a, b) => order[a.st.state] - order[b.st.state] || (a.st.at?.getTime() ?? 0) - (b.st.at?.getTime() ?? 0) || a.r.name.localeCompare(b.r.name));
  }, [data, campaign.closes_at, link, now]);

  if (data === undefined) {
    return loadError
      ? <p className="mt-3 text-xs text-red-600">Pengingat WA gagal dimuat: {loadError} <button type="button" className="underline" onClick={load}>Coba lagi</button></p>
      : <p className="mt-3 text-xs text-slate-400">Memuat pengingat WA…</p>;
  }
  if (data === null) return <p className="mt-3 text-xs text-slate-400">Pengingat WA belum aktif di database ini (jalankan supabase/survey-reminders.sql).</p>;

  const month = periodLabel(campaign.period);
  const isClosed = campaign.status === "closed" || (!!campaign.closes_at && new Date(campaign.closes_at) <= now);
  const filled = rows.filter((x) => x.st.state === "done").length;
  // Tanpa link pribadi, pesan tidak bisa dicatat atas nama orangnya (akan dianggap belum pernah dikirim).
  const due = rows.filter((x) => x.st.state === "due" && x.phone && x.inviteId);
  const lastGroup = data.logs.filter((l) => l.kind === "grup").at(-1);

  // window.open harus terjadi langsung di klik (bukan setelah await), kalau tidak diblokir browser.
  const sendTo = (x: Row) => {
    if (!x.phone) { toast(`Nomor WA ${x.r.name} belum diisi`, "error"); return; }
    if (!x.inviteId) { toast(`Link pribadi ${x.r.name} belum dibuat — muat ulang halaman`, "error"); return; }
    if (sending.current.has(x.inviteId)) return; // klik ganda sebelum catatan kirim tersimpan
    sending.current.add(x.inviteId);
    const text = personalMessage(x.st.stage ?? "harian", { name: x.r.name, title: survey.title, month, link: x.link, closesAt: campaign.closes_at, now, brand: INSTANCE.shortName });
    window.open(waLink(x.phone, text), "_blank", "noopener");
    logWaSend(campaign.id, x.inviteId).then((err) => { sending.current.delete(x.inviteId!); if (err) toast(err, "error"); else load(); });
  };
  const sendGroup = () => {
    if (isClosed) { toast("Formulir ini sudah ditutup", "error"); return; }
    const text = groupMessage({ title: survey.title, month, link, closesAt: campaign.closes_at, now, brand: INSTANCE.shortName, filled, total: rows.length });
    window.open(waLink(null, text), "_blank", "noopener");
    logWaSend(campaign.id, null).then((err) => { if (err) toast(err, "error"); else load(); });
  };

  const save = async (r: Partial<Recipient> & { name: string }) => {
    const err = await saveRecipient(r);
    if (err) { toast(err, "error"); return false; }
    await load();
    return true;
  };

  const chip = (x: Row) => {
    const s = x.st;
    if (s.state === "done") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Sudah isi</span>;
    if (!x.phone) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Nomor WA belum ada</span>;
    if (s.state === "due") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">Kirim sekarang · {STAGE[s.stage!]}</span>;
    if (s.state === "wait") return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{STAGE[s.stage!]} {when(s.at!)}</span>;
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">{s.state === "closed" ? "Ditutup" : "Tidak ada pengingat lagi"}</span>;
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Pengingat WA</p>
          <p className="text-xs text-slate-500">
            {filled} dari {rows.length} sudah mengisi · <b className={due.length ? "text-red-600 dark:text-red-400" : ""}>{due.length} perlu dikirim sekarang</b>
            {lastGroup ? ` · terakhir ke grup ${when(new Date(lastGroup.sent_at))}` : " · belum dikirim ke grup"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Belum mengisi 1 hari → diingatkan lagi. 2 hari terakhir → tiap 3 jam. Hanya 08.00–20.00 WIB. Tiap orang dapat link pribadi, jadi web tahu siapa yang sudah mengisi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={!due.length} onClick={() => due[0] && sendTo(due[0])}>{due.length ? `Kirim berikutnya: ${due[0].r.name} (${due.length})` : "Tidak ada yang perlu dikirim"}</Button>
          <Button size="sm" disabled={isClosed} onClick={sendGroup}>Kirim ke grup WA</Button>
          <Button size="sm" variant="ghost" onClick={() => setManage(!manage)}>{manage ? "Selesai" : "Kelola penerima"}</Button>
        </div>
      </div>

      {!manage ? (
        rows.length ? (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((x) => (
              <li key={x.r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-100">{x.r.name}{x.r.divisi ? <span className="ml-1.5 text-xs text-slate-400">{x.r.divisi}</span> : null}</p>
                  <p className="text-[11px] text-slate-400">{x.st.sent ? `${x.st.sent}× dikirim · terakhir ${when(x.last!)}` : "Belum pernah dikirim"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {chip(x)}
                  {x.st.state !== "done" && x.st.state !== "closed" && (
                    <Button size="sm" variant={x.st.state === "due" ? "primary" : "ghost"} disabled={!x.phone || !x.inviteId} onClick={() => sendTo(x)}>Kirim WA</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-xs text-slate-500">Belum ada penerima. Klik &quot;Kelola penerima&quot; untuk menambahkan nama dan nomor WA.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-400">Nomor WA hanya bisa dilihat tim HR. Penerima nonaktif (mis. sudah keluar) tidak dikirimi pesan.</p>
          {data.recipients.map((r) => <RecipientRow key={r.id} r={r} onSave={save} />)}
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <input className={cn(inputClass, "w-40")} placeholder="Nama panggilan" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className={cn(inputClass, "w-44")} placeholder="Nomor WA (08…)" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <Button size="sm" variant="primary" disabled={!draft.name.trim()} onClick={async () => { if (await save({ name: draft.name, phone: draft.phone || null, active: true })) setDraft({ name: "", phone: "" }); }}>Tambah</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipientRow({ r, onSave }: { r: Recipient; onSave: (r: Partial<Recipient> & { name: string }) => Promise<boolean> }) {
  const [phone, setPhone] = useState(r.phone ?? "");
  const bad = phone.trim() !== "" && !normalizePhone(phone);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex w-48 items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
        <input type="checkbox" checked={r.active} onChange={(e) => onSave({ id: r.id, name: r.name, active: e.target.checked })} />
        <span className={r.active ? "" : "text-slate-400 line-through"}>{r.name}</span>
      </label>
      <input className={cn(inputClass, "w-44", bad && "border-red-400")} placeholder="Nomor WA" value={phone} onChange={(e) => setPhone(e.target.value)}
        onBlur={() => { if (phone !== (r.phone ?? "")) onSave({ id: r.id, name: r.name, phone: phone || null }); }} />
      <span className="text-xs text-slate-400">{[r.full_name, r.divisi].filter(Boolean).join(" · ")}</span>
    </div>
  );
}
