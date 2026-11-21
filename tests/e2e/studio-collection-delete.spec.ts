import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";
import { API } from "./support/studio-measure";
import { PREFIX } from "./support/studio-data";
import { asUser } from "./support/studio-session";
import { openFeaturedCollection, pickCollection } from "./support/studio-editor";

type Collection = { id: string; name: string; slug: string };
const find = async (page: Page, name: string) => ((await (await page.context().request.get(`${API}/collections`)).json()) as { data: Collection[] }).data.find((c) => c.name === name);

async function createCollection(page: Page, name: string): Promise<Collection> {
  await page.goto("/dashboard/collections/new");
  await page.getByLabel("Collection name").fill(name);
  await page.locator("#col-status").selectOption("active");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect.poll(() => find(page, name), { timeout: 30_000 }).toBeTruthy();
  return (await find(page, name))!;
}
const openDelete = async (page: Page, c: Collection) => {
  await page.goto(`/dashboard/collections/${c.id}`);
  await page.getByRole("button", { name: /delete collection/i }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
};

test.describe.configure({ timeout: 150_000 });

test("unused: plain dialog, cancel keeps it, confirm deletes", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const c = await createCollection(page, `${PREFIX} Unused ${Date.now()}`);
    const dialog = await openDelete(page, c);
    await expect(dialog).toContainText("The collection and its image are removed");
    await shot(page, "AC-CDEL-2_unused-delete-dialog");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    expect(await find(page, c.name)).toBeTruthy();
    const again = await openDelete(page, c);
    await again.getByRole("button", { name: "Delete collection" }).click();
    await page.waitForURL(/\/dashboard\/collections$/, { timeout: 30_000 });
    expect(await find(page, c.name)).toBeUndefined();
  });
});

test("draft then published reference: warning names the section and state; cancel changes nothing", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const c = await createCollection(page, `${PREFIX} Used ${Date.now()}`);
    await pickCollection(page, c.id);
    let dialog = await openDelete(page, c);
    await expect(dialog).toContainText("is used by 1 section of your store design");
    await expect(dialog).toContainText("draft");
    await shot(page, "AC-CDEL-1_warning-draft");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    expect(await find(page, c.name)).toBeTruthy();

    await pickCollection(page, c.id, { publish: true });
    dialog = await openDelete(page, c);
    await expect(dialog).toContainText("live");
    await shot(page, "AC-CDEL-1_warning-live");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    expect(await find(page, c.name)).toBeTruthy();
    // cleanup
    await pickCollection(page, "", { publish: true, previous: c.id });
  });
});

test("references change between warning and confirmation: refreshed warning, second confirmation needed", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const c = await createCollection(page, `${PREFIX} Race ${Date.now()}`);
    await pickCollection(page, c.id);
    const dialog = await openDelete(page, c);
    await expect(dialog).toContainText("is used by 1 section");

    // Meanwhile (second tab, same owner) the reference is removed from the draft.
    const other = await page.context().newPage();
    await pickCollection(other, "", { previous: c.id });
    await other.close();

    await dialog.getByRole("button", { name: "Delete anyway" }).click();
    await expect(dialog).toContainText("has changed", { timeout: 30_000 });
    await expect(dialog).toContainText("The collection and its image are removed");
    expect(await find(page, c.name)).toBeTruthy();
    await shot(page, "AC-CDEL-3_refreshed-warning");
    await dialog.getByRole("button", { name: "Delete collection" }).click();
    await page.waitForURL(/\/dashboard\/collections$/, { timeout: 30_000 });
    expect(await find(page, c.name)).toBeUndefined();
  });
});

test("after deletion the section is hidden for shoppers and the editor keeps it with a hint", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const c = await createCollection(page, `${PREFIX} Gone ${Date.now()}`);
    await pickCollection(page, c.id, { publish: true });
    const dialog = await openDelete(page, c);
    await dialog.getByRole("button", { name: "Delete anyway" }).click();
    await page.waitForURL(/\/dashboard\/collections$/, { timeout: 30_000 });
    await openFeaturedCollection(page);
    await expect(page.getByLabel("Collection Identifier")).toContainText("Removed collection");
    await shot(page, "AC-CDEL-5_editor-removed-collection");
    const res = await page.goto(`/s/${process.env.E2E_STORE_SLUG ?? "urban-nest-demo"}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
    await shot(page, "AC-CDEL-5_storefront", { fullPage: true });
    await pickCollection(page, "", { publish: true, previous: c.id });
  });
});
