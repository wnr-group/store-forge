import { ACTIVE_TENANT_COOKIE } from "../../config/app";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  ANON, API, API_NOKEY, Chapters, DB_URL, ENC_KEY, PASSWORD, SUPABASE, TENANT_A, TENANT_B, USERS, VIDEO, VIEWPORT,
  api, caption, clearCaption, db, decryptMatches, fillCreds, installCaptions, keyInput, login, masked, saveButton, secretInput, snap,
  switchWorkspace, synth, token, writeJson,
} from "./support/journey";

/**
 * Razorpay tenant configuration: the complete owner journey, recorded as video, in a real browser against the real frontend,
 * API and an isolated database (sf_razorpay_e2e). One serial session of ten chapters. Synthetic credentials only. This feature
 * stores tenant credentials; it makes no outbound Razorpay call, so checkout, payment verification, webhooks and refunds are
 * NOT exercised (Scenario 12 is a documented boundary, not a test).
 */

const FULL = process.env.RZP_VIDEO_NAME ?? "razorpay-tenant-configuration-complete-demo";
test.skip(!ANON || !PASSWORD || !DB_URL || !ENC_KEY, "needs RZP_ANON, E2E_DEMO_PASSWORD, RZP_DB_URL and RZP_ENC_KEY");
test.describe.configure({ mode: "serial" });

let ctx: BrowserContext;
let page: Page;
let ch: Chapters;
const A = synth();
const A2 = synth();
const B = synth();
const results: Record<string, unknown> = {};
const heading = (p: Page) => p.getByRole("heading", { name: "Payments", exact: true });
const bodyHas = async (p: Page, s: string) => (await p.content()).includes(s) || (await p.locator("body").innerText()).includes(s);

test.beforeAll(async ({ browser }) => {
  mkdirSync(VIDEO, { recursive: true });
  ctx = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(VIDEO, "raw"), size: VIEWPORT } });
  await installCaptions(ctx);
  page = await ctx.newPage();
  ch = new Chapters();
});

test.afterAll(async () => {
  await clearCaption(page);
  const video = page.video();
  await ctx.close();
  if (video) copyFileSync(await video.path(), join(VIDEO, `${FULL}.webm`));
  ch.save(`${FULL}.chapters.json`);
});

test("T-J-01 Chapter 1: introduction, anonymous storefront and protected dashboard", async () => {
  ch.start(1, "Introduction", ["T-J-01"]);
  await page.goto("/s/e2e-store-a");
  await caption(page, "Store Forge: tenant-specific Razorpay configuration", "Each organization stores its own Razorpay API keys, encrypted. This demo configures credentials; it does not take payments.", 3200);
  await expect(page.locator("body")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/rzp_(test|live)_|key secret/i);
  await snap(page, "01-storefront-anonymous.png", "Scenario 1", "T-J-01", "The public storefront loads with no sign-in and exposes no Razorpay credentials.");
  await page.goto("/login");
  await caption(page, "Owner sign-in page", "Only signed-in organization owners can reach payment settings.", 2200);
  await snap(page, "02-login-page.png", "Scenario 1", "T-J-01", "The login page.");
  await page.goto("/dashboard/payments");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fpayments/);
  expect(await bodyHas(page, "Razorpay credentials")).toBe(false);
  await caption(page, "Without signing in, /dashboard/payments redirects to login", "Nothing about payment settings is shown to an anonymous visitor.", 2600);
  await snap(page, "02b-protected-redirect.png", "Scenario 2", "T-J-01", "Anonymous request to /dashboard/payments is redirected to /login with no protected content.");
});

