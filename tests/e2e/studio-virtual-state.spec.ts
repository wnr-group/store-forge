import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { openEditor, publishFromEditor } from "./support/studio-editor";

/**
 * AC-VP-3: after the words of the search, cart and wishlist pages are edited and published, the dynamic parts still work:
 * the search term and its results, the shopper's bag, and the shopper's saved products.
 */
test.describe.configure({ timeout: 600_000 });
test.use({ actionTimeout: 30_000 });
const H = { Origin: "http://localhost:3100" };
const LABEL = { search: "Search results", cart: "Cart", wishlist: "Wishlist" } as const;

async function editHeading(page: Page, key: keyof typeof LABEL, text: string) {
  await page.getByLabel("Page to edit").selectOption({ label: LABEL[key] });
  const frame = page.frameLocator("iframe").first();
  const heading = frame.locator("h1, h2").first();
  await expect(heading).toBeVisible({ timeout: 40_000 });
  const original = (await heading.innerText()).trim();
  await heading.click();
  const fields = page.getByRole("complementary", { name: "Settings" }).locator("input, textarea");
  await expect(fields.first()).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < (await fields.count()); i++) {
    if ((await fields.nth(i).inputValue().catch(() => "")).trim().toLowerCase() === original.toLowerCase()) {
      await fields.nth(i).fill(text);
      await expect(frame.locator("body")).toContainText(text, { timeout: 15_000 });
      return original;
    }
  }
  throw new Error(`${key}: no settings field holds "${original}"`);
}

test("search term, bag and wishlist keep working on edited pages", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const stamp = Date.now() % 100000;
    const word = `zzvp${stamp}`;
    const made = await page.context().request.post(`${API}/products`, { headers: H, data: { name: `ZZ VP ${word}`, price: "25", sku: `VP-${stamp}`, status: "active", quantity: 10 } });
    expect(made.ok(), `create product ${made.status()}`).toBe(true);
    const product = ((await made.json()) as { data: { id: string; slug: string } }).data;
    const heads = { search: `ZZ Find ${stamp}`, cart: `ZZ My bag ${stamp}`, wishlist: `ZZ My saves ${stamp}` };
    const log: Record<string, unknown> = { product: product.slug, heads };
    const originals: Partial<Record<keyof typeof LABEL, string>> = {};
    try {
      await openEditor(page);
      for (const k of ["search", "cart", "wishlist"] as const) originals[k] = await editHeading(page, k, heads[k]);
      await page.waitForTimeout(3000);
      await publishFromEditor(page);

      // Search: the edited heading is shown, the shopper's term still drives the results, the note still names the term.
      await expect.poll(async () => { await page.goto(`/s/${STORE_SLUG}/search?q=${word}`); await page.waitForTimeout(1500); return (await page.locator("body").innerText()).includes(heads.search); }, { timeout: 30_000 }).toBe(true);
      const search = await page.locator("body").innerText();
      expect(search).toContain(`ZZ VP ${word}`);
      expect(search.toLowerCase()).toContain(word);
      await shot(page, "AC-VP-3_search-edited-term-and-results");
      await page.goto(`/s/${STORE_SLUG}/search?q=nomatch${stamp}`);
      await page.waitForTimeout(1500);
      expect(await page.locator("body").innerText()).not.toContain(`ZZ VP ${word}`);
      log.searchTermDrivesResults = true;

      // Bag: add the product, then the edited cart page lists it.
      await page.goto(`/s/${STORE_SLUG}/products/${product.slug}`);
      await page.getByRole("button", { name: "Add to bag" }).first().click();
      await page.goto(`/s/${STORE_SLUG}/cart`);
      await expect(page.getByText(heads.cart).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(`ZZ VP ${word}`).first()).toBeVisible({ timeout: 30_000 });
      await shot(page, "AC-VP-3_cart-edited-with-item");
      log.cartKeepsItem = true;

      // Wishlist: save the product, then the edited wishlist page lists it.
      await page.goto(`/s/${STORE_SLUG}/products/${product.slug}`);
      await page.getByRole("button", { name: "Add to wishlist" }).first().click();
      await page.goto(`/s/${STORE_SLUG}/wishlist`);
      await expect(page.getByText(heads.wishlist).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(`ZZ VP ${word}`).first()).toBeVisible({ timeout: 30_000 });
      await shot(page, "AC-VP-3_wishlist-edited-with-item");
      log.wishlistKeepsItem = true;
    } finally {
      await page.context().request.delete(`${API}/products/${product.id}`, { headers: H });
      // Put the three pages back to their generated defaults and publish.
      try {
        await openEditor(page);
        for (const k of ["search", "cart", "wishlist"] as const) {
          await page.getByLabel("Page to edit").selectOption({ label: LABEL[k] });
          page.once("dialog", (d) => void d.accept());
          await page.getByRole("button", { name: /reset page/i }).click();
        }
        await page.waitForTimeout(3000);
        await publishFromEditor(page);
        log.restoredDefaults = true;
      } catch (e) {
        log.restoreError = (e as Error).message.slice(0, 160);
      }
      mkdirSync("artifacts/studio/virtual-pages", { recursive: true });
      writeFileSync("artifacts/studio/virtual-pages/state-flows.json", JSON.stringify({ takenAt: new Date().toISOString(), ...log }, null, 2));
    }
  });
});
