import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

/** Razorpay journey / demo config: the stack is already running (E2E_BASE_URL); video is recorded by the spec itself at 1920x1080. */
const root = resolve(__dirname, "..", "..", "..");
const tag = process.env.RZP_RUN_TAG ?? "journey";
const evidence = resolve(root, process.env.QA_EVIDENCE_DIR ?? "artifacts/qa-evidence/razorpay-configuration");

export default defineConfig({
  ...base,
  testDir: resolve(root, "tests/e2e"),
  testMatch: /razorpay-(journey|short-demo)\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 300_000,
  webServer: undefined,
  outputDir: resolve(evidence, `e2e/playwright-results-${tag}`),
  reporter: [
    ["list"],
    ["junit", { outputFile: resolve(evidence, `e2e/junit-${tag}.xml`) }],
    ["json", { outputFile: resolve(evidence, `e2e/results-${tag}.json`) }],
    ["html", { outputFolder: resolve(evidence, `e2e/playwright-report-${tag}`), open: "never" }],
  ],
  use: { ...base.use, viewport: { width: 1920, height: 1080 }, actionTimeout: 20_000, trace: "off", video: "off", screenshot: "off" },
});
