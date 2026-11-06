/* ═══════════════════════════════════════════════════════════════════════════
   /brand-og — gambar pratinjau saat link dibagikan di WhatsApp, dari berkas logo resmi di
   public/brand. Latar disamakan dengan warna logo supaya tepinya tidak terlihat saat WhatsApp
   memotong gambar ke bentuk persegi.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { INSTANCE } from "@/lib/instance";

const LOGO = INSTANCE.key === "lencir"
  ? { path: "/brand/lencir-logo.jpg", background: "#a4ddf0", size: 630 }
  : { path: "/brand/rica-rico-logo.jpg", background: "#ffffff", size: 420 };

export async function GET(request: NextRequest) {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: LOGO.background }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dirender ke PNG oleh ImageResponse, bukan ke halaman */}
      <img src={new URL(LOGO.path, request.url).href} width={LOGO.size} height={LOGO.size} alt="" />
    </div>,
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400, s-maxage=604800" } },
  );
}
