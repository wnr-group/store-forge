import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { CONFIG, ensureDirectories } from "./config";

interface CheckResult {
  name: string;
  target: string;
  passed: boolean;
  details: string;
}

async function checkUrl(url: string, timeoutMs = 4000): Promise<{ ok: boolean; status?: number; data?: unknown }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    let data = null;
    try {
      data = await res.json();
    } catch {
      // Not JSON, text is fine
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, details: msg } as { ok: boolean; details: string };
  }
}

async function runPreflight(): Promise<boolean> {
  console.log("===================================================================");
  console.log("   STORE FORGE STUDIO — LOCALHOST E2E PREFLIGHT VERIFICATION");
  console.log("===================================================================\n");

  const results: CheckResult[] = [];

  // 1. Output directories check
  try {
    ensureDirectories();
    results.push({
      name: "Artifacts Directories",
      target: CONFIG.artifactsDir,
      passed: true,
      details: "videos/, screenshots/, traces/, reports/ created or verified",
    });
  } catch (err: unknown) {
    results.push({
      name: "Artifacts Directories",
      target: CONFIG.artifactsDir,
      passed: false,
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. FFmpeg availability
  try {
    const ffmpegVer = execSync("ffmpeg -version", { stdio: "pipe" }).toString().split("\n")[0];
    results.push({
      name: "FFmpeg Media Encoder",
      target: "System PATH",
      passed: true,
      details: ffmpegVer.trim(),
    });
  } catch {
    results.push({
      name: "FFmpeg Media Encoder",
      target: "System PATH",
      passed: false,
      details: "ffmpeg binary not found in PATH. Required for H.264 MP4 transcoding without audio.",
    });
  }

  // 3. FFprobe availability
  try {
    const ffprobeVer = execSync("ffprobe -version", { stdio: "pipe" }).toString().split("\n")[0];
    results.push({
      name: "FFprobe Media Inspector",
      target: "System PATH",
      passed: true,
      details: ffprobeVer.trim(),
    });
  } catch {
    results.push({
      name: "FFprobe Media Inspector",
      target: "System PATH",
      passed: false,
      details: "ffprobe binary not found in PATH. Required for audio-absence and stream verification.",
    });
  }

  // 4. Frontend service health
  let resolvedBaseUrl = CONFIG.baseUrl;
  const feCheck = await checkUrl(`${CONFIG.baseUrl}/login`);
  if (feCheck.ok) {
    results.push({
      name: "Frontend Service",
      target: `${CONFIG.baseUrl}/login`,
      passed: true,
      details: `HTTP ${feCheck.status} OK (Next.js server active)`,
    });
  } else {
    // Try fallback
    const fallbackCheck = await checkUrl(`${CONFIG.fallbackBaseUrl}/login`);
    if (fallbackCheck.ok) {
      resolvedBaseUrl = CONFIG.fallbackBaseUrl;
      results.push({
        name: "Frontend Service",
        target: `${CONFIG.fallbackBaseUrl}/login`,
        passed: true,
        details: `HTTP ${fallbackCheck.status} OK (Found on fallback port 3000)`,
      });
    } else {
      results.push({
        name: "Frontend Service",
        target: `${CONFIG.baseUrl}/login & ${CONFIG.fallbackBaseUrl}/login`,
        passed: false,
        details: "Frontend not reachable. Please start the app with 'npm run dev'.",
      });
    }
  }

  // 5. Backend API health
  const apiHealthCheck = await checkUrl(`${CONFIG.apiUrl}/health`);
  if (apiHealthCheck.ok) {
    results.push({
      name: "Backend API Service",
      target: `${CONFIG.apiUrl}/health`,
      passed: true,
      details: `HTTP 200 OK (${JSON.stringify(apiHealthCheck.data)})`,
    });
  } else {
    results.push({
      name: "Backend API Service",
      target: `${CONFIG.apiUrl}/health`,
      passed: false,
      details: "API service not reachable at " + CONFIG.apiUrl + ". Ensure NestJS API is running.",
    });
  }

  // 6. Backend API & Database readiness
  const apiReadyCheck = await checkUrl(`${CONFIG.apiUrl}/health/ready`);
  if (apiReadyCheck.ok) {
    results.push({
      name: "Database Readiness",
      target: `${CONFIG.apiUrl}/health/ready`,
      passed: true,
      details: `HTTP 200 OK (${JSON.stringify(apiReadyCheck.data)})`,
    });
  } else {
    results.push({
      name: "Database Readiness",
      target: `${CONFIG.apiUrl}/health/ready`,
      passed: false,
      details: "Database readiness check failed. Verify Supabase PostgreSQL container.",
    });
  }

  // 7. Chromium browser availability
  try {
    const browser = await chromium.launch({ headless: true });
    const version = browser.version();
    await browser.close();
    results.push({
      name: "Playwright Chromium Engine",
      target: "Chromium binary",
      passed: true,
      details: `Chromium version ${version} launched and terminated cleanly`,
    });
  } catch (err: unknown) {
    results.push({
      name: "Playwright Chromium Engine",
      target: "Chromium binary",
      passed: false,
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // 8. Authentication flow test
  if (feCheck.ok || results.some((r) => r.name === "Frontend Service" && r.passed)) {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${resolvedBaseUrl}/login`, { timeout: 15000 });
      await page.locator("#email").fill(CONFIG.ownerEmail);
      await page.locator("#password").fill(CONFIG.ownerPassword);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      await browser.close();
      results.push({
        name: "Authentication Verification",
        target: `${resolvedBaseUrl}/login -> /dashboard`,
        passed: true,
        details: `Successfully authenticated as ${CONFIG.ownerEmail}`,
      });
    } catch (err: unknown) {
      results.push({
        name: "Authentication Verification",
        target: `${resolvedBaseUrl}/login`,
        passed: false,
        details: `Login failed for ${CONFIG.ownerEmail}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Display results table
  console.log("| Check | Target | Status | Details |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    const status = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`| ${r.name} | \`${r.target}\` | **${status}** | ${r.details} |`);
  }

  const allPassed = results.every((r) => r.passed);
  console.log("\n===================================================================");
  if (allPassed) {
    console.log("  PREFLIGHT VERIFICATION COMPLETE: ALL PREREQUISITES SATISFIED");
  } else {
    console.error("  PREFLIGHT VERIFICATION FAILED: ONE OR MORE REQUIRED SERVICES DOWN");
  }
  console.log("===================================================================\n");

  return allPassed;
}

runPreflight()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal preflight exception:", err);
    process.exit(1);
  });
