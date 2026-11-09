import { describe, expect, it } from "vitest";
import { isLayoutKey, LAYOUTS } from "../../lib/templates/document";
import { getRootSchema } from "../../lib/templates/engine/root-schema";
import {
  imageValueSchema,
  socialLinksSchema,
} from "../../lib/templates/engine/schema";

describe("Engine Root Schemas per Kind [AC-ENG-005] [AC-ENG-015] [AC-ENG-016] [AC-ENG-017]", () => {
  it("[AC-ENG-005] provides separate root schemas for all 7 template kinds", () => {
    const kinds = [
      "index",
      "product",
      "collection",
      "theme_settings",
      "group_header",
      "group_footer",
      "group_announcement",
    ] as const;

    for (const kind of kinds) {
      const schema = getRootSchema(kind);
      expect(schema).toBeDefined();
    }
  });

  it("[AC-ENG-015] validates page kinds requiring schemaVersion and layout", () => {
    const pageSchema = getRootSchema("index");

    // Valid index document
    const valid = pageSchema.safeParse({
      schemaVersion: 1,
      layout: "spotlight",
      sections: {
        hero: { type: "hero", settings: {}, blocks: {}, block_order: [] },
      },
      order: ["hero"],
    });
    expect(valid.success).toBe(true);

    // Also accepts "classic"; a "default" layout was never approved (C-02) and is now rejected
    expect(
      pageSchema.safeParse({
        schemaVersion: 1,
        layout: "classic",
        sections: {},
        order: [],
      }).success,
    ).toBe(true);

    expect(
      pageSchema.safeParse({
        schemaVersion: 1,
        layout: "default",
        sections: {},
        order: [],
      }).success,
    ).toBe(false);

    // Rejects missing layout or wrong schemaVersion
    expect(
      pageSchema.safeParse({
        schemaVersion: 2,
        layout: "classic",
        sections: {},
        order: [],
      }).success,
    ).toBe(false);

    expect(
      pageSchema.safeParse({
        schemaVersion: 1,
        sections: {},
        order: [],
      }).success,
    ).toBe(false);
  });

  describe("layout is a closed enum of classic and spotlight [AC-ENG-015]", () => {
    const pageKinds = ["index", "product", "collection"] as const;
    const groupKinds = ["group_header", "group_footer", "group_announcement"] as const;
    const withLayout = (layout: unknown) => ({ schemaVersion: 1, layout, sections: {}, order: [] });
    const rejected: Array<[string, unknown]> = [
      ["default", "default"],
      ["empty string", ""],
      ["wrong case", "Classic"],
      ["trailing space", "classic "],
      ["suffixed", "spotlight2"],
      ["a number", 5],
      ["null", null],
      ["an object", { key: "classic" }],
      ["an array", ["classic"]],
    ];

    for (const kind of pageKinds) {
      for (const layout of LAYOUTS) {
        it(`[AC-ENG-015] ${kind} accepts layout ${layout}`, () => {
          expect(getRootSchema(kind).safeParse(withLayout(layout)).success).toBe(true);
        });
      }
      for (const [name, value] of rejected) {
        it(`[AC-ENG-015] ${kind} rejects layout ${name}`, () => {
          expect(getRootSchema(kind).safeParse(withLayout(value)).success).toBe(false);
        });
      }
      it(`[AC-ENG-015] ${kind} still requires a layout`, () => {
        expect(getRootSchema(kind).safeParse({ schemaVersion: 1, sections: {}, order: [] }).success).toBe(false);
      });
    }

    for (const kind of groupKinds) {
      it(`[AC-ENG-015] ${kind} keeps layout optional`, () => {
        expect(getRootSchema(kind).safeParse({ schemaVersion: 1, sections: {}, order: [] }).success).toBe(true);
      });
      for (const layout of LAYOUTS) {
        it(`[AC-ENG-015] ${kind} accepts layout ${layout}`, () => {
          expect(getRootSchema(kind).safeParse(withLayout(layout)).success).toBe(true);
        });
      }
      for (const [name, value] of rejected) {
        it(`[AC-ENG-015] ${kind} rejects layout ${name} when present`, () => {
          expect(getRootSchema(kind).safeParse(withLayout(value)).success).toBe(false);
        });
      }
    }

    it("[AC-ENG-015] explains a rejected layout in plain words", () => {
      const result = getRootSchema("index").safeParse(withLayout("default"));
      expect(result.success).toBe(false);
      if (result.success) return;
      const issue = result.error.issues.find((i) => i.path[0] === "layout");
      expect(issue?.message).toMatch(/classic/);
      expect(issue?.message).toMatch(/spotlight/);
    });

    it("[AC-ENG-015] the layout set is exactly classic and spotlight, shared with the document module", () => {
      expect([...LAYOUTS]).toEqual(["classic", "spotlight"]);
      expect(isLayoutKey("default")).toBe(false);
      expect(isLayoutKey("classic")).toBe(true);
    });
  });

  it("[AC-ENG-005] validates shared group templates without requiring layout", () => {
    const headerSchema = getRootSchema("group_header");

    const valid = headerSchema.safeParse({
      schemaVersion: 1,
      sections: {
        nav: { type: "header", settings: {}, blocks: {}, block_order: [] },
      },
      order: ["nav"],
    });
    expect(valid.success).toBe(true);
  });

  it("[AC-ENG-016] validates image values with tenant prefix, no .., and alt <= 200", () => {
    // Valid
    expect(
      imageValueSchema("tenant-abc").safeParse({
        path: "tenant-abc/store/hero.webp",
        alt: "Summer Sale Banner",
        focal: { x: 50, y: 50 },
      }).success,
    ).toBe(true);

    // Cross-tenant path rejected
    expect(
      imageValueSchema("tenant-abc").safeParse({
        path: "tenant-xyz/store/hero.webp",
        alt: "Image",
      }).success,
    ).toBe(false);

    // Path with directory traversal (..) rejected
    expect(
      imageValueSchema("tenant-abc").safeParse({
        path: "tenant-abc/store/../../etc/passwd",
      }).success,
    ).toBe(false);

    // Alt text > 200 chars rejected
    expect(
      imageValueSchema("tenant-abc").safeParse({
        path: "tenant-abc/store/hero.webp",
        alt: "a".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("[AC-ENG-017] validates social links with fixed networks, HTTPS only, and host check", () => {
    // Valid
    const valid = socialLinksSchema.safeParse({
      instagram: "https://instagram.com/mystore",
      facebook: "https://www.facebook.com/mystore",
      x: "https://x.com/mystore",
    });
    expect(valid.success).toBe(true);

    // Non-HTTPS rejected
    expect(
      socialLinksSchema.safeParse({
        instagram: "http://instagram.com/mystore",
      }).success,
    ).toBe(false);

    // Host mismatch rejected (e.g. facebook network with evil.com)
    expect(
      socialLinksSchema.safeParse({
        facebook: "https://evil.com/fakebook",
      }).success,
    ).toBe(false);

    // Unsupported network rejected
    expect(
      socialLinksSchema.safeParse({
        unknown_network: "https://unknown.com",
      }).success,
    ).toBe(false);
  });
});
