import { expect, test } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { addTestProduct, deleteProductsByPrefix, expectRestored, hydrated, PREFIX, snapshot } from "./support/studio-data";
import { asUser } from "./support/studio-session";

/**
 * QA-FUNC: loading skeletons, row actions, Collections, Settings. EVIDENCE_LABEL=after.
 *  - Loading states and the Inventory row action are READ-ONLY.
 *  - Products row actions, Collections and Settings write to the isolated local E2E database through the real UI, only on
 *    records named "ZZ E2E ..." (Settings: one field is changed and put back). Each test deletes/restores what it touched in
 *    a finally block and compares the data set with its starting state.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 300_000 });

// ------------------------------------------------------------------------------------------------ loading skeletons

const MODULES = [
  { link: "Products", path: "/dashboard/products", heading: "Products" },
  { link: "Categories", path: "/dashboard/categories", heading: "Categories" },
  { link: "Collections", path: "/dashboard/collections", heading: "Collections" },
  { link: "Inventory", path: "/dashboard/inventory", heading: "Inventory" },
  { link: "Customers", path: "/dashboard/customers", heading: "Customers" },
  { link: "Analytics", path: "/dashboard/analytics", heading: "Analytics" },
  { link: "Settings", path: "/dashboard/settings", heading: "Settings" },
  { link: "Team members", path: "/dashboard/team", heading: "Team members" },
] as const;

/**
 * Loading skeletons need the router to have PREFETCHED each route's loading.tsx, which Next.js does only in a production build
 * (the dev server has no prefetch, so holding the request shows nothing). Authenticated E2E against `next start` over plain http
 * did not hold a session in this environment (redirect loop after the first requests; cause not established), so these tests are
 * opt-in: set E2E_LOADING_STATES=1 against a production server whose sessions work. Until then loading states are NOT E2E verified.
 */
const LOADING_ENABLED = process.env.E2E_LOADING_STATES === "1";

for (const m of MODULES) {
  test(`loading state: ${m.link} shows its skeleton while the page loads, then the real page`, async ({ browser }, info) => {
    test.skip(!LOADING_ENABLED, "Loading skeletons are only observable on a production build with working sessions (set E2E_LOADING_STATES=1); not verified on the dev server.");
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard");
      await hydrated(page);
      // Hold the server response for this page so the route's loading.tsx is on screen; release it after the check.
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await page.route((url) => url.pathname === m.path, async (route) => {
        await gate;
        await route.continue();
      });
      await page.locator("aside, nav").getByRole("link", { name: m.link, exact: true }).first().click();
      const skeleton = page.getByRole("status", { name: "Loading" });
      await expect(skeleton, "the loading skeleton is shown").toBeVisible({ timeout: 15_000 });
      expect(await skeleton.locator('[data-slot="skeleton"]').count(), "it is made of skeleton blocks").toBeGreaterThan(3);
      expect(await skeleton.getAttribute("aria-busy"), "announced as busy to assistive tech").toBe("true");
      if (m.link === "Products" || m.link === "Customers") await capture(page, info, { ac: ["QA-FUNC"], folder: m.link.toLowerCase(), name: "loading-skeleton", note: `${m.link}: the loading skeleton shown while the server response is held.` });
      release();
      await expect(page.locator("main h1").first()).toHaveText(m.heading, { timeout: 30_000 });
      await expect(skeleton, "the skeleton is replaced by the page").toHaveCount(0);
      record(info, ["QA-FUNC"], `loading skeleton ${m.link}`, { ok: true });
    });
  });
}

// ------------------------------------------------------------------------------------------------ Inventory row action (read-only)

test("Inventory row action: Adjust opens the dialog, validates, and Cancel leaves the data alone", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/inventory");
    await hydrated(page);
    const before = await snapshot(page);
    await page.getByRole("button", { name: /^Adjust stock for/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Adjust stock" })).toBeVisible();
    await dialog.getByRole("button", { name: "Update stock" }).click();
    await expect(dialog.locator("#adj-value-msg")).not.toBeEmpty();
    await expect(dialog, "stays open on a validation error").toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await snapshot(page)).adjustments, "nothing was adjusted").toEqual(before.adjustments);
    record(info, ["QA-FUNC"], "inventory adjust validation and cancel", { ok: true });
  });
});

// ------------------------------------------------------------------------------------------------ Products row actions (writes test products)

test("Products row actions: menu items, Edit link, publish/draft toggle, Duplicate and Delete on a test product", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/products");
    await hydrated(page);
    const before = await snapshot(page);
    const name = `${PREFIX} product ${Date.now().toString(36)}`;
    try {
      await addTestProduct(page, name);
      await page.goto(`/dashboard/products?q=${encodeURIComponent(name)}`);
      await hydrated(page);
      const row = page.locator("tbody tr").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Draft");

      await page.getByRole("button", { name: `Actions for ${name}` }).click();
      for (const item of [/Edit/, /Duplicate/, /Delete/]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Publish" })).toBeVisible();
      await page.getByRole("menuitem", { name: "Publish" }).click();
      await expect(page.locator("tbody tr").filter({ hasText: name }), "the status badge changes to Active").toContainText("Active", { timeout: 30_000 });
      await capture(page, info, { ac: ["QA-FUNC"], folder: "products", name: "row-actions-menu", note: "Products row actions on a test product (status toggled to Active)." });

      await page.getByRole("button", { name: `Actions for ${name}` }).click();
      await page.getByRole("menuitem", { name: /Duplicate/ }).click();
      await expect(page.getByText("Duplicated as a draft")).toBeVisible({ timeout: 30_000 });
      await page.waitForURL((u) => u.pathname.startsWith("/dashboard/products/") && u.pathname.length > 30, { timeout: 30_000 }); // Duplicate opens the new draft (an id, not /new)
      await page.goto(`/dashboard/products?q=${encodeURIComponent(name)}`);
      await hydrated(page);
      await expect(page.locator("tbody tr").filter({ hasText: name }), "the original and its copy are both listed").toHaveCount(2, { timeout: 30_000 });

      await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
      await page.getByRole("menuitem", { name: /Edit/ }).click();
      await page.waitForURL(/\/dashboard\/products\/[^/]+$/);
      expect(await page.locator("#name").inputValue(), "Edit opens a product with the test name (the first row is the newest, the copy)").toContain(name);
      record(info, ["QA-FUNC"], "products row actions", { name });
    } finally {
      await deleteProductsByPrefix(page);
      expectRestored(before, await snapshot(page), "products row actions");
    }
  });
});

