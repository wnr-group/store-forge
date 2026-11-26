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

import { LOOKS, lookSection, type StorefrontLook } from "@/components/storefront/engine/looks";
import { BoutiqueHero } from "@/components/storefront/engine/looks/boutique/hero";
import { initialsOf } from "@/components/storefront/engine/looks/boutique/initials";
import { percentOff } from "@/components/storefront/engine/looks/boutique/product-card";
import { sortProducts } from "@/components/storefront/engine/looks/boutique/sortable-grid";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { TemplateDocument } from "@/lib/templates/document";
import { themeSettingsSchema } from "@/lib/templates/engine/root-schema";
import { lookOf } from "@/lib/templates/engine/theme-style";
import { LOOK_IDS } from "@/lib/templates/looks";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const boutiqueTheme = { settings: { brand: { look: "boutique" }, colors: { primary: "#10362f", background: "#fcfdfb", text: "#10362f" }, typography: { headingFont: "cormorant-garamond", bodyFont: "jost", headingWeight: 500 } } };

describe("look registry", () => {
  it("has a component entry for every look id and no extras", () => {
    expect(Object.keys(LOOKS).sort()).toEqual([...LOOK_IDS].sort());
    for (const id of LOOK_IDS) expect(LOOKS[id].id).toBe(id);
  });

  it("falls back to the standard look for missing or unknown values", () => {
    expect(lookOf(undefined)).toBe("standard");
    expect(lookOf({ settings: {} })).toBe("standard");
    expect(lookOf({ settings: { brand: { look: "nope" } } })).toBe("standard");
    expect(lookOf(boutiqueTheme)).toBe("boutique");
  });

  it("the theme schema accepts a known look and the new fonts, and rejects an unknown look", () => {
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: boutiqueTheme.settings }).success).toBe(true);
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { brand: { look: "nope" } } }).success).toBe(false);
  });

  it("standard-look themes keep the engine's own sections", () => {
    expect(lookSection({ settings: { buttons: { radius: 12 } } }, "hero")).toBeUndefined();
    expect(lookSection(boutiqueTheme, "hero")).toBe(BoutiqueHero);
    // A section the Boutique look does not override stays with the engine (rich-text has its own Boutique version now).
    expect(lookSection(boutiqueTheme, "logo-list")).toBeUndefined();
  });

  it("another look is picked up from registry data alone, without touching the dispatcher", () => {
    const Stub = () => createElement("p", null, "second look");
    const second: StorefrontLook = { id: "boutique", sections: { hero: Stub } };
    expect(lookSection(boutiqueTheme, "hero", { boutique: second })).toBe(Stub);
  });
});

describe("boutique rendering", () => {
  const doc: TemplateDocument = {
    schemaVersion: 1,
    layout: "classic",
    order: ["hero", "grid"],
    sections: {
      hero: { type: "hero", settings: { heading: "Spring edit" }, blocks: {}, block_order: [] },
      grid: { type: "product-grid", settings: { columns: 4 }, blocks: {}, block_order: [] },
    },
  } as unknown as TemplateDocument;
  const render = (store: Record<string, unknown>, collections: unknown[] = []) =>
    renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, mode: "public", context: { store, collections, theme: boutiqueTheme, basePath: "" } as never }));

  it("shows each tenant's own products and name, and nothing from the other", () => {
    const a = render({ name: "Silk Route", slug: "a", currency: "INR", products: [{ name: "Linen Saree", slug: "linen", price_minor: 540000, compare_at_price_minor: 600000 }] });
    const b = render({ name: "Northline", slug: "b", currency: "USD", products: [{ name: "Shell Jacket", slug: "shell", price_minor: 18900, available: false }] });
    expect(a).toContain("Linen Saree");
    expect(a).toContain("10% off");
    expect(a).toContain("Reduced");
    expect(a).not.toContain("Shell Jacket");
    expect(b).toContain("Shell Jacket");
    expect(b).toContain("Sold out");
    expect(b).not.toContain("Linen Saree");
  });

  it("shows an honest empty state for a store with no products", () => {
    expect(render({ name: "New Shop", slug: "n", currency: "INR", products: [] })).toContain("New products are on their way");
  });
});

describe("boutique helpers", () => {
  it("computes the discount only for a real reduction", () => {
    expect(percentOff(900, 1000)).toBe(10);
    expect(percentOff(1000, 1000)).toBeNull();
    expect(percentOff(1000, null)).toBeNull();
    expect(percentOff(1000, 0)).toBeNull();
  });

  it("builds monogram initials from the store name", () => {
    expect(initialsOf("Kartika Stores")).toBe("KS");
    expect(initialsOf("Haven")).toBe("HA");
    expect(initialsOf("  ")).toBe("");
  });

  it("sorts a copy and keeps the store's order for featured", () => {
    const list = [
      { name: "b", slug: "b", price_minor: 300 },
      { name: "a", slug: "a", price_minor: 100 },
      { name: "c", slug: "c", price_minor: 200 },
    ];
    expect(sortProducts(list, "price-asc").map((p) => p.slug)).toEqual(["a", "c", "b"]);
    expect(sortProducts(list, "price-desc").map((p) => p.slug)).toEqual(["b", "c", "a"]);
    expect(sortProducts(list, "name").map((p) => p.slug)).toEqual(["a", "b", "c"]);
    expect(sortProducts(list, "featured").map((p) => p.slug)).toEqual(["b", "a", "c"]);
    expect(list.map((p) => p.slug)).toEqual(["b", "a", "c"]);
  });
});
