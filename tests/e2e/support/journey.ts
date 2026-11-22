import { createDecipheriv, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared helpers for the Razorpay tenant-configuration journey (razorpay-journey.spec.ts and razorpay-short-demo.spec.ts).
 * Everything runs against the real frontend, API and an isolated database; synthetic credentials only. The captions
 * overlaid on the recorded video are annotations added by the test, not application UI, and are hidden for screenshots.
 */

export const EVIDENCE = resolve(process.cwd(), process.env.QA_EVIDENCE_DIR ?? "artifacts/qa-evidence/razorpay-configuration");
export const SHOTS = join(EVIDENCE, "screenshots");
export const VIDEO = join(EVIDENCE, "video");
export const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "";
export const API = process.env.RZP_API ?? "http://127.0.0.1:4500/api/v1";
export const API_NOKEY = process.env.RZP_API_NOKEY ?? "http://127.0.0.1:4501/api/v1";
export const SUPABASE = process.env.RZP_SUPABASE ?? "http://127.0.0.1:58201";
export const ANON = process.env.RZP_ANON ?? "";
export const DB_URL = process.env.RZP_DB_URL ?? "";
export const ENC_KEY = process.env.RZP_ENC_KEY ?? ""; // test-only: lets the test prove decryption; never printed
/** Scales every caption pause: the detailed video uses a slower pace than the short demo. */
export const DW = Number(process.env.RZP_DWELL ?? 1);
export const VIEWPORT = { width: 1920, height: 1080 };
export const TENANT_A = "a0000000-e2e0-4000-8000-00000000000a";
export const TENANT_B = "b0000000-e2e0-4000-8000-00000000000b";
export const USERS = {
  owner: "e2e.owner@sf-e2e.test",
  ownerB: "e2e.ownerb@sf-e2e.test",
  staff: "e2e.staff@sf-e2e.test",
  outsider: "e2e.outsider@sf-e2e.test",
  platform: "e2e.platform@sf-e2e.test",
};

const hex = (n: number) => randomBytes(n).toString("hex");
export const synth = () => ({ keyId: `rzp_test_${hex(6)}`, secret: `SYNTH${hex(10)}` });
export const masked = (id: string) => `${id.slice(0, 9)}••••${id.slice(-4)}`;

export const keyInput = (p: Page) => p.locator("#pay-key-id");
export const secretInput = (p: Page) => p.locator("#pay-key-secret");
export const saveButton = (p: Page, name: string) => p.getByRole("button", { name, exact: true });

// ---- screenshots + manifest ------------------------------------------------------------------------------------------
export type ShotMeta = { file: string; scenario: string; testId: string; description: string; capturedAt: string; url: string };
const manifest = join(SHOTS, "manifest.ndjson");

/** Hides the video caption, captures the real page, verifies the file, and records it in the manifest. */
export async function snap(page: Page, file: string, scenario: string, testId: string, description: string, full = false) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => { const c = document.getElementById("__cap"); if (c) c.style.display = "none"; }).catch(() => {});
  const path = join(SHOTS, file);
  await page.screenshot({ path, fullPage: full });
  await page.evaluate(() => { const c = document.getElementById("__cap"); if (c) c.style.display = "block"; }).catch(() => {});
  expect(existsSync(path)).toBe(true);
  const meta: ShotMeta = { file, scenario, testId, description, capturedAt: new Date().toISOString(), url: page.url().replace(/\?.*$/, "") };
  appendFileSync(manifest, JSON.stringify(meta) + "\n");
}

