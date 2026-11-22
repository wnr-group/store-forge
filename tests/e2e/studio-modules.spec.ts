import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { contrast, openPalette, parseRgb, surfaceBehind } from "./support/studio-measure";
import { asUser } from "./support/studio-session";

/**
 * Studio QA sweep, READ-ONLY (EVIDENCE_LABEL=after): the nine merchant modules at six viewports in both themes, the
 * keyboard behaviour of the shared chrome, focus trapping in the five dialogs, and the skip link in dark mode.
 * Dialogs are opened and closed but never submitted with valid data, so nothing is written to the database.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 480_000 });

const hydrated = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.area ?? null)).toBe("merchant");

const MODULES = [
  { id: "overview", url: "/dashboard" },
  { id: "products", url: "/dashboard/products" },
  { id: "categories", url: "/dashboard/categories" },
  { id: "collections", url: "/dashboard/collections" },
  { id: "inventory", url: "/dashboard/inventory" },
  { id: "customers", url: "/dashboard/customers" },
  { id: "analytics", url: "/dashboard/analytics" },
  { id: "settings", url: "/dashboard/settings" },
  { id: "team", url: "/dashboard/team" },
] as const;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;
const SHOT_AT = new Set(["1440x900", "390x844"]); // screenshots for the desktop and mobile extremes; every viewport is still measured

// ------------------------------------------------------------------------------------------------ module sweep

for (const m of MODULES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${m.id} (${scheme}): loads, no overflow, no console or page errors, at six viewports`, async ({ browser }, info) => {
      await asUser(browser, "owner", async (page) => {
        const problems: string[] = [];
        page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
        page.on("console", (c) => {
          if (c.type() === "error") problems.push(`console.error: ${c.text().slice(0, 300)}`);
        });

        await page.goto(m.url);
        await hydrated(page);
        const heading = page.locator("main h1").first();
        await expect(heading).toBeVisible({ timeout: 60_000 });
        const title = (await heading.innerText()).trim();
        await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);

        const rows: Record<string, unknown>[] = [];
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await expect(heading).toBeVisible();
          const m1 = await page.evaluate(() => {
            const de = document.documentElement;
            const main = document.querySelector("main")!.getBoundingClientRect();
            return { overflowX: de.scrollWidth - de.clientWidth, mainRight: Math.round(main.right), innerWidth: window.innerWidth };
          });
          expect(m1.overflowX, `${m.id} ${vp.name} ${scheme}: no horizontal page overflow`).toBeLessThanOrEqual(1);
          expect(m1.mainRight, `${m.id} ${vp.name}: main stays inside the viewport`).toBeLessThanOrEqual(m1.innerWidth + 1);
          rows.push({ viewport: vp.name, ...m1 });
          if (SHOT_AT.has(vp.name)) {
            await capture(page, info, { ac: ["QA-MOD-" + m.id], folder: m.id, name: `${vp.name}-${scheme}`, note: `${m.id} at ${vp.name} (${scheme}); heading "${title}".` });
          }
        }
        record(info, ["QA-MOD-" + m.id], `${m.id} ${scheme}: six-viewport sweep`, { title, rows, consoleOrPageErrors: problems });
        expect(problems, "no console errors or page errors (this includes React hydration mismatches)").toEqual([]);
      }, { scheme, viewport: { width: 1440, height: 900 } });
    });
  }
}

// ------------------------------------------------------------------------------------------------ dialogs: keyboard trap + fit

type DialogCase = { name: string; url: string; open: (p: Page) => Promise<void> };
const DIALOGS: DialogCase[] = [
  { name: "Add category", url: "/dashboard/categories", open: (p) => p.getByRole("button", { name: /add category/i }).first().click() },
  { name: "Add customer", url: "/dashboard/customers", open: (p) => p.getByRole("button", { name: /add customer/i }).click() },
  { name: "Adjust stock", url: "/dashboard/inventory", open: (p) => p.getByRole("button", { name: /^Adjust stock for/ }).first().click() },
  { name: "Add team member", url: "/dashboard/team", open: (p) => p.getByRole("button", { name: "Add member" }).click() },
  {
    name: "Edit customer",
    url: "/dashboard/customers",
    open: async (p) => {
      await p.locator('a[href^="/dashboard/customers/"]').first().click();
      await p.waitForURL(/\/dashboard\/customers\/[^/]+$/);
      await hydrated(p);
      await p.getByRole("button", { name: "Edit" }).click();
    },
  },
];

for (const d of DIALOGS) {
  test(`${d.name}: focus enters the dialog, Tab and Shift+Tab never leave it, it fits at every viewport`, async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto(d.url);
      await hydrated(page);
      await d.open(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      /**
       * Focus may rest for an instant on the dialog's own focus guard when it wraps (base-ui's trap redirects it back in).
       * That is tolerated only if the element really is a guard and focus settles inside the dialog; focus landing on any
       * real page control, or never coming back, fails.
       */
      const guarded = async (label: string) => {
        const now = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return { inside: !!el?.closest('[role="dialog"]'), guard: !!el?.hasAttribute("data-base-ui-focus-guard"), tag: el?.tagName ?? "none" };
        });
        if (!now.inside) expect(now.guard, `${label}: focus outside the dialog must be a focus guard, was <${now.tag}>`).toBe(true);
        await expect.poll(inside, { message: `${label}: focus settles inside the dialog`, timeout: 2000 }).toBe(true);
      };
      expect(await inside(), "initial focus is inside the dialog").toBe(true);
      const initial = await page.evaluate(() => document.activeElement?.tagName + "#" + (document.activeElement as HTMLElement | null)?.id);

      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        await guarded(`Tab #${i + 1}`);
      }
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Shift+Tab");
        await guarded(`Shift+Tab #${i + 1}`);
      }

      const fits: Record<string, unknown>[] = [];
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // let the resize and the dvh-based max-height settle (two frames) before measuring the dialog
        await page.waitForFunction(([w, h]) => window.innerWidth === w && window.innerHeight === h, [vp.width, vp.height]);
        await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
        const box = await dialog.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
        });
        expect(box.left, `${d.name} ${vp.name}: not clipped left`).toBeGreaterThanOrEqual(0);
        expect(box.right, `${d.name} ${vp.name}: not clipped right`).toBeLessThanOrEqual(vp.width);
        expect(box.top, `${d.name} ${vp.name}: not clipped top (box ${JSON.stringify(box)}, vh ${vp.height})`).toBeGreaterThanOrEqual(0);
        expect(box.bottom, `${d.name} ${vp.name}: not clipped bottom`).toBeLessThanOrEqual(vp.height);
        const closer = dialog.getByRole("button", { name: /^(Cancel|Close)$/ }).first();
        const cb = await closer.boundingBox();
        expect(cb && cb.y >= 0 && cb.y + cb.height <= vp.height, `${d.name} ${vp.name}: a way to dismiss it is on screen`).toBe(true);
        fits.push({ viewport: vp.name, ...box });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      // the dialog animates its width after a resize; wait until its box stops changing before taking the evidence image
      await expect
        .poll(async () => {
          const r = () => dialog.evaluate((el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.top)}`; });
          const first = await r();
          await page.waitForTimeout(250);
          return (await r()) === first;
        }, { message: "dialog size is stable before the screenshot", timeout: 10_000 })
        .toBe(true);
      await capture(page, info, { ac: ["QA-DLG"], folder: "responsive", name: `dialog-${d.name.toLowerCase().replaceAll(" ", "-")}-1280x720`, note: `${d.name} dialog at 1280x720.` });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      record(info, ["QA-DLG"], `${d.name}: focus trap and fit`, { initialFocus: initial, tabsChecked: 80, fits });
    });
  });
}

// ------------------------------------------------------------------------------------------------ command palette (owner)

test("command palette: Ctrl+K, search, arrow keys, Enter navigates, Escape closes and focus returns", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard");
    await hydrated(page);
    await openPalette(page);
    const input = page.getByPlaceholder("Go to…");
    await expect(input).toBeFocused();
    const all = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    expect(all).toContain("Team members");

    await input.fill("team");
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option").first()).toContainText("Team members");
    await input.fill("");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const selected = (await page.locator('[role="option"][aria-selected="true"]').innerText()).trim();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.pathname), { message: `Enter on "${selected}" navigates`, timeout: 15_000 }).not.toBe("/dashboard");
    const href = await page.evaluate(() => location.pathname);

    await page.goto("/dashboard");
    await hydrated(page);
    const trigger = page.getByRole("button", { name: "Search" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => trigger.evaluate((el) => el === document.activeElement), { message: "focus returns to the Search button after Escape" }).toBe(true);
    record(info, ["QA-CMD"], "owner palette keyboard flow", { options: all, selected, navigatedTo: href });
  });
});

// ------------------------------------------------------------------------------------------------ keyboard navigation

test("keyboard: every tab stop on Products has a visible focus indicator and an accessible name", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/products");
    await hydrated(page);
    await expect(page.locator("main h1").first()).toBeVisible();
    const stops: Record<string, unknown>[] = [];
    const bad: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const name = (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.innerText || (el as HTMLInputElement).placeholder || el.getAttribute("title") || "").trim();
        const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== "none" && cs.boxShadow !== "");
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), role: el.getAttribute("role"), name: name.slice(0, 40), ring, onScreen: r.width > 0 && r.height > 0 };
      });
      if (!s) { bad.push(`stop ${i + 1}: focus lost to <body>`); break; }
      stops.push(s);
      if (!s.name) bad.push(`stop ${i + 1} <${s.tag}> has no accessible name`);
      if (!s.ring) bad.push(`stop ${i + 1} <${s.tag}> "${s.name}" has no visible focus indicator`);
      if (!s.onScreen) bad.push(`stop ${i + 1} <${s.tag}> "${s.name}" is not rendered`);
    }
    expect(stops[0]).toMatchObject({ tag: "a", name: "Skip to main content" });
    record(info, ["QA-KBD"], "Products tab sequence", { stops, problems: bad });
    expect(bad, "tab-stop problems").toEqual([]);
  });
});

test("keyboard: Space activates a button and Shift+Tab returns to the skip link", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/categories");
    await hydrated(page);
    const add = page.getByRole("button", { name: /add category/i }).first();
    await add.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => add.evaluate((el) => el === document.activeElement)).toBe(true);

    await page.goto("/dashboard/categories");
    await hydrated(page);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    record(info, ["QA-KBD"], "Space opens dialog; Shift+Tab reaches skip link", { ok: true });
  });
});

// ------------------------------------------------------------------------------------------------ skip link in dark mode

test("skip link in dark mode: visible on focus, readable (4.5:1 on its own fill), ring present", async ({ browser }, info) => {
  await asUser(browser, "owner", async (page) => {
    await page.goto("/dashboard/products");
    await hydrated(page);
    await page.keyboard.press("Tab");
    const link = page.getByRole("link", { name: "Skip to main content" });
    await expect(link).toBeFocused();
    const fg = parseRgb(await link.evaluate((el) => getComputedStyle(el).color));
    const bg = await surfaceBehind(link);
    const ratio = contrast(fg, bg);
    expect(ratio, "text on the skip-link fill").toBeGreaterThanOrEqual(4.5);
    const ring = await link.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe("none");
    await capture(page, info, { ac: ["SL-1"], folder: "accessibility", name: "skip-link-focused-dark", note: "Skip link focused in dark mode (1280x800)." });
    record(info, ["SL-1"], "skip link dark contrast", { ratio: Math.round(ratio * 100) / 100 });
  }, { scheme: "dark" });
});

// ------------------------------------------------------------------------------------------------ Edit customer: focus return

for (const [how, close] of [
  ["Escape", (p: Page) => p.keyboard.press("Escape")],
  ["X button", (p: Page) => p.getByRole("dialog").getByRole("button", { name: "Close" }).click()],
  ["Cancel", (p: Page) => p.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()],
] as const) {
  test(`Edit customer closed with ${how}: focus returns to the Edit button`, async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/customers");
      await hydrated(page);
      await page.locator('a[href^="/dashboard/customers/"]').first().click();
      await page.waitForURL(/\/dashboard\/customers\/[^/]+$/);
      await hydrated(page);
      const edit = page.getByRole("button", { name: "Edit" });
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "focus moves into the dialog").toBe(true);
      await close(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect.poll(() => edit.evaluate((el) => el === document.activeElement), { message: "focus is back on the Edit button" }).toBe(true);
      record(info, ["DF-1"], `Edit customer closed with ${how}`, { focusReturned: true });
    });
  });
}
