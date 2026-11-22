import { expect, test, type Page } from "@playwright/test";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * Sidebar clipping (Studio polish). Run twice: EVIDENCE_LABEL=before against the unfixed code records the defect
 * (measurements + screenshots, no fix assertions); EVIDENCE_LABEL=after asserts the fix.
 *
 * The fix is merchant-only: edge-shadow scroll cue, a compact density on short screens, and the active item revealed on
 * navigation. Platform Admin must keep its sidebar exactly as it was.
 */
test.describe.configure({ timeout: 240_000 });

const NAV_HEIGHTS = [600, 700, 800, 900] as const;
const AFTER = LABEL === "after";

type Metrics = { client: number; scroll: number; overflowPx: number; items: number; linkH: number; hiddenAtTop: string[]; activeVisible: boolean | null; backgroundImage: string; attachments: string };

async function metrics(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const box = document.querySelector("aside")!.querySelector("div.overflow-y-auto") as HTMLElement;
    const links = [...box.querySelectorAll("nav a")] as HTMLElement[];
    const bx = box.getBoundingClientRect();
    const inView = (a: HTMLElement) => a.getBoundingClientRect().top >= bx.top - 1 && a.getBoundingClientRect().bottom <= bx.bottom + 1;
    const active = box.querySelector('a[aria-current="page"]') as HTMLElement | null;
    const cs = getComputedStyle(box);
    return {
      client: box.clientHeight,
      scroll: box.scrollHeight,
      overflowPx: box.scrollHeight - box.clientHeight,
      items: links.length,
      linkH: Math.round(links[0].getBoundingClientRect().height),
      hiddenAtTop: links.filter((a) => !inView(a)).map((a) => a.textContent!.trim()),
      activeVisible: active ? inView(active) : null,
      backgroundImage: cs.backgroundImage,
      attachments: cs.backgroundAttachment,
    };
  });
}

/** Every link, brought into view by scrolling the sidebar only, must be fully visible and not covered by the footer. */
async function everyLinkReachable(page: Page) {
  const names = await page.getByRole("navigation", { name: "Main" }).getByRole("link").allInnerTexts();
  for (const raw of names) {
    const name = raw.trim();
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
    await link.scrollIntoViewIfNeeded();
    const ok = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    });
    expect(ok, `"${name}" is reachable and not covered`).toBe(true);
  }
  return names.map((n) => n.trim());
}

for (const scheme of ["light", "dark"] as const) {
  for (const h of NAV_HEIGHTS) {
    test(`owner sidebar at ${h}px height (${scheme})`, async ({ browser }, info) => {
      await asUser(
        browser,
        "owner",
        async (page) => {
          await page.goto("/dashboard/settings");
          await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
          // let the "reveal the active item" effect run before measuring
          await page.waitForTimeout(600);
          const m = await metrics(page);
          record(info, ["SB-1", "SB-2", "SB-3", "SB-4"], `owner sidebar at ${h}px (${scheme}) on the Settings page`, m as unknown as Record<string, unknown>);
          await capture(page, info, { ac: ["SB-1", "SB-2", "SB-6"], folder: "sidebar-polish", name: `owner-${h}-${scheme}-on-load`, note: `Owner on Settings at ${h}px height (${scheme}), as the page loads: what the sidebar shows without scrolling.` });

          if (AFTER) {
            expect(m.activeVisible, "the active item (Settings) is visible on load").toBe(true);
            if (h >= 800) expect(m.overflowPx, `owner nav fits at ${h}px`).toBeLessThanOrEqual(0);
            if (m.overflowPx > 0) {
              expect(m.backgroundImage, "scroll cue present when the nav scrolls").not.toBe("none");
              expect(m.attachments).toContain("local");
            }
            expect(m.linkH, "link height").toBe(h <= 830 ? 32 : 36);
          }

          const labels = await everyLinkReachable(page);
          expect(labels).toContain("Settings");
          expect(labels).toContain("Team members");
          await capture(page, info, { ac: ["SB-1"], folder: "sidebar-polish", name: `owner-${h}-${scheme}-scrolled-to-end`, note: `Owner at ${h}px (${scheme}) after scrolling the sidebar to its end: the last items are fully visible above the user footer.` });
        },
        { scheme, viewport: { width: 1280, height: h } },
      );
    });
  }
}

test("staff sidebar at 700px height still reaches every item", async ({ browser }, info) => {
  await asUser(
    browser,
    "staff",
    async (page) => {
      await page.goto("/dashboard/settings");
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await page.waitForTimeout(600);
      const m = await metrics(page);
      if (AFTER) expect(m.activeVisible).toBe(true);
      const labels = await everyLinkReachable(page);
      expect(labels).not.toContain("Team members");
      record(info, ["SB-1", "SB-2"], "staff sidebar at 700px", m as unknown as Record<string, unknown>);
      await capture(page, info, { ac: ["SB-1", "SB-2"], folder: "sidebar-polish", name: "staff-700-light-on-load", note: "Staff on Settings at 700px height." });
    },
    { viewport: { width: 1280, height: 700 } },
  );
});

test("Platform Admin sidebar is unchanged (no scroll cue, original link height)", async ({ browser }, info) => {
  await asUser(
    browser,
    "platform",
    async (page) => {
      await page.goto("/admin/organizations");
      await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
      const m = await metrics(page);
      record(info, ["SB-5"], "admin sidebar at 600px", m as unknown as Record<string, unknown>);
      expect(m.backgroundImage, "Admin keeps a plain sidebar").toBe("none");
      expect(m.linkH, "Admin link height stays 36px at a short viewport").toBe(36);
      await capture(page, info, { ac: ["SB-5"], folder: "sidebar-polish", name: "admin-600-light", note: "Platform Admin at 600px height: sidebar unchanged." });
    },
    { viewport: { width: 1280, height: 600 } },
  );
});

test("navigating reveals the active item in a clipped sidebar", async ({ browser }, info) => {
  test.skip(!AFTER, "Fix assertion: run with EVIDENCE_LABEL=after.");
  await asUser(
    browser,
    "owner",
    async (page) => {
      await page.goto("/dashboard");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings", exact: true }).click();
      await page.waitForURL(/\/dashboard\/settings/);
      await expect.poll(async () => (await metrics(page)).activeVisible).toBe(true);
      record(info, ["SB-2"], "active item revealed after in-app navigation at 700px", await metrics(page) as unknown as Record<string, unknown>);
    },
    { viewport: { width: 1280, height: 700 } },
  );
});
