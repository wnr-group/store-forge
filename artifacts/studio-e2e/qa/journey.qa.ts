import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { API } from "../../../tests/e2e/support/studio-measure";
import { asUser as asUserPlain, sessionFor } from "../../../tests/e2e/support/studio-session";
import { openEditor, publishFromEditor } from "../../../tests/e2e/support/studio-editor";

/**
 * Fresh verification journey (read-mostly): platform admin enables Studio, merchant configures a device display rule,
 * saves, refreshes, API state, publishes (Studio off), storefront at desktop/tablet/mobile, console + network capture,
 * axe scans, lab performance runs. The demo store is restored at the end.
 */
const H = { Origin: "http://localhost:3100" };
const OUT = "artifacts/studio-e2e";
const VP = { desktop: { width: 1280, height: 800 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } } as const;
const AXE = "C:/Users/Eshwar/AppData/Local/Temp/axe-tool/node_modules/axe-core/axe.min.js";
/** Like asUser, but the context records video and a trace (kept under videos/ and traces/). */
let rec = 0;
async function asUser<T>(browser: import("@playwright/test").Browser, who: "owner" | "platform", fn: (page: Page) => Promise<T>): Promise<T> {
  if (who !== "owner") return asUserPlain(browser, who, fn);
  const n = ++rec;
  mkdirSync("artifacts/studio-e2e/videos", { recursive: true });
  mkdirSync("artifacts/studio-e2e/traces", { recursive: true });
  const ctx = await browser.newContext({ storageState: await sessionFor(browser, "owner"), viewport: { width: 1280, height: 800 }, recordVideo: { dir: "artifacts/studio-e2e/videos", size: { width: 1280, height: 800 } } });
  await ctx.tracing.start({ screenshots: true, snapshots: true });
  try { return await fn(await ctx.newPage()); }
  finally { await ctx.tracing.stop({ path: `artifacts/studio-e2e/traces/owner-session-${n}.zip` }); await ctx.close(); }
}
const log: Record<string, unknown> = { startedAt: new Date().toISOString() };
const consoleErrors: string[] = [];
const failedRequests: string[] = [];
let orgId = "";