test("T-J-02 Chapters 2-3: owner login and the Razorpay settings page", async () => {
  ch.start(2, "Owner login", ["T-J-02"]);
  await caption(page, "Signing in as the organization owner", "A disposable test owner for E2E Organization A.", 1400);
  await login(page, USERS.owner);
  await caption(page, "Signed in: the owner dashboard", undefined, 1800);
  await snap(page, "03-owner-dashboard.png", "Scenario 3", "T-J-02", "Owner dashboard after login (E2E Organization A).");
  await snap(page, "10-organization-a-selected.png", "Scenario 4", "T-J-02", "Organization A is the active workspace (switcher shows E2E Organization A).");
  ch.start(3, "Navigate to Razorpay settings", ["T-J-02"]);
  await caption(page, "Open Payments from the dashboard navigation", undefined, 1200);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page).toHaveURL(/\/dashboard\/payments$/);
  await expect(heading(page)).toBeVisible();
  await expect(page.getByText("Razorpay keys for E2E Organization A.")).toBeVisible();
  await snap(page, "04-payment-settings.png", "Scenario 5", "T-J-02", "Payments settings page for Organization A.");
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await expect(secretInput(page)).toHaveAttribute("type", "password");
  await caption(page, "Existing state: Not configured", "Key ID and Key Secret are empty. The secret field is a password input.", 2400);
  await snap(page, "05-razorpay-config-empty.png", "Scenario 5", "T-J-02", "Razorpay configuration form in the Not configured state.");
});

test("T-J-03 Chapter 4: configure Razorpay TEST credentials", async () => {
  ch.start(4, "Configure Razorpay TEST credentials", ["T-J-03"]);
  await caption(page, "Where do the keys come from?", "Razorpay Dashboard > Account & Settings > API Keys, in TEST mode. This demo uses synthetic values.", 3600);
  await caption(page, "Enter the Key ID", "rzp_test_ followed by letters and numbers.", 800);
  await keyInput(page).pressSequentially(A.keyId, { delay: 45 });
  await snap(page, "06-test-key-id-entered.png", "Scenario 5", "T-J-03", "A synthetic TEST Key ID entered; the secret is still empty.");
  await caption(page, "Enter the Key Secret", "It is typed into a masked field and is never shown again after saving.", 800);
  await secretInput(page).pressSequentially(A.secret, { delay: 35 });
  await expect(secretInput(page)).toHaveAttribute("type", "password");
  await snap(page, "07-test-secret-entered-masked.png", "Scenario 5", "T-J-03", "The synthetic Key Secret is entered and displays only as masked dots.");
  await caption(page, "Save credentials", "The browser sends the secret to the server once; the server encrypts it.", 700);
  await saveButton(page, "Save credentials").click();
  await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
  await expect(page.getByText(masked(A.keyId))).toBeVisible();
  await expect(secretInput(page)).toHaveValue("");
  await caption(page, "Saved: Configured, with the Key ID masked", "The secret field is cleared and the secret is not displayed anywhere.", 2600);
  await snap(page, "08-configuration-saved.png", "Scenario 5", "T-J-03", "Success state: Configured (saved), masked Key ID, secret field cleared.");
});

