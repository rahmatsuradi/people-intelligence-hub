import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Lobster } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Rica Rico Bakery — People Intelligence",
  description: "Platform HR terpadu Rica Rico Bakery: rekrutmen, payroll & kepatuhan statutori, performance, dan asesmen.",
  icons: { icon: "/brand/rica-rico-logo.jpg", apple: "/brand/rica-rico-logo.jpg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${lobster.variable} ${jetbrainsMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">{children}</body>
    </html>
  );
}
