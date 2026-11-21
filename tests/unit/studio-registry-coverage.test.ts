import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => { const { createElement: h } = await import("react"); return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) }; });
vi.mock("next/link", async () => { const { createElement: h } = await import("react"); return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) }; });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import { adapterForLook } from "@/lib/editor/adapter";
import "@/lib/editor/adapters";
import { readStyle, overrideValue } from "@/lib/editor/style";
import { documentsCss } from "@/lib/editor/render";
import { LOOK_IDS } from "@/lib/templates/looks";
import { getRegistry } from "@/lib/templates/registry/index";
import { validateDocument } from "@/lib/templates/engine/validate";
import { createBlockNode, createSectionNode, createState, setElementStyle, setTextOverride, toggleSection } from "@/lib/themes/editor/state";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";

// A stored image only becomes a picture on the page when the storage address is known.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example.test");
const registry = getRegistry();
const DEVICES = ["base", "tablet", "mobile"] as const;
type Row = { key: string; look: string; kind: "section" | "block"; type: string; host: string | null; capabilities: string[] | null; persists: boolean; validates: boolean; renders: boolean; hiddenChangesOutput: boolean | "unsupported"; textOverrideShown: boolean | "no-static-text"; notes: string[] };

const doc = (section: ComponentNode): TemplateDocument => ({ schemaVersion: 1, layout: "classic", order: ["s"], sections: { s: section } });
/** One record that serves as the current product (main product) and the current collection (collection banner). */
const RESOURCE = { id: "r1", name: "Brass Candle Holder", slug: "brass-candle-holder", description: "A collection of brass pieces", short_description: "Solid brass candle holder", price_minor: 249900, compare_at_price_minor: 299900, sku: "BCH-001", category: "Home", category_id: "c1", collection_id: "c1", image_path: null, images: [], type: "Candle", options: [{ name: "Size", values: ["S", "M"] }], variants: [{ id: "v1", sku: "BCH-S", option_values: { Size: "S" }, price_minor: 249900, compare_at_price_minor: 299900 }] };
const render = (document: TemplateDocument, look: string, theme: unknown = { settings: { brand: { look } } }) =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store: { name: "Shop", slug: "s", currency: "USD", products: [RESOURCE] }, collections: [], theme, resource: RESOURCE, basePath: "" } as never }));
const firstText = (html: string) => /(?:^|>)\s*([A-Za-z][^<>]{2,60}?)\s*(?:<|$)/.exec(html)?.[1];
const valid = (d: TemplateDocument) => validateDocument("index", d as never, registry, { tenantId: "t1" }).ok;
const stateOf = (d: TemplateDocument) => createState("p", [{ templateId: "p", kind: "index", name: "P", revision: 1, document: d as never }]);

/** A column draws its own title, text, picture and link; the blocks the registry lets it hold are never drawn (proved in the last test). */
const PARENTS_WITHOUT_CHILDREN = ["column"];

/** The (section, block) pairs the registry really allows: a block is only ever drawn inside a section that accepts it. */
function realPairs(): { host: string; block: string; parent?: string }[] {
  const direct = Object.entries(registry.sections).flatMap(([host, def]) => ((def as { accepts?: readonly string[] }).accepts ?? []).filter((t) => registry.blocks[t]).map((block) => ({ host, block })));
  // Blocks inside blocks (a column's heading, a link column's links): shown inside the first section that accepts the parent.
  const nested = Object.entries(registry.blocks).filter(([parent]) => !PARENTS_WITHOUT_CHILDREN.includes(parent)).flatMap(([parent, def]) => {
    const host = Object.entries(registry.sections).find(([, sd]) => ((sd as { accepts?: readonly string[] }).accepts ?? []).includes(parent))?.[0];
    return host ? ((def as { accepts?: readonly string[] }).accepts ?? []).filter((t) => registry.blocks[t]).map((block) => ({ host, block, parent })) : [];
  });
  return [...direct, ...nested];
}

/**
 * A hero slide is slide data, not a styled box: its visibility control is the block's own disable toggle (the eye in the Layers
 * list), which every hero that draws slides honours. Heroes that never draw slides (see the known-gaps fixture) cannot hide one.
 */
const SLIDE_TEXT = "ZZ-SLIDE-HEADING";

const offered = (look: string) => realPairs().filter((p) => adapterForLook(look).drawsBlock?.(p.block, p.host) ?? true);
const notOffered = (look: string) => realPairs().filter((p) => !(adapterForLook(look).drawsBlock?.(p.block, p.host) ?? true));

