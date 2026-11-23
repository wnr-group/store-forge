import { expect, type Page } from "@playwright/test";

export const runId = () => Date.now().toString(36);

export async function addCategory(page: Page, name: string, parentLabel?: string) {
  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: "Add category" }).first().click();
  await page.locator("#cat-name").fill(name);
  if (parentLabel) await page.locator("#cat-parent").selectOption({ label: parentLabel });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
}

export async function addProduct(page: Page, name: string, price = "10.00", categoryLabel?: string) {
  await page.goto("/dashboard/products/new");
  await page.locator("#name").fill(name);
  await page.locator("#price").fill(price);
  if (categoryLabel) await page.locator("#categoryId").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/new"));
}
