import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string; className?: string }) => h("img", { src: p.src, alt: p.alt, className: p.className }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const n = (type: string, settings: Record<string, unknown>, blocks: [string, ComponentNode][] = []): ComponentNode => ({ type, settings, blocks: Object.fromEntries(blocks), block_order: blocks.map(([id]) => id) });
const doc = (sections: [string, ComponentNode][]): TemplateDocument => ({ schemaVersion: 1, layout: "classic", sections: Object.fromEntries(sections), order: sections.map(([id]) => id) }) as unknown as TemplateDocument;

const page = doc([
  ["intro", n("image-with-text", { variant: "panel", eyebrow: "Contact", imagePosition: "right" }, [["h", n("heading", { text: "We are here to help", level: "h1" })], ["a", n("button", { label: "Email support", link: "mailto:support@example.com", style: "primary" })], ["b", n("button", { label: "Browse", link: "/collections", style: "outline" })]])],
  ["office", n("image-with-text", { variant: "plain", eyebrow: "Find us", imagePosition: "left" }, [["h", n("heading", { text: "Our office", level: "h2" })]])],
  ["details", n("multicolumn", { eyebrow: "Get in touch", heading: "Choose the right team", columns: 3 }, [["c1", n("column", { title: "Customer support", text: "support@example.com" })], ["c2", n("column", { title: "Orders and returns", text: "orders@example.com" })]])],
  ["faq", n("collapsible-content", { eyebrow: "Help centre", heading: "Quick answers", subheading: "Short.", ctaLabel: "Email support", ctaLink: "mailto:support@example.com" }, [["q1", n("collapsible-item", { heading: "Where is my order?", content: "Soon." })]])],
]);

const theme = { settings: { brand: { look: "market" } } };
const html = renderToStaticMarkup(createElement(TemplateRenderer, { document: page, mode: "public", context: { store: { name: "Shop", slug: "s", currency: "USD", products: [] }, collections: [], theme, basePath: "" } as never }));

describe("Marketplace About and Contact sections", () => {
  it("are drawn by the Market look", () => {
    expect(html).toContain("We are here to help");
    expect(html).toContain("Customer support");
    expect(html).toContain("Where is my order?");
    expect(html).toContain("Help centre");
    expect(html).toContain('href="mailto:support@example.com"');
    // Multi-column cards have the teal top edge; the dark panel uses the promotion gradient.
    expect(html).toContain("border-t-secondary");
    expect(html).toContain("linear-gradient(115deg");
  });
});
