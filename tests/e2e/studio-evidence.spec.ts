import { expect, test, type Page } from "@playwright/test";
import { API, baseline, measureAdmin, measureCategoryDialog, measureChartAxis, measureLogin, measureProductBanner, measureProductsToolbar, openPalette, paletteLabels, renderedContrast } from "./support/studio-measure";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * AFTER-state evidence for F1, F2, F4 (and the Admin/Login isolation checks), against the branch.
 * Run with EVIDENCE_LABEL=after, after studio-baseline.spec.ts has been run against origin/main.
 * Every "unchanged" assertion compares with a value MEASURED on origin/main (baseline-measurements.json).
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

const MERCHANT_ERROR_LIGHT = "rgb(184, 50, 50)";
const assertIsBranch = async (page: Page) => expect(await page.locator('div[data-area="merchant"]').count(), "merchant scope wrapper present").toBe(1);

const sidebarLinks = async (page: Page) => {
  const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
  const out: Record<string, string> = {};
  for (const a of await links.all()) out[(await a.innerText()).trim()] = new URL((await a.getAttribute("href")) ?? "", "http://x").pathname;
  return out;
};

// ---------------------------------------------------------------------------------------------------- F4 + F2

for (const scheme of ["light", "dark"] as const) {
  test(`F4/F2 merchant controls, dialog and error text (${scheme})`, async ({ browser }, info) => {
    await asUser(
      browser,
      "owner",
      async (page) => {
        if (scheme === "light") {
          const t = await measureProductsToolbar(page);
          await assertIsBranch(page);
          const before = baseline<typeof t>("light.productsToolbar");
          expect(t.trigger, "Ctrl+K trigger").toBeCloseTo(32, 0);
          expect(t.search, "search input").toBeCloseTo(32, 0);
          expect(t.status, "native select").toBeCloseTo(32, 0);
          expect(t.addProductLink, "default Button unchanged").toBe(before.addProductLink);
          expect(new Set([t.trigger, t.search, t.status]).size, "toolbar controls share one height").toBe(1);
          record(info, ["F4-1", "F4-2", "F4-3", "F4-4", "F4-6"], "merchant toolbar heights (px)", { before, after: t });
          await capture(page, info, { ac: ["F4-1", "F4-2", "F4-4", "F4-6"], folder: "F4-control-heights", name: "merchant-list-toolbar", note: "Products toolbar: search input, status select, sort select and the Ctrl+K trigger all 32px; Add product button unchanged." });
          await capture(page, info, { ac: ["F4-3"], folder: "F4-control-heights", name: "command-search-trigger", note: "Header Ctrl+K trigger at 32px, level with its neighbours.", target: page.getByRole("button", { name: "Search", exact: true }) });
        }

        const d = await measureCategoryDialog(page);
        const before = baseline<typeof d>(`${scheme}.categoryDialog`);
        expect(d.nameInput, "dialog Input (portal)").toBeCloseTo(32, 0);
        expect(d.parentSelect, "dialog NativeSelect (portal)").toBeCloseTo(32, 0);
        // Fills and borders must be exactly what origin/main renders.
        expect(d.invalidInputBorder).toBe(before.invalidInputBorder);
        expect(d.invalidInputBackground).toBe(before.invalidInputBackground);
        if (scheme === "light") {
          expect(d.errorText.fg, "merchant light error text colour").toEqual({ r: 184, g: 50, b: 50 });
          expect(await page.locator("#cat-name-msg").evaluate((el) => getComputedStyle(el).color)).toBe(MERCHANT_ERROR_LIGHT);
          expect(d.errorText.ratio, "field error contrast").toBeGreaterThanOrEqual(4.5);
          expect(d.formAlertText.ratio, "dialog alert contrast").toBeGreaterThanOrEqual(4.5);
        } else {
          // Approved change: dark error TEXT is #e46666 (was #e05252 at 4.41:1). Borders and fills are asserted unchanged above.
          expect(d.errorText.fg, "merchant dark error text colour").toEqual({ r: 228, g: 102, b: 102 });
          expect(d.errorText.ratio, "dark field error contrast").toBeGreaterThanOrEqual(4.5);
          expect(d.formAlertText.ratio, "dark dialog alert contrast").toBeGreaterThanOrEqual(4.5);
          expect(before.errorText.ratio, "origin/main baseline was below AA (documents why this changed)").toBeLessThan(4.5);
        }
        record(info, ["F2-1", "F2-2", "F2-3", "F2-4", "F4-2", "F4-5"], `category dialog ${scheme}: heights, rendered contrast and unchanged border/fill`, {
          before,
          after: d,
          note: scheme === "dark" ? "Dark error text changed with approval from #e05252 (4.41:1 on the dialog) to #e46666; the rendered contrast on the dialog surface now meets 4.5:1. Border and fill are unchanged." : "Light error text meets AA on the rendered dialog surface.",
        });
        await capture(page, info, { ac: scheme === "light" ? ["F2-1", "F2-2", "F4-2", "F4-5"] : ["F2-4"], folder: "F2-error-contrast", name: `${scheme}-mode-error`, note: `Merchant Add category dialog (${scheme}) after submitting empty: error text colour, 32px name input and 32px parent select.` });
        if (scheme === "light") await capture(page, info, { ac: ["F4-2", "F4-5"], folder: "F4-control-heights", name: "merchant-dialog-controls", note: "Dialog rendered in a portal: Input and NativeSelect both 32px.", target: page.getByRole("dialog") });

        const b = await measureProductBanner(page);
        const bb = baseline<typeof b>(`${scheme}.productBanner`);
        expect(b.border, "banner border unchanged").toBe(bb.border);
        expect(b.fill, "banner fill unchanged").toBe(bb.fill);
        if (scheme === "light") expect(b.text.ratio, "banner text contrast on its real (tinted) fill").toBeGreaterThanOrEqual(4.5);
        else {
          // Approved change: dark error text is #e46666. The banner text must now meet AA and must not be worse than origin/main.
          expect(b.text.ratio, "dark banner text contrast on its real (tinted) fill").toBeGreaterThanOrEqual(4.5);
          expect(b.text.ratio, "dark banner text is more readable than the origin/main baseline").toBeGreaterThan(bb.text.ratio);
        }
        record(info, ["F2-2", "F2-3", "F2-4"], `product form banner ${scheme}`, { before: bb, after: b });
        await capture(page, info, { ac: ["F2-3", ...(scheme === "light" ? ["F2-2"] : ["F2-4"])], folder: "F2-error-contrast", name: `${scheme}-error-banner`, note: `Product form error banner (${scheme}): border and tinted fill identical to origin/main; only the error text colour differs (light: #b83232; dark: #e46666, both at least 4.5:1).` });
      },
      { scheme },
    );
  });
}

