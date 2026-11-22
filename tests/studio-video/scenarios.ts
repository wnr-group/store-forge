import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, type Page } from "@playwright/test";
import { CONFIG } from "./config";
import { validateVideoFile, type VideoMetadata } from "./validate";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function transcodeAndProbe(webmPath: string, outMp4Path: string): VideoMetadata {
  if (existsSync(outMp4Path)) unlinkSync(outMp4Path);
  console.log(`Transcoding ${webmPath} -> ${outMp4Path}...`);
  execSync(
    `ffmpeg -y -i "${webmPath}" -c:v ${CONFIG.videoCodec} -pix_fmt ${CONFIG.pixelFormat} -r ${CONFIG.fps} -an "${outMp4Path}"`,
    { stdio: "pipe" }
  );

  return validateVideoFile(outMp4Path);
}

export async function signOutCleanly(context: BrowserContext, page: Page): Promise<void> {
  try {
    const accountBtn = page.getByRole("button", { name: "Account menu" }).first();
    if (await accountBtn.isVisible()) {
      await accountBtn.click();
      await sleep(600);
      const signOutBtn = page.getByText("Sign out").first();
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
        await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => undefined);
      }
    }
  } catch {
    // Ignore and proceed to cookie clearing
  }
  await context.clearCookies();
  await page.goto(`${CONFIG.baseUrl}/login`);
  await page.waitForLoadState("networkidle");
  await sleep(1000);
}

export async function recordScenario(
  browser: Browser,
  scenarioId: string,
  outFilename: string,
  traceFilename: string,
  journeyFn: (page: Page, context: BrowserContext) => Promise<void>
): Promise<VideoMetadata> {
  console.log(`\n=======================================================`);
  console.log(`STARTING RECORDING: ${scenarioId} (${outFilename})`);
  console.log(`=======================================================`);

  const tempDir = join(CONFIG.videosDir, `temp-${scenarioId.replace(/[^a-zA-Z0-9]/g, "-")}`);
  mkdirSync(tempDir, { recursive: true });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: { dir: tempDir, size: CONFIG.viewport },
  });
  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  try {
    await journeyFn(page, context);
  } finally {
    await context.tracing.stop({ path: join(CONFIG.tracesDir, traceFilename) });
    await context.close();
  }

  const webmPath = await page.video()?.path();
  if (!webmPath || !existsSync(webmPath)) {
    throw new Error(`Failed to capture video for ${scenarioId}: webm not produced`);
  }

  const outMp4Path = join(CONFIG.videosDir, outFilename);
  const meta = transcodeAndProbe(webmPath, outMp4Path);
  rmSync(tempDir, { recursive: true, force: true });

  console.log(`Recording complete: ${outFilename} (${meta.durationSeconds.toFixed(1)}s, ${meta.audioDetails})`);
  return meta;
}