test("T-J-04 Chapter 5: persistence, masked display and safe update", async () => {
  ch.start(5, "Verify saved configuration", ["T-J-04"]);
  await caption(page, "Refresh the browser", "The configuration persists; the secret is never pre-filled.", 1200);
  await page.reload();
  await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
  await expect(page.getByText(masked(A.keyId))).toBeVisible();
  await expect(secretInput(page)).toHaveValue("");
  await expect(page.getByText("Secret saved, enter a new value to replace it")).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(A.keyId);
  expect(await bodyHas(page, A.secret)).toBe(false);
  await caption(page, "After refresh: same state, secret still hidden", undefined, 2200);
  await snap(page, "09-configuration-persisted-after-refresh.png", "Scenario 5", "T-J-04", "After a browser refresh the configuration persists, Key ID is masked and the secret is empty.");

  const sql = db();
  const before = (await sql`select * from tenant_razorpay_config where tenant_id = ${TENANT_A}`)[0];
  await caption(page, "Update: enter a new Key ID and Key Secret", "Replace credentials overwrites the stored pair.", 1800);
  await fillCreds(page, A2.keyId, A2.secret);
  await saveButton(page, "Replace credentials").click();
  await expect(page.getByText(masked(A2.keyId))).toBeVisible();
  await expect(page.getByText(masked(A.keyId))).toHaveCount(0);
  await caption(page, "Updated: the new Key ID is shown masked", "The old secret cannot be retrieved from any page or API response.", 2400);
  const after = (await sql`select * from tenant_razorpay_config where tenant_id = ${TENANT_A}`)[0];
  expect(after.iv).not.toBe(before.iv);
  expect(after.secret_ciphertext).not.toBe(before.secret_ciphertext);
  const got = await api(API, USERS.owner, "GET", TENANT_A);
  expect(got.status).toBe(200);
  expect(got.text).not.toContain(A.secret);
  expect(got.text).not.toContain(A2.secret);
  expect(Object.keys(got.json.data ?? {})).not.toEqual(expect.arrayContaining(["keySecret"]));
  results.update = { ivChanged: true, ciphertextChanged: true, oldSecretInApi: false, newSecretInApi: false, apiFields: Object.keys(got.json.data ?? {}) };
  await sql.end();
});

test("T-J-05 Chapter 6: multi-tenant configuration and isolation", async () => {
  ch.start(6, "Multi-tenant configuration", ["T-J-05"]);
  await caption(page, "The same owner also belongs to Organization B (as an Admin)", "Switching workspace changes the active organization.", 2200);
  await switchWorkspace(page, "E2E Organization B");
  await caption(page, "Organization B is now active", "As Admin, this person cannot manage payments: owners only.", 2200);
  await expect(page.locator('a[href="/dashboard/payments"]')).toHaveCount(0);
  await snap(page, "11-organization-b-selected.png", "Scenario 4", "T-J-05", "Switching to Organization B changes the active context; Payments navigation is absent for the Admin role.");
  await page.goto("/dashboard/payments");
  await expect(page).not.toHaveURL(/\/dashboard\/payments$/);
  await switchWorkspace(page, "E2E Organization A");

  await caption(page, "Organization B's own owner configures B independently", "Signing out and signing in as B's owner.", 2200);
  await ctx.clearCookies();
  await login(page, USERS.ownerB);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page.getByText("Razorpay keys for E2E Organization B.")).toBeVisible();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await fillCreds(page, B.keyId, B.secret);
  await saveButton(page, "Save credentials").click();
  await expect(page.getByText(masked(B.keyId))).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(masked(A2.keyId));
  await caption(page, "Organization B configured: its own Key ID", "Organization A's key is not visible here.", 2400);
  await snap(page, "13-tenant-b-configuration.png", "Scenario 7", "T-J-05", "Organization B's configuration (B's masked Key ID only).");

  await caption(page, "Back to Organization A's owner", "A's configuration is unchanged and separate.", 1800);
  await ctx.clearCookies();
  await login(page, USERS.owner);
  await page.locator('a[href="/dashboard/payments"]').first().click();
  await expect(page.getByText(masked(A2.keyId))).toBeVisible();
  await expect(page.getByText(masked(B.keyId))).toHaveCount(0);
  await snap(page, "12-tenant-a-configuration.png", "Scenario 7", "T-J-05", "Organization A's configuration remains its own (A's masked Key ID, nothing from B).");

  const sql = db();
  const rows = await sql`select tenant_id, key_id, secret_ciphertext, iv, auth_tag, key_version from tenant_razorpay_config order by tenant_id`;
  const a = rows.find((r) => r.tenant_id === TENANT_A)!;
  const b = rows.find((r) => r.tenant_id === TENANT_B)!;
  results.isolation = {
    rows: rows.length, aTenant: a.tenant_id, bTenant: b.tenant_id,
    differentCiphertext: a.secret_ciphertext !== b.secret_ciphertext, differentIv: a.iv !== b.iv,
    aKeyMatchesA: a.key_id === A2.keyId, bKeyMatchesB: b.key_id === B.keyId,
  };
  expect(rows).toHaveLength(2);
  expect(a.key_id).toBe(A2.keyId);
  expect(b.key_id).toBe(B.keyId);
  writeJson("database/tenant-isolation-results.json", { checkedAt: new Date().toISOString(), database: "sf_razorpay_e2e", ...(results.isolation as object) });
  await sql.end();
});

