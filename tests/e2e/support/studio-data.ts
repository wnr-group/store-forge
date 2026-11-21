import { expect, type Page } from "@playwright/test";
import { API, apiGet } from "./studio-measure";

/**
 * Before/after verification for the specs that write data (isolated local E2E database only). Every record a test
 * creates is named with PREFIX so a leftover can be found by search and reported, never silently ignored.
 */
export const PREFIX = "ZZ E2E";

/** The one designated reusable restricted test member (local E2E database only; never a demo account). */
export const REUSABLE_MEMBER_EMAIL = "e2e-reusable-restricted@demo.test";
type Row = { id: string };
const ids = (rows: Row[]) => rows.map((r) => r.id).sort();

export type DataSnapshot = {
  categories: string[];
  collections: string[];
  adjustments: string[];
  customersTop: string[];
  productsTop: string[];
  leftoverCustomers: string[];
  leftoverProducts: string[];
  store: string;
};

/** Full list when the API allows a larger page, else the default page (the API caps lists at 20 and rejects unknown parameters). */
async function list(page: Page, path: string): Promise<Row[]> {
  const res = await page.context().request.get(`${API}${path}${path.includes("?") ? "&" : "?"}limit=100`);
  if (res.ok()) return ((await res.json()) as { data: Row[] }).data;
  return apiGet<Row[]>(page, path);
}

export async function snapshot(page: Page): Promise<DataSnapshot> {
  const q = encodeURIComponent(PREFIX);
  return {
    categories: ids(await apiGet<Row[]>(page, "/categories")),
    collections: ids(await apiGet<Row[]>(page, "/collections")),
    adjustments: ids(await apiGet<Row[]>(page, "/inventory/adjustments")),
    customersTop: ids(await list(page, "/customers")),
    productsTop: ids(await list(page, "/products")),
    leftoverCustomers: ids(await list(page, `/customers?search=${q}`)),
    leftoverProducts: ids(await list(page, `/products?search=${q}`)),
    store: JSON.stringify(await apiGet<unknown>(page, "/store")),
  };
}

/** The data set must be exactly what it was before the test (store settings compared without the updatedAt stamp). */
export function expectRestored(before: DataSnapshot, after: DataSnapshot, label: string) {
  const strip = (s: string) => JSON.stringify({ ...JSON.parse(s), updatedAt: undefined });
  expect(after.leftoverCustomers, `${label}: no leftover test customer`).toEqual([]);
  expect(after.leftoverProducts, `${label}: no leftover test product`).toEqual([]);
  const diff = (a: string[], b: string[]) => `missing now: [${a.filter((x) => !b.includes(x)).join(",")}] extra now: [${b.filter((x) => !a.includes(x)).join(",")}]`;
  for (const key of ["categories", "collections", "customersTop", "productsTop", "adjustments"] as const) {
    expect(after[key], `${label}: ${key} restored (${diff(before[key], after[key])}; before ${before[key].length}, after ${after[key].length})`).toEqual(before[key]);
  }
  expect(strip(after.store), `${label}: store settings restored`).toBe(strip(before.store));
}

/** The page is interactive once React has hydrated (MerchantScope sets this marker in an effect at that point). */
export const hydrated = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.area ?? null)).toBe("merchant");

export const addTestProduct = async (page: Page, name: string) => {
  await page.goto("/dashboard/products/new");
  await hydrated(page);
  await page.locator("#name").fill(name);
  await page.locator("#price").fill("12.50");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL((u) => /\/dashboard\/products\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new"), { timeout: 60_000 });
};

export const deleteProductsByPrefix = async (page: Page) => {
  await page.goto(`/dashboard/products?q=${encodeURIComponent(PREFIX)}`);
  await hydrated(page);
  for (let i = 0; i < 6; i++) {
    const menu = page.getByRole("button", { name: new RegExp(`^Actions for ${PREFIX}`) }).first();
    // The rows stream in after hydration: counting at once saw an empty list and left the test products behind.
    await menu.waitFor({ timeout: 5_000 }).catch(() => undefined);
    // The rows stream in after hydration: counting at once saw an empty list and left the test products behind.
    await menu.waitFor({ timeout: 5_000 }).catch(() => undefined);
    if (!(await menu.count())) break;
    await menu.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^Delete/ }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
    await page.goto(`/dashboard/products?q=${encodeURIComponent(PREFIX)}`);
    await hydrated(page);
  }
};
