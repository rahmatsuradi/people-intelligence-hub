/* GET /api/kantorku/template — template impor karyawan KantorKu bawaan instance ini,
   khusus akun HR. Pengisian dilakukan di browser HR (src/lib/kantorku/xlsx.ts), jadi data
   karyawan tidak melewati server untuk ekspor. 404 = instance belum punya template bawaan;
   HR mengunggah template dari KantorKu di halaman ekspor. */

import { NextRequest, NextResponse } from "next/server";
import { requireHr } from "@/lib/require-hr";
import { builtinTemplate } from "@/lib/kantorku/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const who = await requireHr(request);
  if (who instanceof NextResponse) return who;
  const t = builtinTemplate();
  if (!t) return NextResponse.json({ error: "Belum ada template bawaan. Unggah template dari KantorKu." }, { status: 404 });
  return new NextResponse(Buffer.from(t), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Cache-Control": "no-store" },
  });
}