test("T-J-06 Chapter 7: security, encryption at rest and authorization", async () => {
  ch.start(7, "Security demonstration", ["T-J-06"]);
  const sql = db();
  const rows = await sql`select tenant_id, key_id, secret_ciphertext, iv, auth_tag, key_version from tenant_razorpay_config order by tenant_id`;
  const a = rows.find((r) => r.tenant_id === TENANT_A)!;
  const b = rows.find((r) => r.tenant_id === TENANT_B)!;
  const checks = rows.map((r) => ({
    tenant: r.tenant_id === TENANT_A ? "A" : "B",
    keyVersion: r.key_version,
    ivBytes: Buffer.from(r.iv, "base64").length,
    authTagBytes: Buffer.from(r.auth_tag, "base64").length,
    ciphertextBytes: Buffer.from(r.secret_ciphertext, "base64").length,
    plaintextInCiphertext: [A.secret, A2.secret, B.secret].some((s) => r.secret_ciphertext.includes(s) || Buffer.from(r.secret_ciphertext, "base64").toString("utf8").includes(s)),
    decryptsWithOwnTenantAad: decryptMatches(r, r.tenant_id, r.tenant_id === TENANT_A ? A2.secret : B.secret),
    decryptsWithOtherTenantAad: decryptMatches(r, r.tenant_id === TENANT_A ? TENANT_B : TENANT_A, r.tenant_id === TENANT_A ? A2.secret : B.secret),
  }));
  for (const c of checks) {
    expect(c.ivBytes).toBe(12);
    expect(c.authTagBytes).toBe(16);
    expect(c.plaintextInCiphertext).toBe(false);
    expect(c.decryptsWithOwnTenantAad).toBe(true);
    expect(c.decryptsWithOtherTenantAad).toBe(false);
  }
  expect(a.iv).not.toBe(b.iv);
  const colInfo = await sql`select column_name from information_schema.columns where table_name = 'tenant_razorpay_config' order by ordinal_position`;
  const encryption = { checkedAt: new Date().toISOString(), database: "sf_razorpay_e2e", algorithm: "AES-256-GCM", columns: colInfo.map((c) => c.column_name), checks, secretsPrinted: false };
  writeJson("database/encryption-at-rest-results.json", encryption);
  writeJson("api-evidence/encryption-verification.json", encryption);
  await sql.end();

  // Evidence view: the real query results rendered in the browser (no secret material, ciphertext abbreviated).
  const ev = await ctx.newPage();
  const tr = checks.map((c) => `<tr><td>${c.tenant}</td><td>${c.keyVersion}</td><td>${c.ivBytes}</td><td>${c.authTagBytes}</td><td>${c.ciphertextBytes}</td><td>${c.plaintextInCiphertext ? "FOUND" : "none"}</td><td>${c.decryptsWithOwnTenantAad ? "yes" : "NO"}</td><td>${c.decryptsWithOtherTenantAad ? "YES (bad)" : "rejected"}</td></tr>`).join("");
  await ev.setContent(`<body style="font:20px system-ui;padding:40px;background:#0b1220;color:#e2e8f0"><h1>Database evidence: tenant_razorpay_config (isolated QA database sf_razorpay_e2e)</h1><p>Rendered from a live SQL query. Algorithm AES-256-GCM. Secret values are not shown.</p><table border="1" cellpadding="10" style="border-collapse:collapse;font-size:20px"><tr><th>Tenant</th><th>Key version</th><th>IV bytes</th><th>Auth tag bytes</th><th>Ciphertext bytes</th><th>Plaintext secret in column</th><th>Decrypts with own tenant AAD</th><th>Decrypts with other tenant AAD</th></tr>${tr}</table><p>Columns: ${encryption.columns.join(", ")}</p></body>`);
  await caption(ev, "Encrypted at rest: AES-256-GCM, 12-byte IV, 16-byte tag", "Decryption works only with the owning tenant's AAD; another tenant's AAD is rejected.", 4200);
  await snap(ev, "18-database-encryption-verification.png", "Scenario 9", "T-J-06", "Rendered result of a live SQL check of tenant_razorpay_config: encrypted, tenant-bound, no plaintext. Evidence view, not application UI.");
  await ev.close();

  // Authorization matrix against the real API (approved AC-PERM-05 contract is still pending: observed values are recorded).
  const tOwnerB = await token(USERS.ownerB);
  const m = {
    anonymous: await api(API, null, "GET", TENANT_A),
    ownerMember: await api(API, USERS.owner, "GET", TENANT_A),
    staffMember: await api(API, USERS.staff, "GET", TENANT_A),
    adminOfB: await api(API, USERS.owner, "GET", TENANT_B),
    nonMember: await api(API, USERS.outsider, "GET", TENANT_A),
    platformAdmin: await api(API, USERS.platform, "GET", TENANT_A),
    forgedOrgHeader: await api(API, USERS.ownerB, "GET", TENANT_A),
    forgedOrgHeaderWrite: await api(API, USERS.ownerB, "PUT", TENANT_A, { keyId: B.keyId, keySecret: B.secret }),
    missingOrgHeader: await api(API, USERS.owner, "GET", null),
  };
  void tOwnerB;
  expect(m.anonymous.status).toBe(401);
  expect(m.ownerMember.status).toBe(200);
  expect(m.staffMember.status).toBe(403);
  expect(m.adminOfB.status).toBe(403);
  expect(m.forgedOrgHeader.status).toBe(403);
  expect(m.forgedOrgHeaderWrite.status).toBe(403);
  expect(m.missingOrgHeader.status).toBe(400);
  for (const k of ["nonMember", "platformAdmin"] as const) expect([403, 404]).toContain(m[k].status); // AC-PERM-05: contract pending
  const leak = Object.values(m).filter((r) => [A.secret, A2.secret, B.secret, A2.keyId].some((s) => r.text.includes(s) && r !== m.ownerMember));
  expect(leak).toHaveLength(0);
  expect(m.ownerMember.text).not.toContain(A2.secret);
  writeJson("api-evidence/authorization-results.json", {
    checkedAt: new Date().toISOString(), api: API,
    note: "AC-PERM-05: non-member and platform-admin denial is observed as 404 NO_WORKSPACE; the Product Owner decision between 404 and 403 is pending.",
    results: Object.fromEntries(Object.entries(m).map(([k, r]) => [k, { status: r.status, code: r.json.error?.code ?? null }])),
  });
  await caption(page, "Server-side access control", "Anonymous: 401. Staff and other-tenant requests: 403. Forged organization header: 403. No response contains a secret.", 4200);
});

