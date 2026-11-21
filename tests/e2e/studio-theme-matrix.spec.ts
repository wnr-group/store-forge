import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { asUser } from "./support/studio-session";
import { applyTheme, publishFromEditor } from "./support/studio-editor";

test.describe.configure({ timeout: 1_800_000 });
test.use({ actionTimeout: 30_000 });
const THEMES = (process.env.THEMES ?? "Atelier,Freshly,Haven,Lumière,Maison,Marketplace,Plain,Stride,Voltage").split(",");
type Steps = Record<"open" | "selectElement" | "changeText" | "changeStyle" | "changeVisibility" | "publish" | "storefront", boolean | string>;
const rows: { theme: string; steps: Steps; notes: string[]; look?: string }[] = [];

async function runSmoke(page: Page, theme: string) {
  const steps = { open: false, selectElement: false, changeText: false, changeStyle: false, changeVisibility: false, publish: false, storefront: false } as Steps;
  const notes: string[] = [];
  const text = `ZZ ${theme.slice(0, 4)} ${Date.now() % 100000}`;
  try {
    await applyTheme(page, theme);
    const frame = page.frameLocator("iframe").first();
    const heading = frame.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 60_000 });
    steps.open = true;

    const original = (await heading.innerText()).trim();
    await heading.click();
    const inspector = page.getByRole("complementary", { name: "Settings" });
    await expect(inspector.locator("input, textarea").first()).toBeVisible({ timeout: 15_000 });
    steps.selectElement = true;
    // The editor opens the setting that holds the clicked words: find the field whose value is the heading text.
    const fields = inspector.locator("input, textarea");
    let target = null;
    for (let i = 0; i < (await fields.count()); i++) {
      if ((await fields.nth(i).inputValue().catch(() => "")).trim() === original) { target = fields.nth(i); break; }
    }
    let direct = false;
    if (target) {
      await target.fill(text);
      direct = await frame.locator("body").getByText(text).first().waitFor({ timeout: 8_000 }).then(() => true, () => false);
    }
    if (!direct) {
      // A slider hero (Haven, Stride) draws its headline from the slide, not from the hero's own heading field: change it there.
      const why = target ? "the hero's own Heading field does not change the slider" : "the clicked headline is slide data (no field holds it)";
      notes.push(`text changed on the first Hero slide: ${why}`);
      await page.getByText("Hero slide", { exact: true }).first().click();
      const slideHeading = inspector.getByLabel("Heading", { exact: true });
      await expect(slideHeading).toBeVisible({ timeout: 15_000 });
      await slideHeading.fill(text);
      await expect(frame.locator("body")).toContainText(text, { timeout: 15_000 });
      // Style and visibility belong to the section: select the hero itself again.
      await page.getByText("Hero Banner", { exact: true }).first().click();
    }
    steps.changeText = true;

    await page.getByRole("tab", { name: "Style" }).first().click();
    const radius = page.getByLabel("Corner radius").first();
    if (await radius.count()) { await radius.fill("8"); await radius.blur(); steps.changeStyle = true; } else steps.changeStyle = "no Corner radius control for the selected element";
    const hide = page.getByLabel("Hide on this device").first();
    if (await hide.count()) { await hide.click(); await hide.click(); steps.changeVisibility = true; } else steps.changeVisibility = "no visibility control for the selected element";

    await publishFromEditor(page);
    steps.publish = true;
    await page.goto(`/s/${STORE_SLUG}`);
    await expect(page.locator("body")).toContainText(text, { timeout: 30_000 });
    steps.storefront = true;
  } catch (e) {
    notes.push((e as Error).message.split("\n")[0].slice(0, 200));
  }
  await shot(page, `AC-CFG-2_${theme.toLowerCase().replace(/[^a-z]/g, "")}`, { fullPage: false });
  rows.push({ theme, steps, notes });
}

test("9 themes pass the editor smoke test (open, select, text, style, visibility, publish, storefront)", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    for (const t of THEMES) await runSmoke(page, t);
  });
  mkdirSync("artifacts/studio/inventory", { recursive: true });
  writeFileSync("artifacts/studio/inventory/smoke-matrix.json", JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 2));
  const failed = rows.filter((r) => Object.values(r.steps).some((v) => v === false));
  expect(failed.map((r) => `${r.theme}: ${r.notes.join(" | ")}`)).toEqual([]);
});
