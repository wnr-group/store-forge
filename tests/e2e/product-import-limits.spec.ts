import { expect, request, test, type Page } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";
import { dbAvailable, dbScalar } from "./support/db";
import { runId } from "./ui";

/**
 * Limits on the real stack: the 500-row maximum and the over-limit paths. Needs E2E_DB_CONTAINER (BLOCKED without it),
 * and AUTH_BFF_SECRET / E2E_API_URL for the direct API 413 check. Signs in once for the browser tests.
 */
test.describe.configure({ mode: "serial" });

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const id = runId();
let page: Page;
let tenant = "";

const tenantCount = () => Number(dbScalar(`select count(*) from public.products where tenant_id='${tenant}'`));
const select = (name: string, body: string) => page.locator("#import-file").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(body) });
const importPosts: string[] = [];

test.beforeAll(async ({ browser }) => {
  test.skip(!dbAvailable(), "Needs E2E_DB_CONTAINER: BLOCKED, never PASS");
  page = await browser.newPage();
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) importPosts.push(r.url()); });
  await login(page, MANAGER);
  tenant = dbScalar(`select tenant_id from public.memberships m join auth.users u on u.id=m.user_id where u.email='${MANAGER}'`);
});
test.afterAll(async () => page?.close());

test("500 rows (the maximum) import in one request: all rows persist for the tenant, none leak, duration recorded", async () => {
  const before = tenantCount();
  const lines = ["name,price,sku,quantity,category"];
  for (let i = 1; i <= 500; i++) lines.push(`QA 500 ${id} ${String(i).padStart(3, "0")},${(i % 90) + 5}.25,Q5-${id}-${i},${i % 7},${i % 2 ? "Clothing" : ""}`);
  await page.goto("/dashboard/products/import");
  await select("rows-500.csv", lines.join("\r\n") + "\r\n");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByRole("status")).toContainText("500 products imported", { timeout: 60_000 });
  const ms = Date.now() - t0;
  console.log(`500-row import: click to success banner = ${ms} ms`);
  await evidence(page, "LIMIT-500-success.png");

  expect(tenantCount()).toBe(before + 500);
  const like = `name like 'QA 500 ${id} %'`;
  expect(Number(dbScalar(`select count(*) from public.products where ${like}`))).toBe(500);
  expect(Number(dbScalar(`select count(*) from public.products where ${like} and tenant_id='${tenant}'`))).toBe(500);
  expect(Number(dbScalar(`select count(distinct name) from public.products where ${like}`))).toBe(500);
  expect(Number(dbScalar(`select count(distinct created_at) from public.products where ${like}`))).toBe(1); // one transaction
  expect(Number(dbScalar(`select count(*) from public.products where ${like} and (status<>'draft' or track_inventory is not true or low_stock_threshold<>5)`))).toBe(0);
  expect(Number(dbScalar(`select count(*) from public.products where ${like} and category_id is not null`))).toBe(250);
  expect(Number(dbScalar(`select count(distinct slug) from public.products where ${like}`))).toBe(500);
  expect(ms).toBeLessThan(60_000);
});

test("501 rows are refused before any API call and nothing is written", async () => {
  const before = tenantCount();
  const lines = ["name,price"];
  for (let i = 1; i <= 501; i++) lines.push(`QA 501 ${id} ${i},5.00`);
  await page.goto("/dashboard/products/import");
  await select("rows-501.csv", lines.join("\r\n") + "\r\n");
  await page.getByRole("button", { name: "Import products" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "No products were imported" });
  await expect(alert).toContainText("501 products");
  await expect(alert).toContainText("limit is 500");
  await evidence(page, "LIMIT-501-rejected.png");
  expect(tenantCount()).toBe(before);
  expect(Number(dbScalar(`select count(*) from public.products where name like 'QA 501 ${id} %'`))).toBe(0);
});

test("a file over 1 MB is stopped in the browser: clear error, no request is sent, nothing is written", async () => {
  const before = tenantCount();
  const sentBefore = importPosts.length;
  const body = "name,price,description\r\n" + `QA BIG ${id},5.00,${"x".repeat(1_300_000)}\r\n`;
  expect(Buffer.byteLength(body)).toBeGreaterThan(1_048_576);
  await page.goto("/dashboard/products/import");
  await select("big.csv", body);
  await expect(page.locator("p[role=alert]")).toContainText("larger than 1 MB");
  await expect(page.getByRole("button", { name: "Import products" })).toBeDisabled();
  await evidence(page, "LIMIT-1MB-browser.png");
  expect(importPosts.length).toBe(sentBefore); // the browser sent nothing
  expect(tenantCount()).toBe(before);
  expect(Number(dbScalar(`select count(*) from public.products where name = 'QA BIG ${id}'`))).toBe(0);
});

test("the API itself answers a real HTTP 413 to an over-2 MB body on the import route and writes nothing", async () => {
  test.skip(!process.env.AUTH_BFF_SECRET || !process.env.E2E_DEMO_PASSWORD, "Needs AUTH_BFF_SECRET and E2E_DEMO_PASSWORD: BLOCKED, never PASS");
  const before = Number(dbScalar("select count(*) from public.products"));
  const ctx = await request.newContext({ extraHTTPHeaders: { "x-internal-auth": process.env.AUTH_BFF_SECRET! } });
  const loginRes = await ctx.post(`${API}/auth/login`, { data: { email: MANAGER, password: process.env.E2E_DEMO_PASSWORD } });
  expect(loginRes.status()).toBe(200);
  const res = await ctx.post(`${API}/products/import`, {
    headers: { "X-Organization-Id": tenant },
    data: { rows: [{ row: 2, name: `QA 413 ${id}`, price: "1.00", description: "a".repeat(2_600_000) }] },
  });
  console.log(`API over-limit body: HTTP ${res.status()} ${(await res.text()).slice(0, 120)}`);
  expect(res.status()).toBe(413);
  expect(Number(dbScalar("select count(*) from public.products"))).toBe(before);
  expect(Number(dbScalar(`select count(*) from public.products where name = 'QA 413 ${id}'`))).toBe(0);
});
