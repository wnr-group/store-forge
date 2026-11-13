import { describe, expect, it } from "vitest";
import { getRegistry } from "@/lib/templates/registry/index";
import {
  addBlock, addSection, createBlockNode, createState, dirtyDocs, duplicateSection, isDirty, markSaved, moveSection, removeBlock, removeSection,
  replaceDoc, sectionOrder, setSetting, setThemeSetting, toggleSection,
} from "@/lib/themes/editor/state";

const registry = getRegistry();
type Loose = { sections: Record<string, { type: string; settings: Record<string, unknown>; block_order: string[]; disabled?: boolean }>; settings: Record<string, Record<string, unknown>> };
const node = (type: string, settings = {}) => ({ type, settings, blocks: {}, block_order: [] });
const page = () => ({
  schemaVersion: 1, layout: "classic",
  sections: { a: node("hero", { heading: "A" }), b: node("product-grid"), c: node("rich-text") },
  order: ["a", "b", "c"],
});
const fresh = () => createState("p", [
  { templateId: "p", kind: "index", name: "Home", revision: 3, document: page() },
  { templateId: "t", kind: "theme_settings", name: "Theme", revision: 1, document: { schemaVersion: 1, settings: { colors: { primary: "#111111" } } } },
]);

describe("editor state", () => {
  it("starts clean and becomes dirty only when the document changes", () => {
    const s = fresh();
    expect(dirtyDocs(s)).toHaveLength(0);
    const edited = setSetting(s, "p", "a", undefined, "heading", "New");
    expect(isDirty(edited.docs.p)).toBe(true);
    expect(isDirty(setSetting(edited, "p", "a", undefined, "heading", "A").docs.p)).toBe(false);
    expect(s.docs.p.document).toEqual(page()); // input untouched
  });

  it("changes text, and removing a setting restores the default", () => {
    let s = setSetting(fresh(), "p", "a", undefined, "heading", "Hello");
    expect((s.docs.p.document as Loose).sections.a.settings.heading).toBe("Hello");
    s = setSetting(s, "p", "a", undefined, "heading", undefined);
    expect((s.docs.p.document as Loose).sections.a.settings).toEqual({});
  });

  it("adds a section with defaults, selects it, and respects position", () => {
    const def = registry.sections["image-with-text"];
    const { state, id } = addSection(fresh(), "p", def, registry, 1);
    expect(id).toBeTruthy();
    expect(sectionOrder(state, "p")[1]).toBe(id);
    expect(sectionOrder(state, "p")).toHaveLength(4);
    expect(state.selection).toEqual({ docId: "p", sectionId: id });
    expect((state.docs.p.document as Loose).sections[id!].type).toBe("image-with-text");
    expect((state.docs.p.document as Loose).sections[id!].settings.imagePosition).toBeDefined();
  });

  it("removes, duplicates, hides and reorders sections", () => {
    let s = removeSection(fresh(), "p", "b");
    expect(sectionOrder(s, "p")).toEqual(["a", "c"]);

    s = duplicateSection(fresh(), "p", "a");
    const order = sectionOrder(s, "p");
    expect(order).toHaveLength(4);
    expect(order[0]).toBe("a");
    expect(order[1]).not.toBe("a");
    expect((s.docs.p.document as Loose).sections[order[1]].settings.heading).toBe("A");

    s = toggleSection(fresh(), "p", "b");
    expect((s.docs.p.document as Loose).sections.b.disabled).toBe(true);
    s = toggleSection(s, "p", "b");
    expect((s.docs.p.document as Loose).sections.b.disabled).toBeUndefined();

    s = moveSection(fresh(), "p", "c", 0);
    expect(sectionOrder(s, "p")).toEqual(["c", "a", "b"]);
    expect(sectionOrder(moveSection(fresh(), "p", "a", 99), "p")).toEqual(["a", "b", "c"]); // refused, unchanged
  });

  it("clears the selection when the selected section is removed", () => {
    let s = fresh();
    s = { ...s, selection: { docId: "p", sectionId: "a" } };
    expect(removeSection(s, "p", "a").selection).toBeNull();
    expect(removeSection(s, "p", "b").selection).toEqual({ docId: "p", sectionId: "a" });
  });

  it("adds and removes blocks inside a section", () => {
    const block = createBlockNode("heading", registry)!;
    const { state, id } = addBlock(fresh(), "p", "a", block);
    expect(id).toBeTruthy();
    expect((state.docs.p.document as Loose).sections.a.block_order).toEqual([id]);
    const after = removeBlock(state, "p", "a", id!);
    expect((after.docs.p.document as Loose).sections.a.block_order).toEqual([]);
    expect(after.selection).toEqual({ docId: "p", sectionId: "a" });
  });

  it("edits global theme settings", () => {
    const s = setThemeSetting(fresh(), "t", "colors", "primary", "#ff0000");
    expect((s.docs.t.document as Loose).settings.colors.primary).toBe("#ff0000");
    expect(isDirty(s.docs.t)).toBe(true);
    const s2 = setThemeSetting(s, "t", "typography", "headingFont", "manrope");
    expect((s2.docs.t.document as Loose).settings.typography.headingFont).toBe("manrope");
    expect((s2.docs.t.document as Loose).settings.colors.primary).toBe("#ff0000");
  });

  it("markSaved moves the baseline but keeps edits made during the save", () => {
    let s = setSetting(fresh(), "p", "a", undefined, "heading", "One");
    const sent = JSON.stringify(s.docs.p.document);
    const sentDoc = JSON.parse(sent);
    s = setSetting(s, "p", "a", undefined, "heading", "Two"); // typed while saving
    s = markSaved(s, "p", 4, sentDoc, sent);
    expect(s.docs.p.revision).toBe(4);
    expect((s.docs.p.document as Loose).sections.a.settings.heading).toBe("Two");
    expect(isDirty(s.docs.p)).toBe(true);

    const clean = markSaved(setSetting(fresh(), "p", "a", undefined, "heading", "X"), "p", 4, JSON.parse(JSON.stringify((setSetting(fresh(), "p", "a", undefined, "heading", "X")).docs.p.document)));
    expect(isDirty(clean.docs.p)).toBe(false);
  });

  it("replaceDoc loads the server copy as the new clean baseline", () => {
    const s = replaceDoc(setSetting(fresh(), "p", "a", undefined, "heading", "mine"), "p", 9, page());
    expect(s.docs.p.revision).toBe(9);
    expect(isDirty(s.docs.p)).toBe(false);
  });

  it("ignores unknown documents", () => {
    const s = fresh();
    expect(setSetting(s, "nope", "a", undefined, "x", 1)).toBe(s);
    expect(removeSection(s, "nope", "a")).toBe(s);
  });
});