// ---------------------------------------------------------------------------------- Admin and Login isolation

for (const scheme of ["light", "dark"] as const) {
  test(`Admin and Login keep their original rendering (${scheme})`, async ({ browser }, info) => {
    await asUser(
      browser,
      "platform",
      async (page) => {
        const a = await measureAdmin(page);
        const before = baseline<typeof a>(`${scheme}.admin`);
        expect(a.htmlArea, "no merchant scope on Admin").toBeNull();
        expect(a, "Admin measurements identical to origin/main").toEqual(before);
        expect(a.statusSelect, "Admin select stays 36px").toBeCloseTo(36, 0);
        record(info, ["F2-5", "F4-7"], `admin ${scheme}`, { before, after: a });
        await capture(page, info, { ac: ["F2-5", "F4-7"], folder: "admin-login-regression", name: `admin-${scheme}`, note: `Platform Admin create-organization form (${scheme}) with validation errors: same heights and error colour as origin/main.` });
        await capture(page, info, { ac: ["F2-5"], folder: "F2-error-contrast", name: `admin-error-${scheme}`, note: `Platform Admin error text (${scheme}): rendered colour identical to origin/main (global --error).`, target: page.locator("#cc-company-msg") });
        await page.goto("/admin/organizations");
        await page.getByRole("combobox", { name: "Status" }).waitFor();
        await capture(page, info, { ac: ["F4-7"], folder: "F4-control-heights", name: `admin-controls-${scheme}`, note: `Admin organizations toolbar (${scheme}): 36px status select, 32px search.` });
      },
      { scheme },
    );
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
    try {
      const page = await context.newPage();
      const l = await measureLogin(page);
      const before = baseline<typeof l>(`${scheme}.login`);
      expect(l.htmlArea).toBeNull();
      expect(l, "Login measurements identical to origin/main").toEqual(before);
      record(info, ["F2-5", "F4-7"], `login ${scheme}`, { before, after: l });
      await capture(page, info, { ac: ["F2-5", "F4-7"], folder: "admin-login-regression", name: `login-${scheme}`, note: `Login screen (${scheme}) with validation errors: same input height and error colour as origin/main.` });
      await capture(page, info, { ac: ["F2-5"], folder: "F2-error-contrast", name: `login-error-${scheme}`, note: `Login error text (${scheme}): rendered colour identical to origin/main.`, target: page.locator("form").first() });
      await capture(page, info, { ac: ["F4-7"], folder: "F4-control-heights", name: `login-controls-${scheme}`, note: `Login inputs (${scheme}) at their own 36px.`, target: page.locator("form").first() });
    } finally {
      await context.close();
    }
  });
}

