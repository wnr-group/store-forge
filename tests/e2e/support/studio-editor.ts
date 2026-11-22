import { expect, type Page } from "@playwright/test";
import { apiGet } from "./studio-measure";

type Summary = { id: string; kind: string; isDefault: boolean };

export async function indexTemplate(page: Page) {
  const list = await apiGet<Summary[]>(page, "/store/templates");
  return list.find((t) => t.kind === "index" && t.isDefault) ?? list.find((t) => t.kind === "index")!;
}

/** Wait until the autosaved draft of the home page does (present=true) or does not (false) contain `needle`. */
export async function waitForDraft(page: Page, needle: string, present = true) {
  const t = await indexTemplate(page);
  await expect
    .poll(async () => JSON.stringify((await apiGet<{ document: unknown }>(page, `/store/templates/${t.id}`)).document).includes(needle), { timeout: 30_000 })
    .toBe(present);
}

/** Makes sure the store has a theme draft (applies the first theme from the Themes page when the editor redirects there). */
export async function openEditor(page: Page) {
  await page.goto("/dashboard/templates/editor");
  if (!/templates\/editor/.test(page.url())) {
    await page.goto("/dashboard/templates");
    await page.getByRole("button", { name: "Apply theme" }).first().click();
    await page.waitForURL(/templates\/editor/, { timeout: 60_000 });
  }
  await expect(page.getByRole("button", { name: "Publish" }).first()).toBeVisible({ timeout: 60_000 });
}

export async function openFeaturedCollection(page: Page) {
  await openEditor(page);
  await page.getByRole("button", { name: "Featured Collection", exact: true }).first().click();
}

/** Header "Publish" button, then the confirmation dialog. */
export async function publishFromEditor(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Publish your theme?")).toBeVisible();
  await dialog.getByRole("button", { name: /publish/i }).last().click();
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
}

/** Choose `next` in the Featured collection select ("" = Newest products). `previous` is the value being replaced, used to wait for the autosave when clearing. */
export async function pickCollection(page: Page, next: string, opts: { publish?: boolean; previous?: string } = {}) {
  await openFeaturedCollection(page);
  await page.getByLabel("Collection Identifier").selectOption(next);
  if (next) await waitForDraft(page, next);
  else if (opts.previous) await waitForDraft(page, opts.previous, false);
  if (opts.publish) await publishFromEditor(page);
}

/** Applies a theme by its card name on the Themes page (or opens the editor when it is already the store's theme). */
export async function applyTheme(page: Page, name: string) {
  await page.goto("/dashboard/templates");
  const card = page.getByRole("button", { name: `Preview ${name}`, exact: true }).locator("xpath=ancestor::*[count(.//button[normalize-space()='Apply theme' or normalize-space()='Customize'])=1][1]");
  const apply = card.getByRole("button", { name: "Apply theme" });
  // The card must be found: falling back to the editor of whatever theme is current would test the wrong theme.
  await expect(card.getByRole("button", { name: /Apply theme|Customize/ })).toHaveCount(1, { timeout: 20_000 });
  if (await apply.count()) {
    await apply.click();
    // A store with its own customizations is asked to confirm; one without is switched straight away.
    const dlg = page.getByRole("alertdialog");
    await Promise.race([dlg.waitFor({ timeout: 6_000 }).catch(() => undefined), page.waitForURL(/templates\/editor/, { timeout: 6_000 }).catch(() => undefined)]);
    if (await dlg.count()) await dlg.getByRole("button", { name: "Switch theme" }).click();
    await page.waitForURL(/templates\/editor/, { timeout: 60_000 });
  } else {
    await card.getByRole("button", { name: "Customize" }).click();
    await page.waitForURL(/templates\/editor/, { timeout: 60_000 });
  }
  await expect(page.getByRole("button", { name: "Publish" }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}
