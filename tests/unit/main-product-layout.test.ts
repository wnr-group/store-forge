import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string; sizes?: string; className?: string; style?: Record<string, string> }) => h("img", { src: p.src, alt: p.alt, sizes: p.sizes, className: p.className, style: p.style }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("@/app/s/[slug]/cart/actions", () => ({ checkCartAction: async () => [] }));
vi.mock("@/app/s/[slug]/wishlist/actions", () => ({ checkWishlistAction: async () => [] }));

import { lookSection } from "@/components/storefront/engine/looks";
import { MarketMainProduct } from "@/components/storefront/engine/looks/market/main-product";
import { SportMainProduct } from "@/components/storefront/engine/looks/sport/main-product";
import { MainProductSection } from "@/components/storefront/engine/sections/main-product";
import { PRESENTATION_SCHEMA_VERSION } from "@/lib/templates/product-presentation";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

/**
 * The Maison (Boutique) and standard product page picture layout, drawn by the engine's own main-product section. Rendered to
 * static markup, so these tests check the markup and classes that produce the layout; how it looks on each screen is checked by hand.
 */

const T = "11111111-1111-4111-8111-111111111111";
const pic = (n: number) => `${T}/p1/pic-${n}.jpg`;
const product = { name: "Linen Dress", slug: "linen", price_minor: 345000, available: true, image_path: pic(1), images: [pic(1), pic(2), pic(3)] };

const render = (settings: Record<string, unknown> = {}, resource: Record<string, unknown> = product, theme: unknown = { settings: { brand: { look: "boutique" } } }) =>
  renderToStaticMarkup(
    createElement(MainProductSection, {
      node: { type: "main-product", settings, blocks: {}, block_order: [] } as never,
      context: { store: { name: "S", slug: "s", currency: "INR" }, resource, theme, mode: "public", basePath: "" } as never,
      sectionId: "main",
    }),
  );

/** The elements whose class list contains `marker`, as lists of class tokens. */
const classesOf = (html: string, marker: string): string[][] =>
  [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).filter((c) => c.includes(marker)).map((c) => c.split(/\s+/));
const first = (html: string, marker: string) => {
  const found = classesOf(html, marker)[0];
  expect(found, `an element with ${marker}`).toBeDefined();
  return found!;
};

describe("the main picture", () => {
  it("shows the whole picture, never cropped", () => {
    const html = render();
    expect(html).not.toContain("object-cover");
    expect(classesOf(html, "object-contain").length).toBeGreaterThan(0);
    const main = html.match(/<img[^>]*alt="Linen Dress"[^>]*>/)?.[0] ?? "";
    expect(main).toContain("object-contain");
    expect(main).not.toContain("object-cover");
  });

  it("sits in a muted box so a picture that does not fill it still looks finished", () => {
    expect(first(render(), "lg:h-[calc(100dvh-17rem)]")).toEqual(expect.arrayContaining(["bg-muted", "overflow-hidden", "relative", "w-full"]));
  });

  it("desktop: is as tall as the screen allows after the header and the thumbnails, within limits", () => {
    const box = first(render(), "lg:h-[calc(100dvh-17rem)]");
    expect(box).toEqual(expect.arrayContaining(["lg:aspect-auto", "lg:h-[calc(100dvh-17rem)]", "lg:max-h-[50rem]", "lg:min-h-[22rem]"]));
  });

  it("tablet: is never taller than three quarters of the screen", () => {
    expect(first(render(), "lg:h-[calc(100dvh-17rem)]")).toContain("md:max-h-[75dvh]");
  });

  it("mobile: keeps the full-width 4:5 shape and has no height rule of its own below the tablet size", () => {
    const box = first(render(), "lg:h-[calc(100dvh-17rem)]");
    expect(box).toEqual(expect.arrayContaining(["aspect-[4/5]", "w-full"]));
    // Every height rule is behind a breakpoint, so on a phone the box is exactly what it was.
    const unprefixed = box.filter((c) => /^(max-h|min-h|h)-/.test(c));
    expect(unprefixed).toEqual([]);
  });
});

describe("the gallery column", () => {
  it("is centred and at most 34rem wide on a tablet, and full width on a phone and on desktop", () => {
    const column = first(render(), "md:max-w-[34rem]");
    expect(column).toEqual(expect.arrayContaining(["md:mx-auto", "md:w-full", "md:max-w-[34rem]", "lg:mx-0", "lg:max-w-none"]));
    expect(column.filter((c) => /^max-w-/.test(c))).toEqual([]);
  });

  it("stays in view beside the details on desktop (sticky), and does not on a phone or tablet", () => {
    const column = first(render(), "md:max-w-[34rem]");
    expect(column).toEqual(expect.arrayContaining(["lg:sticky", "lg:top-24", "lg:self-start"]));
    expect(column.filter((c) => /^(sticky|top-|self-)/.test(c))).toEqual([]);
  });

  it("keeps the media-position setting: the gallery goes to the right on desktop only when asked", () => {
    expect(first(render({ mediaPosition: "right" }), "md:max-w-[34rem]")).toContain("lg:order-2");
    expect(first(render({ mediaPosition: "left" }), "md:max-w-[34rem]")).not.toContain("lg:order-2");
    expect(first(render(), "md:max-w-[34rem]")).not.toContain("lg:order-2");
  });

  it("keeps the product's own gallery settings working", () => {
    const own = { ...product, presentation: { schemaVersion: PRESENTATION_SCHEMA_VERSION, gallery: { layout: "stacked", mediaPosition: "right" } } };
    const html = render({ galleryLayout: "thumbnails", mediaPosition: "left" }, own);
    expect(html).toContain('data-gallery="stacked"');
    expect(first(html, "md:max-w-[34rem]")).toContain("lg:order-2");
  });
});

describe("the thumbnails", () => {
  it("are shown whole too, and still selectable buttons", () => {
    const html = render();
    expect(html).toContain('aria-label="Product pictures"');
    expect((html.match(/aria-label="Show picture \d"/g) ?? []).length).toBe(3);
    expect(html.match(/sizes="100px"/g)).toHaveLength(3);
    const thumbs = html.match(/<img[^>]*sizes="100px"[^>]*>/g) ?? [];
    expect(thumbs).toHaveLength(3);
    for (const tag of thumbs) {
      expect(tag).toContain("object-contain");
      expect(tag).not.toContain("object-cover");
    }
  });

  it("are not drawn for a product with one picture", () => {
    const html = render({}, { ...product, images: [pic(1)] });
    expect(html).not.toContain("Show picture");
  });
});

describe("the stacked gallery", () => {
  const html = render({ galleryLayout: "stacked" });

  it("shows every picture whole, one under the other", () => {
    expect(html).toContain('data-gallery="stacked"');
    expect(html).not.toContain("object-cover");
    expect((html.match(/<li[^>]*class="[^"]*aspect-\[4\/5\][^"]*"/g) ?? []).length).toBe(3);
    const pictures = html.match(/<img[^>]*sizes="\(min-width: 1024px\) 50vw, 100vw"[^>]*>/g) ?? [];
    expect(pictures).toHaveLength(3);
    for (const tag of pictures) expect(tag).toContain("object-contain");
  });

  it("keeps each picture 4:5 on a phone and never taller than three quarters of the screen from the tablet size", () => {
    const box = first(html, "md:max-h-[75dvh]");
    expect(box).toEqual(expect.arrayContaining(["aspect-[4/5]", "w-full", "bg-muted", "md:max-h-[75dvh]"]));
    expect(box.filter((c) => /^(max-h|min-h|h)-/.test(c))).toEqual([]);
  });

  it("is not sticky (it is taller than the screen), but is still centred and limited in width on a tablet", () => {
    const column = first(html, "md:max-w-[34rem]");
    expect(column).not.toContain("lg:sticky");
    expect(column).toContain("md:mx-auto");
  });
});

describe("a product without pictures, and the focal point", () => {
  it("shows the placeholder in the same box without failing", () => {
    for (const settings of [{}, { galleryLayout: "stacked" }]) {
      const html = render(settings, { name: "Bare", slug: "bare", price_minor: 100, available: true });
      expect(html).toContain("No product image");
      expect(html).not.toContain("object-cover");
    }
  });

  it("does not move a picture by the product's focal point, which only applies to cropped pictures", () => {
    const html = render({}, { ...product, presentation: { schemaVersion: PRESENTATION_SCHEMA_VERSION, focalPoint: { x: 10, y: 90 } } });
    expect(html).not.toContain("object-position");
    expect(html).toContain("object-contain");
  });
});

describe("Sport and Market keep their own product pages", () => {
  const read = (file: string) => readFileSync(join(__dirname, "..", "..", file), "utf8");

  it("resolve to their own components, and Boutique and the standard look to the engine's", () => {
    expect(lookSection({ settings: { brand: { look: "sport" } } }, "main-product")).toBe(SportMainProduct);
    expect(lookSection({ settings: { brand: { look: "market" } } }, "main-product")).toBe(MarketMainProduct);
    expect(lookSection({ settings: { brand: { look: "boutique" } } }, "main-product")).toBeUndefined();
    expect(lookSection({ settings: {} }, "main-product")).toBeUndefined();
  });

  it("their picture layouts are not the new one", () => {
    const sport = read("components/storefront/engine/looks/sport/product-gallery.tsx");
    expect(sport).toContain("lg:h-[calc(100dvh-9rem)]");
    expect(sport).toContain("object-cover");
    expect(sport).not.toContain("100dvh-17rem");
    const market = read("components/storefront/engine/looks/market/main-product.tsx");
    expect(market).toContain("aspect-square");
    expect(market).not.toContain("100dvh-17rem");
  });
});
