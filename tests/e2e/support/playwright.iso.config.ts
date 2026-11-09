import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "../../../playwright.config";

/**
 * Same as the repo config, for the ISOLATED local Supabase stack only: trusts the throwaway self-signed certificate of the local TLS proxy
 * and writes reports/traces to the folder named by E2E_REPORT_DIR instead of artifacts/qa (existing V1 evidence is never overwritten).
 */
// Absolute: relative paths would resolve against THIS file's folder, not the repo root.
const out = resolve(process.cwd(), process.env.E2E_REPORT_DIR ?? "artifacts/template-engine-qa/logs/e2e-iso");
export default defineConfig({
  ...base,
  testDir: "..",
  outputDir: `${out}/test-results`,
  reporter: [["list"], ["json", { outputFile: `${out}/report.json` }], ["html", { outputFolder: `${out}/html`, open: "never" }]],
  use: { ...base.use, ignoreHTTPSErrors: true },
});
