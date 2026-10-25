/* Penjaga route server: permintaan wajib membawa token Supabase milik akun ber-peran 'hr'
   (pi_user_roles). Dipakai route yang memakai service-role — tanpa penjaga ini route
   tersebut sama dengan pintu terbuka. */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireHr(request: NextRequest): Promise<{ id: string } | NextResponse> {
  if (!supabaseAdmin) return NextResponse.json({ error: "Server belum dikonfigurasi (service-role)." }, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Harus login." }, { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  const { data: row } = await supabaseAdmin.from("pi_user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
  if (row?.role !== "hr") return NextResponse.json({ error: "Hanya tim HR yang boleh melakukan ini." }, { status: 403 });
  return { id: data.user.id };
}
