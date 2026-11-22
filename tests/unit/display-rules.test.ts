import { describe, expect, it } from "vitest";
import { deviceCss, displayRulesSchema, evaluateDisplay, parseDisplayRules, parseInstant, visibleOnDevice, type DisplayRules } from "../../lib/templates/display-rules";
import { pruneInactiveNodes } from "../../lib/templates/display-prune";
import { MIGRATION_STEPS, migrateDocument, upgradeToDisplayRules } from "../../lib/templates/engine/migrate";
import { resolveStyleValue, type ElementStyle } from "../../lib/editor/style";
import { getRegistry } from "../../lib/templates/registry/index";
import { validateDocument } from "../../lib/templates/engine/validate";
import type { ComponentNode } from "../../lib/templates/document";

const sched = (startsAt?: string, endsAt?: string): DisplayRules => ({ v: 1, rules: [{ type: "schedule", startsAt, endsAt }] });
const T = (s: string) => Date.parse(s);

describe("evaluateDisplay schedule boundaries", () => {
  const rules = sched("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z");
  it("no rules or no schedule: always", () => {
    expect(evaluateDisplay(undefined, 0)).toEqual({ show: true, state: "always" });
    expect(evaluateDisplay({ v: 1, rules: [{ type: "device", desktop: false, tablet: true, mobile: true }] }, 0)).toEqual({ show: true, state: "always" });
  });
  it("before start is upcoming", () => expect(evaluateDisplay(rules, T("2026-05-31T23:59:59.999Z"))).toEqual({ show: false, state: "upcoming" }));
  it("at start is active (inclusive)", () => expect(evaluateDisplay(rules, T("2026-06-01T00:00:00Z"))).toEqual({ show: true, state: "active" }));
  it("inside is active", () => expect(evaluateDisplay(rules, T("2026-06-01T12:00:00Z"))).toEqual({ show: true, state: "active" }));
  it("at end is expired (exclusive)", () => expect(evaluateDisplay(rules, T("2026-06-02T00:00:00Z"))).toEqual({ show: false, state: "expired" }));
  it("after end is expired", () => expect(evaluateDisplay(rules, T("2026-06-03T00:00:00Z"))).toEqual({ show: false, state: "expired" }));
  it("open-ended schedules", () => {
    expect(evaluateDisplay(sched("2026-06-01T00:00:00Z"), T("2030-01-01T00:00:00Z")).show).toBe(true);
    expect(evaluateDisplay(sched(undefined, "2026-06-01T00:00:00Z"), T("2020-01-01T00:00:00Z")).show).toBe(true);
  });
  it("offsets are absolute instants", () => {
    const r = sched("2026-06-01T05:30:00+05:30");
    expect(evaluateDisplay(r, T("2026-06-01T00:00:00Z")).show).toBe(true);
    expect(evaluateDisplay(r, T("2026-05-31T23:59:59Z")).show).toBe(false);
  });
  it("accepts a Date or ISO string for now", () => {
    expect(evaluateDisplay(rules, new Date("2026-06-01T01:00:00Z")).show).toBe(true);
    expect(evaluateDisplay(rules, "2026-06-01T01:00:00Z").show).toBe(true);
  });
  it("invalid input fails closed", () => {
    expect(evaluateDisplay(rules, Number.NaN).show).toBe(false);
    expect(evaluateDisplay(rules, "garbage").show).toBe(false);
    expect(evaluateDisplay(sched("not-a-date"), 0).show).toBe(false);
    expect(evaluateDisplay({ v: 1, rules: [{ type: "schedule" }] }, 0).show).toBe(false);
  });
});

