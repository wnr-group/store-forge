import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard rails for the privileged Supabase key. The service-role key bypasses RLS, so it may be
 * read in exactly one module, used for Auth Admin calls only, and must never be reachable from the browser.
 */
const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "tests", "drizzle", "public"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}
const files = walk(ROOT).map((f) => ({ path: relative(ROOT, f).split(sep).join("/"), text: readFileSync(f, "utf8") }));

describe("service-role key isolation", () => {
  it("the app never reads the key: account provisioning and every privileged operation belong to the StoreForge API", () => {
    const users = files.filter((f) => f.text.includes("SUPABASE_SERVICE_ROLE_KEY")).map((f) => f.path).sort();
    expect(users).toEqual([]);
  });

  it("the Admin Auth client no longer exists in the app: account provisioning is done by the StoreForge API", () => {
    expect(files.filter((f) => f.text.includes("getAdminAuthClient")).map((f) => f.path)).toEqual([]);
    expect(files.some((f) => /from "@\/lib\/auth\/provisioning"|from "@\/lib\/supabase\/admin"/.test(f.text))).toBe(false);
  });

  it("the services that reach privileged operations are server-only", () => {
    for (const path of ["services/platform.service.ts", "services/platform-team.service.ts", "services/team.service.ts", "lib/auth/platform.ts"]) {
      expect(files.find((f) => f.path === path)?.text, path).toMatch(/^import "server-only";/m);
    }
  });

  it("no client component imports a privileged or server-only module", () => {
    const clients = files.filter((f) => /^\s*["']use client["']/.test(f.text));
    expect(clients.length).toBeGreaterThan(10);
    for (const f of clients) {
      // `import type` is erased at build time, so type-only imports from services are fine.
      expect(f.text, f.path).not.toMatch(/^import (?!type\b)[^;]*from "@\/(lib\/auth\/platform|services\/)/m);
      expect(f.text, f.path).not.toMatch(/SERVICE_ROLE/i);
    }
  });

  it("the key is never exposed through a NEXT_PUBLIC_ variable", () => {
    for (const f of files) expect(f.text, f.path).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE/);
  });

  it("no account is ever self-registered or needs e-mail verification in the app", () => {
    expect(files.some((f) => /auth\.signUp\(/.test(f.text))).toBe(false);
  });

  it("documentation and examples contain no real secrets", () => {
    for (const name of ["README.md", ".env.example"]) {
      const text = readFileSync(join(ROOT, name), "utf8");
      expect(text, name).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/); // JWT (service-role / anon keys)
      expect(text, name).not.toMatch(/postgres(ql)?:\/\/[^\s:@]+:(?!<|\[|\$)[^\s@<]{6,}@/); // URL with an inline password
    }
  });
});
