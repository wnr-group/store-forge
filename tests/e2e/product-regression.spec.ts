import { expect, test, type Page } from "@playwright/test";
import { evidence } from "./evidence";
import { MANAGER, login } from "./helpers";
import { dbAvailable, dbRows, dbScalar } from "./support/db";
import { addProduct, runId } from "./ui";

/**
 * Regression check of the EXISTING product flows that the import feature sits beside: create, edit, list, search and
 * filter, bulk publish / draft / delete, and the inventory page. Verification only, no feature scope. Signs in once.
 * Needs E2E_DB_CONTAINER (BLOCKED without it).
 */
test.describe.configure({ mode: "serial" });

const id = runId();
const A = `QA REG ${id} Alpha`;
const B = `QA REG ${id} Beta`;
let page: Page;
let tenant = "";

const row = (name: string) => dbRows(`select name, price_minor, status, tenant_id, updated_at from public.products where name='${name}'`)[0];
const list = (query: string) => page.goto(`/dashboard/products?${query}`);

test.beforeAll(async ({ browser }) => {
  test.skip(!dbAvailable(), "Needs E2E_DB_CONTAINER: BLOCKED, never PASS");
  page = await browser.newPage();
  await login(page, MANAGER);
  tenant = dbScalar(`select tenant_id from public.memberships m join auth.users u on u.id=m.user_id where u.email='${MANAGER}'`);
});
test.afterAll(async () => page?.close());

test("create: the manual product form still creates a draft product for the tenant", async () => {
  await addProduct(page, A, "19.99");
  const r = row(A);
  expect(r.slice(0, 4)).toEqual([A, "1999", "draft", tenant]);
  await addProduct(page, B, "5.00");
  expect(row(B).slice(0, 4)).toEqual([B, "500", "draft", tenant]);
});

test("list + search: the products list shows the new products and search narrows to them", async () => {
  await list(`q=${encodeURIComponent(`QA REG ${id}`)}`);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("link", { name: A })).toBeVisible();
  await evidence(page, "REG-list-search.png");
  await list("");
  await expect(page.locator("tbody tr").first()).toBeVisible(); // the unfiltered list renders
  await expect(page.getByRole("link", { name: "Import" })).toBeVisible(); // the new entry point sits beside the existing actions
  await expect(page.getByRole("link", { name: "Add product" })).toBeVisible();
});

test("edit: changing name, price and visibility persists", async () => {
  await list(`q=${encodeURIComponent(A)}`);
  await page.getByRole("link", { name: A }).first().click();
  const before = row(A)[4];
  await page.locator("#name").fill(`${A} Edited`);
  await page.locator("#price").fill("24.50");
  await page.locator("#status").selectOption("active");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => row(`${A} Edited`)?.slice(0, 3).join("|")).toBe(`${A} Edited|2450|active`);
  expect(row(`${A} Edited`)[4]).not.toBe(before);
  await evidence(page, "REG-edit.png");
});

test("filter: the status filter and the category filter return only matching products", async () => {
  await list(`q=${encodeURIComponent(`QA REG ${id}`)}&status=active`);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Active");
  await list(`q=${encodeURIComponent(`QA REG ${id}`)}&status=draft`);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Draft");
  const clothing = dbScalar(`select id from public.categories where tenant_id='${tenant}' and name='Clothing'`);
  await list(`category=${clothing}`);
  const rows = page.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const text of await rows.allInnerTexts()) expect(text).toContain("Clothing");
  await evidence(page, "REG-filter.png");
});

test("bulk actions: publish, move to draft and delete work on a multi-selection", async () => {
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  const names = [`${A} Edited`, B];
  const pick = async () => {
    await list(`q=${encodeURIComponent(`QA REG ${id}`)}`);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByRole("checkbox", { name: "Select all products on this page" }).check();
    await expect(bulk).toContainText("2 selected");
  };
  const statuses = () => names.map((n) => row(n)?.[2]);

  await pick();
  await bulk.getByRole("button", { name: "Publish" }).click();
  await expect.poll(statuses).toEqual(["active", "active"]);
  await pick();
  await bulk.getByRole("button", { name: "Move to draft" }).click();
  await expect.poll(statuses).toEqual(["draft", "draft"]);
  await evidence(page, "REG-bulk-draft.png");

  await pick();
  await bulk.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect.poll(() => Number(dbScalar(`select count(*) from public.products where name like 'QA REG ${id} %'`))).toBe(0);
  await evidence(page, "REG-bulk-delete.png");
});

test("inventory: the inventory page still loads for the manager", async () => {
  const res = await page.goto("/dashboard/inventory");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /inventory/i }).first()).toBeVisible();
  await evidence(page, "REG-inventory.png");
});