describe("display rules validator", () => {
  const ok = (v: unknown) => displayRulesSchema.safeParse(v).success;
  const dev = { type: "device", desktop: true, tablet: false, mobile: true };
  it("accepts good rules", () => {
    expect(ok({ v: 1, rules: [] })).toBe(true);
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-02T00:00:00Z", timezone: "Asia/Kolkata" }, dev] })).toBe(true);
  });
  it("rejects bad input", () => {
    expect(ok(null)).toBe(false);
    expect(ok({ v: 2, rules: [] })).toBe(false);
    expect(ok({ v: 1 })).toBe(false);
    expect(ok({ v: 1, rules: [], extra: 1 })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "css", value: "x" }] })).toBe(false);
    expect(ok({ v: 1, rules: [{ ...dev, css: "display:none" }] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "device", desktop: "no", tablet: true, mobile: true }] })).toBe(false);
    expect(ok({ v: 1, rules: [dev, dev] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z" }, { type: "schedule", endsAt: "2026-07-01T00:00:00Z" }] })).toBe(false);
    expect(ok({ v: 1, rules: [dev, dev, dev] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "schedule" }] })).toBe(false);
  });
  it("rejects bad instants, order and time zones", () => {
    for (const bad of ["2026-06-01", "2026-06-01T00:00:00", "2026-02-30T00:00:00Z", "2026-13-01T00:00:00Z", "2026-06-01T24:00:00Z", "June 1 2026", "2026-06-01T00:00:00Z; x", 5]) {
      expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: bad }] }), String(bad)).toBe(false);
    }
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-02T00:00:00Z", endsAt: "2026-06-01T00:00:00Z" }] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-01T00:00:00Z" }] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", timezone: "Mars/Base" }] })).toBe(false);
    expect(ok({ v: 1, rules: [{ type: "schedule", startsAt: "2026-06-01T00:00:00Z", timezone: "A".repeat(65) }] })).toBe(false);
    expect(parseInstant("2028-02-29T00:00:00Z")).not.toBeNull();
    expect(parseDisplayRules({ v: 1, rules: [dev] })).not.toBeNull();
  });
  it("the document validator accepts schema 1 and 2, with display on sections and blocks, and rejects bad display", () => {
    const rules = { v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] };
    const doc = (schemaVersion: number, display: unknown) => ({
      schemaVersion,
      layout: "classic",
      sections: { a: { type: "rich-text", settings: {}, blocks: { t: { type: "text", settings: { content: "x" }, blocks: {}, block_order: [], display } }, block_order: ["t"], display } },
      order: ["a"],
    });
    const errors = (d: unknown) => validateDocument("index", d, getRegistry(), { tenantId: "t1" }).issues.filter((i) => i.level === "error");
    expect(errors(doc(1, undefined))).toEqual([]);
    expect(errors(doc(2, undefined))).toEqual([]);
    expect(errors(doc(2, rules))).toEqual([]);
    expect(errors(doc(3, undefined)).length).toBeGreaterThan(0);
    expect(errors(doc(2, { v: 1, rules: [{ type: "device", desktop: 1 }] })).length).toBeGreaterThan(0);
  });
});

describe("deviceCss", () => {
  it("is null when shown everywhere or no device rule", () => {
    expect(deviceCss(undefined)).toBeNull();
    expect(deviceCss({ v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: true }] })).toBeNull();
  });
  it("produces only fixed classes matching the breakpoints", () => {
    const css = deviceCss({ v: 1, rules: [{ type: "device", desktop: false, tablet: false, mobile: false }] });
    expect(css?.className).toBe("contents max-[767px]:hidden min-[768px]:max-[1279px]:hidden min-[1280px]:hidden");
    expect(css?.hide).toBe("mobile tablet desktop");
    expect(deviceCss({ v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] })?.className).toBe("contents max-[767px]:hidden");
  });
  it("never copies user data into the output", () => {
    const evil = { v: 1, rules: [{ type: "device", desktop: false, tablet: "}</style><script>", mobile: true, css: "x:y" }] } as unknown as DisplayRules;
    const css = deviceCss(evil);
    expect(css?.className).toBe("contents min-[1280px]:hidden");
    expect(JSON.stringify(css)).not.toMatch(/script|style/);
  });
});

