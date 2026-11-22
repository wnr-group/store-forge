import { describe, expect, it } from "vitest";
import { applyInlineEdit, locateInlineEdit } from "@/lib/editor/inline";
import { getRegistry } from "@/lib/templates/registry/index";
import { createState, setTextOverride } from "@/lib/themes/editor/state";

const registry = getRegistry();
type N = { type: string; settings: Record<string, unknown>; blocks: Record<string, N>; block_order: string[] };
const node = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, N> = {}): N => ({ type, settings, blocks, block_order: Object.keys(blocks) });
const block = (type: string, settings: Record<string, unknown> = {}): N => node(type, settings);
type Doc = { sections: Record<string, { settings: Record<string, unknown>; blocks: Record<string, { settings: Record<string, unknown> }> }> };

const start = () =>
  createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: { schemaVersion: 1, layout: "classic", sections: { s: node("hero", { heading: "Run faster" }, { b: block("heading", { text: "Big headline" }) }) }, order: ["s"] } }]);
const section = (st: ReturnType<typeof start>) => (st.docs.p.document as unknown as Doc).sections.s;

describe("saving text edited on the page", () => {
  it("text held by a block setting goes to that setting", () => {
    const s = start();
    const target = locateInlineEdit(section(s) as never, "b", registry, "Big headline");
    expect(target).toEqual({ kind: "setting", blockId: "b", key: "text", from: "Big headline" });
    const next = applyInlineEdit(s, "p", "s", target, "New headline");
    expect(section(next).blocks.b.settings.text).toBe("New headline");
  });

  it("text held by a section setting goes to that setting", () => {
    const s = start();
    const target = locateInlineEdit(section(s) as never, undefined, registry, "Run faster");
    expect(target).toMatchObject({ kind: "setting", key: "heading" });
    expect(section(applyInlineEdit(s, "p", "s", target, "Run far")).settings.heading).toBe("Run far");
  });

  it("text no setting holds becomes a replacement for the section", () => {
    const s = start();
    const target = locateInlineEdit(section(s) as never, undefined, registry, "Add to bag");
    expect(target).toEqual({ kind: "override", from: "Add to bag" });
    expect(section(applyInlineEdit(s, "p", "s", target, "Buy now")).settings._text).toEqual([{ from: "Add to bag", to: "Buy now" }]);
  });

  it("editing a replaced word edits the replacement, not a new one", () => {
    const s = setTextOverride(start(), "p", "s", "Add to bag", "Buy now");
    const target = locateInlineEdit(section(s) as never, undefined, registry, "Buy now");
    expect(target).toEqual({ kind: "override", from: "Add to bag" });
    expect(section(applyInlineEdit(s, "p", "s", target, "Get it")).settings._text).toEqual([{ from: "Add to bag", to: "Get it" }]);
  });

  it("a setting edit removes a replacement that would hide it", () => {
    const s = setTextOverride(start(), "p", "s", "Run faster", "Hidden");
    const target = locateInlineEdit(section(s) as never, undefined, registry, "Hidden");
    expect(target).toMatchObject({ kind: "setting", key: "heading", from: "Run faster" });
    const next = applyInlineEdit(s, "p", "s", target, "Run far");
    expect(section(next).settings.heading).toBe("Run far");
    expect(section(next).settings._text).toBeUndefined();
  });

  it("an unknown block falls back to the section", () => {
    const s = start();
    expect(locateInlineEdit(section(s) as never, "gone", registry, "Run faster")).toMatchObject({ kind: "setting", key: "heading" });
  });
});
