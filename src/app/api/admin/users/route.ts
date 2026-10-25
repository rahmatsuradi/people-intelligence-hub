/* ═══════════════════════════════════════════════════════════════════════════
   /api/admin/users — kelola akun login & peran (khusus HR).

   Memakai service-role karena membuat akun & membaca daftar auth.users tidak bisa
   dilakukan dari browser. Setiap permintaan WAJIB membawa token Supabase milik akun
   ber-peran 'hr' (dicek di pi_user_roles), kalau tidak endpoint ini sama dengan pintu
   terbuka untuk membuat akun siapa saja. HR tidak bisa mengubah/mencabut perannya
   sendiri, supaya tidak ada yang tanpa sengaja mengunci tim HR keluar.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHr } from "@/lib/require-hr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "hr" | "owner";
const isRole = (r: unknown): r is Role => r === "hr" || r === "owner";

export async function GET(request: NextRequest) {
  const me = await requireHr(request);
  if (me instanceof NextResponse) return me;
  const [users, roles] = await Promise.all([
    supabaseAdmin!.auth.admin.listUsers({ perPage: 200 }),
    supabaseAdmin!.from("pi_user_roles").select("user_id, role, display_name"),
  ]);
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });
  const byId = new Map((roles.data ?? []).map((r) => [r.user_id as string, r]));
  return NextResponse.json({
    me: me.id,
    users: users.data.users.map((u) => ({
      id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
      role: (byId.get(u.id)?.role as Role | undefined) ?? null, display_name: (byId.get(u.id)?.display_name as string | undefined) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const me = await requireHr(request);
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; role?: unknown; display_name?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  if (!isRole(body.role)) return NextResponse.json({ error: "Peran harus HR atau Owner." }, { status: 400 });
  if ((body.password ?? "").length < 8) return NextResponse.json({ error: "Kata sandi awal minimal 8 karakter." }, { status: 400 });

  const created = await supabaseAdmin!.auth.admin.createUser({ email, password: body.password, email_confirm: true });
  if (created.error || !created.data.user) {
    return NextResponse.json({ error: `Gagal membuat akun: ${created.error?.message ?? "tidak diketahui"}` }, { status: 400 });
  }
  const { error } = await supabaseAdmin!.from("pi_user_roles").upsert({
    user_id: created.data.user.id, role: body.role, display_name: body.display_name?.trim() || null, created_by: me.id,
  });
  if (error) return NextResponse.json({ error: `Akun dibuat, tapi peran gagal disimpan: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.data.user.id });
}

export async function PATCH(request: NextRequest) {
  const me = await requireHr(request);
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => ({}))) as { user_id?: string; role?: unknown };
  if (!body.user_id) return NextResponse.json({ error: "user_id wajib." }, { status: 400 });
  if (body.user_id === me.id) return NextResponse.json({ error: "Anda tidak bisa mengubah peran akun Anda sendiri." }, { status: 400 });
  if (body.role === null) {
    const { error } = await supabaseAdmin!.from("pi_user_roles").delete().eq("user_id", body.user_id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (!isRole(body.role)) return NextResponse.json({ error: "Peran harus HR, Owner, atau dicabut." }, { status: 400 });
  const { error } = await supabaseAdmin!.from("pi_user_roles").upsert({ user_id: body.user_id, role: body.role, created_by: me.id });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
