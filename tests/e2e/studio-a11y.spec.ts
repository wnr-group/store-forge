import { expect, test, type Locator, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * Studio polish: dialog focus return, skip link, Add team member footer. EVIDENCE_LABEL=after.
 * No data is written: dialogs are opened and closed, and forms are only submitted empty (client-side validation).
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

/** The page is interactive once React has hydrated (MerchantScope sets this marker in an effect at that point). */
const hydrated = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.area ?? null)).toBe("merchant");

const isFocused = (page: Page, l: Locator) => l.evaluate((el) => el === document.activeElement);

// ------------------------------------------------------------------------------------------------ focus return

type Opener = { name: string; url: string; open: (page: Page) => Promise<Locator> };
const OPENERS: Opener[] = [
  { name: "Categories: Add category", url: "/dashboard/categories", open: async (p) => p.getByRole("button", { name: /add category/i }).first() },
  { name: "Customers: Add customer", url: "/dashboard/customers", open: async (p) => p.getByRole("button", { name: /add customer/i }) },
  { name: "Inventory: Adjust stock", url: "/dashboard/inventory", open: async (p) => p.getByRole("button", { name: /^Adjust stock for/ }).first() },
  { name: "Team: Add member", url: "/dashboard/team", open: async (p) => p.getByRole("button", { name: "Add member" }) },
];
const CLOSERS: Record<string, (page: Page) => Promise<void>> = {
  Escape: async (p) => p.keyboard.press("Escape"),
  "X button": async (p) => p.getByRole("dialog").getByRole("button", { name: "Close" }).click(),
  Cancel: async (p) => p.getByRole("dialog").getByRole("button", { name: "Cancel" }).click(),
};

test.describe("dialogs return focus to the control that opened them", () => {
  for (const o of OPENERS) {
    for (const [how, close] of Object.entries(CLOSERS)) {
      test(`${o.name} — closed with ${how}`, async ({ browser }, info) => {
        await asUser(browser, "owner", async (page) => {
          await page.goto(o.url);
          await hydrated(page);
          const trigger = await o.open(page);
          await expect(trigger).toBeVisible();
          await trigger.focus(); // keyboard path: focus the button, press Enter
          await page.keyboard.press("Enter");
          await expect(page.getByRole("dialog")).toBeVisible();
          expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "focus moves into the dialog").toBe(true);
          await close(page);
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await expect.poll(() => isFocused(page, trigger), { message: "focus is back on the opener" }).toBe(true);
          record(info, ["DF-1"], `${o.name} closed with ${how}`, { focusReturned: true });
        });
      });
    }
  }

  test("a dialog opened from a row menu still returns focus to the menu button", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/categories");
      await hydrated(page);
      const menu = page.getByRole("button", { name: /^Actions for/ }).first();
      await menu.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "Edit" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect.poll(() => isFocused(page, menu)).toBe(true);
      record(info, ["DF-1"], "row-menu dialog (existing behaviour preserved)", { focusReturned: true });
    });
  });

  test("a confirm dialog still returns focus (existing behaviour preserved)", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/team");
      await hydrated(page);
      const menu = page.getByRole("button", { name: /^Actions for/ }).first();
      await menu.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: /Deactivate|Reactivate/ }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
      await expect.poll(() => isFocused(page, menu)).toBe(true);
      record(info, ["DF-1"], "confirm dialog cancelled", { focusReturned: true });
    });
  });
});

// ------------------------------------------------------------------------------------------------ skip link

