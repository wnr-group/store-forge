import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * OBSERVATIONAL visual regression at narrower viewports, for both versions (EVIDENCE_LABEL=before against origin/main,
 * EVIDENCE_LABEL=after against the branch). It makes no claim about mobile quality: the mobile-layout and touch-target
 * findings (F7, F11) are excluded from this ticket. It only records how the same pages look before and after, so a
 * reviewer can compare. The only assertions are that each page rendered its key element.
 */
test.describe.configure({ timeout: 240_000 });
const VIEWPORTS = [
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

async function category(page: Page) {
  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: /add category/i }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#cat-name-msg")).not.toBeEmpty();
}

for (const vp of VIEWPORTS) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${LABEL}: ${vp.name}px ${scheme} merchant, admin and login`, async ({ browser }, info) => {
      const viewport = { width: vp.width, height: vp.height };
      await asUser(browser, "owner", async (page) => {
        await page.goto("/dashboard/products");
        await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
        await capture(page, info, { ac: ["VIS-1"], folder: "visual-regression", name: `${vp.name}-${scheme}-merchant-products`, note: `${LABEL}: Products page at ${vp.width}px (${scheme}). Observational only.` });
        await category(page);
        const heights = await page.evaluate(() => ({ name: document.querySelector("#cat-name")?.getBoundingClientRect().height, parent: document.querySelector("#cat-parent")?.getBoundingClientRect().height }));
        record(info, ["VIS-1"], `category dialog control heights at ${vp.name}px ${scheme}`, heights);
        await capture(page, info, { ac: ["VIS-1"], folder: "visual-regression", name: `${vp.name}-${scheme}-merchant-category-dialog`, note: `${LABEL}: Add category dialog with errors at ${vp.width}px (${scheme}).` });
      }, { scheme, viewport });

      await asUser(browser, "platform", async (page) => {
        await page.goto("/admin/organizations");
        await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
        await capture(page, info, { ac: ["VIS-1", "F4-7"], folder: "visual-regression", name: `${vp.name}-${scheme}-admin-organizations`, note: `${LABEL}: Platform Admin organizations at ${vp.width}px (${scheme}).` });
      }, { scheme, viewport });

      const context = await browser.newContext({ viewport, colorScheme: scheme });
      try {
        const page = await context.newPage();
        await page.goto("/login");
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.locator("#email-msg")).not.toBeEmpty();
        await capture(page, info, { ac: ["VIS-1", "F4-7"], folder: "visual-regression", name: `${vp.name}-${scheme}-login`, note: `${LABEL}: login with errors at ${vp.width}px (${scheme}).` });
      } finally {
        await context.close();
      }
    });
  }
}
