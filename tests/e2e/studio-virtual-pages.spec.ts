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

/**
 * The shared content layout holds no text (each page under Pages brings its own), so there is no heading to click.
 * Its frame is edited instead: select the section and change its background colour.
 */
async function editContentFrame(page: Page, colour: string) {
  await page.getByLabel("Page to edit").selectOption({ label: LABEL.content });
  await page.getByText("Rich Text", { exact: true }).first().click();
  const field = page.getByRole("complementary", { name: "Settings" }).getByLabel("Background Color", { exact: true });
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.fill(colour);
}

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
    const stamp = Date.now() % 100000;
    // A content page of the store's own (written under Pages): the shared content layout is what the editor styles for it.
    const created = await page.context().request.post(`${API}/store/pages`, { headers: { Origin: "http://localhost:3100" }, data: { title: `ZZ page ${stamp}`, body: "Body text", status: "published" } });
    expect(created.ok(), `create the content page: ${created.status()} ${(await created.text()).slice(0, 200)}`).toBe(true);
    const contentSlug = ((await created.json()) as { data: { slug: string; id: string } }).data.slug;
    const contentId = ((await created.json()) as { data: { id: string } }).data.id;
    const texts = Object.fromEntries(KEYS.map((k) => [k, `ZZ ${k} ${stamp}`])) as Record<(typeof KEYS)[number], string>;
    const results: { page: string; edited: boolean; live: boolean; note?: string }[] = [];

    await openEditor(page);
    const edited = new Set<string>();
    for (const k of KEYS) {
      try { if (k === "content") await editContentFrame(page, "#ffeedd"); else await editFirstHeading(page, k, texts[k]); edited.add(k); } catch (e) {
        await shot(page, `AC-VP-1_${k}-cannot-edit`);
        results.push({ page: k, edited: false, live: false, note: `BLOCKED: ${(e as Error).message.split(String.fromCharCode(10))[0].slice(0, 160)}` });
      }
    }
    await publishFromEditor(page);
    for (const k of KEYS) {
      if (!edited.has(k)) continue;
      await page.goto(`/s/${STORE_SLUG}${k === "content" ? `/${contentSlug}` : PATH[k]}`);
      const seen = () => k === "content"
        ? page.locator("section").evaluateAll((els) => els.some((e) => getComputedStyle(e).backgroundColor === "rgb(255, 238, 221)"))
        : page.locator("body").innerText().then((t) => t.includes(texts[k]));
      const live = await expect.poll(seen, { timeout: 10_000 }).toBe(true).then(() => true, () => false);
      if (live) await shot(page, `AC-VP-1_${k}`);
      results.push({ page: k, edited: true, live, note: live ? undefined : "edited text not visible on the storefront" });
    }
    mkdirSync("artifacts/studio/virtual-pages", { recursive: true });
    writeFileSync("artifacts/studio/virtual-pages/flows.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    expect(results.filter((r) => !r.live)).toEqual([]);

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
    await page.context().request.delete(`${API}/store/pages/${contentId}`, { headers: { Origin: "http://localhost:3100" } });
  });
});
