import { expect, type Locator, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_DIR } from "./studio-evidence";

/**
 * Measurements read from the RENDERED page (computed styles and bounding boxes). The same functions run against
 * origin/main (writing baseline-measurements.json) and against the branch (compared with that file), so every
 * "unchanged" claim is checked against a measured baseline, never an assumed one.
 */
export const height = async (l: Locator) => Math.round((await l.evaluate((el) => el.getBoundingClientRect().height)) * 10) / 10;
export const colorOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).color);

export type Rgb = { r: number; g: number; b: number };

/** The colour a text node is actually painted on: ancestor backgrounds composited bottom-up (alpha respected). */
export async function surfaceBehind(l: Locator): Promise<Rgb> {
  return l.evaluate((el) => {
    const parse = (s: string) => {
      const srgb = s.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
      if (srgb) return { r: +srgb[1] * 255, g: +srgb[2] * 255, b: +srgb[3] * 255, a: srgb[4] === undefined ? 1 : +srgb[4] };
      const rgb = s.match(/^rgba?\(([^)]+)\)$/);
      if (rgb) {
        const p = rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
      }
      const ok = s.match(/^oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)$/);
      if (ok) {
        // OKLab -> linear sRGB -> gamma-encoded sRGB (Chrome reports colour-mix() results in this form).
        const [L, A, B] = [+ok[1], +ok[2], +ok[3]];
        const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
        const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
        const sv = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
        const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sv, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sv, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sv];
        const enc = lin.map((v) => 255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055)));
        return { r: enc[0], g: enc[1], b: enc[2], a: ok[4] === undefined ? 1 : +ok[4] };
      }
      throw new Error(`unsupported computed colour format: ${s}`);
    };
    const layers: { r: number; g: number; b: number; a: number }[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a >= 1) break;
    }
    let out = { r: 255, g: 255, b: 255 }; // the browser canvas when nothing opaque is found
    for (const c of layers.reverse()) out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
    return { r: Math.round(out.r), g: Math.round(out.g), b: Math.round(out.b) };
  });
}

export function parseRgb(s: string): Rgb {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`cannot parse ${s}`);
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2] };
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (c: Rgb) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
/** WCAG 2.x contrast ratio. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast of a rendered text element against the surface actually behind it. */
export async function renderedContrast(l: Locator) {
  const fg = parseRgb(await colorOf(l));
  const bg = await surfaceBehind(l);
  return { fg, bg, ratio: Math.round(contrast(fg, bg) * 100) / 100 };
}

// ---- page-level measurements (each returns plain JSON) -----------------------------------------------------------

export async function measureProductsToolbar(page: Page) {
  await page.goto("/dashboard/products");
  const trigger = page.getByRole("button", { name: "Search", exact: true });
  const search = page.getByRole("textbox", { name: "Search by name, SKU or part number" });
  const status = page.getByRole("combobox", { name: "Status" });
  await expect(status).toBeVisible();
  const addProduct = page.getByRole("link", { name: /add product/i });
  // "View store" is not measured: the header only renders it when NEXT_PUBLIC_ROOT_DOMAIN is configured (it is not in this local environment).
  return { trigger: await height(trigger), search: await height(search), status: await height(status), addProductLink: await height(addProduct) };
}

/** Opens Add category, submits empty, returns heights and colours of the dialog's controls and error text. */
export async function measureCategoryDialog(page: Page) {
  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: /add category/i }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  const msg = page.locator("#cat-name-msg");
  await expect(msg).not.toBeEmpty();
  const input = page.locator("#cat-name");
  const formAlert = page.getByRole("dialog").locator('p[role="alert"]').first();
  return {
    nameInput: await height(input),
    parentSelect: await height(page.locator("#cat-parent")),
    errorText: await renderedContrast(msg),
    formAlertText: await renderedContrast(formAlert),
    invalidInputBorder: await input.evaluate((el) => getComputedStyle(el).borderTopColor),
    invalidInputBackground: await input.evaluate((el) => getComputedStyle(el).backgroundColor),
  };
}

