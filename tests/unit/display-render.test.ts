import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: unknown }) => h("a", { href, ...rest }, children as never) };
});

import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import type { DisplayRules } from "../../lib/templates/display-rules";
import { SCHEMA1_SAMPLES, renderSample } from "./fixtures/schema1-render-samples";

const golden = JSON.parse(readFileSync(new URL("./fixtures/schema1-render.golden.json", import.meta.url), "utf8")) as Record<string, string>;
const NOW = Date.parse("2026-06-15T12:00:00Z");
const sched = (startsAt?: string, endsAt?: string): DisplayRules => ({ v: 1, rules: [{ type: "schedule", startsAt, endsAt }] });
const text = (content: string, display?: DisplayRules): ComponentNode => ({ type: "text", settings: { content }, blocks: {}, block_order: [], ...(display ? { display } : {}) });
const section = (blocks: Record<string, ComponentNode>, display?: DisplayRules): ComponentNode => ({
  type: "rich-text",
  settings: { alignment: "center", maxWidth: "normal" },
  blocks,
  block_order: Object.keys(blocks),
  ...(display ? { display } : {}),
});
const doc = (sections: Record<string, ComponentNode>): TemplateDocument => ({ schemaVersion: 2, layout: "classic", sections, order: Object.keys(sections) });

const ACTIVE = sched("2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z");
const FUTURE = sched("2026-08-01T00:00:00Z");
const PAST = sched(undefined, "2026-06-01T00:00:00Z");
const NOT_ON_MOBILE: DisplayRules = { v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] };

describe("renderer: schedule rules (public mode)", () => {
  const d = doc({
    live: section({ a: text("LIVE-BLOCK", ACTIVE), f: text("FUTURE-BLOCK", FUTURE), p: text("PAST-BLOCK", PAST), n: text("PLAIN-BLOCK") }, ACTIVE),
    soon: section({ t: text("SOON-SECTION-TEXT") }, FUTURE),
    gone: section({ t: text("GONE-SECTION-TEXT") }, PAST),
  });
  const html = renderSample(d, "public", { serverNow: NOW });
  it("keeps active nodes and omits inactive ones from the markup", () => {
    expect(html).toContain("LIVE-BLOCK");
    expect(html).toContain("PLAIN-BLOCK");
    for (const hidden of ["FUTURE-BLOCK", "PAST-BLOCK", "SOON-SECTION-TEXT", "GONE-SECTION-TEXT"]) expect(html).not.toContain(hidden);
  });
  it("judges the boundary instants exactly", () => {
    const edge = doc({ s: section({ t: text("EDGE", sched("2026-06-15T12:00:00Z", "2026-06-15T13:00:00Z")) }) });
    expect(renderSample(edge, "public", { serverNow: NOW })).toContain("EDGE");
    expect(renderSample(edge, "public", { serverNow: NOW - 1 })).not.toContain("EDGE");
    expect(renderSample(edge, "public", { serverNow: Date.parse("2026-06-15T13:00:00Z") })).not.toContain("EDGE");
  });
  it("fails closed on malformed display rules", () => {
    const bad = doc({ s: section({ t: text("BAD", { v: 1, rules: [{ type: "schedule", startsAt: "nope" }] } as DisplayRules) }) });
    expect(renderSample(bad, "public", { serverNow: NOW })).not.toContain("BAD");
  });
  it("preview shows everything unless previewNow is given; a public render ignores previewNow", () => {
    expect(renderSample(d, "preview")).toContain("FUTURE-BLOCK");
    const at = renderSample(d, "preview", { previewNow: "2026-06-15T12:00:00Z" });
    expect(at).toContain("LIVE-BLOCK");
    expect(at).not.toContain("FUTURE-BLOCK");
    const later = renderSample(d, "preview", { previewNow: Date.parse("2026-09-01T00:00:00Z") });
    expect(later).toContain("SOON-SECTION-TEXT");
    expect(later).not.toContain("LIVE-BLOCK");
    expect(renderSample(d, "public", { serverNow: NOW, previewNow: "2026-09-01T00:00:00Z" })).not.toContain("FUTURE-BLOCK");
  });
});

describe("renderer: device rules", () => {
  it("keeps the node in the HTML and adds fixed classes (section and block)", () => {
    const d = doc({ s: section({ t: text("DEVICE-BLOCK", NOT_ON_MOBILE) }, NOT_ON_MOBILE) });
    const html = renderSample(d, "public", { serverNow: NOW });
    expect(html).toContain("DEVICE-BLOCK");
    expect(html.match(/data-sf-hide="mobile"/g)).toHaveLength(2);
    expect(html.match(/class="contents max-\[767px\]:hidden"/g)).toHaveLength(2);
  });
  it("a device rule that shows everywhere adds no wrapper", () => {
    const all: DisplayRules = { v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: true }] };
    const html = renderSample(doc({ s: section({ t: text("X", all) }, all) }), "public", { serverNow: NOW });
    expect(html).not.toContain("data-sf-hide");
  });
  it("schedule and device rules are ANDed", () => {
    const both: DisplayRules = { v: 1, rules: [{ type: "schedule", startsAt: "2026-08-01T00:00:00Z" }, NOT_ON_MOBILE.rules[0]] };
    expect(renderSample(doc({ s: section({ t: text("BOTH", both) }) }), "public", { serverNow: NOW })).not.toContain("BOTH");
    expect(renderSample(doc({ s: section({ t: text("BOTH", both) }) }), "public", { serverNow: Date.parse("2026-09-01T00:00:00Z") })).toContain("BOTH");
  });
});

describe("renderer: schema 1 documents are unchanged", () => {
  for (const [name, d] of Object.entries(SCHEMA1_SAMPLES)) {
    for (const mode of ["public", "preview"] as const) {
      it(`${name} (${mode}) is byte-identical to the markup rendered before display rules existed`, () => {
        expect(renderSample(d, mode)).toBe(golden[`${name}:${mode}`]);
      });
    }
  }
});
