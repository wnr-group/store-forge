import { expect, test } from "@playwright/test";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { indexTemplate, openFeaturedCollection, publishFromEditor } from "./support/studio-editor";

/** AC-PICK-2: a Featured collection saved before the picker (it holds the collection's slug) shows as that collection and still renders its list. */
test.use({ actionTimeout: 30_000 });
test.describe.configure({ timeout: 300_000 });
const H = { Origin: "http://localhost:3100" };
type Doc = { sections: Record<string, { type: string; settings?: Record<string, unknown> }> };

test("a legacy slug value is shown as the selected collection and the list still renders", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const r = page.context().request;
    const cols = ((await (await r.get(`${API}/collections`)).json()) as { data: { id: string; slug: string; name: string; productCount: number; status: string }[] }).data;
    const target = cols.find((c) => c.productCount > 0 && c.status === "active")!;
    const tpl = await indexTemplate(page);
    const before = ((await (await r.get(`${API}/store/templates/${tpl.id}`)).json()) as { data: { revision: number; document: Doc } }).data;
    const original = structuredClone(before.document);
    try {
      const doc = structuredClone(before.document);
      const key = Object.keys(doc.sections).find((k) => doc.sections[k].type === "featured-collection")!;
      doc.sections[key].settings = { ...doc.sections[key].settings, collectionId: target.slug }; // the old, slug-valued form
      const put = await r.put(`${API}/store/templates/${tpl.id}/draft`, { headers: H, data: { document: doc, expectedRevision: before.revision } });
      expect(put.ok(), `save ${put.status()}`).toBe(true);

      await openFeaturedCollection(page);
      const select = page.getByLabel("Collection Identifier");
      await expect(select).toHaveValue(target.id); // the slug is matched to its collection
      await expect(select.locator("option:checked")).toHaveText(new RegExp(target.name));
      await expect(page.getByText(/removed collection/i)).toHaveCount(0);
      await shot(page, "AC-PICK-2_legacy-slug-shown-as-selected");

      await page.waitForTimeout(4000);
      await publishFromEditor(page);
      const detail = await r.get(`${API}/public/storefronts/${STORE_SLUG}/collections/${target.slug}`);
      const names = ((await detail.json()) as { data: { products: { name: string }[] } }).data.products.map((p) => p.name);
      await expect.poll(async () => { await page.goto(`/s/${STORE_SLUG}`); return (await page.locator("body").innerText()).includes(names[0]); }, { timeout: 30_000 }).toBe(true);
      await shot(page, "AC-PICK-2_storefront-still-renders-list", { fullPage: true });
    } finally {
      const now = ((await (await r.get(`${API}/store/templates/${tpl.id}`)).json()) as { data: { revision: number } }).data;
      await r.put(`${API}/store/templates/${tpl.id}/draft`, { headers: H, data: { document: original, expectedRevision: now.revision } });
      await openFeaturedCollection(page);
      await page.waitForTimeout(4000);
      await publishFromEditor(page);
    }
  });
});
