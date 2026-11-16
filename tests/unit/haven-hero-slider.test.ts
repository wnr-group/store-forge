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

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";

// Uploaded files are served from the Supabase public bucket, so the address needs a project URL.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const store = { name: "Haven", slug: "haven", description: null, logo_path: null, currency: "INR", products: [] };
// Haven is recognised by its 4px button corners.
const theme = { settings: { colors: { primary: "#3f5d45", accent: "#c08552", background: "#f6f3ee", text: "#2b2a28" }, buttons: { radius: 4 } } };

const slide = (n: number): ComponentNode => ({
  type: "hero-slide",
  settings: { mediaType: "image", image: { asset: `haven/hero-${n}.jpg` }, heading: `Heading ${n}`, subheading: `Text ${n}`, buttonLabel: `Button ${n}`, link: "/collections" },
  blocks: {},
  block_order: [],
});
const videoSlide = (path: string): ComponentNode => ({ type: "hero-slide", settings: { mediaType: "video", video: { path } }, blocks: {}, block_order: [] });

const doc = (slides: Record<string, ComponentNode>, settings: Record<string, unknown> = {}): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  order: ["hero"],
  sections: { hero: { type: "hero", settings: { heading: "Own heading", ...settings }, blocks: slides, block_order: Object.keys(slides) } },
});

const render = (document: TemplateDocument) => renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store, theme } }));
/** Just the slider, so the page shell around it (its own store-name heading) does not count. */
const carousel = (html: string) => html.slice(html.indexOf('aria-roledescription="carousel"'), html.indexOf("</section>", html.indexOf('aria-roledescription="carousel"')));
const groups = (html: string) => (html.match(/aria-roledescription="slide"/g) ?? []).length;

describe("Haven hero slider", () => {
  it("fills the first screen below the header", () => {
    const html = render(doc({ s1: slide(1), s2: slide(2) }));
    expect(html).toContain("h-[calc(100svh-4rem)]");
    expect(html).toContain("lg:h-[calc(100svh-5.25rem)]");
  });

  it("shows each picture slide with its own text and offers previous and next (no pause button)", () => {
    const html = render(doc({ s1: slide(1), s2: slide(2), s3: slide(3) }));
    expect(groups(html)).toBe(3);
    for (const n of [1, 2, 3]) expect(html).toContain(`Heading ${n}`);
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Next slide"');
    expect(html).not.toContain("Pause slideshow");
    // Only the first slide's heading is the page's h1.
    expect(carousel(html).match(/<h1/g)).toHaveLength(1);
  });

  it("keeps two slides moving one way by doubling the track, with dots for the two real slides", () => {
    const html = render(doc({ s1: slide(1), s2: slide(2) }));
    expect(groups(html)).toBe(4);
    expect(html.match(/aria-label="Go to slide \d"/g)).toHaveLength(2);
  });

  it("a single slide does not slide: no controls", () => {
    const html = render(doc({ s1: slide(1) }));
    expect(groups(html)).toBe(1);
    expect(html).not.toContain("Next slide");
    expect(html).not.toContain("Previous slide");
    expect(html).toContain("Heading 1");
  });

  it("a hero still on the old illustration (no slides) shows the three default photos", () => {
    const html = render(doc({}, { image: { asset: "haven/living-room.svg" }, subheading: "Own text" }));
    expect(groups(html)).toBe(3);
    for (const n of [1, 2, 3]) expect(html).toContain(`/themes/haven/hero-${n}.jpg`);
    expect(html).toContain("Own heading");
    expect(html).toContain('aria-label="Next slide"');
  });

  it("a hero with its own picture and no slides stays one plain slide", () => {
    const html = render(doc({}, { image: { asset: "haven/hero-2.jpg" } }));
    expect(groups(html)).toBe(1);
    expect(html).not.toContain("Next slide");
  });

  it("a video slide has no text and no next or previous, only pause and sound", () => {
    const tenant = "11111111-1111-4111-8111-111111111111";
    const html = render(doc({ v: videoSlide(`${tenant}/store/clip.mp4`) }));
    expect(html).toContain("<video");
    expect(html).toContain(`/products/${tenant}/store/clip.mp4`);
    expect(carousel(html)).not.toMatch(/<h[12]/);
    expect(html).not.toContain("Next slide");
    expect(html).not.toContain("Previous slide");
  });

  it("when a video slide comes first among pictures, the slide controls are replaced by video controls", () => {
    const tenant = "11111111-1111-4111-8111-111111111111";
    const html = render(doc({ v: videoSlide(`${tenant}/store/clip.mp4`), s1: slide(1) }));
    expect(html).toContain('aria-label="Pause video"');
    expect(html).toContain('aria-label="Turn sound on"');
    expect(html).not.toContain('aria-label="Next slide"');
  });

  it("ignores a video value that is not an MP4 or WebM file", () => {
    const html = render(doc({ v: videoSlide("11111111-1111-4111-8111-111111111111/store/photo.png"), s1: slide(1) }));
    expect(html).not.toContain("<video");
    expect(groups(html)).toBe(1);
  });

  it("other themes ignore slide blocks", () => {
    const other = { settings: { colors: { primary: "#171717", accent: "#9a3412", background: "#faf7f2", text: "#1c1917" }, buttons: { radius: 6 } } };
    const html = renderToStaticMarkup(createElement(TemplateRenderer, { document: doc({ s1: slide(1) }, { variant: "banner" }), mode: "public", context: { store, theme: other } }));
    expect(html).not.toContain("carousel");
    expect(html).not.toContain("Button 1");
  });
});
