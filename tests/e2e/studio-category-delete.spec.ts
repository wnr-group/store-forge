import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";
import { API } from "./support/studio-measure";
import { PREFIX } from "./support/studio-data";
import { asUser } from "./support/studio-session";

type Cat = { id: string; name: string; parentId: string | null; productCount: number };
const list = async (page: Page) => ((await (await page.context().request.get(`${API}/categories`)).json()) as { data: Cat[] }).data;
test.describe.configure({ timeout: 180_000 });

async function addCategory(page: Page, name: string, parent?: string) {
  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: /add category/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#cat-name").fill(name);
  if (parent) await dialog.locator("#cat-parent").selectOption({ label: parent });
  await dialog.getByRole("button", { name: /^(save|create|add)/i }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
}
async function openDelete(page: Page, name: string) {
  await page.goto("/dashboard/categories");
  const row = page.getByRole("row", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  await row.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /delete/i }).click();
  return page.getByRole("alertdialog");
}

test("category delete dialog names affected subcategories; cancel keeps everything; confirm promotes them", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const parent = `${PREFIX} Parent ${Date.now() % 100000}`;
    await addCategory(page, parent);
    await addCategory(page, `${parent} B-sub`, parent);
    await addCategory(page, `${parent} A-sub`, parent);

    let dialog = await openDelete(page, `${parent}`);
    await expect(dialog).toContainText("2 subcategories will become top-level categories");
    await expect(dialog).toContainText(`${parent} A-sub, ${parent} B-sub`);
    await expect(dialog).toContainText("will become uncategorised");
    await shot(page, "AC-CAT-1_delete-dialog");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    expect((await list(page)).some((c) => c.name === parent)).toBe(true);

    dialog = await openDelete(page, parent);
    await dialog.getByRole("button", { name: "Delete category" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
    const after = await list(page);
    expect(after.some((c) => c.name === parent)).toBe(false);
    for (const n of ["A-sub", "B-sub"]) expect(after.find((c) => c.name === `${parent} ${n}`)?.parentId).toBeNull();
    await shot(page, "AC-CAT-1_after-delete");
    for (const n of ["A-sub", "B-sub"]) {
      dialog = await openDelete(page, `${parent} ${n}`);
      await dialog.getByRole("button", { name: "Delete category" }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
    }
  });
});
