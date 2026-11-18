"use client";

import { Fragment, useMemo, useState } from "react";
import { Button, Card, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { INSTANCE } from "@/lib/instance";
import { waLink } from "@/lib/rr/pulse-remind";
import { toPhone62 } from "@/lib/kantorku/map";
import { createLinks, setLinkStatus, type DataLink } from "@/lib/kantorku/store";
import { STATUS_LABEL, WORK_GROUP_LABEL, type MasterEmployee, type WorkGroup } from "@/lib/rr/master";
import { GroupChips, GroupHeaderRow, byGroupThenName, fmtDateTime, groupOf, linkUrl } from "./shared";

const message = (name: string | null, url: string) =>
  `Halo${name ? ` ${name.split(" ")[0]}` : ""}, mohon ${name ? "periksa dan lengkapi" : "isi"} data karyawan ${INSTANCE.shortName} lewat link ini:\n${url}\n\n` +
  `Datanya dipakai untuk administrasi gaji, pajak, BPJS, dan aplikasi absensi KantorKu. Siapkan KTP, KK, buku tabungan, dan pas foto. Terima kasih 🙏\n— Tim HR`;

export function LinksTab({ employees, links, readyById, onChanged }: {
  employees: MasterEmployee[]; links: DataLink[]; readyById: Map<string, boolean>; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"belum_lengkap" | "tanpa_link" | "semua">("belum_lengkap");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(0);
  const [group, setGroup] = useState<WorkGroup | "">("");
  const [closing, setClosing] = useState<string | null>(null);
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const openLinkFor = useMemo(() => {
    const m = new Map<string, DataLink>();
    for (const l of links) if (l.employee_id && l.status === "open" && !m.has(l.employee_id)) m.set(l.employee_id, l);
    return m;
  }, [links]);
  const general = links.filter((l) => !l.employee_id);
  const personal = links.filter((l) => l.employee_id);

  const beforeGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => e.status !== "resigned")
      .filter((e) => only === "semua" || (only === "tanpa_link" ? !openLinkFor.has(e.id) : !readyById.get(e.id)))
      .filter((e) => !q || [e.full_name, e.profile?.nickname, e.position, e.profile?.supervisor_name].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [employees, only, openLinkFor, readyById, search]);
  const groupCounts = useMemo(() => {
    const m = new Map<WorkGroup, number>();
    for (const e of beforeGroup) m.set(groupOf(e), (m.get(groupOf(e)) ?? 0) + 1);
    return m;
  }, [beforeGroup]);
  const candidates = useMemo(() => byGroupThenName(beforeGroup.filter((e) => !group || groupOf(e) === group), (e) => e), [beforeGroup, group]);

  const expires = () => (days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null);

  const make = async (rows: { employee_id: string | null; label: string | null }[]) => {
    setBusy(true);
    const { links: made, error } = await createLinks(rows, expires());
    setBusy(false);
    if (error) { toast(`Gagal membuat link: ${error}`, "error"); return; }
    toast(`${made.length} link dibuat.`);
    setPicked(new Set());
    onChanged();
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast("Disalin."); } catch { window.prompt("Salin link ini:", text); }
  };

  const close = async (l: DataLink) => {
    setClosing(null);
    const err = await setLinkStatus(l.id, "closed");
    if (err) toast(err, "error"); else onChanged();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Link umum — untuk karyawan baru</h2>
            <p className="mt-0.5 text-xs text-slate-500">Pengganti link Google Form setelah offering letter. Isian dari link ini dicocokkan HR ke karyawan yang ada, atau dijadikan karyawan baru.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Berlaku</label>
            <select className={cn(inputClass, "w-32")} value={days} onChange={(e) => setDays(+e.target.value)}>
              <option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option><option value={0}>Tanpa batas</option>
            </select>
            <Button variant="primary" disabled={busy} onClick={() => make([{ employee_id: null, label: "Link umum karyawan baru" }])}>Buat link umum</Button>
          </div>
        </div>
        {general.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {general.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className={cn("rounded-full px-2 py-0.5 text-xs", l.status === "open" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>{l.status === "open" ? "Terbuka" : "Ditutup"}</span>
                <span className="min-w-0 basis-full break-all font-mono text-xs text-slate-600 dark:text-slate-300 sm:basis-0 sm:flex-1">{linkUrl(l.token)}</span>
                <span className="basis-full text-xs text-slate-500 sm:basis-auto">dibuat {fmtDateTime(l.created_at)}{l.expires_at ? ` · s.d. ${fmtDateTime(l.expires_at)}` : ""} · isian terakhir {fmtDateTime(l.last_submitted_at)}</span>
                {l.status === "open" && <>
                  <Button size="sm" onClick={() => copy(linkUrl(l.token))}>Salin</Button>
                  <Button size="sm" onClick={() => window.open(waLink(null, message(null, linkUrl(l.token))), "_blank")}>Kirim WA</Button>
                  {closing === l.id
                    ? <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">Yakin? Pemegang link ini tidak bisa mengisi lagi.
                        <Button size="sm" variant="primary" onClick={() => close(l)}>Ya, tutup</Button>
                        <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>Batal</Button></span>
                    : <Button size="sm" variant="ghost" onClick={() => setClosing(l.id)}>Tutup</Button>}
                </>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Link pribadi — karyawan yang sudah ada</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Data lama ditampilkan kembali supaya karyawan cukup memeriksa. NIK, rekening, HP, dan alamat tidak ditampilkan — hanya tanda &quot;sudah tercatat&quot; dan 4 angka terakhir, karena link bisa saja diteruskan.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={cn(inputClass, "max-w-xs")} placeholder="Cari nama, jabatan, atasan…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={cn(inputClass, "w-auto")} value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
            <option value="belum_lengkap">Data belum siap untuk KantorKu</option>
            <option value="tanpa_link">Belum punya link terbuka</option>
            <option value="semua">Semua (selain resign)</option>
          </select>
          <Button size="md" onClick={() => setPicked(new Set(candidates.filter((e) => !openLinkFor.has(e.id)).map((e) => e.id)))}>Pilih semua{group ? ` ${WORK_GROUP_LABEL[group]}` : ""} yang belum punya link ({candidates.filter((e) => !openLinkFor.has(e.id)).length})</Button>
          <Button size="md" variant="primary" disabled={busy || !picked.size}
            onClick={() => make([...picked].map((id) => ({ employee_id: id, label: byId.get(id)?.full_name ?? null })))}>
            Buat link untuk {picked.size} orang
          </Button>
        </div>
        <div className="mt-3"><GroupChips counts={groupCounts} value={group} onChange={setGroup} /></div>
        <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
              <tr><th className="w-8 px-3 py-2"></th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Kelompok</th><th className="px-3 py-2">Link</th><th className="px-3 py-2 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {candidates.slice(0, 400).map((e, i, arr) => {
                const l = openLinkFor.get(e.id);
                const phone = toPhone62(e.profile?.phone);
                const first = i === 0 || groupOf(arr[i - 1]) !== groupOf(e);
                return (
                  <Fragment key={e.id}>
                  {first && <GroupHeaderRow group={groupOf(e)} count={candidates.filter((x) => groupOf(x) === groupOf(e)).length} cols={5} />}
                  <tr>
                    <td className="px-3 py-1.5">
                      {!l && <input type="checkbox" checked={picked.has(e.id)} onChange={(ev) => setPicked((s) => { const n = new Set(s); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} />}
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{e.full_name}</p>
                      <p className="text-xs text-slate-500">{e.position ?? "—"}{e.status !== "active" ? ` · ${STATUS_LABEL[e.status]}` : ""}{readyById.get(e.id) ? " · siap KantorKu" : ""}</p>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">{e.profile ? WORK_GROUP_LABEL[e.profile.work_group] : "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{l ? <>dibuka {fmtDateTime(l.last_opened_at)}<br />dikirim {fmtDateTime(l.last_submitted_at)}</> : "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      {l && <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => copy(linkUrl(l.token))}>Salin</Button>
                        <Button size="sm" disabled={!phone} title={phone ? undefined : "Nomor HP belum ada di master"}
                          onClick={() => window.open(waLink(phone, message(e.profile?.nickname || e.full_name, linkUrl(l.token))), "_blank")}>Kirim WA</Button>
                        <Button size="sm" variant="ghost" onClick={() => close(l)}>Tutup</Button>
                      </div>}
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {candidates.length > 400 && <p className="px-3 py-2 text-xs text-slate-500">Menampilkan 400 dari {candidates.length} — persempit dengan pencarian.</p>}
          {!candidates.length && <p className="px-3 py-6 text-center text-sm text-slate-500">Tidak ada karyawan untuk filter ini.</p>}
        </div>
        <p className="mt-2 text-xs text-slate-500">{personal.filter((l) => l.status === "open").length} link pribadi terbuka · {personal.filter((l) => l.last_submitted_at).length} sudah mengirim isian.</p>
      </Card>
    </div>
  );
}
