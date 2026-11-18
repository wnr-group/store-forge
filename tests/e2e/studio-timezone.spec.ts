import { expect, test, type Locator, type Page } from "@playwright/test";
import { apiGet, customerWithOrders } from "./support/studio-measure";
import { capture, LABEL, record } from "./support/studio-evidence";
import { asUser } from "./support/studio-session";

/**
 * F12: every date surface renders the STORE's timezone, proven against ground truth.
 *
 * Ground truth = the ISO timestamps the StoreForge API returns for the same records (read-only GETs with the signed-in
 * session). The expected text is computed here with Intl.DateTimeFormat("en-IN", { timeZone: <store timezone> }), where
 * the store timezone comes from the API itself (analytics.timezone) and is asserted to be Asia/Kolkata. The server must be
 * started with TZ=UTC (E2E_SERVER_TZ=UTC is recorded in the evidence) and the browser runs in America/Los_Angeles, so
 * neither equals the store timezone. A hydration-error watcher runs over every page load.
 *
 * No data is written. Dates are whatever the seed produced, so a "crosses midnight" case is only claimed for records
 * that really exist (counted and listed in the evidence); none is manufactured.
 */
test.skip(LABEL !== "after", "After-state spec: run with EVIDENCE_LABEL=after against the branch.");
test.describe.configure({ timeout: 240_000 });

const BROWSER_TZ = "America/Los_Angeles";
type Kind = "date" | "dateTime";
const OPTS: Record<Kind, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  dateTime: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
};
const fmt = (iso: string, kind: Kind, timeZone: string) => new Intl.DateTimeFormat("en-IN", { ...OPTS[kind], timeZone }).format(new Date(iso));

/** What each timezone would print, so a row can be classified as discriminating (store time differs from server/browser time). */
function classify(iso: string, kind: Kind, storeTz: string) {
  const store = fmt(iso, kind, storeTz);
  const utc = fmt(iso, kind, "UTC");
  const la = fmt(iso, kind, BROWSER_TZ);
  const dayOf = (tz: string) => fmt(iso, "date", tz);
  return { store, utc, la, discriminates: store !== utc && store !== la, crossesMidnightVsUtc: dayOf(storeTz) !== dayOf("UTC") };
}

