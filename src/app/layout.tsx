import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Lobster, Cormorant_Garamond } from "next/font/google";
import { INSTANCE } from "@/lib/instance";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Huruf sambung untuk wordmark "Rica Rico" — paling dekat dengan tulisan di logo.
// Hanya dipakai untuk merk; teks kerja tetap Plus Jakarta Sans agar mudah dibaca.
const lobster = Lobster({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

// Serif untuk wordmark LENCIR. Kontras tebal-tipisnya mendekati wordmark asli yang
// bergaya Didone. Next membutuhkan pemanggilan font di tingkat modul, jadi kedua font
// merek dideklarasikan; hanya yang milik instance aktif yang dipasang di <html> di bawah.
const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Judul, deskripsi, dan ikon tab mengikuti instance (src/lib/instance.ts).
// Tanpa iconPath, ikon bawaan aplikasi (src/app/favicon.ico) yang dipakai.
export const metadata: Metadata = {
  title: INSTANCE.appTitle,
  description: INSTANCE.description,
  ...(INSTANCE.iconPath ? { icons: { icon: INSTANCE.iconPath, apple: INSTANCE.iconPath } } : {}),
};

const brandFontVariable = INSTANCE.key === "lencir" ? cormorant.variable : lobster.variable;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-instance={INSTANCE.key}
      className={`${plusJakarta.variable} ${brandFontVariable} ${jetbrainsMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">{children}</body>
    </html>
  );
}