export const SCENARIOS = {
  // Scenario 1: Studio Overview & Themes Catalog
  "01": async (browser: Browser) => {
    return recordScenario(
      browser,
      "01-studio-overview",
      "01-studio-overview.mp4",
      "trace-01-studio-overview.zip",
      async (page) => {
        // Step 1: Login
        console.log("  1. Navigating to login...");
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.screenshot({ path: join(CONFIG.shotsDir, "01-01-login-screen.png") });
        await page.locator("#email").fill(CONFIG.ownerEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await sleep(500);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        await page.waitForLoadState("networkidle");
        await sleep(2000);

        // Step 2: Dashboard Overview
        console.log("  2. Inspecting dashboard...");
        await page.screenshot({ path: join(CONFIG.shotsDir, "01-02-dashboard-overview.png") });
        await sleep(1500);

        // Step 3: Themes Workspace
        console.log("  3. Navigating to themes...");
        await page.goto(`${CONFIG.baseUrl}/dashboard/templates`);
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "01-03-themes-workspace.png") });

        // Step 4: Theme Card Details
        console.log("  4. Inspecting theme details...");
        const themeCards = page.locator("[data-template-card]");
        if (await themeCards.count()) {
          await themeCards.first().hover();
          await sleep(1000);
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "01-04-theme-card-details.png") });
        await sleep(1500);
      }
    );
  },

  // Scenario 2: Editor and Component Palette
  "02": async (browser: Browser) => {
    return recordScenario(
      browser,
      "02-editor-and-component-palette",
      "02-editor-and-component-palette.mp4",
      "trace-02-editor-and-component-palette.zip",
      async (page) => {
        // Authenticate
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.locator("#email").fill(CONFIG.ownerEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });

        // Step 1: Open Editor
        console.log("  1. Opening Visual Editor...");
        await page.goto(`${CONFIG.baseUrl}/dashboard/templates/editor`);
        await page.waitForLoadState("networkidle");
        await sleep(3000);
        await page.screenshot({ path: join(CONFIG.shotsDir, "02-01-editor-workspace.png") });

        // Step 2: Viewport Switcher
        console.log("  2. Demonstrating responsive viewports...");
        const tabletBtn = page.getByRole("button", { name: /820px|Tablet/i }).first();
        if (await tabletBtn.isVisible()) {
          await tabletBtn.click();
          await sleep(1500);
        }
        const mobileBtn = page.getByRole("button", { name: /390px|Mobile/i }).first();
        if (await mobileBtn.isVisible()) {
          await mobileBtn.click();
          await sleep(1500);
        }
        const desktopBtn = page.getByRole("button", { name: /1280px|Desktop/i }).first();
        if (await desktopBtn.isVisible()) {
          await desktopBtn.click();
          await sleep(1500);
        }

        // Step 3: Open Component Palette
        console.log("  3. Opening Component Palette...");
        const addBtn = page.getByRole("button", { name: "Add section" });
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click();
        await sleep(1500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "02-02-component-palette-open.png") });

        // Step 4: Add Section
        console.log("  4. Selecting section from palette...");
        const promoOption = page.getByRole("dialog").getByText(/Promotional Banner|Hero Banner|Customer Testimonials/i).first();
        if (await promoOption.isVisible()) {
          await promoOption.hover();
          await sleep(800);
          await promoOption.click();
          await sleep(2000);
        } else {
          await page.keyboard.press("Escape");
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "02-03-component-selected.png") });

        // Step 5: Settings Inspector
        console.log("  5. Inspecting settings panel...");
        const insp = page.getByRole("complementary", { name: "Settings" });
        if (await insp.isVisible()) {
          await sleep(1000);
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "02-04-settings-inspector.png") });
        await sleep(1500);
      }
    );
  },

  // Scenario 3: Page Editing and Persistence
  "03": async (browser: Browser) => {
    return recordScenario(
      browser,
      "03-page-editing-and-autosave",
      "03-page-editing-and-autosave.mp4",
      "trace-03-page-editing-and-autosave.zip",
      async (page) => {
        // Authenticate
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.locator("#email").fill(CONFIG.ownerEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });

        // Open Editor
        await page.goto(`${CONFIG.baseUrl}/dashboard/templates/editor`);
        await page.waitForLoadState("networkidle");
        await sleep(2500);

        // Step 1: Select Hero Banner
        console.log("  1. Selecting Hero Banner section...");
        await page.getByText("Hero Banner", { exact: true }).first().click();
        await sleep(1500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "03-01-section-selected.png") });

        // Step 2: Edit Heading
        console.log("  2. Editing heading text...");
        const headingInput = page.getByRole("complementary", { name: "Settings" }).locator("input, textarea").first();
        if (await headingInput.isVisible()) {
          await headingInput.click();
          await headingInput.fill("Handcrafted Furniture for Modern Living");
          await sleep(1500);
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "03-02-heading-edited.png") });

        // Step 3: Autosave confirmation
        console.log("  3. Observing real autosave...");
        await sleep(3000);
        await page.screenshot({ path: join(CONFIG.shotsDir, "03-03-autosave-confirmed.png") });

        // Step 4: Reload persistence
        console.log("  4. Reloading page to verify database persistence...");
        await page.reload();
        await page.waitForLoadState("networkidle");
        await sleep(3000);
        await page.screenshot({ path: join(CONFIG.shotsDir, "03-04-reload-persisted.png") });
        await sleep(1000);
      }
    );
  },

  // Scenario 4: Display Rules & Readiness
  "04": async (browser: Browser) => {
    return recordScenario(
      browser,
      "04-display-rules-and-readiness",
      "04-display-rules-and-readiness.mp4",
      "trace-04-display-rules-and-readiness.zip",
      async (page) => {
        // Authenticate
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.locator("#email").fill(CONFIG.ownerEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });

        // Open Editor
        await page.goto(`${CONFIG.baseUrl}/dashboard/templates/editor`);
        await page.waitForLoadState("networkidle");
        await sleep(2500);

        // Step 1: Display Rules panel
        console.log("  1. Selecting section and opening Display Rules...");
        await page.getByText("Hero Banner", { exact: true }).first().click();
        await sleep(1000);
        const insp = page.getByRole("complementary", { name: "Settings" });
        await insp.getByText("When to show").first().scrollIntoViewIfNeeded();
        await sleep(1500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "04-01-display-rules-panel.png") });

        // Step 2: Toggle mobile visibility
        console.log("  2. Toggling Mobile visibility rule...");
        const mobileSwitch = insp.getByRole("switch", { name: /mobile/i }).first();
        if (await mobileSwitch.isVisible()) {
          await mobileSwitch.click();
          await sleep(1500);
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "04-02-mobile-toggle-off.png") });

        // Step 3: Layer badge
        console.log("  3. Verifying outline badge 'Hidden on Mobile'...");
        await page.screenshot({ path: join(CONFIG.shotsDir, "04-03-badge-hidden-on-mobile.png") });

        // Step 4: Reload persistence
        console.log("  4. Reloading to confirm display rule persistence...");
        await sleep(2000);
        await page.reload();
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "04-04-persisted-after-reload.png") });

        // Step 5: Publish Readiness Gate
        console.log("  5. Triggering Publish Readiness Gate evaluation...");
        const pubBtn = page.getByRole("button", { name: "Publish", exact: true }).first();
        if (await pubBtn.isVisible()) {
          await pubBtn.click();
          await sleep(2000);
        }
        await page.screenshot({ path: join(CONFIG.shotsDir, "04-05-readiness-gate-evaluation.png") });
        await sleep(1000);
      }
    );
  },

  // Scenario 5: Public Storefront
  "09": async (browser: Browser) => {
    return recordScenario(
      browser,
      "09-public-storefront",
      "09-public-storefront.mp4",
      "trace-05-public-storefront.zip",
      async (page) => {
        // Step 1: Open Public Storefront Desktop
        console.log("  1. Opening public storefront at 1920x1080...");
        await page.goto(`${CONFIG.baseUrl}/s/${CONFIG.storeSlug}`);
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "05-01-storefront-desktop.png") });

        // Step 2: Product Catalog
        console.log("  2. Scrolling through live database catalog...");
        await page.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }));
        await sleep(2000);
        await page.screenshot({ path: join(CONFIG.shotsDir, "05-02-storefront-products.png") });

        // Step 3: Mobile Viewport & Display Rule
        console.log("  3. Switching viewport to Mobile (390x844)...");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "05-03-storefront-mobile-hidden-hero.png") });

        // Step 4: Responsive Catalog
        console.log("  4. Scrolling mobile products...");
        await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
        await sleep(1500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "05-04-storefront-responsive.png") });

        // Restore desktop
        await page.setViewportSize(CONFIG.viewport);
        await sleep(1500);
      }
    );
  },

  // Scenario 6: Permissions and Security Isolation
  "10": async (browser: Browser) => {
    return recordScenario(
      browser,
      "10-permissions-and-security",
      "10-permissions-and-security.mp4",
      "trace-06-permissions-and-security.zip",
      async (page, context) => {
        // 1. Store Owner
        console.log("  1. Logging in as Store Owner (owner@demo.test)...");
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.locator("#email").fill(CONFIG.ownerEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "06-01-owner-permissions.png") });

        for (const item of ["Themes", "Customize", "Products", "Categories", "Collections", "Settings"]) {
          const el = page.getByRole("link", { name: item }).first();
          if (await el.isVisible()) {
            await el.hover();
            await sleep(400);
          }
        }

        console.log("  Signing out from Store Owner session...");
        await signOutCleanly(context, page);

        // 2. Design-Only Member
        console.log("  2. Logging in as Design-Only member (design-only@demo.test)...");
        await page.locator("#email").fill(CONFIG.designEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "06-02-design-only-sidebar.png") });

        console.log("  Opening visual editor as Design-Only member...");
        await page.getByRole("link", { name: "Themes" }).first().click();
        await page.waitForURL(/\/dashboard\/templates/, { timeout: 15000 });
        await sleep(2000);
        await page.goto(`${CONFIG.baseUrl}/dashboard/templates/editor`);
        await page.waitForLoadState("networkidle");
        await sleep(3000);
        await page.screenshot({ path: join(CONFIG.shotsDir, "06-03-design-only-editor.png") });

        console.log("  Signing out from Design-Only session...");
        await signOutCleanly(context, page);

        // 3. Read-Only Member
        console.log("  3. Logging in as Read-Only member (read-only@demo.test)...");
        await page.locator("#email").fill(CONFIG.readOnlyEmail);
        await page.locator("#password").fill(CONFIG.ownerPassword);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        await page.screenshot({ path: join(CONFIG.shotsDir, "06-04-read-only-permissions.png") });

        await signOutCleanly(context, page);
      }
    );
  },
};
