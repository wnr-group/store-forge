import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ACTIVE_TENANT_COOKIE } from "../../config/app";
import { MANAGER, OWNER, STAFF, login } from "./helpers";
import { record, shoot } from "./support/payments-evidence";

/**
 * Razorpay credentials, in a REAL browser against the REAL running frontend, API and Supabase. Nothing is mocked in the acceptance
 * journey: the only network interception either delays a real request and lets it continue (the saving state) or aborts one to
 * show how the page copes with a failure. Synthetic credentials only; nothing is ever sent to Razorpay (the application makes no
 * outbound Razorpay call).
 *
 * Environment (all required): E2E_BASE_URL, E2E_DEMO_PASSWORD, QA_REAL_API (API base URL with prefix), QA_REAL_SUPABASE_URL,
 * QA_REAL_ANON_KEY, QA_SYNTH_SECRET. Two passes: `main` (the API has its encryption key) and `keyless` (the API was restarted
 * WITHOUT the key; E2E_PAYMENTS_PASS=keyless runs only the key-failure test).
 */

const PASS = process.env.E2E_PAYMENTS_PASS ?? "main";
const API = process.env.QA_REAL_API ?? "http://127.0.0.1:4400/api/v1";
const SUPABASE = process.env.QA_REAL_SUPABASE_URL ?? "";
const ANON = process.env.QA_REAL_ANON_KEY ?? "";
const SECRET = process.env.QA_SYNTH_SECRET ?? `SYNTH${randomBytes(10).toString("hex")}`;
const PLATFORM = "platform@demo.test";
const OWNER_B = "ownerb@demo.test";
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "";
const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";
const UNAVAILABLE = "Payment settings are temporarily unavailable. Please contact support.";

const hex = (n: number) => randomBytes(n).toString("hex");
const testKeyId = () => `rzp_test_${hex(6)}`;
const liveKeyId = () => `rzp_live_${hex(6)}`;
const masked = (id: string) => `${id.slice(0, 9)}••••${id.slice(-4)}`;

// ---- direct API helpers (test oracle and setup only; the journey itself drives the browser) -----------------------------

async function token(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return ((await res.json()) as { access_token: string }).access_token;
}
async function tenantOf(t: string): Promise<string> {
  const res = await fetch(`${API}/organizations`, { headers: { Authorization: `Bearer ${t}` } });
  return ((await res.json()) as { data: { id: string }[] }).data[0].id;
}
async function api(email: string, method: string, body?: object, org?: string | null, extra: Record<string, string> = {}) {
  const t = await token(email);
  const tenant = org === undefined ? await tenantOf(t) : org;
  const res = await fetch(`${API}/payments/razorpay`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(tenant ? { "X-Organization-Id": tenant } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as { data?: Record<string, unknown>; error?: { code?: string } } };
}
const reset = (email: string) => api(email, "DELETE");

/** Everything the browser receives from the payments Server Actions, the final HTML and the console, for the leak scan. */
function watch(page: Page) {
  const seen = { actionBodies: [] as string[], console: [] as string[] };
  page.on("response", async (r) => {
    if (r.request().method() === "POST" && r.url().includes("/dashboard/payments")) seen.actionBodies.push(await r.text().catch(() => ""));
  });
  page.on("console", (m) => seen.console.push(m.text()));
  return seen;
}
const secretInput = (page: Page) => page.locator("#pay-key-secret");
const keyInput = (page: Page) => page.locator("#pay-key-id");
const removeButton = (page: Page) => page.locator("main form").getByRole("button", { name: "Remove credentials" });
const saveButton = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function fill(page: Page, keyId: string, secret: string) {
  await keyInput(page).fill(keyId);
  await secretInput(page).fill(secret);
}
async function noForbiddenCopy(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bVerified\b|\bConnected\b|Test Connection|\bVerify\b|\bConnect\b/);
  await expect(page.getByRole("button", { name: /verify|connect|test connection/i })).toHaveCount(0);
}
async function noOverflow(page: Page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(wide).toBe(false);
}