describe("migration 1 -> 2: visibility equivalence over all 27 hidden combinations", () => {
  const states: (boolean | undefined)[] = [undefined, true, false];
  const node = (style: ElementStyle): ComponentNode => ({ type: "rich-text", settings: { alignment: "left", _style: style }, blocks: {}, block_order: [] });
  type Doc = { schemaVersion: number; sections: Record<string, ComponentNode> };
  const doc = (n: ComponentNode) => ({ schemaVersion: 1, layout: "classic", sections: { s: { ...n, blocks: { b: { ...n } }, block_order: ["b"] } }, order: ["s"] });
  // Reference: the cascade the stylesheet applies, from the editor's own resolver (independent of the migration code).
  const before = (style: ElementStyle, device: "base" | "tablet" | "mobile") => resolveStyleValue([{ source: "n", style }], "hidden", device).value !== true;

  for (const base of states) for (const tablet of states) for (const mobile of states) {
    it(`base=${base} tablet=${tablet} mobile=${mobile}`, () => {
      const style: ElementStyle = {};
      if (base !== undefined) style.base = { hidden: base, color: "#112233" };
      if (tablet !== undefined) style.tablet = { hidden: tablet };
      if (mobile !== undefined) style.mobile = { hidden: mobile, fontSize: 14 };
      const input = doc(node(style));
      const frozen = JSON.stringify(input);
      const out = upgradeToDisplayRules(input as unknown as Record<string, unknown>) as unknown as Doc;
      expect(JSON.stringify(input)).toBe(frozen); // input never mutated
      expect(out.schemaVersion).toBe(2);
      for (const target of [out.sections.s, out.sections.s.blocks.b]) {
        const rules = target.display;
        expect(visibleOnDevice(rules, "desktop")).toBe(before(style, "base"));
        expect(visibleOnDevice(rules, "tablet")).toBe(before(style, "tablet"));
        expect(visibleOnDevice(rules, "mobile")).toBe(before(style, "mobile"));
        // hidden keys are gone, everything else is untouched
        const next = (target.settings._style ?? {}) as Record<string, Record<string, unknown>>;
        for (const d of ["base", "tablet", "mobile"]) expect(next[d]?.hidden).toBeUndefined();
        expect(next.base?.color).toBe(base === undefined ? undefined : "#112233");
        expect(next.mobile?.fontSize).toBe(mobile === undefined ? undefined : 14);
        expect(target.settings.alignment).toBe("left");
        if (rules) expect(parseDisplayRules(rules)).not.toBeNull();
      }
    });
  }

  it("leaves a document without hidden keys structurally unchanged apart from the version", () => {
    const input = doc(node({ base: { color: "#112233" } }));
    const out = upgradeToDisplayRules(input as unknown as Record<string, unknown>);
    expect(out).toEqual({ ...input, schemaVersion: 2 });
  });
  it("is registered as step 1 and is lazy: migrateDocument does not upgrade a schema 1 document", () => {
    expect(typeof MIGRATION_STEPS[1]).toBe("function");
    const input = doc(node({ base: { hidden: true } }));
    const read = migrateDocument("index", input);
    expect(read.schemaVersion).toBe(1);
    expect(JSON.stringify(read)).toBe(JSON.stringify(input));
    expect(migrateDocument("index", { ...input, schemaVersion: 2 }).schemaVersion).toBe(2);
  });
  it("migrates the page documents a theme document holds", () => {
    const theme = { schemaVersion: 1, settings: { pages: { cart: doc(node({ base: { hidden: true } })) } } };
    const out = upgradeToDisplayRules(theme) as { settings: { pages: { cart: Doc } } };
    expect(out.settings.pages.cart.schemaVersion).toBe(2);
    expect(out.settings.pages.cart.sections.s.display?.rules[0]).toEqual({ type: "device", desktop: false, tablet: false, mobile: false });
  });
});

describe("pruneInactiveNodes", () => {
  const n = (display?: DisplayRules, blocks: Record<string, ComponentNode> = {}): ComponentNode => ({ type: "rich-text", settings: {}, blocks, block_order: Object.keys(blocks), display });
  it("returns the same object when nothing is inactive", () => {
    const d = { sections: { a: n() }, order: ["a"] };
    expect(pruneInactiveNodes(d, 0)).toBe(d);
  });
  it("removes inactive sections and blocks and their order entries", () => {
    const off = sched("2030-01-01T00:00:00Z");
    const d = { sections: { a: n(off), b: n(undefined, { x: n(off), y: n() }) }, order: ["a", "b"] };
    const out = pruneInactiveNodes(d, T("2026-01-01T00:00:00Z"));
    expect(out.order).toEqual(["b"]);
    expect(Object.keys(out.sections)).toEqual(["b"]);
    expect(out.sections.b.block_order).toEqual(["y"]);
  });
});
