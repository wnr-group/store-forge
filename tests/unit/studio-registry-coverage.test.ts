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
import { readStyle } from "@/lib/editor/style";
import { LOOK_IDS } from "@/lib/templates/looks";
import { getRegistry } from "@/lib/templates/registry/index";
import { validateDocument } from "@/lib/templates/engine/validate";
import { createBlockNode, createSectionNode, createState, setElementStyle, setTextOverride, toggleSection } from "@/lib/themes/editor/state";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";

const registry = getRegistry();
const DEVICES = ["base", "tablet", "mobile"] as const;
type Row = { key: string; look: string; kind: "section" | "block"; type: string; host: string | null; capabilities: string[] | null; persists: boolean; validates: boolean; renders: boolean; hiddenChangesOutput: boolean | "unsupported"; textOverrideShown: boolean | "no-static-text"; notes: string[] };

const doc = (section: ComponentNode): TemplateDocument => ({ schemaVersion: 1, layout: "classic", order: ["s"], sections: { s: section } });
const render = (document: TemplateDocument, look: string) =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store: { name: "Shop", slug: "s", currency: "USD", products: [] }, collections: [], theme: { settings: { brand: { look } } }, basePath: "" } as never }));
const firstText = (html: string) => /(?:^|>)\s*([A-Za-z][^<>]{2,60}?)\s*(?:<|$)/.exec(html)?.[1];
const valid = (d: TemplateDocument) => validateDocument("index", d as never, registry, {}).ok;
const stateOf = (d: TemplateDocument) => createState("p", [{ templateId: "p", kind: "index", name: "P", revision: 1, document: d as never }]);

function hostFor(blockType: string): { hostType: string; section: ComponentNode; blockId: string } | null {
  const block = createBlockNode(blockType, registry);
  if (!block) return null;
  for (const [hostType, def] of Object.entries(registry.sections)) {
    const section = createSectionNode(def, registry);
    section.blocks = { b: block };
    section.block_order = ["b"];
    if (valid(doc(section))) return { hostType, section, blockId: "b" };
  }
  return null;
}

function cover(look: string, kind: "section" | "block", type: string): Row {
  const key = `${look}:${kind}:${type}`;
  const row: Row = { key, look, kind, type, host: null, capabilities: null, persists: false, validates: false, renders: false, hiddenChangesOutput: "unsupported", textOverrideShown: "no-static-text", notes: [] };
  let section: ComponentNode;
  let blockId: string | undefined;
  if (kind === "section") section = createSectionNode(registry.sections[type], registry);
  else { const h = hostFor(type); if (!h) { row.notes.push("no section accepts this block"); return row; } section = h.section; blockId = h.blockId; row.host = h.hostType; }
  const hostType = row.host ?? type;
  const adapter = adapterForLook(look);
  const spec = kind === "section" ? adapter.section(type) : adapter.block(type, hostType);
  row.capabilities = spec ? [...spec.capabilities] : null;
  const base = doc(section);
  let html = "";
  try { html = render(base, look); row.renders = true; } catch (e) { row.notes.push(`render threw: ${(e as Error).message}`); }

  let s = toggleSection(stateOf(base), "p", "s");
  for (const d of DEVICES) s = setElementStyle(s, "p", "s", blockId, d, "hidden", true);
  const edited = s.docs.p.document as unknown as TemplateDocument;
  const node = blockId ? edited.sections.s.blocks[blockId] : edited.sections.s;
  row.persists = Boolean(edited.sections.s.disabled) && DEVICES.every((d) => readStyle(node.settings)[d]?.hidden === true);
  row.validates = valid(edited);

  if (spec?.capabilities.includes("visibility")) {
    const h2 = setElementStyle(stateOf(base), "p", "s", blockId, "base", "hidden", true).docs.p.document as unknown as TemplateDocument;
    try { row.hiddenChangesOutput = render(h2, look) !== html; } catch { row.hiddenChangesOutput = false; }
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
    const rows = LOOK_IDS.flatMap((look) => [...sections.map((t) => cover(look, "section", t)), ...blocks.map((t) => cover(look, "block", t))]);
    mkdirSync("artifacts/studio/inventory", { recursive: true });
    writeFileSync("artifacts/studio/inventory/registry-coverage.json", JSON.stringify({ takenAt: new Date().toISOString(), looks: [...LOOK_IDS], rows }, null, 2));
    const known = new Set((JSON.parse(readFileSync("tests/fixtures/studio-known-gaps.json", "utf8")) as { key: string }[]).map((g) => g.key));
    const open = rows.flatMap(gapsOf).filter((k) => !known.has(k));
    expect(open, `undispositioned gaps (see artifacts/studio/inventory/registry-coverage.json):\n${open.join("\n")}`).toEqual([]);
  });
});