test("T-J-07 Chapter 8: error handling and rejected access", async () => {
  ch.start(8, "Error handling", ["T-J-07"]);
  await page.goto("/dashboard/payments");
  await caption(page, "Invalid input is rejected with a clear message", "A malformed Key ID and a too-short secret.", 1600);
  await fillCreds(page, "bad-key-id", "short");
  await saveButton(page, "Replace credentials").click();
  await expect(page.getByText("Enter a valid Razorpay Key ID, like rzp_test_ or rzp_live_ followed by at least 8 letters or numbers.")).toBeVisible();
  await caption(page, "Validation error shown next to the field", undefined, 2200);
  await snap(page, "16-validation-error.png", "Scenario 10", "T-J-07", "Invalid Key ID shows an inline, understandable error; nothing is saved.");
  await keyInput(page).fill(synth().keyId);
  await secretInput(page).fill("");
  await saveButton(page, "Replace credentials").click();
  await expect(page.locator("#pay-key-secret[aria-invalid='true']")).toBeVisible();

  await caption(page, "If the API is unreachable, the page shows a safe message", "No technical detail or secret is revealed.", 1600);
  const s = synth();
  await fillCreds(page, s.keyId, s.secret);
  await page.route("**/dashboard/payments", (r) => (r.request().method() === "POST" ? r.abort("failed") : r.continue()));
  await saveButton(page, "Replace credentials").click();
  const alert = page.getByRole("alert").filter({ hasText: "Something went wrong" });
  await expect(alert).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(s.secret); // visible text; the user's own input still holds what they typed
  await snap(page, "17-api-error-handling.png", "Scenario 10", "T-J-07", "A failed save request shows a generic, safe error; the input is kept and no secret is exposed.");
  await page.unroute("**/dashboard/payments");
  await page.reload();

  // Database unavailable: the app role cannot log in and its sessions are terminated repeatedly while the save is attempted, then restored.
  const admin = db();
  await caption(page, "If the database is unavailable, the save fails safely", "Simulated by temporarily disabling the API's database login.", 1800);
  const rowBefore = (await admin`select md5(secret_ciphertext) as h from tenant_razorpay_config where tenant_id = ${TENANT_A}`)[0].h;
  await fillCreds(page, s.keyId, s.secret);
  let killer: NodeJS.Timeout | undefined;
  try {
    await admin.unsafe("alter role sf_e2e_app nologin");
    const kill = () => admin.unsafe("select pg_terminate_backend(pid) from pg_stat_activity where usename = 'sf_e2e_app'").catch(() => undefined);
    await kill();
    killer = setInterval(kill, 100);
    await saveButton(page, "Replace credentials").click();
    const failure = page.getByRole("alert").filter({ hasText: /\S/ });
    await expect(failure.first()).toBeVisible({ timeout: 45_000 });
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/postgres|ECONN|sf_e2e_app|password authentication|at \w+\.\w+ \(/i);
    expect(text).not.toContain(s.secret);
    await snap(page, "17b-database-unavailable.png", "Scenario 10", "T-J-07", "With the database unavailable, a save shows a safe message with no internal detail.");
    results.dbUnavailable = { alertShown: true, alertText: (await failure.first().innerText()).slice(0, 120), internalDetailLeaked: false };
  } finally {
    if (killer) clearInterval(killer);
    await admin.unsafe("alter role sf_e2e_app login");
  }
  await page.waitForTimeout(1500);
  const rowAfterOutage = (await admin`select md5(secret_ciphertext) as h from tenant_razorpay_config where tenant_id = ${TENANT_A}`)[0].h;
  expect(rowAfterOutage).toBe(rowBefore); // nothing was written while the database was unavailable
  await admin.end();
  await page.reload();
  await expect(page.getByText(masked(A2.keyId))).toBeVisible({ timeout: 30_000 });

  // Missing encryption key: a second API instance without the key answers 503 and writes nothing.
  const before = await db().unsafe("select secret_ciphertext from tenant_razorpay_config where tenant_id = $1", [TENANT_A]);
  const nk = await api(API_NOKEY, USERS.owner, "PUT", TENANT_A, { keyId: s.keyId, keySecret: s.secret });
  const afterRows = await db().unsafe("select secret_ciphertext from tenant_razorpay_config where tenant_id = $1", [TENANT_A]);
  expect(nk.status).toBe(503);
  expect(nk.json.error?.code).toBe("PAYMENTS_UNAVAILABLE");
  expect(nk.text).not.toContain(s.secret);
  expect(afterRows[0].secret_ciphertext).toBe(before[0].secret_ciphertext);
  results.missingKey = { status: nk.status, code: nk.json.error?.code, rowUnchanged: true };

  // Cross-tenant: B's owner with a forged active-tenant cookie for A sees only B's data.
  await caption(page, "Cross-tenant attempt: B's owner forges Organization A", "The forged request is rejected; B's owner still sees only B.", 2000);
  const ctxB = await page.context().browser()!.newContext({ viewport: VIEWPORT });
  const pb = await ctxB.newPage();
  await login(pb, USERS.ownerB);
  await ctxB.addCookies([{ name: ACTIVE_TENANT_COOKIE, value: TENANT_A, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3500" }]);
  await pb.goto("/dashboard/payments");
  await expect(pb.getByText("Razorpay keys for E2E Organization B.")).toBeVisible();
  expect(await bodyHas(pb, A2.keyId.slice(-6))).toBe(false);
  await snap(pb, "14-cross-tenant-access-rejected.png", "Scenario 7", "T-J-07", "With a forged active-tenant cookie for Organization A, B's owner is still served only Organization B; A's data is absent. The API also answers 403 (see authorization-results.json).");
  await ctxB.close();

  // Unauthorized: a Staff member of A cannot open payments.
  const ctxS = await page.context().browser()!.newContext({ viewport: VIEWPORT });
  const ps = await ctxS.newPage();
  await login(ps, USERS.staff);
  await expect(ps.locator('a[href="/dashboard/payments"]')).toHaveCount(0);
  await ps.goto("/dashboard/payments");
  await expect(ps).toHaveURL(/\/dashboard$/);
  expect(await bodyHas(ps, "Razorpay credentials")).toBe(false);
  await snap(ps, "15-unauthorized-access-rejected.png", "Scenario 8", "T-J-07", "A Staff member has no Payments navigation and the direct URL redirects to the dashboard.");
  await ctxS.close();
});

test("T-J-08 Chapter 8b: browser regression (refresh, navigation, session expiry, catalog, team)", async () => {
  await caption(page, "Regression checks: navigation, catalog and team still work", undefined, 1400);
  await page.goto("/dashboard/products");
  await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
  await page.goto("/dashboard/team");
  await expect(page.getByRole("heading", { name: "Team members", exact: true })).toBeVisible();
  await page.goto("/dashboard/payments");
  await expect(page.getByText(masked(A2.keyId))).toBeVisible();
  await caption(page, "Session expiry: cookies are cleared", "The next request goes to login.", 1400);
  await ctx.clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await snap(page, "11b-session-expired.png", "Scenario 11", "T-J-08", "After the session cookies are removed, the payments page redirects to login.");
  await login(page, USERS.owner);
});

test("T-J-09 Chapters 9-10: payment boundary and final summary", async () => {
  ch.start(9, "Payment integration boundary", ["T-J-09"]);
  await page.goto("/dashboard/payments");
  await caption(page, "Boundary: this feature only stores credentials", "Checkout, payment verification, webhooks, refunds and settlement are separate, not yet implemented. No payment is made in this demo.", 5200);
  ch.start(10, "Final summary", ["T-J-09"]);
  await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
  await caption(page, "Summary", "Per-organization credentials  |  AES-256-GCM at rest, tenant-bound  |  secrets never returned to the browser  |  owners only  |  A and B isolated", 5200);
  await snap(page, "19-final-configuration-state.png", "Scenario 5", "T-J-09", "Final state: Organization A configured and saved, secret hidden.");
  writeJson("api-evidence/migration-results.json", { note: "see database/ and audit migration-compatibility-report.md; isolated DB clone of the migrated QA schema", migrationRows: (await (async () => { const s = db(); const r = await s`select count(*)::int as n from drizzle.__drizzle_migrations`; await s.end(); return r[0].n; })()) });
  writeJson("api-evidence/journey-extra-results.json", { checkedAt: new Date().toISOString(), ...results });
  void SUPABASE;
});
