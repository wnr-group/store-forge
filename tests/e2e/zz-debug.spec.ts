import { test } from "@playwright/test";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
const H = { Origin: "http://localhost:3100" };
test("pp api", async ({ browser }) => {
  test.setTimeout(200_000);
  await asUser(browser, "owner", async (page) => {
    const r = page.context().request;
    const stamp = Date.now() % 100000;
    const p = ((await (await r.post(`${API}/products`, { headers: H, data: { name: `ZZ dbg ${stamp}`, price: "10", sku: `D${stamp}`, status: "active", description: `DESC-D${stamp}` } })).json()) as { data: { id: string; slug: string } }).data;
    const get = async () => (await r.get(`http://localhost:4000/api/v1/public/storefronts/urban-nest-demo/products/${p.slug}`)).json();
    const before = JSON.stringify((await get()).data).includes("hiddenBlocks");
    const d = (await (await r.get(`${API}/store/product-presentations/${p.id}`)).json()).data;
    console.log("DETAIL", JSON.stringify(d).slice(0, 300));
    const put = await r.put(`${API}/store/product-presentations/${p.id}/draft`, { headers: H, data: { document: { schemaVersion: 1, hiddenBlocks: ["product-description"] }, expectedRevision: d.revision ?? 0 } });
    console.log("PUT", put.status(), (await put.text()).slice(0, 200));
    const pub = await r.post(`${API}/store/product-presentations/${p.id}/publish`, { headers: H, data: {} });
    console.log("PUBLISH", pub.status(), (await pub.text()).slice(0, 200));
    const after = await get();
    console.log("PUBLIC", before, JSON.stringify(after.data).includes("hiddenBlocks"), JSON.stringify(after.data.presentation ?? null).slice(0, 200));
    await page.goto(`/s/urban-nest-demo/products/${p.slug}`);
    console.log("PAGE_HAS_DESC", (await page.locator("body").innerText()).includes(`DESC-D${stamp}`));
    await r.delete(`${API}/products/${p.id}`, { headers: H });
  });
});
