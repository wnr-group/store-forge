import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";
import { asUser } from "./support/studio-session";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const between = (labels: string[], from: string, to: string) => labels.slice(labels.indexOf(from) + 1, labels.indexOf(to));

test("owner: Studio group order, Online Store keeps Pages/Navigation, Import is reachable from Products", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard");
    await expect(nav(page).getByRole("link", { name: "Themes" })).toBeVisible();
    const labels = (await nav(page).locator("p, a").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(between(labels, "Studio", "Catalog")).toEqual(["Themes", "Customize", "Products", "Categories", "Collections"]);
    expect(between(labels, "Online Store", "Workspace")).toEqual(["Pages", "Navigation"]);
    await shot(page, "AC-NAV-1_owner-sidebar");

    await nav(page).getByRole("link", { name: "Products", exact: true }).click();
    await page.getByRole("link", { name: /import/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/products\/import/);
    await expect(page.getByRole("heading", { name: "Import products" })).toBeVisible();
    await shot(page, "AC-NAV-1_import-from-products");
  });
});
