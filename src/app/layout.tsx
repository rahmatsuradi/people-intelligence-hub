import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Serif untuk wordmark LENCIR dan judul bergaya merk. Kontras tebal-tipisnya
// mendekati wordmark asli yang bergaya Didone.
const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LENCIR — People Intelligence",
  description: "Platform HR terpadu Lencir Indonesia: perencanaan tenaga kerja, rekrutmen, payroll & kepatuhan statutori, performance, dan asesmen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${cormorant.variable} ${jetbrainsMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">{children}</body>
    </html>
  );
}
