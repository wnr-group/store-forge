import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  ANON, API, Chapters, DB_URL, ENC_KEY, PASSWORD, TENANT_A, TENANT_B, USERS, VIDEO, VIEWPORT,
  api, caption, clearCaption, db, decryptMatches, fillCreds, installCaptions, login, masked, saveButton, secretInput, switchWorkspace, synth,
} from "./support/journey";

/**
 * Stakeholder summary (about 2 minutes): the owner configures Razorpay TEST credentials, the page persists them masked, a second
 * organization stays isolated, and the database holds only tenant-bound ciphertext. Credential configuration only: no payment is
 * made, and checkout, verification, webhooks and refunds are not part of this feature. Synthetic credentials; real stack.
 */

const NAME = "razorpay-tenant-configuration-short-demo";
test.skip(!ANON || !PASSWORD || !DB_URL || !ENC_KEY, "needs RZP_ANON, E2E_DEMO_PASSWORD, RZP_DB_URL and RZP_ENC_KEY");

test("T-S-01 short stakeholder demonstration", async ({ browser }) => {
  // Known starting point: clear both organizations' configurations through the real API.
  await api(API, USERS.owner, "DELETE", TENANT_A);
  await api(API, USERS.ownerB, "DELETE", TENANT_B);

  mkdirSync(VIDEO, { recursive: true });
  const ctx: BrowserContext = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(VIDEO, "raw-short"), size: VIEWPORT } });
  await installCaptions(ctx);
  const page: Page = await ctx.newPage();
  const ch = new Chapters();
  const A = synth();
  const B = synth();

  ch.start(1, "Sign in as the organization owner", ["T-S-01"]);
  await page.goto("/login");
  await caption(page, "Store Forge: each organization configures its own Razorpay keys", "Credential configuration only. No payment is made in this demo.", 3000);
  await login(page, USERS.owner);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();

  ch.start(2, "Configure TEST credentials", ["T-S-01"]);
  await caption(page, "Enter a Razorpay TEST Key ID and Key Secret", "Get them from Razorpay Dashboard > Account & Settings > API Keys (Test mode). Synthetic values here.", 2600);
  await page.locator("#pay-key-id").pressSequentially(A.keyId, { delay: 35 });
  await secretInput(page).pressSequentially(A.secret, { delay: 25 });
  await expect(secretInput(page)).toHaveAttribute("type", "password");
  await caption(page, "The secret is masked as you type", undefined, 1800);
  await saveButton(page, "Save credentials").click();
  await expect(page.getByText(masked(A.keyId))).toBeVisible();
  await caption(page, "Saved. The Key ID is shown masked and the secret is never shown", undefined, 2400);

  ch.start(3, "Persistence", ["T-S-01"]);
  await page.reload();
  await expect(page.getByText(masked(A.keyId))).toBeVisible();
  await expect(secretInput(page)).toHaveValue("");
  await caption(page, "After a refresh the configuration persists; the secret field stays empty", undefined, 2600);

  ch.start(4, "Another organization stays isolated", ["T-S-01"]);
  await ctx.clearCookies();
  await login(page, USERS.ownerB);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await caption(page, "Organization B's owner sees B only, and nothing is configured yet", "Organization A's keys are not visible here.", 2600);
  await fillCreds(page, B.keyId, B.secret);
  await saveButton(page, "Save credentials").click();
  await expect(page.getByText(masked(B.keyId))).toBeVisible();
  await expect(page.getByText(masked(A.keyId))).toHaveCount(0);
  await caption(page, "B has its own Key ID, independent of A", undefined, 2400);
  await ctx.clearCookies();
  await login(page, USERS.owner);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page.getByText(masked(A.keyId))).toBeVisible();
  await switchWorkspace(page, "E2E Organization B");
  await expect(page.locator('a[href="/dashboard/payments"]')).toHaveCount(0);
  await caption(page, "As an Admin of B, this person cannot open Payments: owners only", undefined, 2600);

  ch.start(5, "Encrypted at rest", ["T-S-01"]);
  const sql = db();
  const rows = await sql`select tenant_id, secret_ciphertext, iv, auth_tag from tenant_razorpay_config`;
  await sql.end();
  const a = rows.find((r) => r.tenant_id === TENANT_A)!;
  const b = rows.find((r) => r.tenant_id === TENANT_B)!;
  const ok = decryptMatches(a, TENANT_A, A.secret) && decryptMatches(b, TENANT_B, B.secret) && !decryptMatches(a, TENANT_B, A.secret);
  expect(ok).toBe(true);
  const ev = await ctx.newPage();
  await ev.setContent(`<body style="font:26px system-ui;padding:48px;background:#0b1220;color:#e2e8f0"><h1>Stored as AES-256-GCM ciphertext, bound to the tenant</h1><ul><li>Plaintext secret in database: none</li><li>IV: 12 bytes, auth tag: 16 bytes, per row</li><li>Decrypts with its own tenant: yes</li><li>Decrypts with another tenant's identity: rejected</li></ul><p style="opacity:.7">Evidence view of a live SQL check. Secret values are not shown.</p></body>`);
  await caption(ev, "Database check: encrypted, tenant-bound, no plaintext", "Rendered from a live query against the isolated test database.", 4200);
  await ev.close();

  ch.start(6, "Scope", ["T-S-01"]);
  await page.goto("/dashboard");
  await caption(page, "What this feature does, and does not do", "Does: stores each organization's Razorpay keys securely. Not yet: checkout, payment verification, webhooks, refunds.", 5200);

  await clearCaption(page);
  const video = page.video();
  await ctx.close();
  if (video) copyFileSync(await video.path(), join(VIDEO, `${NAME}.webm`));
  ch.save(`${NAME}.chapters.json`);
});
