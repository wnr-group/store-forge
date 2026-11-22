import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { CONFIG, ensureDirectories } from "./config";
import { SCENARIOS } from "./scenarios";
import { validateAllVideos, type VideoMetadata } from "./validate";

async function main() {
  console.log("===================================================================");
  console.log("   STORE FORGE STUDIO — LOCALHOST E2E DEMONSTRATION RECORDER");
  console.log("===================================================================\n");

  ensureDirectories();

  // Parse arguments
  const args = process.argv.slice(2);
  let scenarioFilter: string | null = null;
  const scenarioIndex = args.indexOf("--scenario");
  if (scenarioIndex !== -1 && args[scenarioIndex + 1]) {
    scenarioFilter = args[scenarioIndex + 1].trim();
  }

  // Determine scenarios to execute
  const scenarioKeys = Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[];
  const targetKeys = scenarioFilter
    ? scenarioKeys.filter((k) => k === scenarioFilter || k.startsWith(scenarioFilter))
    : scenarioKeys;

  if (targetKeys.length === 0) {
    console.error(`Error: Unknown scenario "${scenarioFilter}". Available scenarios: ${scenarioKeys.join(", ")}`);
    process.exit(1);
  }

  console.log(`Target scenarios to record: ${targetKeys.join(", ")}\n`);

  const browser = await chromium.launch({ headless: true });
  const results: VideoMetadata[] = [];

  try {
    for (const key of targetKeys) {
      const runner = SCENARIOS[key];
      const meta = await runner(browser);
      results.push(meta);
    }

    // If all 6 scenarios were recorded, generate canonical concatenated video
    if (targetKeys.length === scenarioKeys.length) {
      console.log("\nGenerating canonical full-journey demonstration video...");
      const concatListPath = join(CONFIG.videosDir, "concat-list.txt");
      const videoFiles = [
        "01-studio-overview.mp4",
        "02-editor-and-component-palette.mp4",
        "03-page-editing-and-autosave.mp4",
        "04-display-rules-and-readiness.mp4",
        "09-public-storefront.mp4",
        "10-permissions-and-security.mp4",
      ];

      const lines = videoFiles
        .filter((f) => existsSync(join(CONFIG.videosDir, f)))
        .map((f) => `file '${f}'`)
        .join("\n");

      writeFileSync(concatListPath, lines);

      const canonicalOut = join(CONFIG.videosDir, "storeforge-studio-canonical-e2e-demo.mp4");
      execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy -an "${canonicalOut}"`, { stdio: "pipe" });
      console.log(`Canonical video generated at: ${canonicalOut}`);
    }

    // Validate deliverables
    const validation = validateAllVideos();
    const metaOutputPath = join(CONFIG.reportsDir, "recorded-videos-meta.json");
    writeFileSync(metaOutputPath, JSON.stringify(validation.records, null, 2));
    console.log(`Updated video metadata index at: ${metaOutputPath}`);

    if (!validation.allValid) {
      console.error("\nWarning: One or more recorded videos failed validation.");
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal recording error:", err);
  process.exit(1);
});
