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
import { defaultPageDocument, isPageKey, PAGE_KEYS, resolvePageDocument, routeForHref, storedPageDocument } from "@/lib/storefront/pages";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { themeSettingsSchema } from "@/lib/templates/engine/root-schema";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const n = (type: string, settings: Record<string, unknown>, blocks: [string, ComponentNode][] = []): ComponentNode => ({ type, settings, blocks: Object.fromEntries(blocks), block_order: blocks.map(([id]) => id) });
const doc = (sections: [string, ComponentNode][]): TemplateDocument => ({ schemaVersion: 1, layout: "classic", sections: Object.fromEntries(sections), order: sections.map(([id]) => id) }) as unknown as TemplateDocument;

const about = doc([
  ["story", n("image-with-text", { variant: "plain", eyebrow: "Our story", imagePosition: "left" }, [["h", n("heading", { text: "It began with one thing", level: "h2" })], ["cta", n("button", { label: "Shop", link: "/collections", style: "primary" })]])],
  ["process", n("image-with-text", { variant: "panel", eyebrow: "How we choose", imagePosition: "right" }, [["h", n("heading", { text: "From sketch to door", level: "h2" })], ["a", n("button", { label: "See new", link: "/collections", style: "primary" })], ["b", n("button", { label: "Talk to us", link: "/contact", style: "outline" })]])],
  ["values", n("multicolumn", { eyebrow: "What we stand for", heading: "Three promises", columns: 3, backgroundColor: "#edf3ef" }, [["v1", n("column", { title: "Made to last", text: "Good materials." })]])],
  ["questions", n("collapsible-content", { eyebrow: "Questions", heading: "Before you write", subheading: "Short answers.", ctaLabel: "Email us", ctaLink: "mailto:hello@example.com" }, [["q1", n("collapsible-item", { heading: "How long is delivery?", content: "Two days." })]])],
]);

const theme = { settings: { brand: { look: "boutique" }, pages: { about } } };
const render = (document: TemplateDocument) => renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store: { name: "Shop", slug: "s", currency: "USD", products: [] }, collections: [], theme, basePath: "" } as never }));

describe("About and Contact pages", () => {
  it("are generated page keys the theme can store, and links to them open them", () => {
    expect(PAGE_KEYS).toContain("about");
    expect(PAGE_KEYS).toContain("contact");
    expect(isPageKey("about")).toBe(true);
    expect(routeForHref("/about")).toEqual({ page: "about" });
    expect(routeForHref("/contact/")).toEqual({ page: "contact" });
    expect(routeForHref("/shipping")).toEqual({ page: "content", slug: "shipping" });
  });

  it("show the theme's design when it has one, and the plain default otherwise", () => {
    expect(storedPageDocument(theme, "about")).toBe(about);
    expect(storedPageDocument(theme, "contact")).toBeNull();
    expect(resolvePageDocument(theme, "about", defaultPageDocument("about"))).toBe(about);
    expect(resolvePageDocument(theme, "contact", defaultPageDocument("contact"))).toEqual(defaultPageDocument("contact"));
  });

  it("are accepted in the theme settings, and an unknown page is not", () => {
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { pages: { about, contact: about } } }).success).toBe(true);
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { pages: { shipping: about } } }).success).toBe(false);
  });

  it("are drawn by the Boutique look's own sections", () => {
    const html = render(about);
    expect(html).toContain("It began with one thing");
    expect(html).toContain("Our story");
    expect(html).toContain("From sketch to door");
    expect(html).toContain("Made to last");
    expect(html).toContain("What we stand for");
    expect(html).toContain("How long is delivery?");
    expect(html).toContain('href="mailto:hello@example.com"');
    // The panel variant is the deep-green one; the plain one is not.
    expect(html.match(/overflow-hidden rounded-\[28px\] bg-primary/g)?.length).toBe(1);
  });
});