// ---------------------------------------------------------------------------------------------------- F1

test.describe("F1 command palette", () => {
  test("owner: Team members is offered, and nothing else changed from origin/main", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const labels = await paletteLabels(page);
      await assertIsBranch(page);
      const before = baseline<string[]>("palette.owner");
      expect(labels).toContain("Team members");
      expect(labels.filter((l) => !before.includes(l)), "only Team members was added").toEqual(["Team members"]);
      expect(before.filter((l) => !labels.includes(l)), "nothing was removed").toEqual([]);

      await page.getByPlaceholder("Go to…").fill("team");
      await expect(page.getByRole("option", { name: "Team members" })).toBeVisible();
      record(info, ["F1-1"], "owner palette labels", { before, after: labels });
      await capture(page, info, { ac: ["F1-1"], folder: "F1-command-palette", name: "owner-team-visible", note: "Owner's command palette filtered to 'team': the Team members entry is offered." });
      await page.getByPlaceholder("Go to…").fill("");
      await page.getByRole("listbox").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByRole("option", { name: "Team members" })).toBeVisible();
      await capture(page, info, { ac: ["F1-1", "F1-3"], folder: "F1-command-palette", name: "owner-palette-scrolled", note: "Owner's full palette scrolled to the end: Team members sits before Settings, as in the sidebar." });
    });
  });

  test("staff: palette equals the sidebar by label and destination, with no Team", async ({ browser }, info) => {
    await asUser(browser, "staff", async (page) => {
      await page.goto("/dashboard");
      const sidebar = await sidebarLinks(page);
      await capture(page, info, { ac: ["F1-3"], folder: "F1-command-palette", name: "staff-sidebar", note: "Staff's sidebar (the reference list the palette must match).", target: page.getByRole("navigation", { name: "Main" }) });
      await openPalette(page);
      const palette = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
      expect(palette).not.toContain("Team members");
      expect([...palette].sort(), "same labels as the sidebar").toEqual(Object.keys(sidebar).sort());
      // Studio (decision D-11, AC-NAV-3): Themes and Customize are shown only to members who can change the design
      // (store:manage). Staff can only read settings, so those two entries are the one intended difference from origin/main.
      const studioOnly = ["Themes", "Customize"];
      expect(palette, "same labels as origin/main for this member, minus the design entries Studio hides from it").toEqual(baseline<string[]>("palette.staff").filter((l) => !studioOnly.includes(l)));
      record(info, ["F1-2", "F1-3"], "staff palette vs sidebar", { palette, sidebar });
      await capture(page, info, { ac: ["F1-3"], folder: "F1-command-palette", name: "staff-palette-sidebar-parity", note: "Staff's palette (top of the list): same entries as the sidebar." });
      await page.getByRole("listbox").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
      await capture(page, info, { ac: ["F1-2", "F1-3"], folder: "F1-command-palette", name: "staff-palette-scrolled", note: "Staff's palette scrolled to the end: the list finishes at Settings and has no Team members." });
    });
  });

  test("owner: choosing an entry navigates to the same destination as its sidebar link", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard");
      const sidebar = await sidebarLinks(page);
      const visited: Record<string, string> = {};
      for (const label of ["Categories", "Customers", "Team members", "Settings"]) {
        await page.goto("/dashboard");
        await openPalette(page);
        await page.getByRole("option", { name: label, exact: true }).click();
        await page.waitForURL((u) => u.pathname === sidebar[label]);
        visited[label] = new URL(page.url()).pathname;
        expect(visited[label], label).toBe(sidebar[label]);
      }
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      record(info, ["F1-4"], "palette navigation destinations", { sidebar: Object.fromEntries(Object.keys(visited).map((k) => [k, sidebar[k]])), visited });
      await capture(page, info, { ac: ["F1-4"], folder: "F1-command-palette", name: "palette-navigates", note: "After choosing 'Settings' in the palette the browser is on the Settings route (the last of four entries checked, each against its sidebar link)." });
    });
  });

  test("staff cannot reach Team by URL or through the API", async ({ browser }, info) => {
    await asUser(browser, "staff", async (page) => {
      await page.goto("/dashboard/team");
      await page.waitForURL((u) => !u.pathname.endsWith("/team"));
      expect(new URL(page.url()).pathname).toBe("/dashboard");
      const status = (await page.context().request.get(`${API}/team/members`)).status();
      expect(status, "API refuses staff on the owner-only team list").toBe(403);
      record(info, ["F1-5"], "staff team access", { urlRedirectedTo: new URL(page.url()).pathname, apiStatusForStaff: status });
      await capture(page, info, { ac: ["F1-5"], folder: "F1-command-palette", name: "staff-team-redirect", note: "Staff who opens /dashboard/team directly is sent to the Overview (server-side check unchanged)." });
    });
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/team");
      await expect(page.getByRole("heading", { name: "Team members" })).toBeVisible();
      const status = (await page.context().request.get(`${API}/team/members`)).status();
      expect(status, "the same endpoint serves the owner").toBe(200);
      record(info, ["F1-5"], "owner team access (control)", { apiStatusForOwner: status });
    });
  });

});

// ---------------------------------------------------------------------------------------------------- chart axis

test("F12-8 Analytics chart axis ticks are identical to origin/main", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    const axis = await measureChartAxis(page);
    const before = baseline<typeof axis>("chartAxis");
    expect(axis.ticks, "x-axis tick labels identical").toEqual(before.ticks);
    record(info, ["F12-8"], "chart x-axis ticks", { before: before.ticks, after: axis.ticks });
    await capture(page, info, { ac: ["F12-8"], folder: "F12-timezone", name: "analytics-chart-axis", note: "Analytics 'Sales over time' chart: x-axis tick labels equal those measured on origin/main.", target: page.locator(".recharts-wrapper").first() });
  });
});

// A tiny self-check that the contrast helper agrees with an independent value (guards the evidence tooling itself).
test("tooling self-check: rendered contrast helper reproduces a known pair", async ({ browser }) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard");
    await page.setContent('<p id="p" style="color:#000;background:#fff">x</p>');
    expect((await renderedContrast(page.locator("#p"))).ratio).toBe(21);
  });
});
