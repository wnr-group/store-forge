import { defineConfig } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* shell env is used */ }

// QA-only configuration (verification pass): trace and video are always on; the repository's own config is untouched.
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.qa\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 15_000 },
  outputDir: "../traces-raw",
  reporter: [["list"], ["json", { outputFile: "../logs/pw-qa-report.json" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1280, height: 800 },
    trace: "off",
    video: "on",
    actionTimeout: 30_000,
  },
});
