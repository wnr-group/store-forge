import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * READ-ONLY search and filter behaviour on Products, Customers and Inventory (EVIDENCE_LABEL=after). Filters are driven
 * through the real controls and verified from the URL and the rendered rows. Nothing is written. This covers the
 * "no results" empty state reached by searching; it does NOT cover the true "no data yet" empty states or loading skeletons.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

const hydrated = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.area ?? null)).toBe("merchant");
const search = (page: Page, placeholder: RegExp) => page.getByPlaceholder(placeholder);
const urlParam = (page: Page, k: string) => page.evaluate((key) => new URL(location.href).searchParams.get(key), k);

test("Products: search narrows the list, the status filter works, a no-match search shows the empty state, clearing restores", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/products");
    await hydrated(page);
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    const all = await rows.count();
    expect(all, "the unfiltered list has several rows").toBeGreaterThan(3);

    await search(page, /search by name or sku/i).fill("Yoga");
    await expect.poll(() => urlParam(page, "q"), { message: "search is debounced into the URL" }).toBe("Yoga");
    await expect(page.getByText("Yoga Mat").first()).toBeVisible();
    await expect(page.getByText("Adjustable Dumbbell Set")).toHaveCount(0);
    const shown = await page.locator("table tbody tr").count();
    expect(shown).toBeLessThan(all);

    await search(page, /search by name or sku/i).fill("");
    await expect.poll(() => urlParam(page, "q")).toBeNull();
    await expect(page.getByText("Adjustable Dumbbell Set").first()).toBeVisible();

    await page.locator("select").filter({ has: page.locator("option", { hasText: "Draft" }) }).first().selectOption({ label: "Draft" });
    await expect.poll(() => urlParam(page, "status")).toBe("draft");
    const statusCells = await page.locator("table tbody tr").allInnerTexts();
    expect(statusCells.length).toBeGreaterThan(0);
    for (const t of statusCells) expect(t, "every row shown is a Draft").toMatch(/Draft/);
    expect(statusCells.some((t) => /Active/.test(t)), "no Active rows leak through the Draft filter").toBe(false);

    await search(page, /search by name or sku/i).fill("zzz-no-such-product");
    await expect(page.getByText("No products match")).toBeVisible({ timeout: 30_000 });
    await capture(page, info, { ac: ["QA-FUNC"], folder: "products", name: "no-match-empty-state", note: "Products with a Draft filter and a search that matches nothing: the 'No products match' empty state." });
    record(info, ["QA-FUNC"], "products search/filter/no-match", { unfiltered: all, afterSearch: shown, draftRows: statusCells.length });
  });
});

test("Customers: search by name narrows the list and a no-match search shows the empty state", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/customers");
    await hydrated(page);
    await expect(page.getByText("Yash Nair").first()).toBeVisible();
    await search(page, /search name, email or phone/i).fill("Nikhil");
    await expect.poll(() => urlParam(page, "q")).toBe("Nikhil");
    await expect(page.getByText("Nikhil Shah").first()).toBeVisible();
    await expect(page.getByText("Yash Nair")).toHaveCount(0);

    await search(page, /search name, email or phone/i).fill("zzz-nobody");
    await expect(page.getByText("No customers match")).toBeVisible({ timeout: 30_000 });
    await capture(page, info, { ac: ["QA-FUNC"], folder: "customers", name: "no-match-empty-state", note: "Customers search that matches nothing: the 'No customers match' empty state." });
    record(info, ["QA-FUNC"], "customers search/no-match", { ok: true });
  });
});

test("Customers: the sort control reorders the list", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/customers");
    await hydrated(page);
    const names = async () => (await page.locator("table tbody tr td:first-child").allInnerTexts()).map((t) => t.split("\n")[0].trim());
    const before = await names();
    await page.locator("select").filter({ has: page.locator("option", { hasText: "Name A–Z" }) }).first().selectOption({ label: "Name A–Z" });
    await expect.poll(() => urlParam(page, "sort")).not.toBeNull();
    await expect.poll(async () => (await names())[0], { message: "list re-ordered" }).not.toBe(before[0]);
    const after = await names();
    const sorted = [...after].sort((a, b) => a.localeCompare(b));
    expect(after, "Name A–Z really sorts the visible page alphabetically").toEqual(sorted);
    record(info, ["QA-FUNC"], "customers sort A-Z", { first: after[0] });
  });
});

test("Inventory: the stock-level filter and search work, and a no-match search shows the empty state", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/inventory");
    await hydrated(page);
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    await page.locator("select").filter({ has: page.locator("option", { hasText: "Out of stock" }) }).first().selectOption({ label: "Out of stock" });
    await expect.poll(() => urlParam(page, "stock")).toBe("out");
    const out = await page.locator("table tbody tr").allInnerTexts();
    expect(out.length).toBeGreaterThan(0);
    for (const t of out) expect(t, "every row is Out of stock").toMatch(/Out of stock/);
    expect(out.some((t) => /Low stock/.test(t)), "no Low-stock rows under the Out of stock filter").toBe(false);

    await page.locator("select").filter({ has: page.locator("option", { hasText: "Low stock" }) }).first().selectOption({ label: "Low stock" });
    await expect.poll(() => urlParam(page, "stock")).toBe("low");
    const low = await page.locator("table tbody tr").allInnerTexts();
    expect(low.length).toBeGreaterThan(0);
    for (const t of low) expect(t, "every row is Low stock").toMatch(/Low stock/);

    await search(page, /search product, variant or sku/i).fill("zzz-no-such-sku");
    await expect(page.getByText("No matching items")).toBeVisible({ timeout: 30_000 });
    await capture(page, info, { ac: ["QA-FUNC"], folder: "inventory", name: "no-match-empty-state", note: "Inventory with a Low stock filter and a search that matches nothing: the 'No matching items' empty state." });
    record(info, ["QA-FUNC"], "inventory filter/search/no-match", { outOfStockRows: out.length, lowStockRows: low.length });
  });
});
