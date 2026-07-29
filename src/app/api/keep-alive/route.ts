/* ═══════════════════════════════════════════════════════════════════════════
   API Route: GET /api/keep-alive

   Fires a tiny, real query at Supabase so the project registers "activity" and
   Supabase's free-tier auto-pause (after 7 days idle) never triggers.

   Driven by Vercel Cron (see vercel.json) — daily, well within the 7-day window.
   Also callable manually to verify the DB connection.

   Security: if CRON_SECRET is set, cron requests must present it as a Bearer
   token. If it's unset, the endpoint is open (the query is read-only and
   harmless), so it works out of the box.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// Never cache — every hit must reach the database to count as activity.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Optional shared-secret gate for Vercel Cron.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured", pinged: false },
      { status: 200 },
    );
  }

  const startedAt = Date.now();
  try {
    const supabase = createClient(url, anonKey);
    // Minimal real query: HEAD count, no rows transferred — enough to count as DB activity.
    const { count, error } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      pinged: true,
      activities: count ?? 0,
      latencyMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // 200 so a transient DB error doesn't spam Vercel Cron with failures.
    return NextResponse.json(
      { ok: false, pinged: false, error: message, latencyMs: Date.now() - startedAt },
      { status: 200 },
    );
  }
}
