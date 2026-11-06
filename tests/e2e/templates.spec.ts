import { expect, test, type Page } from "@playwright/test";
import { heroPng, oversizePng, textFile } from "./fixtures";
import { login, MANAGER, OWNER, password, publicUrl, shot, STAFF } from "./helpers";

test.describe.configure({ mode: "serial" });

const HEADING = "Spring collection";
const SUB = "Fresh looks for the new season";
const ACCENT = "#1a5aaa";

const preview = (page: Page) => page.getByRole("region", { name: "Storefront preview" });
const card = (page: Page, key: string) => page.locator(`[data-template-card="${key}"]`);
const save = (page: Page) => page.getByRole("button", { name: "Save template" });
const cancel = (page: Page) => page.getByRole("button", { name: "Cancel" });
const openTemplates = async (page: Page) => {
  await page.goto("/dashboard/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
};
const publicTemplate = async (page: Page) => {
  await page.goto(publicUrl);
  return page.locator("[data-template]").first().getAttribute("data-template");
};

test("PV-01 existing storefront renders unchanged (Classic) before any customization", async ({ page }) => {
  expect(await publicTemplate(page)).toBe("classic");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Powered by StoreForge")).toBeVisible();
  await shot(page, "PV-01-default-storefront");
});

test("PV-02 templates page lists both templates, Classic is Current", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await expect(card(page, "classic")).toContainText("Current");
  await expect(card(page, "spotlight")).toBeVisible();
  await expect(card(page, "spotlight")).not.toContainText("Current");
  await expect(save(page)).toBeDisabled();
  await expect(cancel(page)).toBeDisabled();
  await shot(page, "PV-02-templates-list");
});

test("PV-03 selecting Spotlight changes the preview but not the public storefront", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await card(page, "spotlight").click();
  await expect(card(page, "spotlight")).toContainText("Selected");
  await expect(card(page, "classic")).toContainText("Current");
  await expect(preview(page)).toHaveAttribute("data-preview-template", "spotlight");
  await expect(save(page)).toBeEnabled();
  await shot(page, "PV-03-select-preview");
  expect(await publicTemplate(page)).toBe("classic");
  await shot(page, "PV-03b-public-unchanged");
});

test("PV-04 / PV-05 / PV-06 customize, upload a hero image and save", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await card(page, "spotlight").click();
  await page.getByLabel("Accent color", { exact: true }).fill(ACCENT);
  await page.getByLabel("Hero heading").fill(HEADING);
  await page.getByLabel("Hero subheading").fill(SUB);
  await expect(preview(page)).toContainText(HEADING);
  await expect(preview(page)).toContainText(SUB);
  await shot(page, "PV-04-live-preview");

  await page.locator('input[type="file"]').setInputFiles(heroPng());
  await expect(preview(page).locator("img").first()).toBeVisible({ timeout: 30_000 });
  await expect(save(page)).toBeEnabled();
  await shot(page, "PV-05-hero-upload");

  await save(page).click();
  await expect(page.getByText("Template saved")).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(cancel(page)).toBeDisabled();
  await expect(card(page, "spotlight")).toContainText("Current");
  await shot(page, "PV-06-save-success");
});

test("PV-07 the public storefront renders Spotlight with the saved values", async ({ page }) => {
  expect(await publicTemplate(page)).toBe("spotlight");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING);
  await expect(page.getByText(SUB)).toBeVisible();
  await expect(page.locator('[data-template="spotlight"] img[alt=""]').first()).toBeVisible();
  const bar = page.locator('[data-template="spotlight"] span[aria-hidden][style*="background-color"]');
  await expect(bar).toHaveCSS("background-color", "rgb(26, 90, 170)");
  await shot(page, "PV-07-public-spotlight");
});

test("PV-08 saved settings persist after a reload", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await page.reload();
  await expect(card(page, "spotlight")).toContainText("Current");
  await expect(page.getByLabel("Hero heading")).toHaveValue(HEADING);
  await expect(page.getByLabel("Hero subheading")).toHaveValue(SUB);
  await expect(page.getByLabel("Accent color", { exact: true })).toHaveValue(ACCENT);
  await expect(preview(page).locator("img").first()).toBeVisible();
  await shot(page, "PV-08-reload-persists");
});

test("PV-09 switching to Classic keeps the saved customization", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await card(page, "classic").click();
  await expect(page.getByLabel("Hero heading")).toHaveValue(HEADING);
  await expect(preview(page)).toHaveAttribute("data-preview-template", "classic");
  await expect(preview(page)).toContainText(HEADING);
  await save(page).click();
  await expect(page.getByText("Template saved")).toBeVisible();
  expect(await publicTemplate(page)).toBe("classic");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING);
  await shot(page, "PV-09-switch-preserves");
});

