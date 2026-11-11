import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATE_KINDS, type TemplateKind } from "../../lib/templates/document";
import { migrateDocument } from "../../lib/templates/engine/migrate";
import { validateDocument } from "../../lib/templates/engine/validate";
import { LIMITS } from "../../lib/templates/limits";
import { applyLegacyToPreset, INDEX_PRESET_KEYS, indexPreset } from "../../lib/templates/presets";
import { getRegistry } from "../../lib/templates/registry/index";

const TENANT = "tenant-1";

/** The document-size and text-length literals only limits.ts may spell; the scanner and its self-check share it. */
const LIMIT_LITERAL = /\b(262_?144|20_?000|5_?000|256\s*\*\s*1024)\b/;

const errors = (res: { issues: { level: string; code: string; path: string }[] }) =>
  res.issues.filter((i) => i.level === "error").map((i) => `${i.code}@${i.path}`);

describe("Presets and migrated documents pass the shared validator [AC-ENG-018]", () => {
  it("[AC-ENG-018] every index preset validates as an index document, with and without a tenant", () => {
    for (const key of INDEX_PRESET_KEYS) {
      for (const context of [undefined, { tenantId: TENANT }]) {
        const res = validateDocument("index", indexPreset(key), getRegistry(), context);
        expect({ key, errors: errors(res) }).toEqual({ key, errors: [] });
      }
    }
  });

  it("[AC-ENG-018] every legacy-derived preset document (each key, with and without image, accent and copy) validates for its tenant", () => {
    const variants = [
      { accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null },
      { accentColor: "#1a5aaa", heroHeading: "Hello", heroSubheading: "World", heroImagePath: `${TENANT}/store/hero.png` },
      { accentColor: " #ABCDEF ", heroHeading: "  ", heroSubheading: "Sub", heroImagePath: null },
    ];
    for (const templateKey of [...INDEX_PRESET_KEYS, "not-a-template"]) {
      for (const variant of variants) {
        const { document } = applyLegacyToPreset({ templateKey, ...variant });
        const res = validateDocument("index", document, getRegistry(), { tenantId: TENANT });
        expect({ templateKey, variant, errors: errors(res) }).toEqual({ templateKey, variant, errors: [] });
        // And it survives migrate-on-read unchanged.
        expect(migrateDocument("index", document)).toEqual(document);
      }
    }
  });

  it("[AC-ENG-018] a preset with an image is only valid for the tenant that owns the path", () => {
    const { document } = applyLegacyToPreset({
      templateKey: "spotlight",
      accentColor: null,
      heroHeading: null,
      heroSubheading: null,
      heroImagePath: `${TENANT}/store/hero.png`,
    });
    expect(validateDocument("index", document, getRegistry()).ok).toBe(false);
    expect(validateDocument("index", document, getRegistry(), { tenantId: "tenant-2" }).ok).toBe(false);
    expect(validateDocument("index", document, getRegistry(), { tenantId: TENANT }).ok).toBe(true);
  });

  it("[AC-ENG-018] presets exist only for the index kind: the other six kinds are covered by their minimal documents", () => {
    // Only INDEX_PRESET_KEYS exists in lib/templates/presets.ts; the migrated side (tests/db) covers index too.
    const minimal: Record<TemplateKind, unknown> = {
      index: indexPreset("classic"),
      product: { schemaVersion: 1, layout: "classic", sections: {}, order: [] },
      collection: { schemaVersion: 1, layout: "classic", sections: {}, order: [] },
      group_header: { schemaVersion: 1, sections: {}, order: [] },
      group_footer: { schemaVersion: 1, sections: {}, order: [] },
      group_announcement: { schemaVersion: 1, sections: {}, order: [] },
      theme_settings: { schemaVersion: 1 },
    };
    for (const kind of TEMPLATE_KINDS) {
      const res = validateDocument(kind, migrateDocument(kind, minimal[kind]), getRegistry(), { tenantId: TENANT });
      expect({ kind, errors: errors(res) }).toEqual({ kind, errors: [] });
    }
  });
});

describe("All limits and quotas live in one central config [AC-ENG-019]", () => {
  it("[AC-ENG-019] LIMITS is frozen, holds only positive integers, and holds the D6 limits and D27 quotas", () => {
    expect(Object.isFrozen(LIMITS)).toBe(true);
    expect(() => {
      (LIMITS as { maxBlockDepth: number }).maxBlockDepth = 99;
    }).toThrow();
    expect(LIMITS.maxBlockDepth).toBe(3);
    for (const [key, value] of Object.entries(LIMITS)) {
      expect({ key, ok: Number.isInteger(value) && value > 0 }).toEqual({ key, ok: true });
    }
    expect(LIMITS).toMatchObject({
      maxActiveTemplatesPerStore: 100,
      maxArchivedTemplatesPerStore: 500,
      maxVersionsPerTemplate: 500,
      maxNameLength: 80,
      maxVersionLabelLength: 80,
      maxAltLength: 200,
      maxValueDepth: 64,
    });
    // D27 also gives minimums (names 1-80, version labels 0-80), but lib/templates/limits.ts has no min
    // constants yet (a later phase owns them; the loop above also requires every limit to be above zero).
    // They are deliberately not pinned or added here.
  });

  const ROOT = join(__dirname, "../../lib/templates");
  const files: string[] = [];
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collect(full);
      else if (full.endsWith(".ts")) files.push(full);
    }
  };
  collect(ROOT);
  const codeOf = (file: string) =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");

  it("[AC-ENG-019] no file but limits.ts spells a limit literal or declares a limit-named constant", () => {
    const literal = LIMIT_LITERAL;
    const declaration =
      /\bmax(BlockDepth|SectionsPerTemplate|BlocksPerSection|ComponentsPerTemplate|DocumentBytes|TextLength|RichtextLength|ActiveTemplatesPerStore|ArchivedTemplatesPerStore|VersionsPerTemplate|NameLength|VersionLabelLength)\w*\s*[:=]/;
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith("limits.ts")) continue;
      const code = codeOf(file);
      if (literal.test(code)) offenders.push(`${file}: literal`);
      if (declaration.test(code)) offenders.push(`${file}: declaration`);
    }
    expect(offenders).toEqual([]);
  });

  it("[AC-ENG-019] the scanner would catch a duplicate (self-check on sample text)", () => {
    // The same constant the scanner above uses, so this checks the real pattern and not a copy of it.
    expect(LIMIT_LITERAL.test("const cap = 262144;")).toBe(true);
    expect(LIMIT_LITERAL.test("z.string().max(20_000)")).toBe(true);
    expect(LIMIT_LITERAL.test("const cap = 5000")).toBe(true);
    expect(LIMIT_LITERAL.test("const cap = 256 * 1024")).toBe(true);
    expect(LIMIT_LITERAL.test("const cap = 50000")).toBe(false);
  });

  it("[AC-ENG-019] the files that need a limit import it from limits.ts", () => {
    const users = files.filter((f) => /\bLIMITS\./.test(codeOf(f)));
    expect(users.length).toBeGreaterThanOrEqual(5);
    for (const file of users) expect(codeOf(file)).toMatch(/from\s+["'][^"']*\/limits["']/);
  });
});
