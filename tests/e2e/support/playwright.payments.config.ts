import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

/**
 * Payments journey config (pattern of the other dedicated configs): only payments.spec.ts, one worker, no retries, and NO
 * traces or videos (they would persist what is typed into the Key Secret field). Reports go to the evidence folder.
 * The web server is the intended, already running one (E2E_BASE_URL); this config never starts one.
 * Paths are absolute: Playwright resolves relative ones against THIS file's folder.
 */
const root = resolve(__dirname, "..", "..", "..");
const evidence = resolve(root, process.env.QA_EVIDENCE_DIR ?? "artifacts/qa-evidence/razorpay-configuration");
const pass = process.env.E2E_PAYMENTS_PASS ?? "main";

export default defineConfig({
  ...base,
  testDir: resolve(root, "tests/e2e"),
  testMatch: /payments\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  webServer: undefined,
  outputDir: resolve(evidence, `test-results/pw-output-${pass}`),
  reporter: [
    ["list"],
    ["json", { outputFile: resolve(evidence, `playwright-report/payments-${pass}.json`) }],
    ["html", { outputFolder: resolve(evidence, `playwright-report/html-${pass}`), open: "never" }],
  ],
  use: { ...base.use, trace: "off", video: "off", screenshot: "off" },
});
