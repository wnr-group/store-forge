import { shotPath } from "./support/shot-path";
import { expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const TICKET = process.env.E2E_TICKET_ID ?? "TEMPLATES-V1";
export const STORE_SLUG = process.env.E2E_STORE_SLUG ?? "urban-nest-demo";
export const OWNER = process.env.E2E_OWNER_EMAIL ?? "owner@demo.test";
export const MANAGER = process.env.E2E_MANAGER_EMAIL ?? "admin@demo.test";
export const STAFF = process.env.E2E_STAFF_EMAIL ?? "staff@demo.test";

/** Never hard-coded: set E2E_DEMO_PASSWORD in your shell (the demo seeder prints it for dev databases). */
export function password(): string {
  const p = process.env.E2E_DEMO_PASSWORD;
  if (!p) throw new Error("Set E2E_DEMO_PASSWORD to run the E2E suite.");
  return p;
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Captures the CURRENT real page state and verifies the file exists and is non-empty. Call after the action has completed. */
export async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}): Promise<string> {
  const { dir, file } = shotPath(name, TICKET);
  const abs = join(process.cwd(), dir);
  mkdirSync(abs, { recursive: true });
  const path = join(abs, file);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  expect(existsSync(path), `${path} exists`).toBe(true);
  expect(statSync(path).size, `${path} is not empty`).toBeGreaterThan(1000);
  return path;
}

export const publicUrl = `/s/${STORE_SLUG}`;
