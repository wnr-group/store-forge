import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static audit of the cutover gate [AC-DB-023]. Whatever anyone edits or overwrites, these fail if an engine-reading entry point
 * could run while the persisted cutover marker is closed. (Behaviour is proven in tests/db/engine-cutover-gate.test.ts.)
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
/** Source without comments: a comment that mentions a table is not a read. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === "node_modules" || name === ".next") continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}

/** The only runtime files allowed to name engine storefront reads or the version tables (everything else would bypass the gate). */
const ALLOWED_ENGINE_READERS = new Set([
  "services/storefront-template.service.ts", // the gated loader
  "services/storage-references.service.ts", // reference protection for file deletion, not a storefront read
  "lib/templates/legacy-resync.ts", // privileged cutover tooling
  "lib/db/schema/templates.ts",
  "lib/db/schema/template-engine-cutover.ts",
]);

describe("[AC-DB-023] cutover gate: static audit", () => {
  const sources = [...walk("app"), ...walk("services"), ...walk("lib"), ...walk("components")];

  it("[AC-DB-023] get_public_template_layout is called from exactly one place, after the gate", () => {
    const callers = sources.filter((f) => /get_public_template_layout/.test(read(f)));
    expect(callers).toEqual(["services/storefront-template.service.ts"]);
    const src = read("services/storefront-template.service.ts");
    expect(src.match(/select public\.get_public_template_layout/g)).toHaveLength(1);
    const gate = src.indexOf("await assertEngineReadsEnabled()");
    expect(gate, "loadStorefrontPage must await assertEngineReadsEnabled()").toBeGreaterThan(-1);
    expect(gate).toBeLessThan(src.indexOf("select public.get_public_template_layout"));
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+loadEnginePage/);
  });

  it("[AC-DB-023] the exported loader awaits the gate before delegating to the unchecked loader", () => {
    const src = read("services/storefront-template.service.ts");
    const body = src.slice(src.indexOf("export async function loadStorefrontPage("), src.indexOf("export async function loadStorefrontPageIfEnabled"));
    expect(body.indexOf("await assertEngineReadsEnabled()")).toBeGreaterThan(-1);
    expect(body.indexOf("await assertEngineReadsEnabled()")).toBeLessThan(body.indexOf("loadEnginePage("));
  });

  it("[AC-DB-023] no other runtime file reads the engine tables or versions (no bypass of the gate)", () => {
    const offenders = sources.filter((f) => {
      if (ALLOWED_ENGINE_READERS.has(f)) return false;
      const text = code(f);
      return /template_versions|templateVersions|get_public_template_layout|\bpublished_version_id\b/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("[AC-DB-023] every storefront page that loads engine data tolerates a closed gate (V1 fallback or 404), never a crash or an engine read", () => {
    const pages = sources.filter((f) => /^app\/s\/\[slug\]\/.*page\.tsx$/.test(f) && /storefront-template\.service/.test(read(f)));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const f of pages) {
      const text = read(f);
      const gated = /loadStorefrontPageIfEnabled/.test(text) || /EngineReadsDisabledError/.test(text);
      expect(gated, `${f} must use loadStorefrontPageIfEnabled or catch EngineReadsDisabledError`).toBe(true);
    }
    const home = read("app/s/[slug]/page.tsx");
    expect(home).toMatch(/getPublicStorefront/); // V1 fallback while closed
    expect(home).toMatch(/TemplateView/);
    for (const f of pages.filter((x) => x !== "app/s/[slug]/page.tsx")) expect(read(f)).not.toMatch(/\bloadStorefrontPage\(/);
  });

  it("[AC-DB-023] the gate service has a single source of truth: the persisted marker function, no env flag, no cache, fail-closed on error", () => {
    const g = code("services/engine-cutover.service.ts");
    expect(g).toMatch(/template_engine_cutover_complete\(\)/);
    expect(g).toMatch(/=== true/);
    expect(g).toMatch(/catch\s*{\s*return false;?\s*}/);
    expect(g).not.toMatch(/process\.env/);
    expect(g).not.toMatch(/\b(cache|Map|setTimeout|ttl)\b/i);
    expect(sources.filter((f) => /process\.env\.[A-Z0-9_]*(ENGINE|CUTOVER|TEMPLATE)[A-Z0-9_]*/.test(code(f)))).toEqual([]);
  });

  it("[AC-DB-023] the migration seeds the marker as pending, revokes all table privileges and grants only the function", () => {
    const sql = read("drizzle/0016_template_engine_cutover.sql");
    expect(sql).toMatch(/VALUES \(true, 'pending'\)/);
    expect(sql).toMatch(/REVOKE ALL ON public\.template_engine_cutover FROM public, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.template_engine_cutover_complete\(\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*template_engine_cutover\b[^(]/);
    expect(relative(ROOT, join(ROOT, "drizzle/0016_template_engine_cutover.sql"))).toBeTruthy();
  });
});
