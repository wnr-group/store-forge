import { expect, test, type Browser, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { REUSABLE_MEMBER_EMAIL } from "./support/studio-data";
import { openPalette } from "./support/studio-measure";
import { asUser } from "./support/studio-session";
import { password } from "./helpers";

/**
 * F1-2 against a REAL restricted member, created and driven through the actual UI.
 *
 * ONE fixed, reusable test member (REUSABLE_MEMBER_EMAIL, or E2E_RESTRICTED_EMAIL to point at another) is used on every run. It is
 * created through the Team UI only the first time, when it does not exist yet; afterwards it is reactivated and its access
 * edited, so this spec never creates a member per run. The member signs in through the real login form and the palette is
 * compared with the sidebar. It is deactivated again in a `finally`, whatever the outcome. Isolated local E2E environment only.
 *
 * Two stages with the same member:
 *  1. No products access. OBSERVATION ONLY (documented, not asserted as desired behaviour): on origin/main the whole
 *     dashboard fails to render for such a member ("Something went wrong"), because the header notifications bell queries
 *     inventory for everyone and the API answers 403. That is outside this ticket, so it is recorded, not fixed.
 *  2. Products read, no customers, no orders. The dashboard loads, so the permission-gated entries (Customers, Analytics)
 *     must be absent from BOTH the sidebar and the palette, and the two must match.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 300_000 });

type Level = "none" | "read" | "write";
type Access = { products: Level; orders: Level; customers: Level; settings: Level };

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const sidebarLabels = async (page: Page) => {
  await expect(nav(page).getByRole("link").first()).toBeVisible();
  return (await nav(page).getByRole("link").allInnerTexts()).map((t) => t.trim());
};

async function fillAccess(dialog: ReturnType<Page["getByRole"]>, prefix: string, a: Access) {
  await dialog.locator(`#${prefix}-products`).selectOption(a.products);
  await dialog.locator(`#${prefix}-orders`).selectOption(a.orders);
  await dialog.locator(`#${prefix}-customers`).selectOption(a.customers);
  await dialog.locator(`#${prefix}-settings`).selectOption(a.settings);
}

async function createMember(page: Page, email: string, a: Access) {
  await page.goto("/dashboard/team");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#tm-name").fill("E2E Restricted Test");
  await dialog.locator("#tm-email").fill(email);
  await dialog.locator("#tm-password").fill(password());
  await fillAccess(dialog, "tm-perm", a);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(email)).toBeVisible();
}

async function menu(page: Page, email: string, item: string) {
  await page.goto("/dashboard/team");
  await page.getByRole("button", { name: `Actions for ${email}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

async function reactivateMember(page: Page, email: string) {
  await menu(page, email, "Reactivate");
  await page.getByRole("alertdialog").getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
}

async function editAccess(page: Page, email: string, a: Access) {
  await menu(page, email, "Edit access");
  const dialog = page.getByRole("dialog");
  await fillAccess(dialog, "em-perm", a);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
}

async function deactivateMember(page: Page, email: string) {
  await menu(page, email, "Deactivate");
  await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: `Actions for ${email}` }).click();
  await expect(page.getByRole("menuitem", { name: "Reactivate" })).toBeVisible(); // the status really changed
  await page.keyboard.press("Escape");
}

/** Signs the member in through the real login form in a fresh browser context. */
async function memberPage(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
  return { context, page };
}

test("F1-2 restricted member: palette hides permission-gated entries and equals the sidebar", async ({ browser }, info) => {
  const email = process.env.E2E_RESTRICTED_EMAIL ?? REUSABLE_MEMBER_EMAIL;
  let touched = false;

  await asUser(browser, "owner", async (owner) => {
    try {
      await owner.goto("/dashboard/team");
      await expect(owner.getByRole("heading", { name: "Team members" })).toBeVisible();
      const exists = (await owner.getByText(email).count()) > 0;
      if (exists) {
        await reactivateMember(owner, email);
        touched = true; // from here on the member is active and must be deactivated again
        await editAccess(owner, email, { products: "none", orders: "none", customers: "read", settings: "read" });
      } else {
        await createMember(owner, email, { products: "none", orders: "none", customers: "read", settings: "read" });
        touched = true;
      }

      // Stage 1: no products access. Observation only.
      {
        const { context, page } = await memberPage(browser, email);
        try {
          await expect(page.getByRole("heading", { name: /something went wrong|overview|urban nest/i }).first()).toBeVisible({ timeout: 30_000 });
          const failed = await page.getByRole("heading", { name: "Something went wrong" }).count();
          record(info, ["F1-2"], "OBSERVATION: member with no products access, dashboard result", {
            member: email,
            dashboardRendered: failed === 0,
            observed: failed ? "error boundary: 'Something went wrong' (the notifications bell's inventory query is refused with 403 and takes the page down)" : "dashboard rendered",
            outOfScope: "Present on origin/main; components/dashboard/notifications.tsx is not modified by this ticket.",
          });
          await capture(page, info, { ac: ["F1-2"], folder: "F1-command-palette", name: "restricted-member-no-catalog-dashboard", note: "OBSERVATION: a member with no products access cannot render the dashboard at all (error boundary). Pre-existing on origin/main; not part of this ticket." });
        } finally {
          await context.close();
        }
      }

      // Stage 2: products read, no customers, no orders. The dashboard loads.
      await editAccess(owner, email, { products: "read", orders: "none", customers: "none", settings: "read" });
      {
        const { context, page } = await memberPage(browser, email);
        try {
          const sidebar = await sidebarLabels(page);
          for (const hidden of ["Customers", "Analytics", "Team members"]) expect(sidebar, `sidebar hides ${hidden}`).not.toContain(hidden);
          for (const shown of ["Overview", "Products", "Categories", "Collections", "Inventory", "Settings"]) expect(sidebar, `sidebar shows ${shown}`).toContain(shown);

          await openPalette(page);
          const palette = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
          for (const hidden of ["Customers", "Analytics", "Team members"]) expect(palette, `palette hides ${hidden}`).not.toContain(hidden);
          for (const shown of ["Overview", "Products", "Categories", "Collections", "Inventory", "Settings"]) expect(palette, `palette shows ${shown}`).toContain(shown);
          expect([...palette].sort(), "palette equals sidebar").toEqual([...sidebar].sort());

          record(info, ["F1-2"], "restricted member (products read, orders none, customers none, settings read): palette vs sidebar", { member: email, sidebar, palette });
          await capture(page, info, { ac: ["F1-2"], folder: "F1-command-palette", name: "restricted-member", note: "Restricted member (no customers, no orders): the palette omits Customers, Analytics and Team members, exactly like their sidebar." });
          await page.keyboard.press("Escape");
          await capture(page, info, { ac: ["F1-2"], folder: "F1-command-palette", name: "restricted-member-sidebar", note: "The same member's sidebar: Customers and Analytics are absent.", target: nav(page) });
        } finally {
          await context.close();
        }
      }
    } finally {
      if (touched) {
        await deactivateMember(owner, email);
        record(info, ["F1-2"], "cleanup", { member: email, action: "deactivated through the Team UI" });
      }
    }
  });
});
