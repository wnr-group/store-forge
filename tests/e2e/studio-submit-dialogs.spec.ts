import { expect, test, type Page } from "@playwright/test";
import { password } from "./helpers";
import { capture, LABEL, record } from "./support/studio-evidence";
import { addTestProduct, deleteProductsByPrefix, expectRestored, hydrated, PREFIX, REUSABLE_MEMBER_EMAIL, snapshot } from "./support/studio-data";
import { asUser } from "./support/studio-session";

/**
 * Successful-submission focus for Add customer, Edit customer, Adjust stock and Add team member (Add category is in
 * studio-submit-focus.spec.ts). Isolated local E2E database only. Records are named "ZZ E2E ..." and removed through the
 * real UI; the data set is compared with its starting state afterwards.
 *
 * Add team member is the exception: the Team UI can only deactivate, never delete. It therefore creates the ONE designated
 * reusable restricted account (REUSABLE_MEMBER_EMAIL) that studio-restricted.spec.ts then reuses, and only when that account
 * does not exist yet; once it exists this test is skipped with a stated reason, so no further members are ever created.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 300_000 });

const isFocused = (page: Page, selector: string) => page.evaluate((s) => document.activeElement === document.querySelector(s), selector);
const describeActive = (page: Page) => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? `${a.tagName.toLowerCase()}${a.id ? "#" + a.id : ""}${a.getAttribute("aria-label") ? "[" + a.getAttribute("aria-label") + "]" : ""}: ${(a.innerText || "").trim().slice(0, 40)}` : "none"; });

async function deleteCustomersByPrefix(page: Page) {
  await page.goto(`/dashboard/customers?q=${encodeURIComponent(PREFIX)}`);
  await hydrated(page);
  for (let i = 0; i < 3; i++) {
    const row = page.locator('a[href^="/dashboard/customers/"]', { hasText: PREFIX }).first();
    if (!(await row.count())) break;
    await row.click();
    await page.waitForURL(/\/dashboard\/customers\/[^/]+$/);
    await hydrated(page);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete customer" }).click();
    await page.waitForURL((u) => u.pathname === "/dashboard/customers", { timeout: 30_000 });
    await page.goto(`/dashboard/customers?q=${encodeURIComponent(PREFIX)}`);
  }
}

test("Add customer and Edit customer: a successful submit, and what happens to focus", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/customers");
    await hydrated(page);
    const before = await snapshot(page);
    const run = Date.now().toString(36);
    const name = `${PREFIX} customer ${run}`;
    try {
      // ---- Add customer
      const trigger = page.getByRole("button", { name: /add customer/i });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(await isFocused(page, "#cu-name"), "focus starts in the name field").toBe(true);
      await dialog.locator("#cu-name").fill(name);
      await dialog.locator("#cu-email").fill(`zz-e2e-${run}@example.test`);
      await dialog.getByRole("button", { name: "Add customer" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Customer added")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // The app opens the new customer's page, so the Add customer button that opened the dialog no longer exists.
      await page.waitForURL(/\/dashboard\/customers\/[^/]+$/, { timeout: 30_000 });
      await hydrated(page);
      await expect(page.locator("main h1").first()).toHaveText(name);
      const triggerGone = (await page.getByRole("button", { name: /add customer/i }).count()) === 0;
      const activeAfterAdd = await describeActive(page);
      await page.keyboard.press("Tab");
      const firstTab = await describeActive(page);
      expect(triggerGone, "the opener was removed by the app's redirect, so focus cannot return to it").toBe(true);
      expect(firstTab, "the keyboard is not trapped or lost: Tab lands on a real control of the new page").toMatch(/^(a|button|input|select|textarea)/);
      expect(firstTab, "and not inside the closed dialog").not.toContain("dialog");
      record(info, ["DF-2"], "Add customer: successful submit (the app redirects, so the opener is gone and focus return is not applicable)", { triggerGone, activeAfterAdd, firstTab, focusReturnApplicable: false });
      await capture(page, info, { ac: ["DF-2"], folder: "focus-return-submit", name: "add-customer-after-successful-save", note: `After a successful Add customer the app opens the new customer's page (the Add customer button is gone, so focus cannot return to it); the next Tab lands on a control of that page. Test customer "${name}" is deleted at the end of the test.` });

      // ---- Edit customer (on the new customer's page; the Edit button stays mounted)
      const edit = page.getByRole("button", { name: "Edit" });
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.locator("#cu-notes").fill("edited by an automated E2E test");
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Customer updated")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => edit.evaluate((el) => el === document.activeElement), { message: "focus returns to the Edit button after a successful save", timeout: 10_000 }).toBe(true);
      record(info, ["DF-2"], "Edit customer: successful submit returns focus to Edit", { active: await describeActive(page), focusedBack: true });
      await capture(page, info, { ac: ["DF-2"], folder: "focus-return-submit", name: "edit-customer-after-successful-save", note: "After a successful Edit customer save: the dialog is closed and focus is on the Edit button (focus ring visible)." });
    } finally {
      await deleteCustomersByPrefix(page);
      const after = await snapshot(page);
      record(info, ["DF-2"], "Add/Edit customer cleanup", { customersBefore: before.customersTop.length, customersAfter: after.customersTop.length, leftover: after.leftoverCustomers });
      expectRestored(before, after, "customers");
    }
  });
});

test("Adjust stock: a successful submit returns focus to the row's Adjust button", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/inventory");
    await hydrated(page);
    const before = await snapshot(page);
    const name = `${PREFIX} stock ${Date.now().toString(36)}`;
    try {
      await addTestProduct(page, name);
      const tracked = page.getByRole("switch", { name: "Track inventory" });
      if ((await tracked.count()) && (await tracked.getAttribute("aria-checked")) === "false") {
        await tracked.click();
        await page.getByRole("button", { name: "Save changes" }).click();
        await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 30_000 });
      }
      await page.goto(`/dashboard/inventory?q=${encodeURIComponent(name)}`);
      await hydrated(page);
      const trigger = page.getByRole("button", { name: `Adjust stock for ${name}` });
      await expect(trigger, "the test product is tracked, so its Adjust button is enabled").toBeEnabled({ timeout: 30_000 });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Adjust stock" })).toBeVisible();
      await dialog.locator("#adj-value").fill("5");
      await dialog.getByRole("button", { name: "Update stock" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Stock updated to 5/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => trigger.evaluate((el) => el === document.activeElement), { message: "focus returns to the row's Adjust button after a successful save", timeout: 10_000 }).toBe(true);
      record(info, ["DF-2"], "Adjust stock: successful submit returns focus", { product: name, active: await describeActive(page) });
      await capture(page, info, { ac: ["DF-2"], folder: "focus-return-submit", name: "adjust-stock-after-successful-save", note: `After a successful stock adjustment (+5 on the test product "${name}") the dialog is closed and focus is on that row's Adjust button. The test product is deleted afterwards.` });
    } finally {
      await deleteProductsByPrefix(page);
      const after = await snapshot(page);
      record(info, ["DF-2"], "Adjust stock cleanup", { adjustmentsBefore: before.adjustments.length, adjustmentsAfter: after.adjustments.length, identical: JSON.stringify(before.adjustments) === JSON.stringify(after.adjustments) });
      expectRestored(before, after, "adjust stock");
    }
  });
});

test("Add team member: a successful submit returns focus to Add member (creates the one reusable restricted account, once)", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/team");
    await hydrated(page);
    const exists = (await page.getByText(REUSABLE_MEMBER_EMAIL).count()) > 0;
    test.skip(exists, `The reusable restricted account ${REUSABLE_MEMBER_EMAIL} already exists; the Team UI cannot delete members, so this create flow runs only when it is first created (see closeout report).`);

    const trigger = page.getByRole("button", { name: "Add member" });
    let created = false;
    try {
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.locator("#tm-name").fill("E2E Reusable Restricted");
      await dialog.locator("#tm-email").fill(REUSABLE_MEMBER_EMAIL);
      await dialog.locator("#tm-password").fill(password());
      await dialog.getByRole("button", { name: "Add member" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText(`${REUSABLE_MEMBER_EMAIL} can now sign in`)).toBeVisible({ timeout: 30_000 });
      created = true;
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(REUSABLE_MEMBER_EMAIL).first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => trigger.evaluate((el) => el === document.activeElement), { message: "focus returns to the Add member button after a successful save", timeout: 10_000 }).toBe(true);
      record(info, ["DF-2"], "Add team member: successful submit returns focus", { member: REUSABLE_MEMBER_EMAIL, active: await describeActive(page) });
      await capture(page, info, { ac: ["DF-2"], folder: "focus-return-submit", name: "add-team-member-after-successful-save", note: `After a successful Add team member the dialog is closed and focus is on the Add member button. The member is the designated reusable restricted test account (${REUSABLE_MEMBER_EMAIL}); it is deactivated at the end of the test.` });
    } finally {
      if (created) {
        await page.getByRole("button", { name: `Actions for ${REUSABLE_MEMBER_EMAIL}` }).click();
        await page.getByRole("menuitem", { name: "Deactivate" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
        await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
        record(info, ["DF-2"], "Add team member: the member was deactivated through the Team UI and kept as the reusable restricted account", { member: REUSABLE_MEMBER_EMAIL });
      }
    }
  });
});
