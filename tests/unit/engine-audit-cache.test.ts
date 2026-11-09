import { beforeEach, describe, expect, it, vi } from "vitest";

// The validator keeps a per-definition, per-tenant compiled-schema cache (a WeakMap, no export). The only
// observable seam is how often compileSettings is called, so wrap the real function in a spy.
vi.mock("../../lib/templates/engine/compile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/templates/engine/compile")>();
  const compileSettings = vi.fn((...args: Parameters<typeof actual.compileSettings>) => actual.compileSettings(...args));
  return { ...actual, compileSettings };
});

import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { ComponentRegistry, SectionDefinition } from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";

const spy = vi.mocked(compileSettings);

const node = (type: string, settings: Record<string, unknown> = {}, children: Record<string, ComponentNode> = {}): ComponentNode => ({
  type,
  settings,
  blocks: children,
  block_order: Object.keys(children),
});

const card = (columnsMax: number): SectionDefinition => ({
  type: "card",
  name: "Card",
  settings: [{ id: "columns", type: "number", label: "Columns", default: 2, min: 1, max: columnsMax }],
});

const registryWith = (def: SectionDefinition): ComponentRegistry => ({ sections: { card: def }, blocks: {} });

const docWith = (settings: Record<string, unknown>): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  sections: { s1: node("card", settings) },
  order: ["s1"],
});

const compilesFor = (def: SectionDefinition) => spy.mock.calls.filter((call) => call[0] === def.settings).length;

describe("The compiled-schema cache in validate.ts [AC-ENG-001]", () => {
  // A block body: returning the spy would make Vitest run it as a teardown function.
  beforeEach(() => {
    spy.mockClear();
  });

  it("[AC-ENG-001] compiles a definition once per tenant: repeated validations reuse the compiled schema", () => {
    const def = card(5);
    const registry = registryWith(def);
    for (let i = 0; i < 5; i++) expect(validateDocument("index", docWith({ columns: 3 }), registry, { tenantId: "t1" }).ok).toBe(true);
    expect(compilesFor(def)).toBe(1);

    // Same result for invalid input, still no recompilation.
    expect(validateDocument("index", docWith({ columns: 9 }), registry, { tenantId: "t1" }).ok).toBe(false);
    expect(compilesFor(def)).toBe(1);
  });

  it("[AC-ENG-001] a different tenant, and no tenant, each get their own compiled schema, and none is rebuilt on return", () => {
    const def = card(5);
    const registry = registryWith(def);
    const run = (tenantId?: string) => validateDocument("index", docWith({ columns: 3 }), registry, tenantId ? { tenantId } : undefined);
    run("t1");
    run("t2");
    run();
    expect(compilesFor(def)).toBe(3);
    run("t1");
    run("t2");
    run();
    expect(compilesFor(def)).toBe(3);
    // The tenant is passed to the compiler, so image paths are checked against the right owner.
    const tenants = spy.mock.calls.filter((c) => c[0] === def.settings).map((c) => c[1]?.tenantId);
    expect(tenants).toEqual(["t1", "t2", undefined]);
  });

  it("[AC-ENG-001] each definition object is compiled separately and a fresh copy of a definition is a new cache entry", () => {
    const registry = getRegistry();
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { h: node("hero", { heading: "Hi" }), p: node("product-grid", { columns: 3 }) },
      order: ["h", "p"],
    };
    validateDocument("index", doc, registry, { tenantId: "t1" });
    validateDocument("index", doc, registry, { tenantId: "t1" });
    expect(compilesFor(registry.sections.hero)).toBe(1);
    expect(compilesFor(registry.sections["product-grid"])).toBe(1);

    // getRegistry() returns the same definition objects every time, so a second registry shares the cache.
    validateDocument("index", doc, getRegistry(), { tenantId: "t1" });
    expect(compilesFor(registry.sections.hero)).toBe(1);

    const copy = structuredClone(registry);
    validateDocument("index", doc, copy, { tenantId: "t1" });
    expect(compilesFor(copy.sections.hero)).toBe(1);
  });

  it("[AC-ENG-001] the per-definition tenant cache is bounded: the least recently used tenant is evicted, a recently used one survives", () => {
    const def = card(5);
    const registry = registryWith(def);
    const run = (tenantId: string) => validateDocument("index", docWith({ columns: 3 }), registry, { tenantId });
    for (let i = 0; i < 32; i++) run(`tenant-${i}`);
    expect(compilesFor(def)).toBe(32);
    run("tenant-0"); // refresh the oldest entry
    expect(compilesFor(def)).toBe(32);
    run("tenant-32"); // the 33rd tenant evicts the least recently used one: tenant-1
    expect(compilesFor(def)).toBe(33);
    run("tenant-0");
    run("tenant-32");
    expect(compilesFor(def)).toBe(33);
    run("tenant-1");
    expect(compilesFor(def)).toBe(34);
  });

  it("[AC-ENG-001] an unsafe tenant id shares the 'no tenant' entry instead of growing the cache", () => {
    const def = card(5);
    const registry = registryWith(def);
    const run = (tenantId?: string) => validateDocument("index", docWith({ columns: 3 }), registry, { tenantId });
    run();
    run("../evil");
    run("a/b");
    run("");
    expect(compilesFor(def)).toBe(1);
  });
});

