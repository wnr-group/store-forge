import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { asUser } from "./support/studio-session";
import { apiGet } from "./support/studio-measure";
import { applyTheme, publishFromEditor } from "./support/studio-editor";

/**
 * D-003 / AC-CFG-3 / AC-CFG-4 in a real browser: on each of the four looks, hide the header on a phone and one menu link on a
 * desktop through the editor, publish, then check the live storefront at both sizes and the saved draft.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });
const LOOKS = [["Atelier", "standard"], ["Maison", "boutique"], ["Stride", "sport"], ["Marketplace", "market"]] as const;
const rows: Record<string, unknown>[] = [];

async function draftHas(page: Page, needle: string) {
  const list = await apiGet<{ id: string; kind: string }[]>(page, "/store/templates");
  for (const t of list.filter((x) => x.kind === "group_header")) {
    if (JSON.stringify((await apiGet<{ document: unknown }>(page, `/store/templates/${t.id}`)).document).includes(needle)) return true;
  }
  return false;
}

/** Puts the "Hide on this device" switch of the selected element into the wanted state (a rerun starts from the saved draft). */
async function setHidden(page: Page, on: boolean) {
  const toggle = page.getByLabel("Hide on this device").first();
  if (((await toggle.getAttribute("aria-checked")) === "true") !== on) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", on ? "true" : "false");
}

const setDevice = (page: Page, size: "Desktop" | "Tablet" | "Mobile") => page.getByRole("group", { name: "Preview size" }).getByRole("button", { name: size, exact: true }).click();

for (const [theme, look] of LOOKS) {
  test(`${look} look (${theme}): header hidden on a phone, a menu link hidden on a desktop`, async ({ browser }) => {
    const row: Record<string, unknown> = { theme, look };
    await asUser(browser, "owner", async (page) => {
      await applyTheme(page, theme);
      await expect(page.getByRole("button", { name: "Publish" }).first()).toBeVisible({ timeout: 60_000 });

      // 1. The header section, on a phone.
      await page.getByText("Header Navigation", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Style" }).first().click();
      await setDevice(page, "Mobile");
      await setHidden(page, true);
      await expect.poll(() => draftHas(page, '"mobile":{"hidden":true}'), { timeout: 30_000 }).toBe(true);

      // 2. One menu link, on a desktop.
      await setDevice(page, "Desktop");
      await page.getByRole("tab", { name: "Content" }).first().click();
      const links = page.getByRole("button", { name: "Link", exact: true });
      await links.first().click();
      const label = (await page.getByLabel("Link Label", { exact: true }).first().inputValue()).trim();
      row.hiddenLinkLabel = label;
      await page.getByRole("tab", { name: "Style" }).first().click();
      await setHidden(page, true);
      await expect.poll(() => draftHas(page, '"base":{"hidden":true}'), { timeout: 30_000 }).toBe(true);
      row.draftPersisted = true;
      await shot(page, `AC-CFG-4_${look}_editor-hide-controls`);

      await publishFromEditor(page);
      row.published = true;

      // 3. The live storefront.
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/s/${STORE_SLUG}`);
      await expect(page.locator("body")).toBeVisible();
      await page.waitForTimeout(1500);
      row.mobileHeaderVisible = await page.locator("header").first().isVisible().catch(() => false);
      await shot(page, `AC-CFG-4_${look}_live-mobile-header-hidden`, { fullPage: false });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/s/${STORE_SLUG}`);
      await page.waitForTimeout(1500);
      row.desktopHeaderVisible = await page.locator("header").first().isVisible().catch(() => false);
      const named = page.locator("header").getByRole("link", { name: label, exact: true });
      let visibleCount = 0;
      for (let i = 0; i < (await named.count()); i++) if (await named.nth(i).isVisible()) visibleCount++;
      row.hiddenLinkVisibleOnDesktop = visibleCount;
      row.otherLinksVisibleOnDesktop = await page.locator("header nav a:visible, header a:visible").count();
      await shot(page, `AC-CFG-4_${look}_live-desktop-link-hidden`, { fullPage: false });

      expect(row.mobileHeaderVisible, "header must be hidden on a phone").toBe(false);
      expect(row.desktopHeaderVisible, "header must stay visible on a desktop").toBe(true);
      expect(visibleCount, `link "${label}" must be hidden on a desktop`).toBe(0);

      // Put the demo store back: show the link and the header again, and publish.
      await page.goto("/dashboard/templates/editor");
      await page.getByText("Header Navigation", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Style" }).first().click();
      await setDevice(page, "Mobile");
      await setHidden(page, false);
      await setDevice(page, "Desktop");
      await page.getByRole("tab", { name: "Content" }).first().click();
      await page.getByRole("button", { name: "Link", exact: true }).first().click();
      await page.getByRole("tab", { name: "Style" }).first().click();
      await setHidden(page, false);
      await expect.poll(() => draftHas(page, '"hidden":true'), { timeout: 30_000 }).toBe(false);
      await publishFromEditor(page);
    });
    rows.push(row);
    mkdirSync("artifacts/studio/inventory", { recursive: true });
    writeFileSync("artifacts/studio/inventory/visibility-live.json", JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 2));
  });
}
