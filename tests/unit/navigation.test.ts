import { describe, expect, it } from "vitest";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { newMenuItem, readMenu, validateMenu, writeMenu } from "@/lib/themes/navigation";

const link = (label: string, url: string, extra: Record<string, unknown> = {}): ComponentNode => ({ type: "link", settings: { label, url, ...extra }, blocks: {}, block_order: [] });

const header = (): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  order: ["header"],
  sections: {
    header: {
      type: "header",
      settings: { sticky: true },
      blocks: {
        social: { type: "social-link", settings: {}, blocks: {}, block_order: [] },
        a: link("Home", "/"),
        b: link("Shop", "/products", { openInNewTab: true }),
      },
      block_order: ["a", "social", "b"],
    },
  },
});

describe("readMenu", () => {
  it("lists the link blocks in order and skips other blocks", () => {
    expect(readMenu(header())).toEqual([
      { id: "a", label: "Home", url: "/", newTab: false },
      { id: "b", label: "Shop", url: "/products", newTab: true },
    ]);
  });
  it("is null when the document has no header", () => {
    expect(readMenu({ schemaVersion: 1, layout: "classic", order: [], sections: {} })).toBeNull();
  });
});

describe("writeMenu", () => {
  it("replaces the links, keeps other blocks and section settings, and does not mutate the input", () => {
    const doc = header();
    const before = JSON.stringify(doc);
    const out = writeMenu(doc, [
      { id: "b", label: " Shop now ", url: "/products", newTab: false },
      { id: "n1", label: "About", url: "/about", newTab: true },
    ]);
    expect(JSON.stringify(doc)).toBe(before);
    const section = out.sections.header;
    expect(section.settings).toEqual({ sticky: true });
    expect(section.block_order).toEqual(["social", "b", "n1"]);
    expect(section.blocks.a).toBeUndefined();
    expect(section.blocks.b.settings).toEqual({ label: "Shop now", url: "/products" });
    expect(section.blocks.n1.settings).toEqual({ label: "About", url: "/about", openInNewTab: true });
  });
  it("round-trips through readMenu", () => {
    const items = readMenu(header())!;
    expect(readMenu(writeMenu(header(), items))).toEqual(items);
  });
});

describe("validateMenu", () => {
  it("accepts internal paths, https links and mailto", () => {
    const items = [
      { id: "1", label: "Home", url: "/", newTab: false },
      { id: "2", label: "Docs", url: "https://example.com/docs", newTab: false },
      { id: "3", label: "Mail", url: "mailto:hi@example.com", newTab: false },
    ];
    expect(validateMenu(items)).toEqual({});
  });
  it("rejects empty labels and unsafe or empty links", () => {
    const errors = validateMenu([
      { id: "1", label: " ", url: "/", newTab: false },
      { id: "2", label: "Bad", url: "javascript:alert(1)", newTab: false },
      { id: "3", label: "Proto", url: "//evil.example", newTab: false },
      { id: "4", label: "x".repeat(41), url: "", newTab: false },
    ]);
    expect(errors["1"]).toEqual({ label: "Enter a label." });
    expect(errors["2"].url).toBeDefined();
    expect(errors["3"].url).toBeDefined();
    expect(errors["4"].label).toBeDefined();
    expect(errors["4"].url).toBeDefined();
  });
});

describe("newMenuItem", () => {
  it("never reuses an id", () => {
    const a = newMenuItem([]);
    const b = newMenuItem([a.id]);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^nav_[0-9a-f]{12}$/);
  });
});