describe("Registries are isolated from one another [AC-ENG-001]", () => {
  const wide = registryWith(card(100));
  const narrow = registryWith(card(5));
  const textual: ComponentRegistry = registryWith({
    type: "card",
    name: "Card",
    settings: [{ id: "columns", type: "text", label: "Columns", default: "two" }],
  });

  const outcome = (registry: ComponentRegistry, settings: Record<string, unknown>) =>
    validateDocument("index", docWith(settings), registry).ok;

  it("[AC-ENG-001] two registries that reuse a type name with different settings give their own verdicts in any call order", () => {
    const orders: (typeof wide)[][] = [
      [wide, narrow, wide, narrow],
      [narrow, wide, narrow, wide],
      [narrow, narrow, wide, wide],
      [wide, wide, narrow, narrow],
    ];
    for (const order of orders) {
      for (const registry of order) {
        const expected = registry === wide;
        expect(outcome(registry, { columns: 50 })).toBe(expected);
        expect(outcome(registry, { columns: 3 })).toBe(true);
      }
    }
  });

  it("[AC-ENG-001] the same setting id can be a different type in another registry", () => {
    for (const registry of [textual, narrow, textual, narrow]) {
      const isText = registry === textual;
      expect(outcome(registry, { columns: "three" })).toBe(isText);
      expect(outcome(registry, { columns: 3 })).toBe(!isText);
    }
  });

  it("[AC-ENG-001] the same block type name in two registries is validated against each registry's own definition", () => {
    const withBlock = (max: number): ComponentRegistry => ({
      sections: { card: { type: "card", name: "Card", settings: [] } },
      blocks: { chip: { type: "chip", name: "Chip", settings: [{ id: "n", type: "number", label: "N", default: 1, max }] } },
    });
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: node("card", {}, { b1: node("chip", { n: 7 }) }) },
      order: ["s1"],
    };
    const lax = withBlock(10);
    const strict = withBlock(3);
    for (const registry of [lax, strict, strict, lax]) {
      expect(validateDocument("index", doc, registry).ok).toBe(registry === lax);
    }
  });

  it("[AC-ENG-001] a tenant's image path is valid for that tenant only, whatever the call order", () => {
    const registry = getRegistry();
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { h: node("hero", { image: { path: "t1/store/a.png" } }) },
      order: ["h"],
    };
    for (const [tenantId, ok] of [["t1", true], ["t2", false], ["t1", true], ["t2", false], [undefined, false], ["t1", true]] as const) {
      expect({ tenantId, ok: validateDocument("index", doc, registry, tenantId ? { tenantId } : undefined).ok }).toEqual({ tenantId, ok });
    }
  });
});