/** The product form's error banner (border-error/30 + bg-error/5): its border, fill and text. */
export async function measureProductBanner(page: Page) {
  await page.goto("/dashboard/products/new");
  await page.getByRole("button", { name: /create product/i }).click();
  const banner = page.locator('form div[role="alert"]').first();
  await expect(banner).toBeVisible();
  return {
    border: await banner.evaluate((el) => getComputedStyle(el).borderTopColor),
    fill: await banner.evaluate((el) => getComputedStyle(el).backgroundColor),
    text: await renderedContrast(banner),
  };
}

export async function measureAdmin(page: Page) {
  await page.goto("/admin/organizations");
  const status = page.getByRole("combobox", { name: "Status" });
  const search = page.getByRole("textbox", { name: "Search by name or address" });
  await expect(status).toBeVisible();
  const out = { statusSelect: await height(status), search: await height(search) } as Record<string, unknown>;
  await page.goto("/admin/organizations/new");
  await page.getByRole("button", { name: "Create organization" }).click();
  const msg = page.locator("#cc-company-msg");
  await expect(msg).not.toBeEmpty();
  out.errorText = await renderedContrast(msg);
  out.orgNameInput = await height(page.locator("#cc-company"));
  out.htmlArea = await page.evaluate(() => document.documentElement.dataset.area ?? null);
  return out;
}

export async function measureLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  const msg = page.locator("#email-msg");
  await expect(msg).not.toBeEmpty();
  return { emailInput: await height(page.locator("#email")), errorText: await renderedContrast(msg), htmlArea: await page.evaluate(() => document.documentElement.dataset.area ?? null) };
}

/** Text of the Analytics chart's x-axis ticks (proves the axis is unchanged, not just that a chart renders). */
export async function measureChartAxis(page: Page) {
  await page.goto("/dashboard/analytics");
  // SVG text has no innerText, so read textContent; the first chart on the page is "Sales over time".
  const ticks = page.locator(".recharts-wrapper").first().locator(".recharts-xAxis-tick-labels text");
  await ticks.first().waitFor({ state: "attached", timeout: 60_000 });
  return { ticks: (await ticks.evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()))).filter(Boolean) };
}

/** Opens the Ctrl+K palette, retrying until it is really open (a key pressed before hydration is ignored). */
export async function openPalette(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press("Control+K");
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
}

export async function paletteLabels(page: Page) {
  await page.goto("/dashboard");
  await openPalette(page);
  return (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
}

// ---- read-only API access (ground truth), using the already authenticated browser session ------------------------

export const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";

/** GET against the StoreForge API with the signed-in session's cookies. Read-only by construction. */
export async function apiGet<T>(page: Page, path: string): Promise<T> {
  const res = await page.context().request.get(`${API}${path}`);
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

/** The first customer that has orders (so the detail page has an order history to check). */
export async function customerWithOrders(page: Page) {
  const list = await apiGet<{ id: string; fullName: string; orderCount: number }[]>(page, "/customers");
  const c = list.find((x) => x.orderCount > 0);
  if (!c) throw new Error("No seeded customer has orders");
  return c;
}

// ---- baseline file ---------------------------------------------------------------------------------------------

const BASELINE = join(REPORT_DIR, "baseline-measurements.json");
type Baseline = Record<string, unknown>;

export function saveBaseline(key: string, value: unknown) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const all: Baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
  all[key] = value;
  writeFileSync(BASELINE, JSON.stringify(all, null, 2));
}

/** Reads a value measured on origin/main. Fails loudly if the baseline run has not been done. */
export function baseline<T>(key: string): T {
  if (!existsSync(BASELINE)) throw new Error(`No baseline measurements. Run studio-baseline.spec.ts against origin/main first (${BASELINE}).`);
  const all = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  if (!(key in all)) throw new Error(`Baseline has no "${key}". Re-run studio-baseline.spec.ts.`);
  return all[key] as T;
}
