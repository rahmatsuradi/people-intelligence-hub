import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/payroll/**/*.test.ts", "src/lib/assessment/**/*.test.ts", "src/lib/*.test.ts"],
  },
});
