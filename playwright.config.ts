import { defineConfig } from "@playwright/test";

// Load .env.local when present. Variables already set in the shell are NOT overridden,
// which is how the E2E run is pointed at a local/dev Supabase instead of whatever .env.local names.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Not present (CI injecting real env vars) - fine.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  // One worker, serial: the tests share one store's settings.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "artifacts/qa/playwright-report", open: "never" }]],
  use: { baseURL, viewport: { width: 1280, height: 800 }, trace: "retain-on-failure" },
  // Reuses a server that is already running at E2E_BASE_URL (started by the tester with the intended environment).
  webServer: { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
