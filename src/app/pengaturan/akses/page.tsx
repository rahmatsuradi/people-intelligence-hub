"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, Button, Card, Label, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/roles";

interface UserRow { id: string; email: string; created_at: string; last_sign_in_at: string | null; role: "hr" | "owner" | null; display_name: string | null }

const ROLE_LABEL = { hr: "HR — baca & ubah", owner: "Owner — lihat saja" } as const;

async function api(method: string, body?: unknown) {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const res = await fetch("/api/admin/users", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export default function AksesPage() {
  const { role, loading: roleLoading } = useRole();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", display_name: "", password: "", role: "owner" as "hr" | "owner" });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api("GET").then((j) => { setUsers(j.users); setMe(j.me); }).catch((e: Error) => toast(e.message, "error")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (role === "hr") reload(); else if (!roleLoading) setLoading(false); }, [role, roleLoading, reload]);

  const create = async () => {
    setSaving(true);
    try {
      await api("POST", form);
      toast(`Akun ${form.email} dibuat. Sampaikan kata sandi awal secara langsung, lalu minta ia menggantinya di menu Akun Saya.`);
      setForm({ email: "", display_name: "", password: "", role: "owner" });
      reload();
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); }
  };

  const change = async (u: UserRow, next: "hr" | "owner" | null) => {
    if (next === null && !window.confirm(`Cabut akses ${u.email}? Akun tetap ada, tapi tidak bisa melihat data apa pun.`)) return;
    try { await api("PATCH", { user_id: u.id, role: next }); toast("Peran diperbarui"); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <AppShell activeNavId="akses" title="Pengguna & Akses" subtitle="Siapa yang bisa login dan apa yang boleh dilakukannya">
      {!roleLoading && role !== "hr" ? (
        <Card><p className="text-sm text-slate-600 dark:text-slate-300">Halaman ini hanya untuk tim HR.</p></Card>
      ) : (
        <>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Aturan akses</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li><strong>HR</strong> — melihat dan mengubah semua data.</li>
              <li><strong>Owner</strong> — melihat semua data (termasuk gaji & NIK) tanpa bisa mengubah. Dijaga oleh database, bukan hanya tampilan.</li>
              <li>Akun tanpa peran tidak bisa melihat data apa pun. Pendaftaran mandiri ditutup — akun hanya dibuat dari halaman ini.</li>
            </ul>
          </Card>

          <Card padding={false} className="overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Akun</th><th className="px-4 py-2.5 font-medium">Peran</th>
                <th className="px-4 py-2.5 font-medium">Terakhir login</th><th className="px-4 py-2.5 text-right font-medium">Ubah</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5"><p className="font-medium text-slate-900 dark:text-white">{u.display_name ?? u.email}</p>{u.display_name && <p className="text-xs text-slate-500">{u.email}</p>}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{u.role ? ROLE_LABEL[u.role] : <span className="text-red-600">Tanpa akses</span>}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("id-ID") : "Belum pernah"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {u.id === me ? <span className="text-xs text-slate-400">Akun Anda</span> : (
                        <select className={`${inputClass} w-auto py-1 text-xs`} value={u.role ?? ""} onChange={(e) => change(u, (e.target.value || null) as UserRow["role"])}>
                          <option value="hr">HR</option><option value="owner">Owner</option><option value="">Cabut akses</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Belum ada akun.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Buat akun baru</h2>
            <p className="mt-0.5 text-xs text-slate-500">Isi kata sandi awal sementara; sampaikan langsung ke orangnya (jangan lewat grup), lalu minta ia menggantinya di menu Akun Saya.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>Email</Label><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Nama tampilan</Label><input className={inputClass} placeholder="mis. Koh Rico" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              <div><Label>Kata sandi awal (min. 8 karakter)</Label><input className={inputClass} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Peran</Label>
                <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "hr" | "owner" })}>
                  <option value="owner">Owner — lihat saja</option><option value="hr">HR — baca & ubah</option>
                </select></div>
            </div>
            <div className="mt-4 flex justify-end"><Button variant="primary" onClick={create} disabled={saving}>{saving ? "Membuat…" : "Buat akun"}</Button></div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