test.describe("Razorpay credentials (real browser, real stack)", () => {
  test.skip(!SUPABASE || !ANON || !PASSWORD, "needs QA_REAL_SUPABASE_URL, QA_REAL_ANON_KEY and E2E_DEMO_PASSWORD");

  test.describe("main pass", () => {
    test.skip(PASS !== "main", "the main pass runs with the API's encryption key set");
    test.describe.configure({ mode: "serial" });

    test("T-PW-01: the Owner journey", { annotation: { type: "AC", description: "AC-UI-01 AC-UI-02 AC-UI-03a AC-UI-03b AC-UI-04 AC-UI-05 AC-UI-06 AC-UI-07 AC-UI-08 AC-UI-09 AC-UI-10 AC-UI-11 AC-UI-12 AC-UI-13 AC-UI-14 AC-UI-23 AC-UI-24 AC-UI-26 AC-SEC-07 AC-FE-16" } }, async ({ page, context, browser }) => {
      await reset(OWNER);
      const seen = watch(page);
      const first = { id: testKeyId() };
      const second = { id: liveKeyId() };
      await login(page, OWNER);

      // 1-3 Navigation, route, heading.
      await page.locator('a[href="/dashboard/payments"]').first().click();
      await expect(page).toHaveURL(/\/dashboard\/payments$/);
      await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
      await shoot(page, "AC-UI-01", "owner-payments-page", "the Owner opens Payments from the dashboard navigation", async () => {
        await expect(page.locator('a[href="/dashboard/payments"]').first()).toBeVisible();
        await expect(page).toHaveURL(/\/dashboard\/payments$/);
        await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
      });

      // 4 The unconfigured state, and the initial entry state before any input.
      await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
      await shoot(page, "AC-UI-02", "not-configured", "Payments shows the Not configured state for a tenant with nothing saved", async () => {
        await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
        await expect(page.getByText("Configured (saved)")).toHaveCount(0);
      });
      await shoot(page, "AC-UI-24", "initial-entry", "empty enabled Key ID, password-type Key Secret, a save control, no replace hint and no Remove control", async () => {
        await expect(keyInput(page)).toBeEmpty();
        await expect(keyInput(page)).toBeEnabled();
        await expect(secretInput(page)).toHaveAttribute("type", "password");
        await expect(secretInput(page)).toHaveValue("");
        await expect(secretInput(page)).toBeEnabled();
        await expect(saveButton(page, "Save credentials")).toBeVisible();
        await expect(page.getByText("Secret saved, enter a new value to replace it")).toHaveCount(0);
        await expect(removeButton(page)).toHaveCount(0);
      });
      await noForbiddenCopy(page);

      // 5-6 Validation: an invalid Key ID, then an invalid secret.
      await fill(page, "bad-key-id", SECRET);
      await saveButton(page, "Save credentials").click();
      const keyError = page.getByText("Enter a valid Razorpay Key ID, like rzp_test_ or rzp_live_ followed by at least 8 letters or numbers.");
      await expect(keyError).toBeVisible();
      await shoot(page, "AC-UI-03a", "validation-error-keyid", "a malformed Key ID shows the inline field error", async () => {
        await expect(keyError).toBeVisible();
        await expect(keyInput(page)).toHaveAttribute("aria-invalid", "true");
      });
      await fill(page, first.id, "short");
      await saveButton(page, "Save credentials").click();
      const secretError = page.getByText("Enter a valid Razorpay Key Secret: 16 to 128 letters and numbers, with no spaces or symbols.");
      await expect(secretError).toBeVisible();
      await shoot(page, "AC-UI-03b", "validation-error-secret", "an invalid Key Secret shows the inline field error", async () => {
        await expect(secretError).toBeVisible();
        await expect(secretInput(page)).toHaveAttribute("aria-invalid", "true");
      });

      // 7-8 Save through the real Server Action; the real request is delayed (and then continues) to show the saving state.
      await fill(page, first.id, SECRET);
      await page.route("**/dashboard/payments", async (route) => {
        if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      });
      await saveButton(page, "Save credentials").click();
      const saving = page.getByRole("button", { name: /Saving/ });
      await expect(saving).toBeDisabled();
      await shoot(page, "AC-UI-23", "saving-state", "while the real save request is in flight the form is busy, the submit control is disabled and the secret is not yet cleared (saving-state evidence, not success evidence)", async () => {
        await expect(saving).toBeDisabled();
        await expect(secretInput(page)).not.toHaveValue("");
        await expect(page.getByText("Configured (saved)")).toHaveCount(0);
      });

      // 9-15 Configured state. The delayed request has completed once the saved state shows; only then is the route removed.
      await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
      await page.unroute("**/dashboard/payments");
      const oracle = await api(OWNER, "GET");
      expect(oracle.body.data).toMatchObject({ configured: true, keyIdMasked: masked(first.id), mode: "test" });
      const ownerName = String(oracle.body.data?.updatedByName);
      await expect(page.getByText(masked(first.id))).toBeVisible();
      await shoot(page, "AC-UI-04", "credentials-saved", "after Save the real Server Action succeeded and the page shows the saved credentials", async () => {
        await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
        expect(oracle.status).toBe(200);
      });
      await shoot(page, "AC-UI-05", "configured-status", "Configured (saved), the Test badge, the masked Key ID and the saved, not verified wording are shown; the full Key ID is not", async () => {
        await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
        await expect(page.locator("main").getByText("Test", { exact: true })).toBeVisible();
        await expect(page.getByText(masked(first.id))).toBeVisible();
        await expect(page.getByText("saved, not verified")).toBeVisible();
        expect(await page.locator("main").innerText()).not.toContain(first.id);
      });
      await shoot(page, "AC-UI-07", "secret-cleared", "the Key Secret input is empty after a successful save", async () => {
        await expect(secretInput(page)).toHaveValue("");
        await expect(keyInput(page)).toHaveValue("");
      });
      await shoot(page, "AC-UI-10", "last-updated", "Last updated shows the owner's name and a timestamp (the name matches the API's answer)", async () => {
        await expect(page.getByText(new RegExp(`Last updated .+ UTC by ${ownerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
      });
      await noForbiddenCopy(page);
      await shoot(page, "AC-UI-26", "no-test-connection", "no Test Connection, Verify or Connect control and no Verified or Connected text, in the Not configured and Configured states", async () => {
        await noForbiddenCopy(page);
      });

      // 16-18 Reload.
      await page.reload();
      await shoot(page, "AC-UI-09", "reload-persistence", "after a reload the same status and masked Key ID are shown", async () => {
        await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
        await expect(page.getByText(masked(first.id))).toBeVisible();
      });
      await shoot(page, "AC-UI-08", "secret-not-prefilled", "after a reload the Key Secret is empty (never prefilled) and the replace hint is shown", async () => {
        await expect(secretInput(page)).toHaveValue("");
        await expect(secretInput(page)).toHaveAttribute("type", "password");
        await expect(page.getByText("Secret saved, enter a new value to replace it")).toBeVisible();
      });

      // Failure journey: a save request that never reaches the server (the network fails).
      await fill(page, testKeyId(), SECRET);
      await page.route("**/dashboard/payments", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.continue()));
      await saveButton(page, "Replace credentials").click();
      await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
      await expect(secretInput(page)).not.toHaveValue(""); // the input is never cleared on failure
      expect(await page.locator("main").innerText()).not.toContain(SECRET);
      await page.unroute("**/dashboard/payments");
      await page.reload();

      // 19-20 Replace with a Live pair.
      await fill(page, second.id, SECRET);
      await saveButton(page, "Replace credentials").click();
      await expect(page.getByText(masked(second.id))).toBeVisible();
      await shoot(page, "AC-UI-11", "credentials-replaced", "the replaced pair shows its new masked Key ID", async () => {
        await expect(page.getByText(masked(second.id))).toBeVisible();
        await expect(page.getByText(masked(first.id))).toHaveCount(0);
        await expect(secretInput(page)).toHaveValue("");
      });
      await shoot(page, "AC-UI-06", "live-badge", "a rzp_live_ Key ID shows the Live badge", async () => {
        await expect(page.locator("main").getByText("Live", { exact: true })).toBeVisible();
        await expect(page.locator("main").getByText("Test", { exact: true })).toHaveCount(0);
      });

      // Responsive layout of the configured screen (AC-FE-16 part b).
      for (const [slug, width, height] of [["desktop", 1280, 800], ["mobile", 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        await shoot(page, "AC-FE-16", slug, `the Payments screen at ${width}px: no horizontal overflow, all controls reachable`, async () => {
          await noOverflow(page);
          await expect(keyInput(page)).toBeVisible();
          await expect(secretInput(page)).toBeVisible();
          await expect(page.getByRole("button", { name: "Replace credentials" })).toBeVisible();
          await expect(removeButton(page)).toBeVisible();
        });
      }
      await page.setViewportSize({ width: 1280, height: 800 });

      // 21-22 Removal: confirmation, then cancel.
      const stale = await context.newPage(); // a second tab that still shows the configured state, for the idempotent removal
      await stale.goto("/dashboard/payments");
      await expect(removeButton(stale)).toBeVisible();
      await removeButton(page).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await shoot(page, "AC-UI-12", "remove-confirmation", "Remove opens a confirmation dialog", async () => {
        await expect(dialog.getByText("Remove Razorpay credentials?")).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
      });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();

      // Failure journey: a removal request that fails.
      await removeButton(page).click();
      await page.route("**/dashboard/payments", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.continue()));
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove credentials" }).click();
      await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText("Something went wrong");
      await page.unroute("**/dashboard/payments");
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();

      // 23-24 Confirm removal.
      await removeButton(page).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove credentials" }).click();
      await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
      await shoot(page, "AC-UI-13", "configuration-removed", "after the confirmed removal the page shows Not configured", async () => {
        await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
        await expect(page.getByText("Configured (saved)")).toHaveCount(0);
      });

      // 25 Repeat the removal from the stale tab: nothing is saved any more, and it still succeeds.
      await removeButton(stale).click();
      await stale.getByRole("alertdialog").getByRole("button", { name: "Remove credentials" }).click();
      await expect(stale.getByText("Not configured", { exact: true })).toBeVisible();
      await shoot(stale, "AC-UI-14", "remove-idempotent", "removing an already removed configuration (from a stale tab) succeeds and the page still shows Not configured", async () => {
        await expect(stale.getByText("Not configured", { exact: true })).toBeVisible();
        expect((await api(OWNER, "GET")).body.data).toEqual({ configured: false });
      });
      await stale.close();

      // T-PW-05: nothing the browser received ever held the secret.
      const html = await page.content();
      const leakCount = [...seen.actionBodies, html, ...seen.console].filter((s) => s.includes(SECRET)).length;
      await record("AC-SEC-07", "logs", `Server Action responses (${seen.actionBodies.length}), the final HTML and the console (${seen.console.length} messages) were scanned for the synthetic secret: ${leakCount} found\n`, `Server Action response bodies scanned: ${seen.actionBodies.length}\nconsole messages scanned: ${seen.console.length}\nfinal HTML bytes scanned: ${html.length}\nsecret occurrences: ${leakCount}\n`, async () => {
        expect(seen.actionBodies.length).toBeGreaterThanOrEqual(2);
        expect(leakCount).toBe(0);
      });
      void browser;
    });

    test("T-PW-02: Admin, Staff, anonymous and platform admin are denied, and cannot obtain the credentials", { annotation: { type: "AC", description: "AC-UI-15 AC-UI-16 AC-UI-17 AC-UI-18" } }, async ({ page, browser }) => {
      const distinctive = `rzp_test_DENY${hex(4)}`;
      expect((await api(OWNER, "PUT", { keyId: distinctive, keySecret: SECRET })).status).toBe(200);
      const suffix = distinctive.slice(-6);

      const denied = async (who: string, email: string | null, acId: string, slug: string, landing: RegExp) => {
        const ctx: BrowserContext = await browser.newContext();
        const p = await ctx.newPage();
        const seen = watch(p);
        if (email && who === "platform admin") {
          // A platform admin signs in to the admin area, not the dashboard.
          await p.goto("/login");
          await p.locator("#email").fill(email);
          await p.locator("#password").fill(PASSWORD);
          await p.getByRole("button", { name: "Sign in" }).click();
          await p.waitForURL(/\/admin/);
        } else if (email) {
          await login(p, email);
        }
        const nav = p.locator('a[href="/dashboard/payments"]');
        await expect(nav).toHaveCount(0);
        await p.goto("/dashboard/payments");
        await expect(p).not.toHaveURL(/\/dashboard\/payments/);
        await expect(p).toHaveURL(landing);
        const html = await p.content();
        const text = await p.locator("body").innerText();
        for (const s of [...seen.actionBodies, html, text]) {
          expect(s).not.toContain(suffix);
          expect(s).not.toContain(SECRET);
          expect(s).not.toContain("Razorpay credentials");
        }
        await shoot(p, acId, slug, `${who}: the Payments navigation item is absent and the direct URL is denied (redirected)`, async () => {
          await expect(p).not.toHaveURL(/\/dashboard\/payments/);
          await expect(p.getByText("Razorpay credentials")).toHaveCount(0);
        });
        await ctx.close();
      };
      await denied("admin", MANAGER, "AC-UI-15", "admin-denied", /\/dashboard$/);
      await denied("staff", STAFF, "AC-UI-16", "staff-denied", /\/dashboard$/);
      await denied("anonymous visitor", null, "AC-UI-17", "anonymous-denied", /\/login/);
      await denied("platform admin", PLATFORM, "AC-UI-18", "platform-admin-denied", /\/admin/);

      // The same people cannot read it from the API either.
      const viaApi = { admin: await api(MANAGER, "GET"), staff: await api(STAFF, "GET") };
      expect([viaApi.admin.status, viaApi.staff.status]).toEqual([403, 403]);
      expect(JSON.stringify(viaApi)).not.toContain(suffix);
      void page;
    });

    test("T-PW-03: a tampered active-tenant cookie never shows another tenant's configuration", { annotation: { type: "AC", description: "AC-UI-19" } }, async ({ browser }) => {
      const tB = await token(OWNER_B);
      const tenantB = await tenantOf(tB);
      const distinctive = `rzp_test_BETA${hex(4)}`;
      expect((await api(OWNER_B, "PUT", { keyId: distinctive, keySecret: SECRET })).status).toBe(200);
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await login(p, OWNER);
      await ctx.addCookies([{ name: ACTIVE_TENANT_COOKIE, value: tenantB, url: process.env.E2E_BASE_URL ?? "http://localhost:3300" }]);
      await p.goto("/dashboard/payments");
      const html = await p.content();
      await shoot(p, "AC-UI-19", "cross-tenant", "tenant A's Owner with the active-tenant cookie forged to tenant B sees only tenant A's data; tenant B's Key ID is nowhere on the page", async () => {
        await expect(p.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
        expect(html).not.toContain(distinctive.slice(-6));
        expect(await p.locator("body").innerText()).not.toContain(distinctive.slice(-6));
        await expect(p.getByText("Razorpay keys for Urban Nest Trading Co.")).toBeVisible();
      });
      await ctx.close();
      await reset(OWNER_B);
    });

    test("AC-UI-25: throttling shows a safe inline error and the form stays usable (exhausts the sensitive-route window, so it runs after the other saves and waits the window out)", { annotation: { type: "AC", description: "AC-UI-25" } }, async ({ page }) => {
      await page.waitForTimeout(62_000); // let the sensitive-route window of the earlier saves expire
      await reset(OWNER);
      await login(page, OWNER);
      await page.goto("/dashboard/payments");
      let limited = false;
      for (let i = 0; i < 12 && !limited; i++) {
        await fill(page, testKeyId(), SECRET);
        await saveButton(page, i === 0 ? "Save credentials" : "Replace credentials").click();
        const rate = page.getByRole("alert").filter({ hasText: RATE_LIMIT_MESSAGE });
        // "Configured (saved)" stays on the page after the first save, so it cannot signal that THIS save finished. The request is
        // done when the rate-limit message appears or the secret input has been cleared by a successful save.
        await expect.poll(async () => (await rate.isVisible()) || (await secretInput(page).inputValue()) === "").toBe(true);
        limited = await rate.isVisible();
      }
      expect(limited).toBe(true);
      await shoot(page, "AC-UI-25", "throttle-error", "after the sensitive-route limit the page shows the application's rate-limit message inline, with no technical detail, and the form stays usable", async () => {
        await expect(page.getByRole("alert").filter({ hasText: RATE_LIMIT_MESSAGE })).toBeVisible();
        await expect(keyInput(page)).toBeEnabled();
        await expect(secretInput(page)).toBeEnabled();
        await expect(page.getByRole("button", { name: /Replace credentials|Save credentials/ })).toBeEnabled();
        expect(await page.locator("main").innerText()).not.toContain(SECRET);
      });
      await page.waitForTimeout(62_000);
    });

    test("T-PW-06: the real API rejects a missing or blank organization header, an unknown field, a missing field and another tenant's header", { annotation: { type: "AC", description: "AC-UI-21" } }, async () => {
      await reset(OWNER); // a known starting point: nothing saved
      const t = await token(OWNER);
      const tenant = await tenantOf(t);
      const tB = await tenantOf(await token(OWNER_B));
      const good = { keyId: testKeyId(), keySecret: SECRET };
      const results = {
        missingHeader: await api(OWNER, "PUT", good, null),
        blankHeader: await api(OWNER, "PUT", good, " ", {}),
        unknownField: await api(OWNER, "PUT", { ...good, tenantId: tenant }),
        missingField: await api(OWNER, "PUT", { keyId: good.keyId }),
        otherTenantHeader: await api(OWNER, "PUT", good, tB),
      };
      await record("AC-UI-21", "api-evidence", "the real API answered 400 for a missing header, a blank header, an unknown field and a missing field, and 403 for another tenant's header", Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { status: r.status, code: r.body.error?.code }])), async () => {
        expect(results.missingHeader.status).toBe(400);
        expect(results.blankHeader.status).toBe(400);
        expect(results.unknownField.status).toBe(400);
        expect(results.missingField.status).toBe(400);
        expect(results.otherTenantHeader.status).toBe(403);
        expect((await api(OWNER, "GET")).body.data).toMatchObject({ configured: false });
      });
      // Leave a saved configuration behind: the keyless pass (API without its encryption key) starts from one, because it
      // cannot save any more. The API still has its key here.
      expect((await api(OWNER, "PUT", { keyId: testKeyId(), keySecret: SECRET })).status).toBe(200);
    });

    test("AC-REG-03: the Owner dashboard pages still open and render", { annotation: { type: "AC", description: "AC-REG-03" } }, async ({ page }) => {
      await login(page, OWNER);
      // The Overview page's heading is the store's own name, so it is checked as "some heading", the others by their title.
      const pages: [string, string | null][] = [["/dashboard", null], ["/dashboard/products", "Products"], ["/dashboard/team", "Team members"], ["/dashboard/settings", "Settings"]];
      for (const [path, heading] of pages) {
        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/") + "$"));
        await expect((heading ? page.getByRole("heading", { name: heading, exact: true }) : page.locator("main h1")).first()).toBeVisible();
      }
    });

    test("AC-SEC-08: the frontend server log and every artifact written so far hold no secret", { annotation: { type: "AC", description: "AC-SEC-08" } }, async () => {
      const { readdirSync, readFileSync, statSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { leaks, evidenceRoot } = await import("../support/payments-evidence");
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push(full);
        }
      };
      try {
        walk(evidenceRoot());
      } catch {
        /* nothing written yet */
      }
      if (process.env.QA_WEB_LOG) files.push(process.env.QA_WEB_LOG);
      const bad = files.filter((f) => leaks(readFileSync(f)) > 0).length;
      await record("AC-SEC-08", "logs", `the frontend server log and ${files.length} artifacts were scanned for the run's sentinels: ${bad} files held one`, `files scanned: ${files.length} (including the frontend server log when provided)\nfiles holding a sentinel: ${bad}\n`, async () => {
        expect(files.length).toBeGreaterThan(0);
        expect(bad).toBe(0);
      });
    });
  });

  test.describe("keyless pass", () => {
    test.skip(PASS !== "keyless", "needs the API restarted WITHOUT its encryption key");

    test("T-PW-04: with no encryption key, saving shows the exact generic message, nothing changes, and status and removal still work", { annotation: { type: "AC", description: "AC-UI-20" } }, async ({ page }) => {
      await login(page, OWNER);
      await page.goto("/dashboard/payments");
      // The status loads without the key. A configuration left by the main pass is still shown.
      await expect(page.getByText("Configured (saved)", { exact: true })).toBeVisible();
      const before = await api(OWNER, "GET");
      const seen = watch(page);
      await fill(page, testKeyId(), SECRET);
      await saveButton(page, "Replace credentials").click();
      const alert = page.getByRole("alert").filter({ hasText: UNAVAILABLE });
      await expect(alert).toBeVisible();
      await shoot(page, "AC-UI-20", "encryption-failure", "with the API's encryption key missing, Save shows the exact generic message and nothing is persisted", async () => {
        await expect(alert).toHaveText(UNAVAILABLE);
        const after = await api(OWNER, "GET");
        expect(after.body.data).toEqual(before.body.data); // the stored configuration is unchanged
        expect(await page.locator("main").innerText()).not.toContain(SECRET);
        // Server responses must not hold the secret. In the page, the only legitimate place is the form input the Owner typed
        // into (React mirrors a controlled input's value into its attribute, and a failed save keeps the input); every other
        // part of the HTML must not.
        expect(seen.actionBodies.some((s) => s.includes(SECRET))).toBe(false);
        const html = await page.content();
        expect(html.replace(/<input[^>]*>/g, "<input>").includes(SECRET)).toBe(false);
      });
      // Removal needs no key.
      await page.reload();
      await removeButton(page).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove credentials" }).click();
      await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
    });
  });
});
