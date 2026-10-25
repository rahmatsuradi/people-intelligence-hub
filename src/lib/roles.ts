/* ═══════════════════════════════════════════════════════════════════════════
   Peran akun yang login — 'hr' (baca + tulis) atau 'owner' (baca saja).

   Sumber kebenaran ada di database (pi_user_roles + RLS, supabase/rica-rico-phase1.sql):
   tulisan owner DITOLAK oleh database, bukan sekadar disembunyikan di layar. Hook ini
   hanya untuk menyesuaikan tampilan (banner "lihat saja", menyembunyikan tombol ubah).
   Akun tanpa baris peran tidak bisa membaca data apa pun.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Role = "hr" | "owner";

let cached: Promise<Role | null> | null = null;

export function fetchMyRole(): Promise<Role | null> {
  // Tanpa Supabase (mode lokal pengembangan) tidak ada pembatasan apa pun.
  if (!supabase) return Promise.resolve("hr");
  if (!cached) {
    const client = supabase;
    cached = (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return null;
      const { data } = await client.from("pi_user_roles").select("role").eq("user_id", auth.user.id).maybeSingle();
      const role = data?.role;
      return role === "hr" || role === "owner" ? role : null;
    })().catch(() => null);
  }
  return cached;
}

export function clearRoleCache(): void {
  cached = null;
}

export function useRole(): { role: Role | null; loading: boolean; canEdit: boolean } {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchMyRole().then((r) => {
      if (!alive) return;
      setRole(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return { role, loading, canEdit: role === "hr" };
}