function watchHydration(page: Page) {
  const bad: string[] = [];
  page.on("console", (m) => {
    if (/hydrat/i.test(m.text())) bad.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => {
    if (/hydrat/i.test(e.message)) bad.push(`pageerror: ${e.message.slice(0, 200)}`);
  });
  return bad;
}

async function storeTimezone(page: Page): Promise<string> {
  const a = await apiGet<{ timezone: string }>(page, "/analytics?range=30");
  expect(a.timezone, "the seeded store's timezone, as reported by the API").toBe("Asia/Kolkata");
  return a.timezone;
}

const text = async (l: Locator) => (await l.innerText()).trim();

test.describe("store-timezone dates (server TZ=UTC, browser America/Los_Angeles, store Asia/Kolkata)", () => {
  test("browser and server timezones really differ from the store's", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard");
      const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      expect(tz).toBe(BROWSER_TZ);
      expect(process.env.E2E_SERVER_TZ, "start the frontend with TZ=UTC and export E2E_SERVER_TZ=UTC").toBe("UTC");
      record(info, ["F12-7"], "timezone setup", { storeTz: await storeTimezone(page), serverTZ: process.env.E2E_SERVER_TZ, browserTZ: tz });
    }, { timezoneId: BROWSER_TZ });
  });

  test("Customers list", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const bad = watchHydration(page);
      const tz = await storeTimezone(page);
      const api = await apiGet<{ email: string; lastOrderAt: string | null; createdAt: string }[]>(page, "/customers");
      await page.goto("/dashboard/customers");
      const rows = page.locator("tbody tr");
      await rows.first().waitFor();
      const n = Math.min(await rows.count(), 12);
      const checked: unknown[] = [];
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        const email = await text(row.locator("td").first().locator("span.block"));
        const rec = api.find((c) => c.email === email);
        expect(rec, `API record for ${email}`).toBeTruthy();
        const cells = row.locator("td");
        const count = await cells.count();
        const last = await text(cells.nth(count - 2));
        const created = await text(cells.nth(count - 1));
        const expLast = rec!.lastOrderAt ? fmt(rec!.lastOrderAt, "date", tz) : "—";
        const expCreated = fmt(rec!.createdAt, "date", tz);
        expect(last, `${email} last order`).toBe(expLast);
        expect(created, `${email} registered`).toBe(expCreated);
        checked.push({ email, lastOrderAt: rec!.lastOrderAt, createdAt: rec!.createdAt, expectedLast: expLast, expectedCreated: expCreated, renderedLast: last, renderedCreated: created });
      }
      expect(checked.length).toBeGreaterThanOrEqual(5);
      expect(bad, "hydration errors").toEqual([]);
      record(info, ["F12-1", "F12-7"], "customers list: rendered vs expected", { rows: checked, hydrationErrors: bad });
      await rows.first().scrollIntoViewIfNeeded();
      await capture(page, info, { ac: ["F12-1", "F12-7"], folder: "F12-timezone", name: "customers-list", note: "Customers list: 'Last order' and 'Registered' dates equal the store-timezone rendering of the API timestamps.", fullPage: true });
    }, { timezoneId: BROWSER_TZ });
  });

  test("Customer detail", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const bad = watchHydration(page);
      const tz = await storeTimezone(page);
      const c = await customerWithOrders(page);
      const d = await apiGet<{ createdAt: string; lastOrderAt: string | null; orders: { orderNumber: number; placedAt: string }[] }>(page, `/customers/${c.id}`);
      await page.goto(`/dashboard/customers/${c.id}`);
      await expect(page.getByText(`Customer since ${fmt(d.createdAt, "date", tz)}`)).toBeVisible();
      await expect(page.locator("dt", { hasText: "Last order" }).locator("xpath=following-sibling::dd[1]")).toHaveText(d.lastOrderAt ? fmt(d.lastOrderAt, "date", tz) : "—");
      const shown: unknown[] = [];
      for (const o of d.orders.slice(0, 10)) {
        const row = page.locator("tbody tr", { hasText: `#${o.orderNumber}` }).first();
        const got = await text(row.locator("td").nth(1));
        expect(got, `order #${o.orderNumber}`).toBe(fmt(o.placedAt, "date", tz));
        shown.push({ order: o.orderNumber, placedAt: o.placedAt, expected: fmt(o.placedAt, "date", tz), rendered: got });
      }
      expect(shown.length).toBeGreaterThan(0);
      expect(bad).toEqual([]);
      record(info, ["F12-1", "F12-7"], "customer detail: rendered vs expected", { customerSince: d.createdAt, lastOrderAt: d.lastOrderAt, orders: shown, hydrationErrors: bad });
      await capture(page, info, { ac: ["F12-1", "F12-7"], folder: "F12-timezone", name: "customer-detail", note: "Customer detail: 'Customer since', 'Last order' and the order-history dates equal the store-timezone rendering.", fullPage: true });
    }, { timezoneId: BROWSER_TZ });
  });

  test("Inventory recent adjustments", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const bad = watchHydration(page);
      const tz = await storeTimezone(page);
      const api = await apiGet<{ productName: string; delta: number; quantityAfter: number; createdAt: string }[]>(page, "/inventory/adjustments");
      await page.goto("/dashboard/inventory");
      const items = page.locator("section[aria-labelledby=history] li");
      await items.first().waitFor();
      const n = Math.min(await items.count(), 10);
      expect(n).toBeGreaterThanOrEqual(5);
      const shown: unknown[] = [];
      for (let i = 0; i < n; i++) {
        // Several seeded adjustments share one timestamp, so rows are matched to their API record by product, delta and
        // resulting quantity (all printed in the row), not by position.
        const li = items.nth(i);
        const body = await li.innerText();
        const name = (await text(li.locator("span.min-w-0 > span.font-medium"))) || "";
        const m = body.match(/([+-]?\d+)\s*→\s*(\d+)/);
        expect(m, `row ${i} shows "delta → quantity"`).toBeTruthy();
        const delta = Number(m![1]);
        const after = Number(m![2]);
        const candidates = api.filter((a) => a.productName === name && a.delta === delta && a.quantityAfter === after);
        expect(candidates.length, `API record for row ${i} (${name} ${delta} → ${after})`).toBeGreaterThan(0);
        const got = await text(li.locator("span.text-right > span.block"));
        const expectedAny = candidates.map((c) => fmt(c.createdAt, "dateTime", tz));
        expect(expectedAny, `adjustment ${i} (${name})`).toContain(got);
        shown.push({ i, product: name, delta, after, candidateTimestamps: candidates.map((c) => c.createdAt), expected: expectedAny, rendered: got });
      }
      expect(bad).toEqual([]);
      record(info, ["F12-1", "F12-7"], "inventory adjustments: rendered vs expected", { rows: shown, hydrationErrors: bad });
      await page.locator("section[aria-labelledby=history]").scrollIntoViewIfNeeded();
      await capture(page, info, { ac: ["F12-1", "F12-7"], folder: "F12-timezone", name: "inventory-adjustments", note: "Inventory 'Recent adjustments': times equal the store-timezone rendering of the API timestamps.", fullPage: true });
    }, { timezoneId: BROWSER_TZ });
  });

  for (const [name, url, folderName, ac] of [
    ["Overview recent orders", "/dashboard", "overview-orders", ["F12-1", "F12-2", "F12-7"]],
    ["Analytics recent orders", "/dashboard/analytics", "analytics-orders", ["F12-1", "F12-2", "F12-7"]],
  ] as const) {
    test(name, async ({ browser }, info) => {
      await asUser(browser, "owner", async (page) => {
        const bad = watchHydration(page);
        const tz = await storeTimezone(page);
        const a = await apiGet<{ recentOrders: { orderNumber: number; placedAt: string }[] }>(page, "/analytics?range=30");
        await page.goto(url);
        const shown: unknown[] = [];
        for (const o of a.recentOrders) {
          const li = page.locator("li", { hasText: `#${o.orderNumber}` }).first();
          await li.waitFor();
          const got = await text(li.locator("span.block.text-xs.text-muted-foreground").first());
          expect(got, `order #${o.orderNumber}`).toBe(fmt(o.placedAt, "dateTime", tz));
          shown.push({ order: o.orderNumber, placedAt: o.placedAt, ...classify(o.placedAt, "dateTime", tz), rendered: got });
        }
        expect(shown.length).toBeGreaterThan(0);
        expect(bad).toEqual([]);
        record(info, [...ac], `${name}: rendered vs expected`, { rows: shown, hydrationErrors: bad });
        await page.getByText("Recent orders", { exact: true }).evaluate((el) => el.scrollIntoView({ block: "start" }));
        await capture(page, info, { ac: [...ac], folder: "F12-timezone", name: folderName, note: `${name}: order times equal the store-timezone rendering of the API's placedAt values.`, fullPage: true });
      }, { timezoneId: BROWSER_TZ });
    });
  }

  test("Products Updated column (client component) and no hydration error", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const bad = watchHydration(page);
      const tz = await storeTimezone(page);
      const api = await apiGet<{ name: string; updatedAt: string }[]>(page, "/products");
      await page.goto("/dashboard/products");
      const rows = page.locator("tbody tr");
      await rows.first().waitFor();
      await page.waitForLoadState("networkidle");
      const n = Math.min(await rows.count(), 15);
      const shown: unknown[] = [];
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        const name = await text(row.locator("td:nth-child(2) a span.font-medium"));
        const rec = api.find((p) => p.name === name);
        if (!rec) continue;
        const got = await text(row.locator("td:nth-child(7)"));
        expect(got, `${name} updated`).toBe(fmt(rec.updatedAt, "date", tz));
        shown.push({ product: name, updatedAt: rec.updatedAt, ...classify(rec.updatedAt, "date", tz), rendered: got });
      }
      expect(shown.length, "rows matched to API records").toBeGreaterThanOrEqual(5);
      expect(bad, "hydration errors while server TZ, browser TZ and store TZ all differ").toEqual([]);
      record(info, ["F12-1", "F12-3", "F12-7"], "products Updated: rendered vs expected", { rows: shown, hydrationErrors: bad });
      await capture(page, info, { ac: ["F12-1", "F12-3", "F12-7"], folder: "F12-timezone", name: "products-updated", note: "Products 'Updated' column (client component): dates equal the store-timezone rendering; no hydration error was logged.", fullPage: true });
    }, { timezoneId: BROWSER_TZ });
  });

  test("how many real records discriminate between store, server and browser time (no data is created)", async ({ browser }, info) => {
    await asUser(browser, "owner", async (page) => {
      const tz = await storeTimezone(page);
      const a = await apiGet<{ recentOrders: { orderNumber: number; placedAt: string }[] }>(page, "/analytics?range=30");
      const ad = await apiGet<{ productName: string; createdAt: string }[]>(page, "/inventory/adjustments");
      const pr = await apiGet<{ name: string; updatedAt: string }[]>(page, "/products");
      const cu = await apiGet<{ email: string; createdAt: string; lastOrderAt: string | null }[]>(page, "/customers");
      const all = [
        ...a.recentOrders.map((o) => ({ surface: "orders", id: `#${o.orderNumber}`, iso: o.placedAt, kind: "dateTime" as Kind })),
        ...ad.slice(0, 10).map((x, i) => ({ surface: "adjustments", id: `${i}:${x.productName}`, iso: x.createdAt, kind: "dateTime" as Kind })),
        ...pr.map((p) => ({ surface: "products", id: p.name, iso: p.updatedAt, kind: "date" as Kind })),
        ...cu.flatMap((c) => [{ surface: "customers", id: `${c.email} registered`, iso: c.createdAt, kind: "date" as Kind }, ...(c.lastOrderAt ? [{ surface: "customers", id: `${c.email} last order`, iso: c.lastOrderAt, kind: "date" as Kind }] : [])]),
      ].map((r) => ({ ...r, ...classify(r.iso, r.kind, tz) }));
      const discriminating = all.filter((r) => r.discriminates).length;
      const crossing = all.filter((r) => r.crossesMidnightVsUtc);
      expect(discriminating, "records whose store-time text differs from both server and browser rendering").toBeGreaterThan(0);
      record(info, ["F12-4"], "discriminating records in the seeded data", {
        total: all.length,
        discriminating,
        crossesMidnightVsUtc: crossing.length,
        examples: crossing.slice(0, 6).map((r) => ({ surface: r.surface, id: r.id, iso: r.iso, store: r.store, utc: r.utc })),
        note: crossing.length ? "Real records exist where the store-time CALENDAR DAY differs from UTC; the surface tests above assert those rows too." : "No seeded record crosses midnight between UTC and the store timezone: a deterministic midnight case is NOT available in this data and none was created.",
      });
    }, { timezoneId: BROWSER_TZ });
  });
});
