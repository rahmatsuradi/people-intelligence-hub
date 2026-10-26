import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dua pemasangan (rica-rico, lencir) bisa dijalankan berdampingan di satu komputer —
  // `next dev` mengunci folder build-nya, jadi tiap instance butuh folder sendiri.
  // Tanpa variabel ini tidak ada yang berubah (.next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
