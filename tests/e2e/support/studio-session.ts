import type { Browser } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { login, MANAGER, OWNER, password, STAFF } from "../helpers";

/**
 * One REAL UI login per account, reused by every spec file in the run (the API rate-limits logins).
 * The saved browser storage state lives outside the repository (the OS temp folder), is reused only while it is still
 * a valid session, and is replaced by a fresh real login otherwise. Nothing here bypasses authentication.
 */
export type Who = "owner" | "admin" | "staff" | "platform" | "designOnly" | "catalogOnly" | "readOnly" | "noAccess";

/** The restricted members come from tests/qa/seed-restricted-members.sql (local database only). */
const SEEDED: Partial<Record<Who, string>> = { designOnly: "design-only@demo.test", catalogOnly: "catalog-only@demo.test", readOnly: "read-only@demo.test", noAccess: "no-access@demo.test" };

const dir = process.env.E2E_SESSION_DIR ?? join(tmpdir(), "studio-e2e-sessions");
const MAX_AGE_MS = 25 * 60 * 1000;
const checked = new Map<Who, string>();

const home = (who: Who): RegExp => (who === "platform" ? /\/admin/ : /\/dashboard/);
const landing = (who: Who): string => (who === "platform" ? "/admin" : "/dashboard");

function emailOf(who: Who): string {
  if (who === "owner") return OWNER;
  if (who === "admin") return MANAGER;
  if (who === "staff") return STAFF;
  const seeded = SEEDED[who];
  if (seeded) return seeded;
  const e = process.env.E2E_PLATFORM_ADMIN_EMAIL;
  if (!e) throw new Error("Set E2E_PLATFORM_ADMIN_EMAIL to use the Platform Admin account.");
  return e;
}

async function freshLogin(browser: Browser, who: Who, file: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  const page = await context.newPage();
  if (who === "platform") {
    await page.goto("/login");
    await page.locator("#email").fill(emailOf(who));
    await page.locator("#password").fill(password());
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(home(who));
  } else {
    await login(page, emailOf(who));
  }
  await context.storageState({ path: file });
  await context.close();
}

/** Path of a storage-state file holding a currently valid session for `who`. */
export async function sessionFor(browser: Browser, who: Who): Promise<string> {
  const memo = checked.get(who);
  if (memo) return memo;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${who}.json`);

  let usable = false;
  try {
    usable = Date.now() - statSync(file).mtimeMs < MAX_AGE_MS;
  } catch {
    usable = false;
  }
  if (usable) {
    // A sign-out elsewhere can revoke a saved session: prove it still works before trusting it.
    const context = await browser.newContext({ storageState: file });
    const page = await context.newPage();
    await page.goto(landing(who));
    usable = home(who).test(new URL(page.url()).pathname);
    await context.close();
  }
  if (!usable) await freshLogin(browser, who, file);

  checked.set(who, file);
  return file;
}

export type AsUserOptions = { scheme?: "light" | "dark"; timezoneId?: string; viewport?: { width: number; height: number } };

/** Runs `fn` on a fresh page inside an already signed-in context, and always closes the context. */
export async function asUser<T>(browser: Browser, who: Who, fn: (page: import("@playwright/test").Page) => Promise<T>, o: AsUserOptions = {}): Promise<T> {
  const context = await browser.newContext({
    storageState: await sessionFor(browser, who),
    viewport: o.viewport ?? { width: 1280, height: 800 },
    colorScheme: o.scheme ?? "light",
    ...(o.timezoneId ? { timezoneId: o.timezoneId } : {}),
  });
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}
