import { expect, test, type Page } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";
import { dbAvailable, dbRows, dbScalar } from "./support/db";
import { runId } from "./ui";

/**
 * Real browser import flow with independent database verification (the disposable Postgres named by E2E_DB_CONTAINER).
 * Signs in once for the whole file to stay inside the API's login rate limit. Skips (BLOCKED) without a database.
 */
test.describe.configure({ mode: "serial" });

let page: Page;
let tenant = "";
const id = runId();

const upload = async (name: string, body: string | Buffer | null, path?: string) => {
  await page.goto("/dashboard/products/import");
  if (path) await page.locator("#import-file").setInputFiles(path);
  else await page.locator("#import-file").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(body as string) });
};
const submit = () => page.getByRole("button", { name: "Import products" }).click();
const tenantCount = () => Number(dbScalar(`select count(*) from public.products where tenant_id='${tenant}'`));

test.beforeAll(async ({ browser }) => {
  test.skip(!dbAvailable(), "Needs E2E_DB_CONTAINER: BLOCKED, never PASS");
  page = await browser.newPage();
  await login(page, MANAGER);
  tenant = dbScalar(`select tenant_id from public.memberships m join auth.users u on u.id=m.user_id where u.email='${MANAGER}'`);
  expect(tenant).toMatch(/^[0-9a-f-]{36}$/);
});
test.afterAll(async () => page?.close());

test("AC-11 (UI + DB): a valid CSV persists every row for the signed-in tenant with the manual-form defaults", async () => {
  const before = tenantCount();
  const clothing = dbScalar(`select id from public.categories where tenant_id='${tenant}' and name='Clothing'`);
  await upload("ok.csv", `name,price,sku,status,quantity,category\r\nQA UI ${id} A,10.00,QA-UI-${id}-A,active,7,Clothing\r\nQA UI ${id} B,12.50,,,,\r\nQA UI ${id} C,3,,draft,,\r\n`);
  await submit();
  await expect(page.getByRole("status")).toContainText("3 products imported");
  await evidence(page, "DB-csv-success.png");
  expect(tenantCount()).toBe(before + 3);
  const db = dbRows(`select name, price_minor, status, quantity, track_inventory, low_stock_threshold, coalesce(sku,''), coalesce(category_id::text,''), tenant_id from public.products where name like 'QA UI ${id} %' order by name`);
  expect(db.map((r) => r[0])).toEqual([`QA UI ${id} A`, `QA UI ${id} B`, `QA UI ${id} C`]);
  expect(db.map((r) => r[8])).toEqual([tenant, tenant, tenant]);
  expect(db.map((r) => r[1])).toEqual(["1000", "1250", "300"]);
  expect(db.map((r) => r[2])).toEqual(["active", "draft", "draft"]);
  expect(db.map((r) => r[3])).toEqual(["7", "0", "0"]);
  expect(db.map((r) => r[4])).toEqual(["t", "t", "t"]);
  expect(db.map((r) => r[5])).toEqual(["5", "5", "5"]);
  expect(db[0][6]).toBe(`QA-UI-${id}-A`);
  expect(db[0][7]).toBe(clothing);
});

test("AC-11 (UI + DB): a valid XLSX persists its rows for the signed-in tenant", async () => {
  const before = tenantCount();
  const startedAt = dbScalar("select now()");
  await upload("e2e-valid.xlsx", null, "tests/fixtures/import/e2e-valid.xlsx");
  await submit();
  await expect(page.getByRole("status")).toContainText("2 products imported");
  await evidence(page, "DB-xlsx-success.png");
  expect(tenantCount()).toBe(before + 2);
  const created = dbRows(`select name, status, tenant_id from public.products where created_at >= '${startedAt}' and tenant_id='${tenant}' order by name`);
  expect(created).toHaveLength(2);
  expect(created.every((r) => r[2] === tenant)).toBe(true);
  console.log(`xlsx created: ${created.map((r) => `${r[0]} (${r[1]})`).join("; ")}`);
});

test("AC-12/15 (UI + DB): a CSV with one invalid row imports nothing, shows the row error, and leaves the database unchanged", async () => {
  const before = tenantCount();
  const beforeTotal = Number(dbScalar("select count(*) from public.products"));
  await upload("bad.csv", `name,price\r\nQA UI ${id} R1,5.00\r\nQA UI ${id} R2,0\r\nQA UI ${id} R3,6.00\r\n`);
  await submit();
  const alert = page.getByRole("alert").filter({ hasText: "No products were imported" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("row", { name: /^3 price/ })).toBeVisible(); // spreadsheet row 3 (R2), column price
  await expect(alert.getByRole("row", { name: /^3 price/ })).toContainText("0");
  await evidence(page, "DB-rollback.png");
  expect(tenantCount()).toBe(before);
  expect(Number(dbScalar("select count(*) from public.products"))).toBe(beforeTotal);
  expect(Number(dbScalar(`select count(*) from public.products where name like 'QA UI ${id} R%'`))).toBe(0);
});

test("duplicate submission (UI): a double-click sends the import once; the database holds each row once", async () => {
  const sent: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) sent.push(r.url()); });
  await upload("dbl.csv", `name,price\r\nQA UI ${id} D1,4.00\r\nQA UI ${id} D2,4.00\r\n`);
  await page.getByRole("button", { name: "Import products" }).dblclick();
  await expect(page.getByRole("status")).toContainText("products imported");
  console.log(`server-action POSTs after a double-click: ${sent.length}`);
  expect(sent).toHaveLength(1);
  expect(Number(dbScalar(`select count(*) from public.products where name like 'QA UI ${id} D%'`))).toBe(2);
  // This shows the UI behaviour only. Server-side duplicate protection is covered by the API spec, not by this test.
});