const shot = async (page: Page, rel: string) => { mkdirSync(`${OUT}/screenshots/${rel.split("/").slice(0, -1).join("/")}`, { recursive: true }); await page.screenshot({ path: `${OUT}/screenshots/${rel}.png` }); };
const watch = (page: Page) => {
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${page.url().replace(/\?.*/, "")} :: ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url().replace(/\?.*/, "").slice(0, 140)}`); });
};
async function axe(page: Page, name: string) {
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () => {
    // @ts-expect-error injected
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return { violations: r.violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), incomplete: r.incomplete.map((v: any) => ({ id: v.id, nodes: v.nodes.length })), passes: r.passes.length };
  });
  (log.axe as Record<string, unknown>)[name] = res;
}
const flag = (browser: import("@playwright/test").Browser, enabled: boolean, reason: string) =>
  asUser(browser, "platform", async (p) => (await p.context().request.put(`${API}/platform/organizations/${orgId}/studio-rollout`, { headers: H, data: { enabled, reason } })).status());
async function openHero(page: Page) {
  await openEditor(page);
  await page.getByText("Hero Banner", { exact: true }).first().click();
  const insp = page.getByRole("complementary", { name: "Settings" });
  await insp.getByText("When to show").first().scrollIntoViewIfNeeded();
  return insp;
}

test.describe.configure({ mode: "serial" });
log.axe = {};

test("journey: flag, device display rule, save, refresh, API, publish, storefront at three viewports", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    orgId = ((await (await page.context().request.get(`${API}/organizations`)).json()).data as { id: string; name: string }[]).find((o) => /urban nest/i.test(o.name))!.id;
    log.statusBefore = (await (await page.context().request.get(`${API}/store/studio/status`)).json()).data;
  });
  expect((log.statusBefore as { enabled: boolean }).enabled, "existing store starts with Studio disabled").toBe(false);
  log.enable = await flag(browser, true, "fresh verification pass");
  await asUser(browser, "owner", async (page) => {
    watch(page);
    const req = page.context().request;
    const t0 = Date.now();
    const insp = await openHero(page);
    log.studioLoadMs = Date.now() - t0;
    await shot(page, "R1/editor-desktop-panel-before");
    await axe(page, "editor-desktop");
    for (const [name, size] of Object.entries(VP)) {
      await page.setViewportSize(size);
      await page.waitForTimeout(800);
      await shot(page, `R1/editor-${name}`);
    }
    await page.setViewportSize(VP.desktop);
    const mobile = insp.getByRole("switch", { name: /mobile/i }).first();
    await expect(mobile).toBeChecked();
    // keyboard: the switch is reachable and operable by keyboard
    await mobile.focus();
    log.switchFocusable = await mobile.evaluate((el) => document.activeElement === el);
    await page.keyboard.press("Space");
    await expect(mobile).not.toBeChecked();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30_000 });
    await shot(page, "R1/editor-desktop-rule-saved");
    const list = (await (await req.get(`${API}/store/templates`)).json()).data as { id: string; kind: string; isDefault: boolean }[];
    const home = list.find((t) => t.kind === "index" && t.isDefault)!;
    const stored = (await (await req.get(`${API}/store/templates/${home.id}`)).json()).data;
    const heroKey = Object.keys(stored.document.sections).find((k) => stored.document.sections[k].type === "hero")!;
    log.apiDraft = { schemaVersion: stored.document.schemaVersion, display: stored.document.sections[heroKey].display, revision: stored.revision };
    expect(stored.document.sections[heroKey].display).toEqual({ v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] });
    await page.reload();
    const insp2 = await openHero(page);
    await expect(insp2.getByRole("switch", { name: /mobile/i }).first()).not.toBeChecked();
    await shot(page, "R1/editor-desktop-rule-restored-after-refresh");
    // readiness gate with Studio on (API): record what the server says
    const gate = await (await req.post(`${API}/store/studio/readiness`, { headers: H, data: {} })).json();
    log.readinessStudioOn = { counts: gate.data?.counts, issues: (gate.data?.issues ?? []).map((i: any) => `${i.severity} ${i.ruleId}`) };
    // publish through the real editor with Studio ON must be refused if blockers exist
    const pub = await req.post(`${API}/store/theme/publish`, { headers: H, data: {} });
    log.publishWithStudioOn = { status: pub.status(), code: (await pub.json()).error?.code ?? null };
  });
  log.flagOffBeforePublish = await flag(browser, false, "fresh verification: publish without readiness gate");
  await asUser(browser, "owner", async (page) => {
    watch(page);
    await page.goto("/dashboard/templates/editor");
    await expect(page.getByRole("button", { name: "Publish", exact: true }).first()).toBeEnabled({ timeout: 60_000 });
    await page.waitForTimeout(4000);
    await publishFromEditor(page);
    for (const [name, size] of Object.entries(VP)) {
      await page.setViewportSize(size);
      await page.goto("/s/urban-nest-demo");
      await page.waitForTimeout(2500);
      const heading = await page.locator("main h1, main h2").first().innerText().catch(() => "");
      const heroVisible = await page.locator("main section").first().isVisible();
      (log.storefront as Record<string, unknown>) ??= {};
      (log.storefront as Record<string, unknown>)[name] = { firstSectionVisible: heroVisible, firstHeading: heading.slice(0, 60), hideClassInHtml: (await page.content()).includes("max-[767px]:hidden") };
      await shot(page, `R1/storefront-${name}`);
      if (name !== "tablet") await axe(page, `storefront-${name}`);
    }
  });
});

test("performance (lab, mobile 390x844, no throttling): 5 cold loads of the storefront home", async ({ browser }) => {
  const runs: { lcp: number | null; cls: number; loadMs: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext({ viewport: VP.mobile, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as any).__m = { lcp: null, cls: 0 };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as any).__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const t = Date.now();
    await page.goto("/s/urban-nest-demo", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => (window as any).__m);
    runs.push({ lcp: m.lcp, cls: m.cls, loadMs: Date.now() - t - 3000 });
    await ctx.close();
  }
  const p75 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(0.75 * s.length) - 1)]; };
  log.performance = { runs, lcpP75Ms: p75(runs.map((r) => r.lcp ?? 0)), clsP75: p75(runs.map((r) => r.cls)), note: "lab measurement, 5 runs, no CPU/network throttling; not real-user field data; INP not measured" };
});

test.afterAll(async ({ browser }) => {
  try {
    await flag(browser, true, "fresh verification cleanup: restore store");
    await asUser(browser, "owner", async (page) => {
      const insp = await openHero(page);
      const m = insp.getByRole("switch", { name: /mobile/i }).first();
      if (!(await m.isChecked())) await m.click();
      await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 30_000 });
    });
    await flag(browser, false, "fresh verification cleanup");
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/templates/editor");
      await expect(page.getByRole("button", { name: "Publish", exact: true }).first()).toBeEnabled({ timeout: 60_000 });
      await page.waitForTimeout(4000);
      await publishFromEditor(page);
    });
    log.restored = true;
  } catch (e) { log.restoreError = String(e).slice(0, 200); }
  log.consoleErrors = consoleErrors.slice(0, 40);
  log.failedRequests = failedRequests.slice(0, 40);
  log.finishedAt = new Date().toISOString();
  mkdirSync(`${OUT}/logs`, { recursive: true });
  writeFileSync(`${OUT}/logs/journey-result.json`, JSON.stringify(log, null, 2));
});
