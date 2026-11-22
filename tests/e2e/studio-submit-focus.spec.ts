import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { API, apiGet } from "./support/studio-measure";
import { asUser } from "./support/studio-session";

/**
 * DF-2: focus returns to the opener after a SUCCESSFUL submit. This is the ONLY spec that writes data.
 *
 * It creates exactly ONE category through the real Studio UI, in the isolated local E2E stack, and deletes only that
 * record through the same UI in a finally block. The category list is read through the API before and after: the end state
 * must equal the start state. It refuses to run unless the API is on localhost, and unless no leftover record of an
 * earlier run exists (so a stuck record is reported, never silently deleted).
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

const PREFIX = "ZZ E2E focus-return";
type Cat = { id: string; name: string };

const hydrated = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.area ?? null)).toBe("merchant");

test("Add category: after a successful save, focus returns to the Add category button (one record, cleaned up)", async ({ browser }, info) => {
  expect(new URL(API).hostname, "writes are only allowed against a local API").toMatch(/^(localhost|127\.0\.0\.1)$/);

  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/categories");
    await hydrated(page);

    const before = await apiGet<Cat[]>(page, "/categories");
    const beforeIds = before.map((c) => c.id).sort();
    const leftovers = before.filter((c) => c.name.startsWith(PREFIX));
    expect(leftovers, "no leftover test category from an earlier run (clean it up deliberately, not automatically)").toEqual([]);

    const name = `${PREFIX} ${Date.now()}`;
    let createdId: string | null = null;
    let cleanup = "not needed";
    try {
      const trigger = page.getByRole("button", { name: /add category/i }).first();
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "focus moves into the dialog").toBe(true);

      await dialog.locator("#cat-name").fill(name);
      // keyboard path: focus Save and press Enter (a keyboard user also gets the focus ring back on the opener)
      await dialog.getByRole("button", { name: "Save" }).focus();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText("Category created")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });

      const focusedBack = await expect
        .poll(() => trigger.evaluate((el) => el === document.activeElement), { message: "focus returns to the Add category button after a successful save", timeout: 10_000 })
        .toBe(true)
        .then(() => true);
      const active = await page.evaluate(() => `${document.activeElement?.tagName}: ${(document.activeElement as HTMLElement | null)?.innerText?.trim()}`);

      const after = await apiGet<Cat[]>(page, "/categories");
      const created = after.filter((c) => c.name === name);
      expect(created, "exactly one record was created").toHaveLength(1);
      createdId = created[0].id;
      expect(after.length, "exactly one more category than before").toBe(before.length + 1);

      await capture(page, info, {
        ac: ["DF-2"],
        folder: "focus-return-submit",
        name: "add-category-after-successful-save",
        note: `After a successful save the dialog is closed and focus is on "${active}" (the Add category button). Test record "${name}" is visible in the list and is deleted afterwards.`,
      });
      record(info, ["DF-2"], "focus returns to the trigger after a successful submit", { focusedBack, active, createdId, name });
    } finally {
      // Delete ONLY the record this test created, through the UI. Anything else is left alone.
      try {
        if (createdId || (await page.getByText(name).count()) > 0) {
          await page.getByRole("button", { name: `Actions for ${name}` }).click();
          await page.getByRole("menuitem", { name: "Delete" }).click();
          await page.getByRole("alertdialog").getByRole("button", { name: "Delete category" }).click();
          await expect(page.getByText(name)).toHaveCount(0, { timeout: 30_000 });
          cleanup = "deleted through the UI";
        }
      } catch (e) {
        cleanup = `UI cleanup FAILED: ${(e as Error).message.split("\n")[0]}`;
      }
      const final = await apiGet<Cat[]>(page, "/categories");
      const finalIds = final.map((c) => c.id).sort();
      const leftover = final.filter((c) => c.name === name || c.id === createdId);
      record(info, ["DF-2"], "cleanup", { cleanup, createdId, name, categoriesBefore: before.length, categoriesAfter: final.length, leftover, identicalToStart: JSON.stringify(finalIds) === JSON.stringify(beforeIds) });
      expect(leftover, `LEFTOVER test record (${cleanup})`).toEqual([]);
      expect(finalIds, "the category list is identical to what it was before the test").toEqual(beforeIds);
    }
  });
});
