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
    // Generated output (minified Playwright report bundles, traces, evidence logs), never source.
    "artifacts/**",
    "**/artifacts/**",
    "test-results/**",
    "**/test-results/**",
    "playwright-report/**",
    "**/playwright-report/**",
    ".vitest/**",
    "**/.vitest/**",
  ]),
]);

export default eslintConfig;
