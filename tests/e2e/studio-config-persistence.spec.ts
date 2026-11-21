import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { shot, STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { publishFromEditor } from "./support/studio-editor";

/**
 * AC-CFG-3 and AC-CFG-5 in a real browser.
 *  - A text override and a mobile-hidden style override, written as a draft and published, show on the live storefront
 *    (the text override is applied by a client component, so only a browser can show it) at desktop and phone width.
 *  - Version history: restoring an older published version makes it live again; a tab that is out of date is refused.
 */
test.describe.configure({ timeout: 600_000 });
test.use({ actionTimeout: 30_000 });
const H = { Origin: "http://localhost:3100" };
type Tpl = { id: string; kind: string; isDefault: boolean };
type Detail = { id: string; revision: number; document: Record<string, unknown> & { order: string[]; sections: Record<string, { settings?: Record<string, unknown> }> } };
const log: Record<string, unknown> = {};

const req = (page: Page) => page.context().request;
const list = async (page: Page) => ((await (await req(page).get(`${API}/store/templates`)).json()) as { data: Tpl[] }).data;
const detail = async (page: Page, id: string) => ((await (await req(page).get(`${API}/store/templates/${id}`)).json()) as { data: Detail }).data;
async function save(page: Page, id: string, document: unknown, revision: number) {
  const res = await req(page).put(`${API}/store/templates/${id}/draft`, { headers: H, data: { document, expectedRevision: revision } });
  expect(res.ok(), `save draft ${res.status()} ${(await res.text()).slice(0, 160)}`).toBe(true);
  return ((await res.json()) as { data: Detail }).data;
}
/** Publish the way a merchant does: the editor's Publish button (its server action also refreshes the storefront cache). */
async function publishViaEditor(page: Page) {
  await page.goto("/dashboard/templates/editor");
  await expect(page.getByRole("button", { name: "Publish", exact: true }).first()).toBeEnabled({ timeout: 60_000 });
  // Let the editor finish loading every draft (the page and its shared header/announcement) before publishing.
  await expect(page.frameLocator("iframe").first().locator("body")).not.toBeEmpty({ timeout: 60_000 });
  await page.waitForTimeout(4_000);
  await publishFromEditor(page);
}
const liveText = async (page: Page) => {
  await page.goto(`/s/${STORE_SLUG}`);
  // The text override is applied in the browser after hydration, so read the page once it has settled.
  await page.waitForTimeout(2_000);
  return page.locator("body").innerText();
};

test("text override and mobile-hidden override persist, publish and render live", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const group = (await list(page)).find((t) => t.kind === "group_announcement")!;
    const before = await detail(page, group.id);
    const original = structuredClone(before.document);
    const key = before.document.order[0];
    const message = String((before.document.sections[key].settings as Record<string, unknown>).text);
    expect(message.length).toBeGreaterThan(3);
    const stamp = Date.now() % 100000;
    const replaced = `ZZ replaced ${stamp}`;
    try {
      const doc = structuredClone(before.document);
      doc.sections[key].settings = { ...doc.sections[key].settings, _text: [{ from: message, to: replaced }], _style: { mobile: { hidden: true } } };
      await save(page, group.id, doc, before.revision);
      await publishViaEditor(page);

      await page.setViewportSize({ width: 1280, height: 800 });
      await expect.poll(async () => { const t = await liveText(page); log.lastLiveText = t.slice(0, 120); return t.includes(replaced); }, { timeout: 30_000, intervals: [1000] }).toBe(true);
      expect(await page.locator("body").innerText()).not.toContain(message);
      await shot(page, "AC-CFG-3_live-desktop-text-override");
      log.desktopShowsReplacedText = true;

      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/s/${STORE_SLUG}`);
      await page.waitForTimeout(2000);
      await expect(page.getByText(replaced)).toBeHidden();
      await shot(page, "AC-CFG-3_live-mobile-announcement-hidden", { fullPage: false });
      log.mobileHidden = true;
    } finally {
      mkdirSync("artifacts/studio/inventory", { recursive: true });
      writeFileSync("artifacts/studio/inventory/config-persistence-text.json", JSON.stringify({ takenAt: new Date().toISOString(), ...log }, null, 2));
      const now = await detail(page, group.id);
      await save(page, group.id, original, now.revision);
      await publishViaEditor(page);
    }
    await expect.poll(async () => (await liveText(page)).includes(message), { timeout: 30_000, intervals: [1000] }).toBe(true);
    log.restored = true;
  });
});

test("version history restores an older version; an out-of-date tab is refused", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const home = (await list(page)).find((t) => t.kind === "index" && t.isDefault)!;
    const start = await detail(page, home.id);
    const original = structuredClone(start.document);
    const stamp = Date.now() % 100000;
    const withText = (text: string, d: Detail["document"]) => {
      const doc = structuredClone(d);
      doc.sections.zzrb = {
        type: "rich-text",
        settings: { alignment: "left", maxWidth: "normal", backgroundColor: "#ffffff" },
        blocks: { b0: { type: "text", settings: { content: text, alignment: "left" }, blocks: {}, block_order: [] } },
        block_order: ["b0"],
      } as never;
      if (!doc.order.includes("zzrb")) doc.order = [...doc.order, "zzrb"];
      return doc;
    };
    const A = `ZZ ROLLBACK A ${stamp}`;
    const B = `ZZ ROLLBACK B ${stamp}`;
    try {
      await save(page, home.id, withText(A, original as never), start.revision);
      await publishViaEditor(page);
      await expect.poll(async () => (await liveText(page)).includes(A), { timeout: 30_000, intervals: [1000] }).toBe(true);
      await save(page, home.id, withText(B, original as never), (await detail(page, home.id)).revision);
      await publishViaEditor(page);
      await expect.poll(async () => (await liveText(page)).includes(B), { timeout: 30_000, intervals: [1000] }).toBe(true);

      // Rollback in the editor: History > Restore on the version that carried A.
      const versions = ((await (await req(page).get(`${API}/store/templates/${home.id}/versions`)).json()) as { data: { id: string }[] }).data;
      const vA = versions[1] as { id: string; version?: number; number?: number; versionNumber?: number };
      const vn = vA.version ?? vA.number ?? vA.versionNumber;
      expect(vn, `version shape: ${JSON.stringify(vA)}`).toBeDefined();
      await page.goto("/dashboard/templates/editor");
      await page.getByRole("button", { name: "Version history" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(`Version ${vn}`, { exact: true })).toBeVisible({ timeout: 30_000 });
      await shot(page, "AC-CFG-5_history-before-restore");
      await dialog.locator(`xpath=.//*[normalize-space()='Version ${vn}']/ancestor::*[.//button[normalize-space()='Restore']][1]`).getByRole("button", { name: "Restore" }).first().click();
      const confirm = page.getByRole("alertdialog");
      if (await confirm.count()) await confirm.getByRole("button", { name: /restore/i }).last().click();
      await expect.poll(async () => { const t = await liveText(page); return t.includes(A) && !t.includes(B); }, { timeout: 40_000, intervals: [1000] }).toBe(true);
      log.rollbackVersion = vn;
      await shot(page, "AC-CFG-5_live-after-restore-shows-A");

      // Out-of-date tab: the editor was loaded, then the draft changed elsewhere; saving from the old tab is refused.
      const tab = await page.context().newPage();
      await tab.goto("/dashboard/templates/editor");
      await expect(tab.getByRole("button", { name: "Publish" }).first()).toBeVisible({ timeout: 60_000 });
      const cur = await detail(page, home.id);
      await save(page, home.id, withText(`ZZ ELSEWHERE ${stamp}`, original as never), cur.revision);
      await tab.getByRole("button", { name: "Hide Hero Banner" }).click({ force: true });
      const banner = tab.getByText(/changed|newer|out of date|conflict|reload/i).first();
      await expect(banner).toBeVisible({ timeout: 40_000 });
      log.staleMessage = (await banner.innerText()).slice(0, 200);
      await shot(tab, "AC-CFG-5_stale-tab-refused");
      await tab.close();
      const kept = JSON.stringify((await detail(page, home.id)).document);
      expect(kept, "the stale tab must not overwrite the newer draft").toContain("ZZ ELSEWHERE");
    } finally {
      const now = await detail(page, home.id);
      await save(page, home.id, original, now.revision);
      await publishViaEditor(page);
      mkdirSync("artifacts/studio/inventory", { recursive: true });
      writeFileSync("artifacts/studio/inventory/config-persistence.json", JSON.stringify({ takenAt: new Date().toISOString(), ...log }, null, 2));
    }
  });
});
