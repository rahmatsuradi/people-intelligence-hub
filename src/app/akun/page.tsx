"use client";

import { useEffect, useState } from "react";
import { AppShell, Button, Card, Label, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/roles";

export default function AkunPage() {
  const { role } = useRole();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);

  const save = async () => {
    if (pw.length < 8) { toast("Kata sandi minimal 8 karakter", "error"); return; }
    if (pw !== pw2) { toast("Konfirmasi kata sandi tidak sama", "error"); return; }
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { toast(`Gagal mengganti kata sandi: ${error.message}`, "error"); return; }
    setPw(""); setPw2("");
    toast("Kata sandi berhasil diganti");
  };

  return (
    <AppShell activeNavId="akun" title="Akun Saya" subtitle="Ganti kata sandi login Anda">
      <Card className="max-w-lg">
        <p className="text-sm text-slate-600 dark:text-slate-300">Login sebagai <strong>{email || "…"}</strong>{role ? ` · ${role === "hr" ? "HR" : "Owner"}` : ""}</p>
        <div className="mt-4 space-y-3">
          <div><Label>Kata sandi baru</Label><input type="password" autoComplete="new-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><Label>Ulangi kata sandi baru</Label><input type="password" autoComplete="new-password" className={inputClass} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Ganti kata sandi"}</Button></div>
      </Card>
    </AppShell>
  );
}
