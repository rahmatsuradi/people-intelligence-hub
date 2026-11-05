import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sama dengan paths "@/*" di tsconfig — dibutuhkan tes yang memuat route API (mis. survei-load.test.ts).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/lib/payroll/**/*.test.ts", "src/lib/assessment/**/*.test.ts", "src/lib/recruiting/**/*.test.ts", "src/lib/rr/**/*.test.ts", "src/lib/*.test.ts"],
  },
});
