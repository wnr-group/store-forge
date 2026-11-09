import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { login, OWNER, publicUrl, shot } from "./helpers";

/**
 * Cutover gate end to end [AC-DB-023], in a real browser, against the ISOLATED local stack only.
 * Sequence under test: (migrations applied) -> engine reads closed -> V1 merchant saves -> re-sync dry run -> --apply --activate -> engine renders ->
 * a later V1 save + --activate closes the gate again (fail-closed) -> --apply --activate reopens it. Needs DIRECT_URL (privileged, isolated stack).
 */
test.describe.configure({ mode: "serial" });

const HOST = "127.0.0.1";
const PRODUCT = process.env.E2E_PRODUCT_SLUG ?? "premium-cotton-t-shirt";
const SUFFIX = Date.now().toString(36);
const HEADING_1 = `Gate heading ${SUFFIX}`;
const HEADING_2 = `Gate heading ${SUFFIX} v2`;

/** Runs the real operator CLI. Refuses to run against anything but the isolated stack. */
function cli(...args: string[]): { out: string; code: number } {
  const url = process.env.DIRECT_URL ?? "";
  if (!/^postgres(ql)?:\/\/[^@]*@127\.0\.0\.1:17042\//.test(url)) throw new Error("cutover-gate.spec refuses to run: DIRECT_URL is not the isolated local stack (127.0.0.1:17042).");
  try {
    const out = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/resync-legacy-templates.ts", ...args], { env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { out, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { out: `${err.stdout ?? ""}${err.stderr ?? ""}`, code: err.status ?? 1 };
  }
}
const confirm = ["--confirm-host", HOST];

const isEngine = (page: Page) => page.locator("[data-template-source]").first();
const openTemplates = async (page: Page) => {
  await page.goto("/dashboard/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
};
async function saveV1(page: Page, heading: string) {
  await login(page, OWNER);
  await openTemplates(page);
  await page.locator('[data-template-card="spotlight"]').click();
  await page.getByLabel("Hero heading").fill(heading);
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByText("Template saved")).toBeVisible();
}

test("GATE-01 the gate starts closed: the storefront is the V1 render and the product route does not exist", async ({ page }) => {
  expect(cli("--deactivate", ...confirm).out).toContain("cutover gate CLOSED");
  expect(JSON.parse(cli("--status").out.split("\n").filter((l) => l.startsWith("{")).pop()!).status).toBe("pending");

  const home = await page.goto(publicUrl);
  expect(home?.status()).toBe(200);
  await expect(page.locator("[data-template]").first()).toBeVisible();
  await expect(isEngine(page)).toHaveCount(0); // no engine marker: this is the V1 render
  await shot(page, "GATE-01a-closed-v1-storefront");

  const product = await page.goto(`${publicUrl}/products/${PRODUCT}`);
  expect(product?.status()).toBe(404);
  await shot(page, "GATE-01b-closed-product-404");
  const collection = await page.goto(`${publicUrl}/collections/any`);
  expect(collection?.status()).toBe(404);
});

test("GATE-02 a merchant saves in the V1 Templates page while the gate is closed; the storefront shows it via V1", async ({ page }) => {
  await saveV1(page, HEADING_1);
  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_1);
  await expect(isEngine(page)).toHaveCount(0);
  await shot(page, "GATE-02-v1-save-visible-via-v1");
});

test("GATE-03 dry run reports the pending store, changes nothing, and activation refuses while the engine is behind V1", async ({ page }) => {
  const dry = cli();
  expect(dry.code, dry.out).toBe(1);
  expect(dry.out).toContain('"dryRun":true');
  expect(dry.out).toMatch(/"pending":[1-9]/);
  const act = cli("--activate", ...confirm);
  expect(act.code, act.out).toBe(1);
  expect(act.out).toContain("cutover gate stays CLOSED");
  await page.goto(`${publicUrl}/products/${PRODUCT}`);
  expect(await page.title()).toBeTruthy();
  const res = await page.goto(`${publicUrl}/products/${PRODUCT}`);
  expect(res?.status(), "partial synchronization must not open the gate").toBe(404);
});

test("GATE-04 --apply --activate re-syncs, verifies every store and opens the gate; repeating it is safe", async ({ page }) => {
  const first = cli("--apply", "--activate", ...confirm);
  expect(first.code, first.out).toBe(0);
  expect(first.out).toContain("cutover gate OPEN");
  const again = cli("--apply", "--activate", ...confirm);
  expect(again.code, again.out).toBe(0);
  expect(again.out).toContain("cutover gate OPEN");

  const home = await page.goto(publicUrl);
  expect(home?.status()).toBe(200);
  await expect(isEngine(page)).toBeVisible(); // engine renders now
  await expect(page.getByText(HEADING_1).first()).toBeVisible(); // with the value the merchant saved in V1
  await shot(page, "GATE-04a-open-engine-storefront");

  const product = await page.goto(`${publicUrl}/products/${PRODUCT}`);
  expect(product?.status()).toBe(200);
  await shot(page, "GATE-04b-open-product-page");
  const missing = await page.goto(`${publicUrl}/products/no-such-product-${SUFFIX}`);
  expect(missing?.status()).toBe(404);
});

test("GATE-05 a V1 save after cutover is not shown by the engine, and the next activation CLOSES the gate until the re-sync is repeated", async ({ page }) => {
  await saveV1(page, HEADING_2);
  await page.goto(publicUrl);
  await expect(isEngine(page)).toBeVisible();
  await expect(page.getByText(HEADING_1).first()).toBeVisible(); // engine still serves the synced value: the documented V1/engine split
  await shot(page, "GATE-05a-engine-serves-synced-value");

  const act = cli("--activate", ...confirm);
  expect(act.code, act.out).toBe(1);
  expect(act.out).toContain("cutover gate stays CLOSED");
  await page.goto(publicUrl);
  await expect(isEngine(page)).toHaveCount(0); // closed again: V1 render with the newest value
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_2);
  await shot(page, "GATE-05b-closed-again-v1-newest");

  const reopen = cli("--apply", "--activate", ...confirm);
  expect(reopen.code, reopen.out).toBe(0);
  await page.goto(publicUrl);
  await expect(isEngine(page)).toBeVisible();
  await expect(page.getByText(HEADING_2).first()).toBeVisible();
  await shot(page, "GATE-05c-reopened-engine-newest");
});

test("GATE-06 deactivation closes the gate again (rollback)", async ({ page }) => {
  expect(cli("--deactivate", ...confirm).out).toContain("cutover gate CLOSED");
  await page.goto(publicUrl);
  await expect(isEngine(page)).toHaveCount(0);
  const product = await page.goto(`${publicUrl}/products/${PRODUCT}`);
  expect(product?.status()).toBe(404);
  await shot(page, "GATE-06-rolled-back-closed");
});
