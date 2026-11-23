import { expect, test } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";

test("AC-11: a valid XLSX creates the products", async ({ page }) => {
  await login(page, MANAGER);
  await page.goto("/dashboard/products/import");
  await page.locator("#import-file").setInputFiles("tests/fixtures/import/e2e-valid.xlsx");
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByRole("status")).toContainText("2 products imported");
  await evidence(page, "AC-11-xlsx-success.png");
});
