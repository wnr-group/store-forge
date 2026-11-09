import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// next/image and next/link need the Next runtime; plain elements keep the markup comparable.
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});

import { ClassicTemplate } from "@/components/storefront/templates/classic-template";
import { getTemplateComponent } from "@/components/storefront/templates/index";
import { SpotlightTemplate } from "@/components/storefront/templates/spotlight-template";
import { resolveTemplateSettings } from "@/lib/templates/resolve";
import type { StorefrontData } from "@/lib/templates/types";
import { LegacyStorefront } from "./fixtures/legacy-storefront";

const store: StorefrontData = {
  name: "Urban Nest",
  slug: "urban-nest",
  description: "Home goods",
  logo_path: null,
  currency: "INR",
  products: [
    { name: "Lamp", slug: "lamp", short_description: "Warm light", price_minor: 129900, compare_at_price_minor: 159900, image_path: "t1/p1/a.webp" },
    { name: "Mug", slug: "mug", short_description: null, price_minor: 49900, compare_at_price_minor: null, image_path: null },
  ],
};
const render = <P extends object>(c: ComponentType<P>, props: P) => renderToStaticMarkup(createElement(c, props));
const unconfigured = (s: StorefrontData) => resolveTemplateSettings(s, null);

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"));
afterAll(() => vi.unstubAllEnvs());

describe("Classic template is the existing storefront", () => {
  it("renders byte-identical markup to the pre-templates page for an unconfigured store", () => {
    expect(render(ClassicTemplate, { store, settings: unconfigured(store) })).toBe(render(LegacyStorefront, { store }));
  });

  it("matches the legacy page with no products, no description and a logo", () => {
    const empty = { ...store, products: [], description: null, logo_path: "t1/store/logo.webp" };
    expect(render(ClassicTemplate, { store: empty, settings: unconfigured(empty) })).toBe(render(LegacyStorefront, { store: empty }));
  });

  it("adds no inline styles when nothing is customized", () => {
    expect(render(ClassicTemplate, { store, settings: unconfigured(store) })).not.toContain("style=");
  });
});

describe("customization rendering", () => {
  it("shows the saved heading and subheading, and the accent only as an inline color", () => {
    const settings = { accentColor: "#1a2b3c", heading: "Big sale", subheading: "Everything must go", heroImageUrl: null };
    const html = render(ClassicTemplate, { store, settings });
    expect(html).toContain("Big sale");
    expect(html).toContain("Everything must go");
    expect(html).toContain("#1a2b3c");
  });

  it("escapes HTML-like text instead of executing it, in every template", () => {
    const settings = { accentColor: null, heading: "<script>alert(1)</script>", subheading: "<img src=x onerror=alert(1)>", heroImageUrl: null };
    for (const t of [ClassicTemplate, SpotlightTemplate]) {
      const html = render(t, { store, settings });
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;script&gt;");
    }
  });

  it("Spotlight renders a hero with the heading, subheading and image, and differs from Classic", () => {
    const settings = { accentColor: "#ff0000", heading: "Hello", subheading: "World", heroImageUrl: "https://example.supabase.co/storage/v1/object/public/products/t1/store/h.webp" };
    const html = render(SpotlightTemplate, { store, settings });
    expect(html).toContain("Hello");
    expect(html).toContain("World");
    expect(html).toContain('src="https://example.supabase.co/storage/v1/object/public/products/t1/store/h.webp"');
    expect(html).toContain('alt=""');
    expect(html).not.toBe(render(ClassicTemplate, { store, settings }));
  });

  it("falls back to store data in Spotlight when nothing is configured", () => {
    const html = render(SpotlightTemplate, { store, settings: unconfigured(store) });
    expect(html).toContain("Urban Nest");
    expect(html).toContain("Home goods");
  });
});

describe("getTemplateComponent", () => {
  it("maps keys to components and falls back to Classic for unknown or missing keys", () => {
    expect(getTemplateComponent("classic")).toBe(ClassicTemplate);
    expect(getTemplateComponent("spotlight")).toBe(SpotlightTemplate);
    for (const bad of ["removed-template", "", null, undefined]) expect(getTemplateComponent(bad)).toBe(ClassicTemplate);
  });
});
