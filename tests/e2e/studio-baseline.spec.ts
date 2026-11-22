import { expect, test, type Browser, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { customerWithOrders, measureAdmin, measureCategoryDialog, measureChartAxis, measureLogin, measureProductBanner, measureProductsToolbar, paletteLabels, saveBaseline } from "./support/studio-measure";
import { sessionFor, type Who } from "./support/studio-session";

/**
 * BASELINE capture. Run ONLY against the original application (origin/main), with EVIDENCE_LABEL=before:
 *   EVIDENCE_LABEL=before E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/studio-baseline.spec.ts
 *
 * It records what the unchanged app actually renders (heights, error colours, border and fill, chart axis, palette
 * contents) into evidence-report/baseline-measurements.json and saves "before-*" screenshots. The "after" specs compare
 * against these measured values. Nothing here writes data: every interaction stops at client-side validation.
 */
test.skip(LABEL !== "before", "Baseline spec: run with EVIDENCE_LABEL=before against origin/main only.");
test.use({ viewport: { width: 1280, height: 800 }, timezoneId: "America/Los_Angeles" });
test.describe.configure({ timeout: 240_000 }); // a dev server compiles each route on first visit

async function asUser<T>(browser: Browser, who: Who, scheme: "light" | "dark", fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ storageState: await sessionFor(browser, who), viewport: { width: 1280, height: 800 }, colorScheme: scheme, timezoneId: "America/Los_Angeles" });
  try {
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** Refuses to label a capture "before" if the page is actually the new build. */
const assertIsOriginal = async (page: Page) => expect(await page.locator("[data-area]").count(), "this server must be origin/main (no scope wrapper)").toBe(0);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`baseline ${scheme}`, () => {
    test(`merchant: products toolbar, category dialog, product banner (${scheme})`, async ({ browser }, info) => {
      await asUser(browser, "owner", scheme, async (page) => {
        if (scheme === "light") {
          const toolbar = await measureProductsToolbar(page);
          await assertIsOriginal(page);
          saveBaseline("light.productsToolbar", toolbar);
          await capture(page, info, { ac: ["F4-1", "F4-2", "F4-3", "F4-4", "F4-6"], folder: "F4-control-heights", name: "merchant-list-toolbar", note: "ORIGINAL app: Products toolbar. Search trigger and status select are 36px, search input 32px." });
        }
        const dialog = await measureCategoryDialog(page);
        saveBaseline(`${scheme}.categoryDialog`, dialog);
        await capture(page, info, { ac: ["F2-1", "F2-4", "F4-2", "F4-5"], folder: "F2-error-contrast", name: `${scheme}-mode-error`, note: `ORIGINAL app (${scheme}): Add category dialog with validation errors.` });
        saveBaseline(`${scheme}.productBanner`, await measureProductBanner(page));
        await capture(page, info, { ac: ["F2-3"], folder: "F2-error-contrast", name: `${scheme}-error-banner`, note: `ORIGINAL app (${scheme}): product form error banner (border and fill).` });
      });
    });

    test(`admin and login (${scheme})`, async ({ browser }, info) => {
      await asUser(browser, "platform", scheme, async (page) => {
        saveBaseline(`${scheme}.admin`, await measureAdmin(page));
        await capture(page, info, { ac: ["F2-5", "F4-7"], folder: "admin-login-regression", name: `admin-${scheme}`, note: `ORIGINAL app (${scheme}): Platform Admin create-organization form with validation errors.` });
      });
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
      try {
        const page = await context.newPage();
        saveBaseline(`${scheme}.login`, await measureLogin(page));
        await capture(page, info, { ac: ["F2-5", "F4-7"], folder: "admin-login-regression", name: `login-${scheme}`, note: `ORIGINAL app (${scheme}): login screen with validation errors.` });
      } finally {
        await context.close();
      }
    });
  });
}

test("baseline: command palette contents (owner and staff)", async ({ browser }, info) => {
  await asUser(browser, "owner", "light", async (page) => {
    const labels = await paletteLabels(page);
    saveBaseline("palette.owner", labels);
    await capture(page, info, { ac: ["F1-1"], folder: "F1-command-palette", name: "owner-palette", note: "ORIGINAL app: owner's command palette (no Team members entry)." });
  });
  await asUser(browser, "staff", "light", async (page) => saveBaseline("palette.staff", await paletteLabels(page)));
});

test("baseline: analytics chart axis ticks", async ({ browser }, info) => {
  await asUser(browser, "owner", "light", async (page) => {
    const axis = await measureChartAxis(page);
    expect(axis.ticks.length).toBeGreaterThan(2);
    saveBaseline("chartAxis", axis);
    await capture(page, info, { ac: ["F12-8"], folder: "F12-timezone", name: "analytics-chart-axis", note: "ORIGINAL app: Analytics chart with its x-axis ticks.", target: page.locator(".recharts-wrapper").first() });
  });
});

test("baseline: the six date surfaces as the original app renders them (server TZ=UTC, browser America/Los_Angeles)", async ({ browser }, info) => {
  await asUser(browser, "owner", "light", async (page) => {
    const shots: [string, string, string][] = [
      ["customers-list", "/dashboard/customers", "tbody tr"],
      ["inventory-adjustments", "/dashboard/inventory", "section[aria-labelledby=history]"],
      ["overview-orders", "/dashboard", "li:has-text('#')"],
      ["analytics-orders", "/dashboard/analytics", "li:has-text('#')"],
      ["products-updated", "/dashboard/products", "tbody tr"],
    ];
    for (const [name, url, anchor] of shots) {
      await page.goto(url);
      const el = page.locator(anchor).first();
      await el.waitFor();
      await el.scrollIntoViewIfNeeded();
      await capture(page, info, { ac: ["F12-1"], folder: "F12-timezone", name, fullPage: true, note: `ORIGINAL app: ${name} with dates formatted in server/browser time.` });
    }
    const customer = await customerWithOrders(page);
    await page.goto(`/dashboard/customers/${customer.id}`);
    await page.getByText("Customer since").waitFor();
    await capture(page, info, { ac: ["F12-1"], folder: "F12-timezone", name: "customer-detail", fullPage: true, note: "ORIGINAL app: customer detail dates." });
    record(info, ["F12-1"], "baseline date screenshots captured", { serverTZ: process.env.E2E_SERVER_TZ ?? "unspecified" });
  });
});
