import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { BlockDefinition, ComponentRegistry, SectionDefinition, SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { imageValueSchema } from "../../lib/templates/engine/schema";
import { validateDocument, type Issue } from "../../lib/templates/engine/validate";

const T = "tenant-a";
const OTHER = "tenant-b";
const SECRET_PATH = `${OTHER}/store/SECRETNAME.png`;

const imageDescriptor: SettingDescriptor = { id: "image", type: "image", label: "Image", default: null };

const heroDef: SectionDefinition = {
  type: "hero",
  name: "Hero",
  accepts: ["card"],
  settings: [{ id: "heading", type: "text", label: "Heading", default: "" }, imageDescriptor],
};
const cardDef: BlockDefinition = { type: "card", name: "Card", accepts: ["card"], settings: [imageDescriptor] };
const registry: ComponentRegistry = { sections: { hero: heroDef }, blocks: { card: cardDef } };

function node(type: string, settings: Record<string, unknown> = {}, children: Record<string, ComponentNode> = {}): ComponentNode {
  return { type, settings, blocks: children, block_order: Object.keys(children) };
}
const img = (path: string) => ({ path, alt: "Alt" });
const own = (name = "a.png") => `${T}/store/${name}`;

function pageDoc(sections: Record<string, ComponentNode>): TemplateDocument {
  return { schemaVersion: 1, layout: "classic", sections, order: Object.keys(sections) };
}
function groupDoc(sections: Record<string, ComponentNode>) {
  return { schemaVersion: 1, sections, order: Object.keys(sections) };
}
/** section > b1 > b2 > b3 (maximum depth 3); only the deepest block carries the image. */
function deepDoc(path: string): TemplateDocument {
  const b3 = node("card", { image: img(path) });
  const b2 = node("card", {}, { b3 });
  const b1 = node("card", {}, { b2 });
  return pageDoc({ s1: node("hero", {}, { b1 }) });
}

const codes = (issues: Issue[]) => issues.map((i) => i.code);
const errors = (issues: Issue[]) => issues.filter((i) => i.level === "error");
const DEEP_PATH = "sections.s1.blocks.b1.blocks.b2.blocks.b3.settings.image";

/** Every way a path can leave `<T>/store/`, or smuggle a different location past a naive prefix check. */
const BAD_PATHS: [label: string, path: string][] = [
  ["cross-tenant", `${OTHER}/store/a.png`],
  ["sibling prefix with suffix", `${T}-evil/store/a.png`],
  ["sibling prefix with extra char", `${T}x/store/a.png`],
  ["sibling folder", `${T}/storex/a.png`],
  ["store folder without a file", `${T}/store`],
  ["store folder with trailing slash only", `${T}/store/`],
  ["empty segment before store", `${T}//store/a.png`],
  ["empty segment after store", `${T}/store//a.png`],
  ["empty segment inside", `${T}/store/a//b.png`],
  ["dot-dot after prefix", `${T}/store/../a.png`],
  ["dot-dot escaping the tenant", `${T}/store/a/../../${OTHER}/store/a.png`],
  ["dot-dot as a file name", `${T}/store/..`],
  ["dot segment", `${T}/store/./a.png`],
  ["backslash separator", `${T}/store/a\\b.png`],
  ["backslash prefix", `${T}\\store\\a.png`],
  ["encoded dots lower", `${T}/store/%2e%2e/a.png`],
  ["encoded dots upper", `${T}/store/%2E%2E/a.png`],
  ["encoded dot mixed", `${T}/store/.%2e/a.png`],
  ["encoded slash lower", `${T}/store/a%2fb.png`],
  ["encoded slash upper", `${T}/store/a%2Fb.png`],
  ["encoded backslash lower", `${T}/store/a%5cb.png`],
  ["encoded backslash upper", `${T}/store/a%5Cb.png`],
  ["double-encoded dots", `${T}/store/%252e%252e/a.png`],
  ["encoded prefix slash", `${T}%2fstore/a.png`],
  ["NUL byte", `${T}/store/a\u0000.png`],
  ["newline", `${T}/store/a\n.png`],
  ["tab", `${T}/store/a\t.png`],
  ["DEL", `${T}/store/a\u007f.png`],
  ["leading slash", `/${T}/store/a.png`],
  ["absolute https URL", `https://evil.example/${T}/store/a.png`],
  ["absolute http URL", "http://evil.example/a.png"],
  ["data URL", "data:image/png;base64,AAAA"],
  ["file URL", "file:///etc/passwd"],
  ["protocol-relative URL", `//evil.example/${T}/store/a.png`],
  ["tenant case differs", `${T.toUpperCase()}/store/a.png`],
  ["store case differs", `${T}/STORE/a.png`],
  ["fullwidth dots", `${T}/store/．．/a.png`],
  ["fullwidth backslash", `${T}/store/a＼b.png`],
  ["empty path", ""],
];

describe("Tenant-aware image paths across the whole pipeline [AC-ENG-016]", () => {
  describe("accepts paths inside the owning tenant's store folder", () => {
    const okCases: [string, Record<string, ComponentNode>][] = [
      ["a section setting", { s1: node("hero", { image: img(own()) }) }],
      ["a block setting (depth 1)", { s1: node("hero", {}, { b1: node("card", { image: img(own("b.webp")) }) }) }],
      ["a null image", { s1: node("hero", { image: null }) }],
      ["a nested sub-folder path", { s1: node("hero", { image: img(own("2026/11/a-b_c.webp")) }) }],
    ];
    for (const [label, sections] of okCases) {
      it(`[AC-ENG-016] accepts ${label} and returns the document unchanged`, () => {
        const doc = pageDoc(sections);
        const snapshot = structuredClone(doc);
        const res = validateDocument("index", doc, registry, { tenantId: T });
        expect(res.ok).toBe(true);
        expect(errors(res.issues)).toEqual([]);
        if (res.ok) expect(res.document).toEqual(snapshot);
        expect(doc).toEqual(snapshot);
      });
    }

    it("[AC-ENG-016] accepts a same-tenant path in a depth-3 nested block", () => {
      const res = validateDocument("index", deepDoc(own("deep.png")), registry, { tenantId: T });
      expect(res.ok).toBe(true);
      expect(errors(res.issues)).toEqual([]);
    });

    it("[AC-ENG-016] accepts same-tenant paths in theme_settings and in every group kind", () => {
      const theme = { schemaVersion: 1, settings: { brand: { favicon: img(own("fav.png")) } } };
      expect(validateDocument("theme_settings", theme, registry, { tenantId: T }).ok).toBe(true);
      const themeWithSections = { ...theme, sections: { s1: node("hero", { image: img(own()) }) }, order: ["s1"] };
      expect(validateDocument("theme_settings", themeWithSections, registry, { tenantId: T }).ok).toBe(true);
      for (const kind of ["group_header", "group_footer", "group_announcement"] as const) {
        const res = validateDocument(kind, groupDoc({ s1: node("hero", { image: img(own()) }) }), registry, { tenantId: T });
        expect({ kind, ok: res.ok }).toEqual({ kind, ok: true });
      }
    });

    it("[AC-ENG-016] accepts an own-tenant path with an unknown component type (warning only)", () => {
      const doc = pageDoc({ w: node("future-widget", { slides: [{ image: img(own()) }] }) });
      const res = validateDocument("index", doc, registry, { tenantId: T });
      expect(res.ok).toBe(true);
      expect(codes(res.issues)).toEqual(["UNKNOWN_COMPONENT"]);
    });
  });

  describe("rejects every cross-tenant, sibling-prefix, traversal and encoding variant", () => {
    for (const [label, bad] of BAD_PATHS) {
      it(`[AC-ENG-016] rejects ${label} in imageValueSchema, a section, a depth-3 block and a group`, () => {
        // The shared schema.
        const direct = imageValueSchema(T).safeParse({ path: bad });
        expect(direct.success).toBe(false);

        // Section setting, exact path, one issue, code CROSS_TENANT_PATH.
        const inSection = validateDocument("index", pageDoc({ s1: node("hero", { image: img(bad) }) }), registry, { tenantId: T });
        expect(inSection.ok).toBe(false);
        if (bad !== "") {
          const hit = inSection.issues.filter((i) => i.code === "CROSS_TENANT_PATH");
          expect(hit.map((i) => i.path)).toEqual(["sections.s1.settings.image"]);
          expect(hit[0].level).toBe("error");
        }

        // Nested block at depth 3.
        const inDeep = validateDocument("index", deepDoc(bad), registry, { tenantId: T });
        expect(inDeep.ok).toBe(false);
        if (bad !== "") {
          expect(inDeep.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual([DEEP_PATH]);
        }

        // Group kind.
        const inGroup = validateDocument("group_header", groupDoc({ s1: node("hero", { image: img(bad) }) }), registry, { tenantId: T });
        expect(inGroup.ok).toBe(false);
      });
    }

    it("[AC-ENG-016] messages never echo the offending path or another tenant's id", () => {
      const res = validateDocument("index", pageDoc({ s1: node("hero", { image: img(SECRET_PATH) }) }), registry, { tenantId: T });
      expect(res.ok).toBe(false);
      for (const issue of res.issues) {
        expect(issue.message).not.toContain("SECRETNAME");
        expect(issue.message).not.toContain(OTHER);
      }
    });

    it("[AC-ENG-016] rejects an unknown component type's image: warning stays, plus an error for the image", () => {
      const doc = pageDoc({ w: node("future-widget", { slides: [{ caption: "x", image: img(SECRET_PATH) }] }) });
      const res = validateDocument("index", doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.find((i) => i.code === "UNKNOWN_COMPONENT")?.level).toBe("warning");
      const hit = res.issues.filter((i) => i.code === "CROSS_TENANT_PATH");
      expect(hit.map((i) => i.path)).toEqual(["sections.w.settings.slides.0.image"]);
      expect(hit[0].level).toBe("error");
    });

    it("[AC-ENG-016] rejects an image smuggled into an unknown block type nested three deep", () => {
      const b3 = node("future-block", { media: { hero: img(SECRET_PATH) } });
      const doc = pageDoc({ s1: node("hero", {}, { b1: node("card", {}, { b2: node("future-block", {}, { b3 }) }) }) });
      const res = validateDocument("index", doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual([
        "sections.s1.blocks.b1.blocks.b2.blocks.b3.settings.media.hero",
      ]);
    });

    it("[AC-ENG-016] rejects an image under a setting key the registered component does not declare", () => {
      const doc = pageDoc({ s1: node("hero", { sneaky: img(SECRET_PATH) }) });
      const res = validateDocument("index", doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual(["sections.s1.settings.sneaky"]);
    });

    it("[AC-ENG-016] rejects a cross-tenant image in theme_settings (settings and sections)", () => {
      const theme = { schemaVersion: 1, settings: { branding: { logo: img(SECRET_PATH) } } };
      const res = validateDocument("theme_settings", theme, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual(["settings.branding.logo"]);

      const withSection = { schemaVersion: 1, sections: { s1: node("hero", { image: img(SECRET_PATH) }) }, order: ["s1"] };
      const res2 = validateDocument("theme_settings", withSection, registry, { tenantId: T });
      expect(res2.ok).toBe(false);
      expect(res2.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual(["sections.s1.settings.image"]);
    });

    it("[AC-ENG-016] rejects a cross-tenant image in every group kind", () => {
      for (const kind of ["group_header", "group_footer", "group_announcement"] as const) {
        const res = validateDocument(kind, groupDoc({ s1: node("hero", {}, { b1: node("card", { image: img(SECRET_PATH) }) }) }), registry, { tenantId: T });
        expect({ kind, ok: res.ok }).toEqual({ kind, ok: false });
        expect(res.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual([
          "sections.s1.blocks.b1.settings.image",
        ]);
      }
    });

    it("[AC-ENG-016] rejects an image smuggled in a root-level extra key", () => {
      const doc = { ...pageDoc({ s1: node("hero") }), extras: { banner: img(SECRET_PATH) } };
      const res = validateDocument("index", doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path)).toEqual(["extras.banner"]);
    });

    it("[AC-ENG-016] keeps alt <= 200 and focal 0..100", () => {
      const longAlt = pageDoc({ s1: node("hero", { image: { path: own(), alt: "a".repeat(201) } }) });
      expect(validateDocument("index", longAlt, registry, { tenantId: T }).ok).toBe(false);
      const badFocal = pageDoc({ s1: node("hero", { image: { path: own(), focal: { x: 101, y: 0 } } }) });
      expect(validateDocument("index", badFocal, registry, { tenantId: T }).ok).toBe(false);
      const okFocal = pageDoc({ s1: node("hero", { image: { path: own(), alt: "a".repeat(200), focal: { x: 0, y: 100 } } }) });
      expect(validateDocument("index", okFocal, registry, { tenantId: T }).ok).toBe(true);
    });
  });

  describe("a missing or unsafe tenant id rejects documents that contain images", () => {
    const UNSAFE: [string, string | undefined][] = [
      ["undefined", undefined],
      ["an empty string", ""],
      ["a slash", "a/b"],
      ["dot-dot", ".."],
      ["a dot", "a.b"],
      ["a space", "a b"],
      ["a backslash", "a\\b"],
      ["a newline", "a\nb"],
    ];
    for (const [label, tenantId] of UNSAFE) {
      it(`[AC-ENG-016] ${label} as the tenant id: image documents fail with TENANT_REQUIRED, one per image`, () => {
        const doc = pageDoc({
          s1: node("hero", { image: img(own()) }, { b1: node("card", { image: img(own()) }) }),
          w: node("future-widget", { logo: img(own()) }),
        });
        const res = validateDocument("index", doc, registry, tenantId === undefined ? undefined : { tenantId });
        expect(res.ok).toBe(false);
        const hit = res.issues.filter((i) => i.code === "TENANT_REQUIRED");
        expect(hit.map((i) => i.path).sort()).toEqual([
          "sections.s1.blocks.b1.settings.image",
          "sections.s1.settings.image",
          "sections.w.settings.logo",
        ]);
        expect(hit.every((i) => i.level === "error")).toBe(true);
        expect(codes(res.issues)).not.toContain("CROSS_TENANT_PATH");
      });

      it(`[AC-ENG-016] ${label} as the tenant id: documents without image values still validate`, () => {
        const doc = pageDoc({ s1: node("hero", { heading: "Hello", image: null }, { b1: node("card") }) });
        const res = validateDocument("index", doc, registry, tenantId === undefined ? {} : { tenantId });
        expect(res.ok).toBe(true);
        expect(errors(res.issues)).toEqual([]);
      });
    }

    it("[AC-ENG-016] no context at all behaves as a missing tenant", () => {
      const doc = pageDoc({ s1: node("hero", { image: img(own()) }) });
      expect(validateDocument("index", doc, registry).ok).toBe(false);
      expect(codes(validateDocument("index", doc, registry).issues)).toContain("TENANT_REQUIRED");
    });

    it("[AC-ENG-016] theme_settings and groups need a tenant for images too", () => {
      const theme = { schemaVersion: 1, settings: { logo: img(own()) } };
      const res = validateDocument("theme_settings", theme, registry);
      expect(res.ok).toBe(false);
      expect(res.issues.filter((i) => i.code === "TENANT_REQUIRED").map((i) => i.path)).toEqual(["settings.logo"]);
      expect(validateDocument("theme_settings", { schemaVersion: 1, settings: { colors: { primary: "#112233" } } }, registry).ok).toBe(true);
      expect(validateDocument("group_footer", groupDoc({ s1: node("hero", { image: img(own()) }) }), registry).ok).toBe(false);
    });
  });

  describe("responsive image descriptors", () => {
    const responsiveDef: SectionDefinition = {
      type: "hero",
      name: "Hero",
      settings: [{ id: "image", type: "image", label: "Image", default: null, responsive: true }],
    };
    const reg: ComponentRegistry = { sections: { hero: responsiveDef }, blocks: {} };

    it("[AC-ENG-016] accepts own-tenant paths in the plain and the per-breakpoint form", () => {
      const plain = pageDoc({ s1: node("hero", { image: img(own()) }) });
      const perBreakpoint = pageDoc({ s1: node("hero", { image: { base: img(own("d.png")), mobile: img(own("m.png")) } }) });
      expect(validateDocument("index", plain, reg, { tenantId: T }).ok).toBe(true);
      expect(validateDocument("index", perBreakpoint, reg, { tenantId: T }).ok).toBe(true);
    });

    it("[AC-ENG-016] rejects a cross-tenant path in either form with CROSS_TENANT_PATH", () => {
      const plain = pageDoc({ s1: node("hero", { image: img(SECRET_PATH) }) });
      const perBreakpoint = pageDoc({ s1: node("hero", { image: { base: img(own()), tablet: img(SECRET_PATH) } }) });
      for (const doc of [plain, perBreakpoint]) {
        const res = validateDocument("index", doc, reg, { tenantId: T });
        expect(res.ok).toBe(false);
        expect(codes(res.issues)).toContain("CROSS_TENANT_PATH");
      }
    });
  });

  describe("compiled schema cache never leaks across tenants or registries", () => {
    const doc = pageDoc({
      s1: node("hero", { image: img(own("x.png")) }, { b1: node("card", { image: img(own("y.png")) }) }),
    });

    it("[AC-ENG-016] tenant A passes, B fails, A passes again, then no tenant fails", () => {
      expect(validateDocument("index", doc, registry, { tenantId: T }).ok).toBe(true);

      const asB = validateDocument("index", doc, registry, { tenantId: OTHER });
      expect(asB.ok).toBe(false);
      expect(asB.issues.filter((i) => i.code === "CROSS_TENANT_PATH").map((i) => i.path).sort()).toEqual([
        "sections.s1.blocks.b1.settings.image",
        "sections.s1.settings.image",
      ]);

      expect(validateDocument("index", doc, registry, { tenantId: T }).ok).toBe(true);

      const none = validateDocument("index", doc, registry);
      expect(none.ok).toBe(false);
      expect(codes(none.issues)).toContain("TENANT_REQUIRED");
    });

    it("[AC-ENG-016] the order of tenants does not matter (none first, then A, then B)", () => {
      const fresh: ComponentRegistry = { sections: { hero: { ...heroDef } }, blocks: { card: { ...cardDef } } };
      expect(validateDocument("index", doc, fresh).ok).toBe(false);
      expect(validateDocument("index", doc, fresh, { tenantId: T }).ok).toBe(true);
      expect(validateDocument("index", doc, fresh, { tenantId: OTHER }).ok).toBe(false);
      expect(validateDocument("index", doc, fresh, { tenantId: "" }).ok).toBe(false);
    });

    it("[AC-ENG-016] two registries with identical type names never share compiled schemas", () => {
      const strictHero: SectionDefinition = {
        type: "hero",
        name: "Hero",
        settings: [{ id: "image", type: "text", label: "Image as text", default: "" }],
      };
      const loose: ComponentRegistry = { sections: { hero: heroDef }, blocks: {} };
      const strict: ComponentRegistry = { sections: { hero: strictHero }, blocks: {} };
      const d = pageDoc({ s1: node("hero", { image: img(own()) }) });

      expect(validateDocument("index", d, loose, { tenantId: T }).ok).toBe(true);
      const bad = validateDocument("index", d, strict, { tenantId: T });
      expect(bad.ok).toBe(false);
      expect(codes(bad.issues)).toContain("INVALID_SETTING");
      expect(validateDocument("index", d, loose, { tenantId: T }).ok).toBe(true);
    });
  });

  describe("one pipeline: compileSettings and validateDocument share the image rules [AC-ENG-001]", () => {
    const cases: unknown[] = [
      { path: own() },
      { path: own("a/b/c.png"), alt: "ok", focal: { x: 0, y: 100 } },
      { path: SECRET_PATH },
      { path: `${T}-evil/store/a.png` },
      { path: `${T}/store/../x.png` },
      { path: `${T}/store/%2e%2e/x.png` },
      { path: "" },
      { path: own(), alt: "x".repeat(201) },
      { path: own(), focal: { x: 101, y: 0 } },
      { alt: "no path" },
      "tenant-a/store/a.png",
      null,
    ];

    for (const tenantId of [T, "", "a/b", undefined]) {
      it(`[AC-ENG-001] [AC-ENG-016] rejects the same inputs with tenant ${JSON.stringify(tenantId)}`, () => {
        const { schema } = compileSettings([imageDescriptor], { tenantId });
        const reg: ComponentRegistry = {
          sections: { hero: { type: "hero", name: "Hero", settings: [imageDescriptor] } },
          blocks: {},
        };
        for (const value of cases) {
          const viaCompile = schema.safeParse({ image: value }).success;
          const doc = pageDoc({ s1: node("hero", { image: value }) });
          const viaValidate = validateDocument("index", doc, reg, tenantId === undefined ? undefined : { tenantId }).ok;
          expect({ value, ok: viaValidate }).toEqual({ value, ok: viaCompile });
        }
      });
    }

    it("[AC-ENG-001] [AC-ENG-016] the tenant rules live only in schema.ts (no second image validator)", () => {
      const dir = join(__dirname, "../../lib/templates/engine");
      // Comments are stripped first so prose that mentions the folder cannot trip (or hide) the check.
      const code = (file: string) =>
        readFileSync(join(dir, file), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[\s;{(,])\/\/.*$/gm, "$1");
      const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));

      // Only schema.ts spells the store folder or defines the rule functions.
      expect(files.filter((f) => /\/store\//.test(code(f)))).toEqual(["schema.ts"]);
      for (const fn of ["imagePathViolation", "imageValueSchema", "isSafeTenantId"]) {
        expect(files.filter((f) => new RegExp(`function\\s+${fn}\\b`).test(code(f)))).toEqual(["schema.ts"]);
      }

      // The other pipeline files import the rule from schema.ts instead of re-implementing it.
      const imports: Record<string, string[]> = {
        "compile.ts": ["imageValueSchema"],
        "image-scan.ts": ["imagePathViolation"],
        "validate.ts": ["isSafeTenantId", "imageIssueCode"],
      };
      for (const [file, names] of Object.entries(imports)) {
        const source = code(file);
        const fromSchema = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/schema"/g)].flatMap((m) =>
          m[1].split(",").map((n) => n.replace(/\btype\b/, "").trim()),
        );
        for (const name of names) expect({ file, name, imported: fromSchema.includes(name) }).toEqual({ file, name, imported: true });
      }
    });
  });
});