// ---- video captions + chapters ----------------------------------------------------------------------------------------
export async function installCaptions(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const paint = () => {
      let t: { t: string; s?: string } | null = null;
      try { t = JSON.parse(localStorage.getItem("__cap") || "null"); } catch { /* storage unavailable */ }
      let el = document.getElementById("__cap");
      if (!t) { el?.remove(); return; }
      if (!el) {
        el = document.createElement("div");
        el.id = "__cap";
        el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:16px 32px;background:rgba(15,23,42,.93);color:#fff;font:600 24px/1.35 system-ui,sans-serif;pointer-events:none;border-top:4px solid #38bdf8";
        document.documentElement.appendChild(el);
      }
      el.innerHTML = "";
      const h = document.createElement("div"); h.textContent = t.t; el.appendChild(h);
      if (t.s) { const s = document.createElement("div"); s.textContent = t.s; s.style.cssText = "font-weight:400;font-size:20px;opacity:.9;margin-top:4px"; el.appendChild(s); }
    };
    document.addEventListener("DOMContentLoaded", paint);
    window.addEventListener("load", paint);
    (window as unknown as { __paintCap: () => void }).__paintCap = paint;
  });
}
export async function caption(page: Page, title: string, sub?: string, dwellMs = 1600) {
  await page.evaluate(([t, s]) => {
    try { localStorage.setItem("__cap", JSON.stringify({ t, s })); } catch { /* ignore */ }
    (window as unknown as { __paintCap?: () => void }).__paintCap?.();
  }, [title, sub ?? ""] as const);
  await page.waitForTimeout(dwellMs * DW);
}
export async function clearCaption(page: Page) {
  await page.evaluate(() => { try { localStorage.removeItem("__cap"); } catch { /* ignore */ } document.getElementById("__cap")?.remove(); }).catch(() => {});
}
export class Chapters {
  private t0 = Date.now();
  readonly list: { n: number; title: string; startSeconds: number; tests: string[] }[] = [];
  start(n: number, title: string, tests: string[]) { this.list.push({ n, title, startSeconds: Math.round((Date.now() - this.t0) / 100) / 10, tests }); }
  save(name: string) { mkdirSync(VIDEO, { recursive: true }); writeFileSync(join(VIDEO, name), JSON.stringify({ recordedAt: new Date().toISOString(), chapters: this.list }, null, 2)); }
}

// ---- real UI actions --------------------------------------------------------------------------------------------------
export async function login(page: Page, email: string, landing: RegExp = /\/dashboard/) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}
export async function fillCreds(page: Page, keyId: string, secret: string) {
  await keyInput(page).fill(keyId);
  await secretInput(page).fill(secret);
}
export async function switchWorkspace(page: Page, name: string) {
  const trigger = page.locator('button[aria-label="Switch workspace"]:visible').first();
  for (let attempt = 0; attempt < 2; attempt++) {
    await trigger.click();
    const item = page.getByRole("menuitem", { name: new RegExp(name) });
    try {
      await item.waitFor({ state: "visible", timeout: 5000 });
      await item.click();
      await page.waitForLoadState("networkidle");
      return;
    } catch {
      await page.keyboard.press("Escape"); // menu did not open (or closed again): close any remnant and retry once
    }
  }
  throw new Error(`could not switch workspace to ${name}`);
}

// ---- API + database oracles (test setup and verification only; the journey itself drives the browser) -------------------
export async function token(email: string): Promise<string> {
  const r = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return ((await r.json()) as { access_token: string }).access_token;
}
export async function api(base: string, email: string | null, method: string, org: string | null, body?: object) {
  const t = email ? await token(email) : null;
  const r = await fetch(`${base}/payments/razorpay`, {
    method,
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(org ? { "X-Organization-Id": org } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: { code?: string; message?: string } };
  return { status: r.status, json, text: JSON.stringify(json) };
}
// Minimal shape of the `postgres` client (loaded from the API repo at run time, so its types are not resolvable here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = Record<string, any>;
export type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<DbRow[]>;
  unsafe(query: string, params?: unknown[]): Promise<DbRow[]>;
  end(): Promise<void>;
};
export function db(): Sql {
  const req = createRequire("C:/sf-wt/api-feature/package.json");
  const mod = req("postgres");
  return (mod.default ?? mod)(DB_URL, { onnotice: () => {} }) as Sql;
}
export type Row = { tenant_id: string; key_id: string; secret_ciphertext: string; iv: string; auth_tag: string; key_version: number };
/** Decrypts with the test-only key and the tenant-bound AAD, compares to the expected secret, never returning the plaintext. */
export function decryptMatches(row: Row | DbRow, tenantAad: string, expected: string): boolean {
  try {
    const d = createDecipheriv("aes-256-gcm", Buffer.from(ENC_KEY, "base64"), Buffer.from(row.iv, "base64"), { authTagLength: 16 });
    d.setAAD(Buffer.from(tenantAad.toLowerCase(), "utf8"));
    d.setAuthTag(Buffer.from(row.auth_tag, "base64"));
    const out = Buffer.concat([d.update(Buffer.from(row.secret_ciphertext, "base64")), d.final()]).toString("utf8");
    return out === expected;
  } catch { return false; }
}
export function writeJson(rel: string, data: unknown) {
  const p = join(EVIDENCE, rel);
  mkdirSync(resolve(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}
