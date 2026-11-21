import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";

/**
 * AC-PP-1..4 in a real browser: the per-product customizer (editor, Product page). A hidden block is saved as a draft (never
 * public), published for that product only, reset for that product only, and a stale tab is refused. The storefront must show
 * each change without waiting for a cache to expire (cache invalidation).
 */
test.describe.configure({ timeout: 600_000 });
test.use({ actionTimeout: 30_000 });
const ORIGIN = { Origin: "http://localhost:3100" };
type Made = { id: string; slug: string; sku: string; name: string };

async function makeProduct(page: Page, name: string, sku: string): Promise<Made> {
  const res = await page.context().request.post(`${API}/products`, { headers: ORIGIN, data: { name, price: "10", sku, status: "active", description: `DESC-${sku}` } });
  expect(res.ok(), `create product: ${res.status()} ${(await res.text()).slice(0, 200)}`).toBe(true);
  const d = ((await res.json()) as { data: { id: string; slug: string } }).data;
  return { id: d.id, slug: d.slug, sku, name };
}

const productPage = (p: Made) => `/s/${STORE_SLUG}/products/${p.slug}`;
const shows = async (page: Page, p: Made) => {
  await page.goto(productPage(p));
  return (await page.locator("body").innerText()).includes(`DESC-${p.sku}`);
};
const waitShows = async (page: Page, p: Made, want: boolean) => {
  const t0 = Date.now();
  await expect.poll(() => shows(page, p), { timeout: 30_000, intervals: [500, 1000] }).toBe(want);
  return Date.now() - t0;
};

test("per-product customizer: draft, publish, reset, stale tab, one product only", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const stamp = Date.now() % 1_000_000;
    const a = await makeProduct(page, `ZZ PP A ${stamp}`, `PPA-${stamp}`);
    const b = await makeProduct(page, `ZZ PP B ${stamp}`, `PPB-${stamp}`);
    const log: Record<string, unknown> = { a: a.slug, b: b.slug };
    try {
      // Baseline: both product pages show their SKU (the store design).
      expect(await shows(page, a), "A shows its description before any change").toBe(true);
      expect(await shows(page, b), "B shows its description before any change").toBe(true);

      const open = async (p: Page) => {
        await p.goto(`/dashboard/templates/editor?product=${a.id}`);
        await p.getByLabel("Page to edit").selectOption({ label: "Product page" });
        await p.getByRole("tab", { name: "Product" }).click();
        await p.getByPlaceholder("Search products").fill(a.name);
        await p.getByRole("button", { name: new RegExp(a.name) }).first().click();
        await expect(p.locator("#pp-layout")).toBeVisible({ timeout: 60_000 });
      };
      await open(page);
      await shot(page, "AC-PP-1_customizer-open");

      // Draft: hide the SKU for product A only. It is saved, but a draft is never public.
      await page.locator('label[for="pp-block-product-description"]').click();
      await expect.poll(async () => JSON.stringify((await (await page.context().request.get(`${API}/store/product-presentations/${a.id}`)).json())), { timeout: 30_000 }).toContain("product-description");
      await shot(page, "AC-PP-1_draft-saved-sku-hidden");
      expect(await shows(page, a), "a draft must not reach the storefront").toBe(true);
      log.draftPublic = false;

      // Publish this product: A loses the SKU, B keeps it, the shared template is unchanged.
      await open(page);
      await page.getByRole("button", { name: "Publish this product" }).click();
      const dlg = page.getByRole("alertdialog");
      if (await dlg.count()) await dlg.getByRole("button", { name: /publish/i }).last().click();
      log.publishVisibleAfterMs = await waitShows(page, a, false);
      await shot(page, "AC-PP-1_storefront-A-sku-hidden");
      expect(await shows(page, b), "B must keep the store design").toBe(true);
      await shot(page, "AC-PP-1_storefront-B-unchanged");

      // Stale tab (AC-PP-3): a second tab opened now, then the first tab changes the product, then the second tab saves.
      const tab2 = await page.context().newPage();
      await open(tab2);
      await open(page);
      const enabled = await page.locator('input[id^="pp-block-"]:not([disabled])').evaluateAll((els) => els.map((e) => e.id));
      const others = enabled.filter((id) => id !== "pp-block-product-description");
      expect(others.length, "one more hideable block in this theme's product page").toBeGreaterThanOrEqual(1);
      const [first] = others;
      await page.locator(`label[for="${first}"]`).click();
      await expect.poll(async () => JSON.stringify((await (await page.context().request.get(`${API}/store/product-presentations/${a.id}`)).json())), { timeout: 30_000 }).toContain(first.replace("pp-block-", ""));
      await tab2.locator("#pp-layout").selectOption("stacked");
      const conflict = tab2.getByText(/changed|newer|conflict|out of date|reload|refresh/i).first();
      await expect(conflict).toBeVisible({ timeout: 30_000 });
      log.staleMessage = (await conflict.innerText()).slice(0, 200);
      await shot(tab2, "AC-PP-3_stale-tab-refused");
      const saved = JSON.stringify((await (await page.context().request.get(`${API}/store/product-presentations/${a.id}`)).json()));
      expect(saved, "the stale save must not overwrite the newer draft").not.toContain("stacked");
      await tab2.close();

      // Reset: A goes back to the store design, B untouched (AC-PP-2).
      await open(page);
      await page.getByRole("button", { name: "Reset to the store design" }).click();
      const dlg2 = page.getByRole("alertdialog");
      if (await dlg2.count()) await dlg2.getByRole("button", { name: /reset/i }).last().click();
      log.resetVisibleAfterMs = await waitShows(page, a, true);
      await shot(page, "AC-PP-2_storefront-A-reset-to-store-design");
      expect(await shows(page, b)).toBe(true);
    } finally {
      for (const p of [a, b]) await page.context().request.delete(`${API}/products/${p.id}`, { headers: ORIGIN });
      mkdirSync("artifacts/studio/presentations", { recursive: true });
      writeFileSync("artifacts/studio/presentations/browser-flow.json", JSON.stringify({ takenAt: new Date().toISOString(), ...log }, null, 2));
    }
  });
});