function cover(look: string, kind: "section" | "block", type: string, hostType?: string, parentType?: string): Row {
  const key = kind === "section" ? `${look}:section:${type}` : `${look}:block:${hostType}${parentType ? `>${parentType}` : ""}:${type}`;
  const row: Row = { key, look, kind, type, host: hostType ?? null, capabilities: null, persists: false, validates: false, renders: false, hiddenChangesOutput: "unsupported", textOverrideShown: "no-static-text", notes: [] };
  let section: ComponentNode;
  let blockId: string | undefined;
  if (kind === "section") section = createSectionNode(registry.sections[type], registry);
  else {
    section = createSectionNode(registry.sections[hostType!], registry);
    const block = createBlockNode(type, registry);
    if (!block) { row.notes.push("block cannot be created"); return row; }
    if (type === "hero-slide") block.settings = { ...block.settings, heading: SLIDE_TEXT, image: { path: "t1/store/slide.webp", alt: "s" } };
    if (type === "image") block.settings = { ...block.settings, image: { path: "t1/store/test.webp", alt: "t" } };
    const first = hostType === "hero" && type === "button" ? createBlockNode("button", registry) : null;
    if (parentType) {
      const parent = createBlockNode(parentType, registry)!;
      parent.blocks = { b: block };
      parent.block_order = ["b"];
      section.blocks = { p: parent };
      section.block_order = ["p"];
    } else {
      section.blocks = first ? { a: first, b: block } : { b: block };
      section.block_order = first ? ["a", "b"] : ["b"];
    }
    blockId = "b";
    if (!valid(doc(section))) { row.notes.push("the host section does not validate with this block"); return row; }
  }
  const adapter = adapterForLook(look);
  const spec = kind === "section" ? adapter.section(type) : adapter.block(type, hostType!);
  row.capabilities = spec ? [...spec.capabilities] : null;
  const base = doc(section);
  // Square-cornered buttons (radius 4) make the standard hero a slider, the only layout that draws slides.
  const theme = type === "hero-slide" ? { settings: { brand: { look }, buttons: { radius: 4 } } } : { settings: { brand: { look } } };
  const renderIn = (d: TemplateDocument) => render(d, look, theme);
  let html = "";
  try { html = renderIn(base); row.renders = true; } catch (e) { row.notes.push(`render threw: ${(e as Error).message}`); }

  let s = toggleSection(stateOf(base), "p", "s");
  for (const d of DEVICES) s = setElementStyle(s, "p", "s", blockId, d, "hidden", true);
  const edited = s.docs.p.document as unknown as TemplateDocument;
  const find = (n: ComponentNode, id: string): ComponentNode | undefined => n.blocks?.[id] ?? Object.values(n.blocks ?? {}).map((c) => find(c, id)).find(Boolean);
  const node = (blockId ? find(edited.sections.s, blockId) : edited.sections.s)!;
  row.persists = Boolean(edited.sections.s.disabled) && DEVICES.every((d) => readStyle(node.settings)[d]?.hidden === true);
  row.validates = valid(edited);

  if (type === "hero-slide") {
    // The disable toggle is the control: the slide's heading must leave the public page when it is switched off.
    const off = structuredClone(base) as TemplateDocument;
    off.sections.s.blocks.b.disabled = true;
    try { row.hiddenChangesOutput = html.includes(SLIDE_TEXT) && !renderIn(off).includes(SLIDE_TEXT); } catch { row.hiddenChangesOutput = false; }
    if (row.hiddenChangesOutput !== true) row.notes.push("this look does not draw hero slides");
  } else if (spec?.capabilities.includes("visibility")) {
    // Hidden on one device: the element must carry the style hook in the page AND the generated stylesheet must hide it.
    const hidden = setElementStyle(stateOf(base), "p", "s", blockId, "base", "hidden", true).docs.p.document as unknown as TemplateDocument;
    try {
      const hook = `data-sf-ov="${overrideValue(blockId ?? "s")}"`;
      row.hiddenChangesOutput = renderIn(hidden) !== html && renderIn(hidden).includes(hook) && /display:none/.test(documentsCss([hidden]));
    } catch { row.hiddenChangesOutput = false; }
  } else row.notes.push("adapter offers no visibility control for this element");

  // Text overrides are applied by a client component (components/storefront/engine/text-overrides.tsx, layout effect), so server
  // markup cannot show them. What is checked here: the override persists in settings._text and the document still validates.
  const text = firstText(html);
  if (text) {
    const t = setTextOverride(stateOf(base), "p", "s", text, "ZZ-OVERRIDE").docs.p.document as unknown as TemplateDocument;
    row.textOverrideShown = valid(t) && JSON.stringify(t).includes("ZZ-OVERRIDE");
  }
  return row;
}

