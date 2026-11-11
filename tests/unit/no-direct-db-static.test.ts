import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static audit of the "Next.js -> NestJS API -> Drizzle -> Supabase" architecture: business data in the frontend goes
 * through the API client only. Migrated code must not import a database client, Drizzle, or the tenant/user DB helpers,
 * must not run SQL, and must not keep an `API_MODULES` switch or a database fallback. Type-only imports of the row types in
 * `@/lib/domain` hold the row types and enums the UI uses.
 *
 * There is no remaining direct access: the database client, Drizzle, the migrations and the DB scripts were removed from this app
 * (docs/NEXTJS_ARCHITECTURE_CLEANUP.md).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name).replace(/\\/g, "/");
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

const FORBIDDEN: [string, RegExp][] = [
  ["any import from @/lib/db", /from\s+["']@\/lib\/db(\/|["'])/],
  ["database package import", /from\s+["'](postgres|pg|drizzle-orm[^"']*|drizzle-kit)["']/],
  ["tenant DB helper", /\b(withTenantDb|withAuthenticatedDb|withPublicContext|withUserContext|getDatabase)\s*\(/],
  ["SQL", /\b(tx|db)\.(select|insert|update|delete|execute)\s*\(|\bsql`/],
  ["Supabase table/rpc access", /\.(from|rpc)\(\s*["'`]/],
  ["API_MODULES switch or apiServes", /API_MODULES|apiServes|enabledApiModules/],
];

const violations = (file: string) => {
  const src = read(file);
  return FORBIDDEN.filter(([, re]) => re.test(src)).map(([what]) => `${file}: ${what}`);
};

// Services and helpers whose business data now comes from the API only.
const MIGRATED = [
  "services/category.service.ts",
  "services/collection.service.ts",
  "services/product.service.ts",
  "services/inventory.service.ts",
  "services/customer.service.ts",
  "services/analytics.service.ts",
  "services/team.service.ts",
  "services/store-settings.service.ts",
  "services/profile.service.ts",
  "services/store.service.ts",
  "services/tenant.service.ts",
  "services/storefront.service.ts",
  "services/platform.service.ts",
  "services/platform-settings.service.ts",
  "services/platform-team.service.ts",
  "services/platform-usage.service.ts",
  "services/admin-audit.service.ts",
  "lib/auth/platform.ts",
  "lib/tenant/api-workspace.ts",
  ...walk("lib/api"),
];

describe("migrated business code has no direct database access", () => {
  it.each(MIGRATED)("%s", (file) => {
    expect(violations(file)).toEqual([]);
  });

  it("the pages, server actions, API routes and components never touch the database", () => {
    const files = [...walk("app"), ...walk("components")];
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap(violations)).toEqual([]);
  });

  it("an API failure is surfaced, never answered from the database (no catch-and-fallback in the services)", () => {
    for (const file of MIGRATED.filter((f) => f.startsWith("services/"))) {
      expect(read(file), file).not.toMatch(/fall(s|ing)?\s*back\s+(to|on)\s+(the\s+)?(database|direct|drizzle)|legacy|rollback/i);
    }
  });
});

describe("no direct database access is left in the app", () => {
  it("no file under app/, components/, lib/, services/ or config/ has any", () => {
    const all = [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("services"), ...walk("config")];
    expect(all.length).toBeGreaterThan(100);
    expect(all.flatMap(violations)).toEqual([]);
  });

  it("the database packages, migrations and DB scripts are gone", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string> };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of ["drizzle-orm", "drizzle-kit", "postgres", "pg", "@electric-sql/pglite", "@electric-sql/pglite-socket"]) expect(names).not.toContain(banned);
    expect(Object.keys(pkg.scripts).filter((n) => /^db:|^admin:/.test(n))).toEqual([]);
    for (const path of ["drizzle", "drizzle.config.ts", "lib/db", "scripts"]) expect(existsSync(join(ROOT, path)), path).toBe(false);
  });
});
