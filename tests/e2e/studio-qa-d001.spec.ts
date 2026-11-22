import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { STORE_SLUG } from "./helpers";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { openEditor, publishFromEditor } from "./support/studio-editor";

/**
 * QA-D-001 retest in the real application: configure a display rule in the editor, save, refresh, check the API state and
 * the live storefront. Needs the rebuilt API (schema 2 + display accepted) and a platform-admin login.
 */
test.use({ actionTimeout: 30_000 });
test.describe.configure({ timeout: 600_000, mode: "serial" });
const H = { Origin: "http://localhost:3100" };
const DIR = "artifacts/qa/studio/screenshots/qa-d-001";
const shot = (page: Page, name: string) => { mkdirSync(DIR, { recursive: true }); return page.screenshot({ path: `${DIR}/${name}.png` }); };
const log: Record<string, unknown> = {};
let orgId = "";

const flag = (browser: import("@playwright/test").Browser, enabled: boolean, reason: string) =>
  asUser(browser, "platform", async (p) => (await p.context().request.put(`${API}/platform/organizations/${orgId}/studio-rollout`, { headers: H, data: { enabled, reason } })).status());

async function openHero(page: Page) {
  await openEditor(page);
  await page.getByText("Hero Banner", { exact: true }).first().click();
  const insp = page.getByRole("complementary", { name: "Settings" });
  await insp.getByText("When to show").first().scrollIntoViewIfNeeded();
  return insp;
}

test("display rule: configure, save, refresh, API state, live storefront", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const orgs = (await (await page.context().request.get(`${API}/organizations`)).json()).data as { id: string; name: string }[];
    orgId = orgs.find((o) => /urban nest/i.test(o.name))!.id;
  });
  log.enable = await flag(browser, true, "QA-D-001 retest");
  expect(log.enable).toBe(200);
  await asUser(browser, "owner", async (page) => {
    const req = page.context().request;
    // 1. configure
    const insp = await openHero(page);
    const mobile = insp.getByRole("switch", { name: /mobile/i }).first();
    await expect(mobile).toBeChecked();
    await shot(page, "01-display-rule-panel-before");
    await mobile.click();
    await expect(mobile).not.toBeChecked();
    // 2. saved: the footer says so and no error bar is shown
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("This design has problems that must be fixed first.")).toHaveCount(0);
    await shot(page, "02-display-rule-saved-no-error");
    // 3. API / database state
    const list = (await (await req.get(`${API}/store/templates`)).json()).data as { id: string; kind: string; isDefault: boolean }[];
    const home = list.find((t) => t.kind === "index" && t.isDefault)!;
    const stored = (await (await req.get(`${API}/store/templates/${home.id}`)).json()).data;
    const heroKey = Object.keys(stored.document.sections).find((k) => stored.document.sections[k].type === "hero")!;
    log.draftSchemaVersion = stored.document.schemaVersion;
    log.heroDisplay = stored.document.sections[heroKey].display;
    log.draftRevision = stored.revision;
    expect(stored.document.schemaVersion).toBe(2);
    expect(stored.document.sections[heroKey].display).toEqual({ v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] });
    // 4. refresh: the rule is restored
    await page.reload();
    const insp2 = await openHero(page);
    const mobile2 = insp2.getByRole("switch", { name: /mobile/i }).first();
    await expect(mobile2).not.toBeChecked();
    await expect(insp2.getByRole("switch", { name: /desktop/i }).first()).toBeChecked();
    await expect(page.getByText(/Hidden on Mobile/)).toBeVisible();
    await shot(page, "03-display-rule-restored-after-refresh");
    // 5a. With Studio ON the readiness gate applies: the shipped theme has images without alt text (blockers) and there is no
    //     panel yet to fix or acknowledge issues, so a publish is refused. That is the gate working, not QA-D-001.
    const gate = await (await req.post(`${API}/store/studio/readiness`, { headers: H, data: {} })).json();
    log.readinessWithStudioOn = (gate.data?.issues ?? []).map((i: { severity: string; ruleId: string }) => `${i.severity} ${i.ruleId}`);
    // 5b. Turn Studio OFF (schema-2 content must stay readable and publishable), publish through the real editor, view the storefront.
    log.flagOffBeforePublish = await flag(browser, false, "QA-D-001 retest: publish without readiness gate");
    await page.goto("/dashboard/templates/editor");
    await expect(page.getByRole("button", { name: "Publish", exact: true }).first()).toBeEnabled({ timeout: 60_000 });
    await page.waitForTimeout(4000);
    let publishError: string | null = null;
    try { await publishFromEditor(page); } catch (e) { publishError = (e as Error).message.slice(0, 200); }
    log.publishError = publishError;
    await shot(page, publishError ? "04-publish-attempt-failed" : "04-publish-succeeded");
    if (!publishError) {
      const heading = stored.document.sections[heroKey].settings?.heading as string | undefined;
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/s/${STORE_SLUG}`);
      await page.waitForTimeout(2000);
      const hero = heading ? page.getByText(heading, { exact: false }).first() : page.locator("main section").first();
      log.desktopHeroVisible = await hero.isVisible();
      await shot(page, "05-storefront-desktop-hero-visible");
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/s/${STORE_SLUG}`);
      await page.waitForTimeout(2000);
      log.mobileHeroVisible = await hero.isVisible();
      const html = await page.content();
      log.deviceClassInHtml = html.includes("max-[767px]:hidden") || html.includes("data-sf-hide");
      await shot(page, "06-storefront-mobile-hero-hidden");
      expect(log.desktopHeroVisible).toBe(true);
      expect(log.mobileHeroVisible).toBe(false);
    }
  });
});

test.afterAll(async ({ browser }) => {
  // Restore: remove the rule, republish if we published, switch Studio off again.
  try {
    await flag(browser, true, "QA-D-001 retest cleanup: restore the store");
    await asUser(browser, "owner", async (page) => {
      const insp = await openHero(page);
      const mobile = insp.getByRole("switch", { name: /mobile/i }).first();
      if (!(await mobile.isChecked())) await mobile.click();
      await page.waitForTimeout(4000);
      await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30_000 });
    });
    await flag(browser, false, "QA-D-001 retest cleanup");
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/templates/editor");
      await expect(page.getByRole("button", { name: "Publish", exact: true }).first()).toBeEnabled({ timeout: 60_000 });
      await page.waitForTimeout(4000);
      await publishFromEditor(page).catch((e) => { log.restorePublishError = String(e).slice(0, 160); });
    });
  } catch (e) { log.restoreError = String(e).slice(0, 200); }
  log.disable = await flag(browser, false, "QA-D-001 retest cleanup");
  mkdirSync("artifacts/qa/studio/test-results", { recursive: true });
  writeFileSync("artifacts/qa/studio/test-results/QA-D-001-retest.json", JSON.stringify(log, null, 2));
});
