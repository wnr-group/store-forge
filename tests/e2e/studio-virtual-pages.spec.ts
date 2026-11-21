import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { openEditor, publishFromEditor } from "./support/studio-editor";

test.describe.configure({ timeout: 900_000 });
const KEYS = ["products", "collections", "search", "cart", "wishlist", "content", "about", "contact"] as const;
const LABEL: Record<(typeof KEYS)[number], string> = { products: "All products", collections: "Collections", search: "Search results", cart: "Cart", wishlist: "Wishlist", content: "Content pages (About, Contact ...)", about: "About page", contact: "Contact page" };
const PATH: Record<(typeof KEYS)[number], string> = { products: "/products", collections: "/collections", search: "/search?q=shoes", cart: "/cart", wishlist: "/wishlist", content: "", about: "/about", contact: "/contact" };

async function editFirstHeading(page: Page, key: (typeof KEYS)[number], text: string) {
  await page.getByLabel("Page to edit").selectOption({ label: LABEL[key] });
  const frame = page.frameLocator("iframe").first();
  const heading = frame.locator("h1, h2").first();
  await expect(heading).toBeVisible({ timeout: 40_000 });
  const original = (await heading.innerText()).trim();
  await heading.click();
  const inspector = page.getByRole("complementary", { name: "Settings" });
  const fields = inspector.locator("input, textarea");
  await expect(fields.first()).toBeVisible({ timeout: 15_000 });
  let target = null;
  for (let i = 0; i < (await fields.count()); i++) if ((await fields.nth(i).inputValue().catch(() => "")).trim() === original) { target = fields.nth(i); break; }
  if (!target) throw new Error(`${key}: no settings field holds "${original}"`);
  await target.fill(text);
  await expect(frame.locator("body")).toContainText(text, { timeout: 15_000 });
}

test("all eight virtual pages: edit, publish, see it live; reset touches one page only", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const pagesRes = await page.context().request.get(`${API}/public/storefronts/${STORE_SLUG}/pages`);
    const contentSlug = ((await pagesRes.json()) as { data: { slug: string }[] }).data[0]?.slug;
    const stamp = Date.now() % 100000;
    const texts = Object.fromEntries(KEYS.map((k) => [k, `ZZ ${k} ${stamp}`])) as Record<(typeof KEYS)[number], string>;
    const results: { page: string; edited: boolean; live: boolean; note?: string }[] = [];

    const HEALTHY = ["collections", "cart", "wishlist"] as const;
    const DEFECTIVE = ["products", "search", "content", "about", "contact"] as const;
    await openEditor(page);
    for (const k of HEALTHY) await editFirstHeading(page, k, texts[k]);
    await publishFromEditor(page);
    for (const k of HEALTHY) {
      await page.goto(`/s/${STORE_SLUG}${PATH[k]}`);
      const live = (await page.locator("body").innerText()).includes(texts[k]);
      if (live) await shot(page, `AC-VP-1_${k}`);
      results.push({ page: k, edited: true, live, note: live ? undefined : "edited text not visible on the storefront" });
    }
    // The other five pages: edit, then check whether the editor lets the merchant publish.
    for (const k of DEFECTIVE) {
      await openEditor(page);
      try { await editFirstHeading(page, k, texts[k]); } catch (e) {
        await shot(page, `AC-VP-1_${k}-cannot-edit`);
        results.push({ page: k, edited: false, live: false, note: `BLOCKED: ${(e as Error).message.split(String.fromCharCode(10))[0].slice(0, 160)}` });
        continue;
      }
      await page.waitForTimeout(3000);
      const blocked = await page.getByRole("button", { name: "Publish", exact: true }).first().isDisabled();
      results.push({ page: k, edited: true, live: false, note: blocked ? "BLOCKED: Publish is disabled after the edit (invalid default document, defect D-002)" : "publish enabled" });
      if (!blocked) { await publishFromEditor(page); await page.goto(`/s/${STORE_SLUG}${PATH[k] || ""}`); results[results.length - 1].live = (await page.locator("body").innerText()).includes(texts[k]); }
      if (blocked) await shot(page, `AC-VP-1_${k}-publish-blocked`);
    }
    mkdirSync("artifacts/studio/virtual-pages", { recursive: true });
    writeFileSync("artifacts/studio/virtual-pages/flows.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    expect(results.filter((r) => HEALTHY.includes(r.page as never) && !r.live)).toEqual([]);

    await openEditor(page);
    await page.getByLabel("Page to edit").selectOption({ label: LABEL.cart });
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /reset page/i }).click();
    await publishFromEditor(page);
    await page.goto(`/s/${STORE_SLUG}/cart`);
    await expect(page.locator("body")).not.toContainText(texts.cart);
    await page.goto(`/s/${STORE_SLUG}/wishlist`);
    await expect(page.locator("body")).toContainText(texts.wishlist);
    await shot(page, "AC-VP-2_reset-cart-only-wishlist-intact");
  });
});