test.describe("skip link", () => {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`merchant ${label}: first Tab shows it, Enter lands on the page content`, async ({ browser }, info) => {
      await asUser(
        browser,
        "owner",
        async (page) => {
          await page.goto("/dashboard/products");
          await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
          const link = page.getByRole("link", { name: "Skip to main content" });

          // hidden until focused: a 1px clipped box
          const hidden = await link.evaluate((el) => el.getBoundingClientRect().width);
          expect(hidden, "visually hidden while not focused").toBeLessThanOrEqual(2);

          await page.keyboard.press("Tab");
          await expect(link).toBeFocused();
          const box = await link.boundingBox();
          expect(box && box.width > 80 && box.height > 20, "visible with a real size when focused").toBe(true);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          await capture(page, info, { ac: ["SL-1"], folder: "a11y-polish", name: `skip-link-focused-${label}`, note: `Skip link shown on the first Tab (${label}).` });

          await page.keyboard.press("Enter");
          await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main");
          await page.keyboard.press("Tab");
          const inMain = await page.evaluate(() => !!document.activeElement?.closest("main"));
          expect(inMain, "next Tab goes to the first control in the page, not back to the sidebar").toBe(true);
          record(info, ["SL-1"], `skip link ${label}`, { target: "main", nextTabInsideMain: inMain });
        },
        { viewport },
      );
    });
  }

  test("Platform Admin is unchanged (no skip link)", async ({ browser }, info) => {
    await asUser(browser, "platform", async (page) => {
      await page.goto("/admin/organizations");
      await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
      expect(await page.locator('a[href="#main"]').count()).toBe(0);
      record(info, ["SL-1"], "admin has no skip link", { count: 0 });
    });
  });
});

// ------------------------------------------------------------------------------------------------ Add team member footer

test.describe("Add team member dialog footer", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`actions stay visible at 800px (${scheme}); validation and cancel unchanged`, async ({ browser }, info) => {
      await asUser(
        browser,
        "owner",
        async (page) => {
          await page.goto("/dashboard/team");
          await page.getByRole("button", { name: "Add member" }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();

          const add = dialog.getByRole("button", { name: "Add member" });
          const cancel = dialog.getByRole("button", { name: "Cancel" });
          for (const b of [add, cancel]) {
            const r = await b.evaluate((el) => { const x = el.getBoundingClientRect(); return { top: x.top, bottom: x.bottom }; });
            expect(r.bottom, "action is inside the viewport without scrolling").toBeLessThanOrEqual(800);
            expect(r.top).toBeGreaterThanOrEqual(0);
          }
          const f = await dialog.locator('[data-slot="dialog-footer"]').evaluate((el) => {
            const d = el.closest('[role="dialog"]')!;
            return { position: getComputedStyle(el).position, gap: Math.round(d.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom) };
          });
          expect(f.position).toBe("sticky");
          expect(f.gap, "footer sits flush with the dialog bottom").toBe(0);
          const ab = await add.boundingBox();
          const cb = await cancel.boundingBox();
          expect(ab!.x, "primary action is to the right of Cancel").toBeGreaterThan(cb!.x);
          await capture(page, info, { ac: ["TD-1"], folder: "dialog-polish", name: `add-member-800-${scheme}`, note: `Add team member at 800px height (${scheme}): Cancel and Add member stay pinned and visible while the fields scroll.` });

          // validation unchanged: an empty submit shows the field errors and keeps the dialog open
          await add.click();
          await expect(dialog.locator("#tm-name-msg")).not.toBeEmpty();
          await expect(dialog).toBeVisible();
          // cancellation unchanged
          await cancel.click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
          record(info, ["TD-1"], `add member footer ${scheme}`, f);
        },
        { scheme, viewport: { width: 1280, height: 800 } },
      );
    });
  }

  test("Platform Admin's Add member dialog keeps its original (non-sticky) footer", async ({ browser }, info) => {
    await asUser(browser, "platform", async (page) => {
      await page.goto("/admin/organizations");
      await page.getByRole("link", { name: /Urban Nest Trading Co/ }).first().click();
      await page.waitForURL(/\/admin\/organizations\//);
      const open = page.getByRole("button", { name: /add team member/i }).first();
      await expect(open).toBeVisible();
      await open.click();
      const footer = page.getByRole("dialog").locator('[data-slot="dialog-footer"]');
      await expect(footer).toBeVisible();
      const pos = await footer.evaluate((el) => getComputedStyle(el).position);
      expect(pos, "Admin footer is not sticky").not.toBe("sticky");
      record(info, ["TD-1"], "admin add member footer unchanged", { position: pos });
    });
  });
});
