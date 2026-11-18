import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { apiGet } from "./support/studio-measure";
import { expectRestored, hydrated, PREFIX, snapshot } from "./support/studio-data";
import { asUser } from "./support/studio-session";

/**
 * F6a: the Add category action lives in the Categories PageHeader (as Add member does on Team), on top of the merged
 * subcategories behaviour (grouped two-level table, Add subcategory, hierarchical product category labels).
 * The first three tests are read-only. The last one writes a parent and a subcategory through the real UI in the isolated
 * local E2E database and deletes both through the UI; the category list must equal its starting state afterwards.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

const header = (page: Page) => page.locator("main h1").first().locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");
const addButtons = (page: Page) => page.getByRole("button", { name: "Add category" });

const VIEWS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

for (const scheme of ["light", "dark"] as const) {
  test(`F6a-1: Add category is in the PageHeader, once, level with the title, at every viewport (${scheme})`, async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/categories");
      await hydrated(page);
      const rows: Record<string, unknown>[] = [];
      for (const v of VIEWS) {
        await page.setViewportSize({ width: v.width, height: v.height });
        await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [v.width, v.height]);
        const hdr = header(page);
        const btn = hdr.getByRole("button", { name: "Add category" });
        await expect(btn, `${v.name}: the action is inside the page header`).toBeVisible();
        await expect(addButtons(page), `${v.name}: exactly one Add category button (not duplicated above the table)`).toHaveCount(1);
        const m = await page.evaluate(() => {
          const h1 = document.querySelector("main h1")!;
          const root = h1.closest("div.justify-between")!.getBoundingClientRect();
          const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Add category")!.getBoundingClientRect();
          const table = document.querySelector("table")!.getBoundingClientRect();
          const de = document.documentElement;
          return { rootTop: root.top, rootBottom: root.bottom, rootRight: root.right, btnTop: btn.top, btnBottom: btn.bottom, btnRight: btn.right, btnLeft: btn.left, tableTop: table.top, overflowX: de.scrollWidth - de.clientWidth, innerWidth };
        });
        expect(m.btnTop, `${v.name}: button starts inside the header`).toBeGreaterThanOrEqual(m.rootTop - 1);
        expect(m.btnBottom, `${v.name}: button ends above the table (it is not between header and table any more)`).toBeLessThanOrEqual(m.tableTop);
        expect(m.btnRight, `${v.name}: button not clipped on the right`).toBeLessThanOrEqual(m.innerWidth);
        expect(m.btnLeft, `${v.name}: button not clipped on the left`).toBeGreaterThanOrEqual(0);
        expect(m.overflowX, `${v.name}: no horizontal page overflow`).toBeLessThanOrEqual(1);
        if (v.width >= 1024) expect(m.rootRight - m.btnRight, `${v.name}: action is right-aligned in the header, as on Team members`).toBeLessThanOrEqual(2);
        rows.push({ view: v.name, ...m });
        if (v.name === "1440x900" || v.name === "390x844") await capture(page, info, { ac: ["F6a-1"], folder: "f6a-header", name: `categories-${v.name}-${scheme}`, note: `Categories (${scheme}, ${v.name}): Add category sits in the page header beside the title; the table starts directly below.` });
      }
      record(info, ["F6a-1"], `header action position (${scheme})`, { rows });
    }, { scheme, viewport: { width: 1440, height: 900 } });
  });
}

test("F6a-2/F6a-4: the header button opens the existing dialog; empty submit shows the existing validation; Escape, X and Cancel return focus to it", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/categories");
    await hydrated(page);
    const trigger = header(page).getByRole("button", { name: "Add category" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "New category" })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id), "focus starts in the name field").toBe("cat-name");

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.locator("#cat-name-msg")).toContainText("required", { ignoreCase: true });
    await expect(dialog, "the dialog stays open on a validation error").toBeVisible();

    const closers: [string, () => Promise<void>][] = [
      ["Escape", () => page.keyboard.press("Escape")],
      ["X button", () => dialog.getByRole("button", { name: "Close" }).click()],
      ["Cancel", () => dialog.getByRole("button", { name: "Cancel" }).click()],
    ];
    for (const [how, close] of closers) {
      if (!(await dialog.isVisible())) { await trigger.focus(); await page.keyboard.press("Enter"); await expect(dialog).toBeVisible(); }
      await close();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => trigger.evaluate((el) => el === document.activeElement), { message: `focus returns to the header button after ${how}` }).toBe(true);
    }
    record(info, ["F6a-2", "F6a-4"], "header button opens the dialog, validation, focus return", { closers: closers.map((c) => c[0]) });
  });
});

test("F6a-5: seeded hierarchy is grouped and intact: parent then child, no Parent column, Add subcategory only on top-level rows, top-level-only parents, hierarchical labels on the product pages", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/categories");
    await hydrated(page);
    await expect(page.getByRole("columnheader", { name: "Parent" })).toHaveCount(0);
    const rows = page.locator("tbody tr");
    const texts = await rows.allTextContents();
    for (const [parent, child] of [["Electronics", "Audio"], ["Clothing", "T-Shirts"]]) {
      const pi = texts.findIndex((t) => t.startsWith(parent));
      expect(pi, `${parent} is listed`).toBeGreaterThanOrEqual(0);
      expect(texts[pi + 1], `${child} directly follows its parent ${parent}`).toContain(child);
      await expect(rows.nth(pi)).toHaveAttribute("data-level", "1");
      await expect(rows.nth(pi + 1)).toHaveAttribute("data-level", "2");
    }
    await page.getByRole("button", { name: "Actions for Electronics" }).click();
    await expect(page.getByRole("menuitem", { name: "Add subcategory" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: "Actions for Audio" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add subcategory" }), "subcategories cannot have children").toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    await header(page).getByRole("button", { name: "Add category" }).click();
    const parents = await page.locator("#cat-parent option").allTextContents();
    expect(parents).toEqual(expect.arrayContaining(["None (top level)", "Electronics", "Clothing"]));
    expect(parents, "subcategories are not offered as parents").not.toContain("Audio");
    expect(parents).not.toContain("T-Shirts");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await page.goto("/dashboard/products");
    await hydrated(page);
    const filterOptions = await page.locator("select").filter({ has: page.locator("option", { hasText: "All categories" }) }).first().locator("option").allTextContents();
    expect(filterOptions).toEqual(expect.arrayContaining(["All categories", "Uncategorised", "Electronics › Audio", "Clothing › T-Shirts"]));
    await page.goto("/dashboard/products/new");
    const formOptions = await page.locator("#categoryId option").allTextContents();
    expect(formOptions).toEqual(expect.arrayContaining(["Electronics › Audio", "Clothing › T-Shirts"]));
    record(info, ["F6a-5", "F6a-6"], "seeded hierarchy intact", { filterOptions, formOptions });

    await page.goto("/dashboard/categories");
    await capture(page, info, { ac: ["F6a-5"], folder: "f6a-header", name: "hierarchy-seeded", note: "Seeded hierarchy under the new header: Electronics then Audio, Clothing then T-Shirts (indented), no Parent column." });
  });
});

test("F6a-3/F6a-5: create a category and a subcategory through the UI (focus returns after a successful save), hierarchy and product labels update, then delete both", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/categories");
    await hydrated(page);
    const before = await snapshot(page);
    const run = Date.now().toString(36);
    const parent = `${PREFIX} F6a parent ${run}`;
    const child = `${PREFIX} F6a child ${run}`;
    const created: string[] = [];
    try {
      const trigger = header(page).getByRole("button", { name: "Add category" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.locator("#cat-name").fill(parent);
      await dialog.getByRole("button", { name: "Save" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText("Category created")).toBeVisible();
      created.push(parent);
      await expect.poll(() => trigger.evaluate((el) => el === document.activeElement), { message: "focus returns to the header button after a successful save" }).toBe(true);

      await page.getByRole("button", { name: `Actions for ${parent}` }).click();
      await page.getByRole("menuitem", { name: "Add subcategory" }).click();
      await expect(page.getByRole("heading", { name: "New subcategory" })).toBeVisible();
      await expect(page.locator("#cat-parent option:checked")).toHaveText(parent);
      await page.locator("#cat-name").fill(child);
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
      created.push(child);
      await expect(page.getByRole("row", { name: new RegExp(child) })).toBeVisible({ timeout: 30_000 }); // the list refreshes after the save

      const texts = await page.locator("tbody tr").allTextContents();
      const pi = texts.findIndex((t) => t.includes(parent));
      expect(texts[pi + 1], "the new subcategory directly follows its parent").toContain(child);
      await expect(page.locator("tbody tr").nth(pi)).toHaveAttribute("data-level", "1");
      await expect(page.locator("tbody tr").nth(pi + 1)).toHaveAttribute("data-level", "2");
      const cats = await apiGet<{ id: string; name: string; parentId: string | null }[]>(page, "/categories");
      const p = cats.find((c) => c.name === parent)!, c = cats.find((c) => c.name === child)!;
      expect(c.parentId, "the API stored the parent link").toBe(p.id);
      await capture(page, info, { ac: ["F6a-3", "F6a-5"], folder: "f6a-header", name: "created-hierarchy", note: `After creating "${parent}" and its subcategory through the UI: indented child under its parent; header action unchanged. Both are deleted at the end of the test.` });

      await page.goto("/dashboard/products/new");
      expect(await page.locator("#categoryId option").allTextContents(), "product form offers Parent › Child").toContain(`${parent} › ${child}`);
    } finally {
      await page.goto("/dashboard/categories");
      for (const name of [...created].reverse()) {
        const menu = page.getByRole("button", { name: `Actions for ${name}` });
        if (await menu.count()) {
          await menu.click();
          await page.getByRole("menuitem", { name: "Delete" }).click();
          await page.getByRole("alertdialog").getByRole("button", { name: "Delete category" }).click();
          await expect(page.getByText(name)).toHaveCount(0, { timeout: 30_000 });
        }
      }
      const after = await snapshot(page);
      record(info, ["F6a-3"], "cleanup", { created, categoriesBefore: before.categories.length, categoriesAfter: after.categories.length, identical: JSON.stringify(before.categories) === JSON.stringify(after.categories) });
      expectRestored(before, after, "F6a");
    }
  });
});