// ------------------------------------------------------------------------------------------------ Collections (writes a test collection)

test("Collections: add form validates, Cancel returns, create, edit, delete-confirm Cancel keeps it, Delete removes it", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/collections");
    await hydrated(page);
    const before = await snapshot(page);
    const name = `${PREFIX} collection ${Date.now().toString(36)}`;
    let created = false;
    try {
      await page.getByRole("link", { name: /add collection/i }).click();
      await page.waitForURL(/\/dashboard\/collections\/new/);
      await hydrated(page);
      await page.getByRole("button", { name: "Create collection" }).click();
      await expect(page.locator("#col-name-msg")).not.toBeEmpty();
      await expect(page, "still on the form after a validation error").toHaveURL(/\/collections\/new/);
      await page.getByRole("link", { name: "Cancel" }).click();
      await page.waitForURL((u) => u.pathname === "/dashboard/collections");

      await page.getByRole("link", { name: /add collection/i }).click();
      await page.locator("#col-name").fill(name);
      await page.getByRole("button", { name: "Create collection" }).click();
      await expect(page.getByText("Collection created")).toBeVisible({ timeout: 30_000 });
      created = true;
      await page.waitForURL(/\/dashboard\/collections\/[0-9a-f-]{8,}/);
      await hydrated(page);
      await expect(page.locator("#col-name")).toHaveValue(name);

      await page.locator("#col-desc").fill("created by an automated E2E test");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Changes saved")).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "Delete collection" }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(page.locator("#col-name"), "Cancel kept the collection").toHaveValue(name);

      await capture(page, info, { ac: ["QA-FUNC"], folder: "collections", name: "edit-test-collection", note: "Collections edit form for a test collection, created through the UI (deleted at the end of the test)." });
      await page.getByRole("button", { name: "Delete collection" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete collection" }).click();
      await expect(page.getByText("Collection deleted")).toBeVisible({ timeout: 30_000 });
      created = false;
      await page.waitForURL((u) => u.pathname === "/dashboard/collections");
      await expect(page.getByText(name)).toHaveCount(0);
      record(info, ["QA-FUNC"], "collections create/edit/delete", { name });
    } finally {
      if (created) {
        await page.goto("/dashboard/collections");
        const card = page.getByRole("link", { name: new RegExp(name) }).first();
        if (await card.count()) {
          await card.click();
          await page.getByRole("button", { name: "Delete collection" }).click();
          await page.getByRole("alertdialog").getByRole("button", { name: "Delete collection" }).click();
          await expect(page.getByText("Collection deleted")).toBeVisible({ timeout: 30_000 });
        }
      }
      expectRestored(before, await snapshot(page), "collections");
    }
  });
});

// ------------------------------------------------------------------------------------------------ Settings (changes one field and restores it)

test("Settings: validation messages, a successful save with feedback that persists, and the original value restored", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/settings");
    await hydrated(page);
    const before = await snapshot(page);
    const original = await page.locator("#st-desc").inputValue();
    const marker = ` (E2E ${Date.now().toString(36)})`;
    let changed = false;
    try {
      const name = await page.locator("#st-name").inputValue();
      const email = await page.locator("#st-email").inputValue(); // read before touching it: React keeps defaultValue in sync with the current value
      await page.locator("#st-name").fill("");
      await page.locator("#st-name").blur();
      await expect(page.locator("#st-name-msg")).not.toBeEmpty();
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Store settings saved"), "an invalid form is not saved").toHaveCount(0);
      await page.locator("#st-name").fill(name);

      await page.locator("#st-email").fill("not-an-email");
      await page.locator("#st-email").blur();
      await expect(page.locator("#st-email-msg")).not.toBeEmpty();
      await page.locator("#st-email").fill(email);
      await expect(page.locator("#st-email-msg")).toBeEmpty();

      await page.locator("#st-desc").fill(original + marker);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Store settings saved")).toBeVisible({ timeout: 30_000 });
      changed = true;
      await capture(page, info, { ac: ["QA-FUNC"], folder: "settings", name: "save-feedback", note: "Settings after a successful save: the success toast is shown. The description is restored at the end of the test." });
      await page.reload();
      await hydrated(page);
      await expect(page.locator("#st-desc"), "the change persisted").toHaveValue(original + marker);
    } finally {
      if (changed) {
        await page.goto("/dashboard/settings");
        await hydrated(page);
        await page.locator("#st-desc").fill(original);
        await page.getByRole("button", { name: "Save settings" }).click();
        await expect(page.getByText("Store settings saved")).toBeVisible({ timeout: 30_000 });
      }
      expectRestored(before, await snapshot(page), "settings");
      record(info, ["QA-FUNC"], "settings validation/save/restore", { restored: true });
    }
  });
});
