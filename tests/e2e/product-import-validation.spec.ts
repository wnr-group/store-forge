import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";
import { runId } from "./ui";

const upload = async (page: Page, name: string, body: string | Buffer, mimeType = "text/csv") => {
  await page.goto("/dashboard/products/import");
  await page.locator("#import-file").setInputFiles({ name, mimeType, buffer: Buffer.isBuffer(body) ? body : Buffer.from(body) });
};
const submit = (page: Page) => page.getByRole("button", { name: "Import products" }).click();

test("AC-12/14/16/15: invalid files import nothing; errors name row, column, message and value; the report downloads escaped", async ({ page }) => {
  const id = runId();
  await login(page, MANAGER);
  await upload(page, "ok.csv", `name,price,sku\r\nQA Seed ${id},5.00,QA-SKU-${id}\r\n`);
  await submit(page);
  await expect(page.getByRole("status")).toContainText("1 product imported");

  await upload(page, "bad.csv", [
    "name,price,sku",
    `QA ROLL ${id} 1,0,`,                    // row 2: zero price
    `QA ROLL ${id} 2,,`,                     // row 3: blank price
    `=HYPERLINK("x"),5.00,QA-SKU-${id}`,     // row 4: SKU already exists in the store; name starts with '='
    `QA ROLL ${id} 4,5.00,DUP-${id}`,        // row 5
    `QA ROLL ${id} 5,5.00,dup-${id}`,        // row 6: duplicate of row 5
    `QA ROLL ${id} 6,=1+1,`,                 // row 7: invalid price that starts with a formula character
  ].join("\r\n"));
  await submit(page);
  const alert = page.getByRole("alert").filter({ hasText: "No products were imported" });
  await expect(alert).toBeVisible();
  const rows = alert.locator("tbody tr");
  await expect(rows.filter({ hasText: "price" })).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("2");
  await expect(alert.getByRole("row", { name: /^4 sku/ })).toBeVisible();
  await expect(alert.getByRole("row", { name: /^6 sku/ })).toContainText("row 5");
  await evidence(page, "AC-12-validation-errors.png");
  await evidence(page, "AC-14-price-validation.png");
  await evidence(page, "AC-16-duplicate-conflicts.png");

  const [download] = await Promise.all([page.waitForEvent("download"), alert.getByRole("button", { name: "Download error report" }).click()]);
  const csv = readFileSync(await download.path(), "utf8");
  expect(csv.split("\r\n")[0]).toBe("row,column,message,value");
  expect(csv).toContain("'=1+1"); // a value that starts with a formula character is escaped in the report
  expect(csv).not.toMatch(/(^|,)=1\+1/m);

  // AC-15 (UI consequence only): nothing from the failed file exists
  await page.goto(`/dashboard/products?q=${encodeURIComponent(`QA ROLL ${id}`)}`);
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await evidence(page, "AC-15-rollback.png");
});

test("AC-13: file-level rejections are actionable", async ({ page }) => {
  await login(page, MANAGER);
  const cases: [string, string, string | Buffer, RegExp, string?][] = [
    ["xls", "legacy.xls", "x", /Legacy \.xls files are not supported/, "application/vnd.ms-excel"],
    ["too-big", "big.csv", "name,price\r\n" + "a".repeat(1_100_000), /larger than 1 MB/],
    ["unknown-header", "u.csv", "name,price,colour\r\nA,1\r\n", /Unknown columns: colour/],
    ["duplicate-header", "d.csv", "name,price,price\r\nA,1,2\r\n", /Duplicate columns: price/],
    ["missing-header", "m.csv", "name,sku\r\nA,1\r\n", /Missing required columns: price/],
    ["too-many-rows", "r.csv", "name,price\r\n" + Array.from({ length: 501 }, (_, i) => `P${i},1`).join("\r\n"), /501 products. The limit is 500/],
    ["payload", "payload-over-1_5mb.xlsx", readFileSync("tests/fixtures/import/payload-over-1_5mb.xlsx"), /too much text/, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ];
  for (const [slug, name, body, message, mime] of cases) {
    await upload(page, name, body, mime);
    if (slug !== "xls" && slug !== "too-big") await submit(page);
    await expect(page.getByText(message)).toBeVisible();
    await evidence(page, `AC-13-file-validation-${slug}.png`);
  }
});

test("AC-12: an uncached formula cell is a row error and is never imported as a blank", async ({ page }) => {
  await login(page, MANAGER);
  await page.goto("/dashboard/products/import");
  await page.locator("#import-file").setInputFiles("tests/fixtures/import/formulas/uncached.xlsx");
  await page.getByRole("button", { name: "Import products" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "No products were imported" });
  await expect(alert.getByRole("row", { name: /^2 cost/ })).toContainText("formula with no stored value");
  await evidence(page, "AC-12-formula-error.png");
});

test("AC-12 (rule V-FE): a formula that evaluates to an error is a row error", async ({ page }) => {
  await login(page, MANAGER);
  await page.goto("/dashboard/products/import");
  await page.locator("#import-file").setInputFiles("tests/fixtures/import/formulas/error-cached.xlsx");
  await page.getByRole("button", { name: "Import products" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "No products were imported" });
  await expect(alert.getByRole("row", { name: /^2 cost/ })).toContainText("formula error");
  await evidence(page, "AC-12-formula-error-cell.png");
});
