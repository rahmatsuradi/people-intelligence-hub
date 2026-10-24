import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // These client pages intentionally hydrate state from localStorage /
      // sessionStorage / URL params inside a mount effect — doing it in a lazy
      // useState initializer would run during SSR and cause hydration
      // mismatches. Keep the rule as a warning (not an error) rather than
      // refactor every page to useSyncExternalStore.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
