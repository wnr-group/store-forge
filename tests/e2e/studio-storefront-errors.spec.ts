import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

/**
 * Run against a Next server whose API_BASE_URL points at the fault proxy (scripts/qa/storefront-fault-proxy.mjs on :4100).
 * The proxy only touches /public/storefronts/fault-* so every run starts with a cold Next fetch cache.
 */
const PROXY = process.env.FAULT_PROXY_URL ?? "http://127.0.0.1:4100";
// Variants verified to throw while rendering by tests/unit/storefront-bad-document.test.ts
const INVALID_DOCUMENT = "bad-order";
const THROWING_SECTION = "null-section";
const setMode = (page: Page, mode: string) => page.request.get(`${PROXY}/__fault/mode?mode=${mode}`);
const requests = async (page: Page) => ((await (await page.request.get(`${PROXY}/__fault/stats`)).json()) as { storefrontRequests: number }).storefrontRequests;
const fresh = () => `fault-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function expectShopperErrorState(page: Page) {
  await expect(page.getByRole("heading", { name: "This store is temporarily unavailable" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/dashboard|workspace|SECRET|hunter2|digest|stack|TypeError|at \w+ \(/i);
  expect(await page.locator('a[href*="dashboard"]').count()).toBe(0);
}

test("API unavailable: shopper state, no internals, same URL, Retry re-fetches from the server and recovers", async ({ page }) => {
  const slug = fresh();
  await setMode(page, "http500");
  await page.goto(`/s/${slug}`);
  await expectShopperErrorState(page);
  expect(page.url()).toContain(`/s/${slug}`);
  await shot(page, "AC-ERR-1_api-down");

  const before = await requests(page);
  await setMode(page, "pass");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "This store is temporarily unavailable" })).toHaveCount(0, { timeout: 30_000 });
  expect(await requests(page)).toBeGreaterThan(before);
  expect(page.url()).toContain(`/s/${slug}`);
  await shot(page, "AC-ERR-1_recovered", { fullPage: true });
});

test("Retry while the API is still down stays on the shopper state and asks the server again", async ({ page }) => {
  const slug = fresh();
  await setMode(page, "http500");
  await page.goto(`/s/${slug}`);
  await expectShopperErrorState(page);
  const before = await requests(page);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => requests(page), { timeout: 30_000 }).toBeGreaterThan(before);
  await expectShopperErrorState(page);
  await setMode(page, "pass");
});

// Characterization of existing behaviour (services/storefront.service.ts getPublishedDesign): a home-page design that cannot be
// used is treated as "no published design" and the built-in template renders. It is safe (no internals) but it is NOT the neutral
// error state; recorded as finding D-001 in the defect register.
test("invalid published document is handled safely: no technical detail, no crash page", async ({ page }) => {
  const slug = fresh();
  await setMode(page, INVALID_DOCUMENT);
  const res = await page.goto(`/s/${slug}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/SECRET|hunter2|digest|stack|TypeError|Something went wrong/i);
  expect(await page.locator('a[href*="dashboard"]').count()).toBe(0);
  await shot(page, "AC-ERR-2_invalid-document");
  await setMode(page, "pass");
});

test("a section that throws while rendering is caught by the boundary", async ({ page }) => {
  const slug = fresh();
  await setMode(page, THROWING_SECTION);
  await page.goto(`/s/${slug}`);
  await expectShopperErrorState(page);
  await shot(page, "AC-ERR-2_section-throws");
  await setMode(page, "pass");
});
