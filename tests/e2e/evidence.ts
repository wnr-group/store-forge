import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

const DIR = join(process.cwd(), "artifacts", "qa", "store-forge-ticket", "screenshots");

/** Saves a real full-page browser screenshot and fails the test if the file is missing or empty-looking. */
export async function evidence(page: Page, file: string, fullPage = true): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  const path = join(DIR, file);
  await page.screenshot({ path, fullPage });
  if (!existsSync(path) || statSync(path).size < 5_000) throw new Error(`Evidence ${file} is missing or too small`);
  return path;
}
