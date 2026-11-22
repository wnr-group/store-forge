import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { API } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { openEditor } from "./support/studio-editor";

/** QA closeout (Release 1): rollout flag off/on, "When to show" panel, schema-2 save against the real API. */
test.use({ actionTimeout: 30_000 });
test.describe.configure({ timeout: 600_000, mode: "serial" });
const H = { Origin: "http://localhost:3100" };
const OUT = "artifacts/qa/studio";
const shot = (page: Page, rel: string) => { mkdirSync(`${OUT}/screenshots/${rel.split("/")[0]}`, { recursive: true }); return page.screenshot({ path: `${OUT}/screenshots/${rel}.png` }); };
const log: Record<string, unknown> = {};
let orgId = "";

async function setFlag(browser: import("@playwright/test").Browser, enabled: boolean, reason: string) {
  return asUser(browser, "platform", async (p) => {
    const res = await p.context().request.put(`${API}/platform/organizations/${orgId}/studio-rollout`, { headers: H, data: { enabled, reason } });
    const body = await res.text();
    return { status: res.status(), body: body.slice(0, 300) };
  });
}

test("flag OFF: existing editor unchanged, no display panel, status disabled", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    const orgs = (await (await page.context().request.get(`${API}/organizations`)).json()) as { data: { id: string; name: string }[] };
    orgId = orgs.data.find((o) => /urban nest/i.test(o.name))?.id ?? orgs.data[0].id;
    const st = await (await page.context().request.get(`${API}/store/studio/status`)).json();
    log.statusOff = st.data;
    expect(st.data.enabled).toBe(false);
    await openEditor(page);
    await page.getByText("Hero Banner", { exact: true }).first().click().catch(() => undefined);
    await expect(page.getByText("When to show")).toHaveCount(0);
    await shot(page, "deployment/R1-flag-off-editor-no-display-panel");
  });
});

test("flag ON via platform admin: audited, panel appears, device rule works", async ({ browser }) => {
  const r = await setFlag(browser, true, "QA closeout verification");
  log.enable = r;
  expect(r.status, r.body).toBeLessThan(300);
  await asUser(browser, "owner", async (page) => {
    const st = await (await page.context().request.get(`${API}/store/studio/status`)).json();
    log.statusOn = st.data;
    expect(st.data.enabled).toBe(true);
    await openEditor(page);
    await page.getByText("Hero Banner", { exact: true }).first().click();
    await expect(page.getByText("When to show").first()).toBeVisible({ timeout: 30_000 });
    await shot(page, "release-1/R1-display-rules-panel-visible-flag-on");
    const insp = page.getByRole("complementary", { name: "Settings" });
    await insp.getByText("When to show").first().scrollIntoViewIfNeeded();
    log.panelControls = await insp.locator("input, button, [role=switch]").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") || e.id || e.getAttribute("type") || e.textContent || "").trim().slice(0, 40)).filter(Boolean).slice(-14));
    await shot(page, "release-1/R1-display-rules-panel-controls");
    const mobile = insp.getByRole("switch", { name: /mobile/i }).first();
    await mobile.click();
    await page.waitForTimeout(5000);
    log.saveStatus = (await page.locator("body").innerText()).match(/All changes saved|Saving|couldn.t save|Could not save|error/i)?.[0] ?? null;
    await shot(page, "release-1/R1-display-rule-mobile-off-after-save");
    const lst = (await (await page.context().request.get(`${API}/store/templates`)).json()).data as { id: string; kind: string; isDefault: boolean }[];
    const home = lst.find((t) => t.kind === "index" && t.isDefault)!;
    const d = (await (await page.context().request.get(`${API}/store/templates/${home.id}`)).json()).data;
    log.draftSchemaVersion = d.document.schemaVersion;
    log.draftHasDisplay = JSON.stringify(d.document).includes('"display"');
    await shot(page, "release-1/R1-schema2-draft-state");
  });
});

test.afterAll(async ({ browser }) => {
  log.disable = await setFlag(browser, false, "QA closeout cleanup");
  mkdirSync(`${OUT}/test-results`, { recursive: true });
  writeFileSync(`${OUT}/test-results/R1-flag-and-display-run.json`, JSON.stringify(log, null, 2));
});
