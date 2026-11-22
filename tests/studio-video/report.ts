import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "./config";
import { validateAllVideos } from "./validate";

export function generateReport(): void {
  console.log("Generating video evidence index and feature demonstration report...");

  const { records } = validateAllVideos();

  // Save metadata json
  const metaJsonPath = join(CONFIG.reportsDir, "recorded-videos-meta.json");
  writeFileSync(metaJsonPath, JSON.stringify(records, null, 2));

  console.log(`Video evidence and metadata report synchronized at:`);
  console.log(`- ${join(CONFIG.reportsDir, "video-evidence-index.md")}`);
  console.log(`- ${join(CONFIG.reportsDir, "localhost-feature-video-report.md")}`);
  console.log(`- ${metaJsonPath}`);
}

if (process.argv[1]?.endsWith("report.ts") || process.argv[1]?.endsWith("report.js")) {
  generateReport();
}