test("PV-10 invalid input is rejected and nothing is saved", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await page.getByLabel("Accent color", { exact: true }).fill("red");
  await page.getByLabel("Hero heading").fill("x".repeat(81));
  await save(page).click();
  await expect(page.getByText("Use a six-digit hex color")).toBeVisible();
  await expect(page.getByText(/at most 80 characters/)).toBeVisible();
  await expect(page.getByText("Template saved")).toHaveCount(0);
  await shot(page, "PV-10-invalid-input");
  await cancel(page).click();
});

test("PV-11 a wrong file type and an oversized file are rejected", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(textFile());
  await expect(page.getByText(/JPG|JPEG|PNG|WebP|allowed|type/i).first()).toBeVisible();
  await input.setInputFiles(oversizePng());
  await expect(page.getByText(/5 MB|too large|size/i).first()).toBeVisible();
  await shot(page, "PV-11-image-rejected");
});

test("PV-12 Cancel restores the saved state", async ({ page }) => {
  await login(page, OWNER);
  await openTemplates(page);
  await card(page, "spotlight").click();
  await page.getByLabel("Hero heading").fill("Unsaved edit");
  await expect(preview(page)).toContainText("Unsaved edit");
  await cancel(page).click();
  await expect(page.getByLabel("Hero heading")).toHaveValue(HEADING);
  await expect(card(page, "classic")).toContainText("Current");
  await expect(preview(page)).toHaveAttribute("data-preview-template", "classic");
  await expect(save(page)).toBeDisabled();
  await shot(page, "PV-12-cancel-restores");
});

test("PV-13 Staff is read-only but can preview", async ({ page }) => {
  await login(page, STAFF);
  await openTemplates(page);
  await expect(page.getByText("Only owners and managers can change the template")).toBeVisible();
  await expect(page.getByLabel("Hero heading")).toBeDisabled();
  await expect(save(page)).toHaveCount(0);
  await card(page, "spotlight").click();
  await expect(preview(page)).toHaveAttribute("data-preview-template", "spotlight");
  await shot(page, "PV-13-staff-readonly");
  await page.reload();
  await expect(card(page, "classic")).toContainText("Current"); // the preview choice was never persisted
});

test("PV-14 unauthenticated users are redirected, and Staff cannot write the table directly", async ({ page, request }) => {
  await page.goto("/dashboard/templates");
  await expect(page).toHaveURL(/\/login/);
  await shot(page, "PV-14-unauthenticated-redirect");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(!url || !anon, "Supabase URL/anon key not available: direct-API check NOT VERIFIED");
  const tok = await request.post(`${url}/auth/v1/token?grant_type=password`, { headers: { apikey: anon! }, data: { email: STAFF, password: password() } });
  expect(tok.ok()).toBe(true);
  const { access_token } = (await tok.json()) as { access_token: string };
  const headers = { apikey: anon!, Authorization: `Bearer ${access_token}`, "Content-Type": "application/json", Prefer: "return=representation" };

  const before = await (await request.get(`${url}/rest/v1/store_template_settings?select=template_key,hero_heading`, { headers })).json();
  const patch = await request.patch(`${url}/rest/v1/store_template_settings`, { headers, data: { template_key: "spotlight", hero_heading: "HACKED" } });
  const body = patch.status() === 204 ? [] : await patch.json().catch(() => []);
  expect([200, 204, 401, 403]).toContain(patch.status());
  expect(Array.isArray(body) ? body : []).toHaveLength(0); // RLS: Staff matches no row to update
  const after = await (await request.get(`${url}/rest/v1/store_template_settings?select=template_key,hero_heading`, { headers })).json();
  expect(after).toEqual(before);
  const del = await request.delete(`${url}/rest/v1/store_template_settings`, { headers });
  expect([401, 403]).toContain(del.status()); // no DELETE privilege at all
});

test("PV-15 responsive: mobile and desktop layouts", async ({ page }) => {
  await login(page, OWNER);
  await page.setViewportSize({ width: 390, height: 844 });
  await openTemplates(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const [pickerBox, previewBox] = await Promise.all([card(page, "classic").boundingBox(), preview(page).boundingBox()]);
  expect(previewBox!.y).toBeGreaterThan(pickerBox!.y); // stacked: preview below the picker
  await shot(page, "PV-15-mobile-templates", { fullPage: true });
  await page.goto(publicUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, "PV-15b-mobile-storefront");
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("PV-16 reset to default restores the original storefront", async ({ page }) => {
  await login(page, MANAGER); // also proves the Manager role can save
  await openTemplates(page);
  await card(page, "classic").click();
  for (const label of ["Hero heading", "Hero subheading"]) await page.getByLabel(label).fill("");
  await page.getByLabel("Accent color", { exact: true }).fill("");
  // remove the hero image (saved item: removing only unlinks it; the server deletes the file on save)
  const remove = page.getByRole("button", { name: /remove|delete/i }).first();
  if (await remove.isVisible()) await remove.click();
  await save(page).click();
  await expect(page.getByText("Template saved")).toBeVisible();
  expect(await publicTemplate(page)).toBe("classic");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(HEADING);
  await expect(page.locator('[data-template="classic"] header')).not.toHaveAttribute("style", /./);
  await shot(page, "PV-16-reset-default");
});
