import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, OWNER } from "./helpers";
import { asUser } from "./support/studio-session";

/**
 * Scope guard for the merchant dashboard styling (Studio UI enhancement).
 *
 * Inside the dashboard, inputs, native selects and the Ctrl+K trigger are 32px tall and error text is a darker red.
 * Platform Admin and the login screen must keep the global defaults (Admin's 36px select, the login form's own 36px
 * inputs, and #dc5353 errors on both). The dashboard also opens dialogs in a portal outside its page wrapper, so those
 * are checked too.
 *
 * Needs the app, the StoreForge API and a seeded demo store. E2E_DEMO_PASSWORD is required; the Platform Admin login
 * needs E2E_PLATFORM_ADMIN_EMAIL (it has no default: the demo seeder decides that address).
 *
 * The API rate-limits logins, so each account signs in once for the whole file and every test reuses that session.
 * The sign-out test runs last, with a login of its own, so it cannot end the session the others share.
 */
test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

const MERCHANT_ERROR_LIGHT = "rgb(184, 50, 50)"; // #b83232, the merchant-scoped error text
const GLOBAL_ERROR_LIGHT = "rgb(220, 83, 83)"; // #dc5353, the global --error
const GLOBAL_ERROR_DARK = "rgb(224, 82, 82)"; // #e05252, the global --error token, which still drives borders and fills in dark mode
const MERCHANT_ERROR_DARK = "rgb(228, 102, 102)"; // #e46666, the merchant-scoped dark error TEXT (4.55:1 or better on every dark surface)

const height = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().height);
const color = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);
const areaMarker = (page: Page) => page.evaluate(() => document.documentElement.dataset.area ?? null);

/** Opens "Add category" and submits it empty so the name field shows its validation error. */
async function openCategoryDialogWithError(page: Page) {
  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: /add category/i }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#cat-name-msg")).not.toBeEmpty();
}

test.describe("merchant dashboard (scoped styling applies)", () => {
  test("toolbar and header controls are 32px", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/products");

      // The wrapper is in the server-rendered HTML; the <html> marker (for portals) is set once the page hydrates.
      await expect(page.locator('div[data-area="merchant"]')).toHaveCount(1);
      await expect.poll(() => areaMarker(page)).toBe("merchant");
      expect(await height(page.getByRole("button", { name: "Search", exact: true }))).toBeCloseTo(32, 0);
      expect(await height(page.getByRole("textbox", { name: "Search by name, SKU or part number" }))).toBeCloseTo(32, 0);
      expect(await height(page.getByRole("combobox", { name: "Status" }))).toBeCloseTo(32, 0);
    });
  });

  test("dialog controls (portal) are 32px and error text is the darker red", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      await openCategoryDialogWithError(page);

      expect(await height(page.locator("#cat-name"))).toBeCloseTo(32, 0);
      expect(await height(page.locator("#cat-parent"))).toBeCloseTo(32, 0);
      expect(await color(page.locator("#cat-name-msg"))).toBe(MERCHANT_ERROR_LIGHT);
    });
  });

  test("dark mode: merchant error TEXT is the approved lighter red; the global --error token is unchanged", async ({ browser }) => {
    await asUser(
      browser,
      "owner",
      async (page) => {
        await openCategoryDialogWithError(page);
        expect(await color(page.locator("#cat-name-msg"))).toBe(MERCHANT_ERROR_DARK);
        const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--error").trim());
        expect(token.toLowerCase(), "the global --error token (borders, fills) is unchanged").toBe("#e05252");
        expect(GLOBAL_ERROR_DARK).toBe("rgb(224, 82, 82)");
      },
      { scheme: "dark" },
    );
  });
});

test.describe("Ctrl+K palette matches the sidebar", () => {
  async function paletteAndSidebar(page: Page) {
    await page.goto("/dashboard");
    const sidebar = (await page.getByRole("navigation", { name: "Main" }).getByRole("link").allInnerTexts()).map((t) => t.trim());
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog")).toBeVisible();
    const palette = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    return { sidebar, palette };
  }

  test("owner sees Team members in both", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      const { sidebar, palette } = await paletteAndSidebar(page);
      expect(palette).toContain("Team members");
      expect([...palette].sort()).toEqual([...sidebar].sort());
    });
  });

  test("staff get no Team members, and nothing the sidebar hides", async ({ browser }) => {
    await asUser(browser, "staff", async (page) => {
      const { sidebar, palette } = await paletteAndSidebar(page);
      expect(palette).not.toContain("Team members");
      expect([...palette].sort()).toEqual([...sidebar].sort());
    });
  });
});

test.describe("outside the merchant scope (global defaults are unchanged)", () => {
  test("login screen", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    const message = page.locator("#email-msg");
    await expect(message).not.toBeEmpty();

    expect(await areaMarker(page)).toBeNull();
    expect(await color(message)).toBe(GLOBAL_ERROR_LIGHT);
    // The login form sets its own h-9 on its inputs; an explicit height must still win over the scoped default.
    expect(await height(page.locator("#email"))).toBeCloseTo(36, 0);
  });

  test("platform admin keeps the 36px select, 32px search and the global error red", async ({ browser }) => {
    await asUser(browser, "platform", async (page) => {
      await page.goto("/admin/organizations");

      expect(await areaMarker(page)).toBeNull();
      expect(await height(page.getByRole("combobox", { name: "Status" }))).toBeCloseTo(36, 0);
      expect(await height(page.getByRole("textbox", { name: "Search by name or address" }))).toBeCloseTo(32, 0);

      await page.goto("/admin/organizations/new");
      await page.getByRole("button", { name: "Create organization" }).click();
      const message = page.locator("#cc-company-msg");
      await expect(message).not.toBeEmpty();
      expect(await color(message)).toBe(GLOBAL_ERROR_LIGHT);
    });
  });
});

// Last on purpose: signing out ends that login, so it gets its own rather than the session shared above.
test.describe("leaving the dashboard", () => {
  test("signing out removes the scope marker", async ({ page }) => {
    await login(page, OWNER);
    await expect.poll(() => areaMarker(page)).toBe("merchant");

    await page.getByRole("button", { name: "Account menu" }).first().click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    expect(await areaMarker(page)).toBeNull();
  });
});
