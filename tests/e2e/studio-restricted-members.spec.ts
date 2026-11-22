import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot } from "./helpers";
import { asUser, type Who } from "./support/studio-session";

/**
 * AC-NAV-2 / AC-NAV-3 / AC-PERM in a real browser, for the restricted members seeded by tests/qa/seed-restricted-members.sql:
 * what each member's sidebar shows, and what a direct address does for items the sidebar hides.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const ALL = ["Overview", "Themes", "Customize", "Products", "Categories", "Collections", "Inventory", "Customers", "Analytics", "Pages", "Navigation", "Team members", "Settings"];

/** The sidebar entries each member must see (permission rules in components/dashboard/nav-config.ts). */
const EXPECTED: { who: Who; label: string; ac: string; sees: string[] }[] = [
  { who: "owner", label: "owner", ac: "AC-NAV-2", sees: ALL },
  { who: "admin", label: "manager (all write)", ac: "AC-NAV-2", sees: ALL.filter((l) => l !== "Team members") },
  { who: "designOnly", label: "design-only (settings write)", ac: "AC-NAV-3", sees: ["Overview", "Themes", "Customize", "Pages", "Navigation", "Settings"] },
  { who: "catalogOnly", label: "catalogue-only (products write)", ac: "AC-NAV-3", sees: ["Overview", "Products", "Categories", "Collections", "Inventory", "Pages", "Navigation", "Settings"] },
  { who: "readOnly", label: "read-only (everything read)", ac: "AC-NAV-2", sees: ALL.filter((l) => !["Themes", "Customize", "Team members"].includes(l)) },
  { who: "noAccess", label: "no-access (everything none)", ac: "AC-NAV-3", sees: ["Overview", "Pages", "Navigation", "Settings"] },
];
const found: Record<string, unknown>[] = [];

for (const m of EXPECTED) {
  test(`sidebar of the ${m.label} member`, async ({ browser }) => {
    await asUser(browser, m.who, async (page) => {
      await page.goto("/dashboard");
      await expect(nav(page).getByRole("link", { name: "Overview" })).toBeVisible({ timeout: 30_000 });
      const seen = (await nav(page).getByRole("link").allInnerTexts()).map((t) => t.trim()).filter((t) => ALL.includes(t));
      found.push({ who: m.who, ac: m.ac, seen });
      mkdirSync("artifacts/studio/permissions", { recursive: true });
      writeFileSync("artifacts/studio/permissions/browser-nav.json", JSON.stringify({ takenAt: new Date().toISOString(), rows: found }, null, 2));
      expect(seen.slice().sort()).toEqual(m.sees.slice().sort());
      await shot(page, `${m.ac}_${m.who}-sidebar`);
    });
  });
}

const publishButton = (page: Page) => page.getByRole("button", { name: "Publish", exact: true });
const noErrorPage = (page: Page) => expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);

test("design-only member: can customize and publish; the catalogue routes fall back to the overview without an error page", async ({ browser }) => {
  await asUser(browser, "designOnly", async (page) => {
    await page.goto("/dashboard/templates/editor");
    await expect(publishButton(page).first()).toBeEnabled({ timeout: 60_000 });
    await noErrorPage(page);
    await shot(page, "AC-PERM-1_designOnly-editor-can-publish");
    for (const path of ["/dashboard/products", "/dashboard/collections", "/dashboard/categories", "/dashboard/inventory"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await noErrorPage(page);
    }
    await shot(page, "AC-PERM-1_designOnly-catalogue-route-redirects");
  });
});

for (const who of ["catalogOnly", "readOnly"] as const) {
  test(`${who} member: Themes and the editor open read-only (nothing can be applied or published)`, async ({ browser }) => {
    await asUser(browser, who, async (page) => {
      await page.goto("/dashboard/templates");
      await expect(page.getByRole("heading", { name: "Themes" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Apply theme" })).toHaveCount(0);
      await shot(page, `AC-NAV-2_${who}-themes-read-only`);
      await page.goto("/dashboard/templates/editor");
      await expect(page.getByRole("button", { name: "Version history" })).toBeVisible({ timeout: 60_000 });
      await expect(publishButton(page)).toHaveCount(0).catch(async () => expect(publishButton(page).first()).toBeDisabled());
      await expect(page.getByRole("button", { name: "Undo (Ctrl+Z)" })).toBeDisabled();
      await shot(page, `AC-NAV-2_${who}-editor-read-only`);
    });
  });
}

test("read-only member: sees the catalogue but cannot add or import; no-access member lands on the overview", async ({ browser }) => {
  await asUser(browser, "readOnly", async (page) => {
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /add product|new product/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /import/i })).toHaveCount(0);
    await page.goto("/dashboard/products/import");
    await expect(page).toHaveURL(/\/dashboard\/products$/);
    await shot(page, "AC-PERM-1_readOnly-products-no-add-import");
  });
  await asUser(browser, "noAccess", async (page) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/dashboard$/);
    await noErrorPage(page);
    await shot(page, "AC-PERM-1_noAccess-products-redirect");
  });
});