const gapsOf = (r: Row): string[] => [
  ...(r.persists ? [] : [`${r.key}:persist`]),
  ...(r.validates ? [] : [`${r.key}:validate`]),
  ...(r.renders ? [] : [`${r.key}:render`]),
  ...(r.hiddenChangesOutput === true ? [] : [`${r.key}:visibility`]),
  ...(r.textOverrideShown === false ? [`${r.key}:text-override`] : []),
];

describe("registry coverage per look", () => {
  const sections = Object.keys(registry.sections);
  const blocks = Object.keys(registry.blocks);
  it("has the registry the plan was written against (18 sections, 22 blocks) and 4 looks", () => {
    expect(sections).toHaveLength(18);
    expect(blocks).toHaveLength(22);
    expect(LOOK_IDS).toHaveLength(4);
  });
  it("every element on every look persists, validates, renders and is covered, or is dispositioned", () => {
    const rows = LOOK_IDS.flatMap((look) => [...sections.map((t) => cover(look, "section", t)), ...offered(look).map((p) => cover(look, "block", p.block, p.host, p.parent))]);
    mkdirSync("artifacts/studio/inventory", { recursive: true });
    writeFileSync("artifacts/studio/inventory/registry-coverage.json", JSON.stringify({ takenAt: new Date().toISOString(), looks: [...LOOK_IDS], rows }, null, 2));
    const known = new Set((JSON.parse(readFileSync("tests/fixtures/studio-known-gaps.json", "utf8")) as { key: string }[]).map((g) => g.key));
    const open = rows.flatMap(gapsOf).filter((k) => !known.has(k));
    expect(open, `undispositioned gaps (see artifacts/studio/inventory/registry-coverage.json):\n${open.join("\n")}`).toEqual([]);
  });
  it("every block type can be hidden somewhere on every look, and nothing is left out silently", () => {
    for (const look of LOOK_IDS) {
      const seen = new Set(offered(look).map((p) => p.block));
      const unreachable = blocks.filter((t) => !seen.has(t) && !notOffered(look).some((p) => p.block === t));
      // "group" is registered but no section or block accepts it, so a merchant cannot place one (finding D-006); it is named here, not skipped.
      expect(unreachable, `${look}: block types in no section`).toEqual(["group"]);
    }
  });
  it("a block a look does not offer is really not drawn by that look (so nothing visible escapes the visibility controls)", () => {
    const drawn: string[] = [];
    for (const look of LOOK_IDS) {
      for (const { host, block: type } of notOffered(look)) {
        const section = createSectionNode(registry.sections[host], registry);
        const block = createBlockNode(type, registry)!;
        const MARK = "ZZ-NOT-DRAWN";
        block.settings = { ...block.settings, text: MARK, content: MARK, heading: MARK, label: MARK, image: { path: "t1/store/x.webp", alt: "x" } };
        section.blocks = { b: block };
        section.block_order = ["b"];
        const theme = type === "hero-slide" ? { settings: { brand: { look }, buttons: { radius: 0 } } } : { settings: { brand: { look } } };
        if (render(doc(section), look, theme).includes(MARK)) drawn.push(`${look}:${host}:${type}`);
      }
    }
    expect(drawn).toEqual([]);
  });
  it("the blocks a column accepts are never drawn by it, on any look, and the editor cannot nest blocks anyway", () => {
    const drawn: string[] = [];
    for (const look of LOOK_IDS) {
      for (const child of (registry.blocks.column as { accepts?: readonly string[] }).accepts ?? []) {
        const section = createSectionNode(registry.sections.multicolumn, registry);
        const column = createBlockNode("column", registry)!;
        const block = createBlockNode(child, registry)!;
        const MARK = "ZZ-CHILD-NOT-DRAWN";
        block.settings = { ...block.settings, text: MARK, content: MARK, label: MARK };
        column.blocks = { c: block };
        column.block_order = ["c"];
        section.blocks = { col: column };
        section.block_order = ["col"];
        if (render(doc(section), look).includes(MARK)) drawn.push(`${look}:column>${child}`);
      }
    }
    expect(drawn).toEqual([]);
  });
});
