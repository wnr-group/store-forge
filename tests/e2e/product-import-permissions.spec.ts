import { expect, test } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";

test("AC-10: the manager sees Import and can open the page", async ({ page }) => {
  await login(page, MANAGER);
  await page.goto("/dashboard/products");
  await expect(page.getByRole("link", { name: "Import" })).toBeVisible();
  await evidence(page, "AC-10-manager.png");
  await page.getByRole("link", { name: "Import" }).click();
  await expect(page.getByRole("heading", { name: "Import products" })).toBeVisible();
});

test("AC-10: an account without catalog:manage sees no Import button and is redirected away from the page", async ({ page }) => {
  const viewer = process.env.E2E_VIEWER_EMAIL;
  test.skip(!viewer, "Needs E2E_VIEWER_EMAIL (products read/none): report as BLOCKED, never PASS");
  await login(page, viewer!);
  await page.goto("/dashboard/products");
  await expect(page.getByRole("link", { name: "Import" })).toHaveCount(0);
  await page.goto("/dashboard/products/import");
  await expect(page).toHaveURL(/\/dashboard\/products$/);
  await evidence(page, "AC-10-unauthorised.png");
});
