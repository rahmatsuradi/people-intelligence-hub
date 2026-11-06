/* ═══════════════════════════════════════════════════════════════════════════
   /brand-og — gambar pratinjau saat link dibagikan di WhatsApp.

   WhatsApp hanya menampilkan gambar raster, sedangkan logo Lencir di aplikasi berupa SVG;
   jadi lambangnya digambar ulang di sini sebagai PNG. Ini tiruan lambang di aplikasi, bukan
   berkas logo resmi — bila berkas resminya tersedia, cukup ganti isi gambar ini.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { INSTANCE } from "@/lib/instance";

const SIZE = { width: 1200, height: 630 };

/** Font wordmark Lencir. Gagal diambil = tetap jalan dengan font bawaan. */
async function serifFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&text=LENCIR")).text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const headers = { "cache-control": "public, max-age=86400, s-maxage=604800" };
  if (INSTANCE.key !== "lencir") {
    const logo = new URL(INSTANCE.iconPath ?? "/brand/rica-rico-logo.jpg", request.url).href;
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dirender ke PNG oleh ImageResponse, bukan ke halaman */}
        <img src={logo} width={420} height={420} alt="" />
      </div>,
      { ...SIZE, headers },
    );
  }
  const font = await serifFont();
  const serif = font ? "Cormorant" : "serif";
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#faf8f6", gap: 44 }}>
      <div style={{ display: "flex", width: 230, height: 230, borderRadius: 58, background: "#17130f", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: 150, fontFamily: serif, lineHeight: 1 }}>L</div>
      <div style={{ display: "flex", fontSize: 76, letterSpacing: 22, color: "#17130f", fontFamily: serif, lineHeight: 1 }}>LENCIR</div>
    </div>,
    { ...SIZE, headers, fonts: font ? [{ name: "Cormorant", data: font, weight: 500, style: "normal" }] : undefined },
  );
}
