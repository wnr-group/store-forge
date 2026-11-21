import { expect, test } from "@playwright/test";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { openFeaturedCollection, pickCollection } from "./support/studio-editor";

type Collection = { id: string; slug: string; name: string; productCount: number; status: string };

test("picking a collection stores its id, survives a reload, and the storefront shows it", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const res = await page.context().request.get(`${API}/collections`);
    expect(res.ok()).toBe(true);
    const target = ((await res.json()) as { data: Collection[] }).data.find((c) => c.productCount > 0 && c.status === "active");
    expect(target, "needs an active collection with products in the E2E data").toBeTruthy();

    await pickCollection(page, target!.id, { publish: true });
    await shot(page, "AC-PICK-1_picker-selected");

    await openFeaturedCollection(page); // reload from the server
    await expect(page.getByLabel("Collection Identifier")).toHaveValue(target!.id);
    const live = await page.context().request.get(`${API}/public/storefronts/${STORE_SLUG}/layout?kind=index`);
    expect(JSON.stringify(((await live.json()) as { data: unknown }).data)).toContain(target!.id);
    await page.goto(`/s/${STORE_SLUG}`);
    const detail = await page.context().request.get(`${API}/public/storefronts/${STORE_SLUG}/collections/${target!.slug}`);
    const names = ((await detail.json()) as { data: { products: { name: string }[] } }).data.products.map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);
    await expect(page.locator("body")).toContainText(names[0], { timeout: 30_000 });
    await shot(page, "AC-PICK-1_storefront", { fullPage: true });
  });
});
