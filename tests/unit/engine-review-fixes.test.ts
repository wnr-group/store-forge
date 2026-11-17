import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, LAYOUTS, PAGE_KINDS, TEMPLATE_KINDS, type TemplateKind } from "../../lib/templates/document";
import { resolveBinding } from "../../lib/templates/engine/bindings";
import { FONT_KEYS, FONT_REGISTRY } from "../../lib/templates/engine/fonts";
import { migrateDocument } from "../../lib/templates/engine/migrate";
import { getRootSchema } from "../../lib/templates/engine/root-schema";
import { imageValueSchema } from "../../lib/templates/engine/schema";
import { validateDocument } from "../../lib/templates/engine/validate";
import { LIMITS } from "../../lib/templates/limits";
import { getRegistry } from "../../lib/templates/registry/index";
import { themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";

// Final-review fixes 6, 10 and 12.
const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("resolveBinding survives a missing context [AC-ENG-007]", () => {
  const binding = { source: "store.name", fallback: "Fallback" };

  it("[AC-ENG-007] a null or undefined context resolves to the fallback instead of throwing", () => {
    for (const context of [null, undefined]) {
      expect(resolveBinding(binding, context as never)).toBe("Fallback");
      expect(resolveBinding({ source: "store.name" }, context as never)).toBeUndefined();
      expect(resolveBinding({ source: "nope", fallback: "F" }, context as never)).toBe("F");
    }
  });

  it("[AC-ENG-007] other non-object contexts behave like an empty one, and url targets still pass the URL check", () => {
    for (const context of [0, "text", true, []]) {
      expect(resolveBinding(binding, context as never)).toBe("Fallback");
    }
    expect(resolveBinding({ source: "store.name", fallback: "javascript:alert(1)" }, null as never, "url")).toBeUndefined();
    expect(resolveBinding({ source: "store.name", fallback: "https://example.com/" }, undefined as never, "url")).toBe("https://example.com/");
  });
});

describe("an unknown document kind is an error, never a silent page [AC-ENG-005]", () => {
  const registry = getRegistry();
  const page = { schemaVersion: 1, layout: "classic", sections: {}, order: [] };
  const unknownKinds: unknown[] = ["page", "", "__proto__", "constructor", "INDEX", " index", 5, null, undefined, {}, ["index"], Symbol("index")];

  for (const kind of unknownKinds) {
    it(`[AC-ENG-005] kind ${typeof kind === "symbol" ? "Symbol()" : (JSON.stringify(kind) ?? "undefined")}: validateDocument reports UNKNOWN_KIND and getRootSchema throws`, () => {
      const res = validateDocument(kind as TemplateKind, page, registry);
      expect(res.ok).toBe(false);
      expect(res.issues).toHaveLength(1);
      expect(res.issues[0]).toMatchObject({ code: "UNKNOWN_KIND", level: "error", path: "" });
      expect(validateDocument(kind as TemplateKind, page, registry, { tenantId: "t" }).ok).toBe(false);
      expect(() => getRootSchema(kind as TemplateKind)).toThrow(/unknown template kind/i);
    });
  }

  it("[AC-ENG-005] all seven real kinds still resolve to a schema", () => {
    for (const kind of TEMPLATE_KINDS) expect(() => getRootSchema(kind)).not.toThrow();
  });
});

describe("shared constants are declared once [AC-ENG-001] [AC-ENG-015]", () => {
  it("[AC-ENG-015] DEFAULT_LAYOUT is the first layout, `classic`", () => {
    expect(DEFAULT_LAYOUT).toBe("classic");
    expect(DEFAULT_LAYOUT).toBe(LAYOUTS[0]);
  });

  it("[AC-ENG-015] migrate.ts uses the exported PAGE_KINDS and DEFAULT_LAYOUT, not copies", () => {
    const text = source("lib/templates/engine/migrate.ts");
    expect(text).not.toMatch(/const PAGE_KINDS/);
    expect(text).not.toMatch(/["']classic["']/);
    expect(text).toMatch(/PAGE_KINDS/);
    expect(text).toMatch(/DEFAULT_LAYOUT/);
    for (const kind of PAGE_KINDS) expect(migrateDocument(kind, { schemaVersion: 1, sections: {}, order: [] }).layout).toBe(DEFAULT_LAYOUT);
    expect(migrateDocument("group_header", { schemaVersion: 1, sections: {}, order: [] }).layout).toBeUndefined();
  });

  it("[AC-ENG-001] the image alt limit comes from LIMITS.maxAltLength (200), not a literal in schema.ts", () => {
    expect(LIMITS.maxAltLength).toBe(200);
    expect(source("lib/templates/engine/schema.ts")).not.toMatch(/\.max\(200/);
    const schema = imageValueSchema("t");
    const image = (alt: string) => ({ path: "t/store/a.png", alt });
    expect(schema.safeParse(image("a".repeat(LIMITS.maxAltLength))).success).toBe(true);
    expect(schema.safeParse(image("a".repeat(LIMITS.maxAltLength + 1))).success).toBe(false);
  });

  it("[AC-ENG-001] the theme font options are derived from the font registry, with the same values and order as before", () => {
    const options = (id: string) => themeSettingDescriptors.find((d) => d.id === id)?.options ?? [];
    expect(options("headingFont").map((o) => o.value)).toEqual(["manrope", "inter", "dm-sans", "system-sans", "system-serif", "system-mono"]);
    expect(options("bodyFont").map((o) => o.value)).toEqual(["inter", "manrope", "dm-sans", "system-sans", "system-serif", "system-mono"]);
    for (const id of ["headingFont", "bodyFont"]) {
      expect([...options(id).map((o) => o.value)].sort()).toEqual([...FONT_KEYS].sort());
      for (const option of options(id)) expect(option.label).toBe(FONT_REGISTRY[option.value as keyof typeof FONT_REGISTRY].name);
    }
    expect(options("headingFont").map((o) => o.label)).toEqual(["Manrope", "Inter", "DM Sans", "System Sans", "System Serif", "System Mono"]);
    expect(options("bodyFont").map((o) => o.label)).toEqual(["Inter", "Manrope", "DM Sans", "System Sans", "System Serif", "System Mono"]);
    const text = source("lib/templates/registry/theme-settings.ts");
    expect(text).not.toMatch(/value: "system-mono"/);
  });
});
