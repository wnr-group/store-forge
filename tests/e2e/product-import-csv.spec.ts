import { expect, test } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";
import { runId } from "./ui";

test("AC-11/14: a valid CSV creates the products as drafts with the manual-form defaults", async ({ page }) => {
  const id = runId();
  await login(page, MANAGER);
  await page.goto("/dashboard/products/import");
  await page.locator("#import-file").setInputFiles({ name: "qa.csv", mimeType: "text/csv", buffer: Buffer.from(`name,price,status\r\nQA CSV ${id} A,10.00,\r\nQA CSV ${id} B,12.50,active\r\n`) });
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByRole("status")).toContainText("2 products imported");
  await evidence(page, "AC-11-csv-success.png");

  await page.goto(`/dashboard/products?q=${encodeURIComponent(`QA CSV ${id} A`)}`);
  await page.getByRole("link", { name: `QA CSV ${id} A` }).first().click();
  await expect(page.getByLabel("Inventory quantity")).toHaveValue("0");
  await expect(page.getByLabel("Low-stock alert at")).toHaveValue("5");
  await expect(page.getByRole("switch", { name: /track/i })).toBeChecked();
  await expect(page.locator("#status")).toHaveValue("draft");
  await evidence(page, "AC-14-defaults.png");
});

test("the downloaded template has every column and a sample row", async ({ page }) => {
  await login(page, MANAGER);
  await page.goto("/dashboard/products/import");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download template" }).click()]);
  expect(download.suggestedFilename()).toBe("product-import-template.csv");
  const path = await download.path();
  const text = (await import("node:fs")).readFileSync(path, "utf8");
  const [header, sample] = text.trim().split(/\r?\n/);
  expect(header.split(",")).toEqual(["name", "price", "slug", "sku", "short_description", "description", "product_type", "compare_at_price", "cost", "quantity", "track_inventory", "low_stock_threshold", "status", "category", "subcategory"]);
  expect(sample.length).toBeGreaterThan(0);
  await evidence(page, "template-download.png");
});
