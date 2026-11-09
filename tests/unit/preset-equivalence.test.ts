import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// next/image and next/link mocks
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});

import { ClassicTemplate } from "@/components/storefront/templates/classic-template";
import { SpotlightTemplate } from "@/components/storefront/templates/spotlight-template";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import { resolveTemplateSettings } from "@/lib/templates/resolve";
import { applyLegacyToPreset, classicPreset, type LegacyTemplateSettings } from "@/lib/templates/presets";
import type { StorefrontData } from "@/lib/templates/types";

const sampleStore: StorefrontData = {
  name: "Urban Nest",
  slug: "urban-nest",
  description: "Home goods",
  logo_path: null,
  currency: "INR",
  products: [
    {
      name: "Lamp",
      slug: "lamp",
      short_description: "Warm light",
      price_minor: 129900,
      compare_at_price_minor: 159900,
      image_path: "t1/p1/a.webp",
    },
    {
      name: "Mug",
      slug: "mug",
      short_description: null,
      price_minor: 49900,
      compare_at_price_minor: null,
      image_path: null,
    },
  ],
};

const renderComponent = <P extends object>(c: ComponentType<P>, props: P) =>
  renderToStaticMarkup(createElement(c, props));

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"));
afterAll(() => vi.unstubAllEnvs());

describe("Preset DOM Equivalence Verification [AC-REN-012] [AC-REN-013]", () => {
  describe("AC-REN-012: Classic preset renders the same DOM as V1 ClassicTemplate", () => {
    it("renders byte-identical DOM to V1 ClassicTemplate for an unconfigured store", () => {
      const v1Settings = resolveTemplateSettings(sampleStore, null);
      const v1Html = renderComponent(ClassicTemplate, { store: sampleStore, settings: v1Settings });

      const engineHtml = renderComponent(TemplateRenderer, {
        document: classicPreset,
        context: { store: sampleStore },
        mode: "public",
      });

      expect(engineHtml).toBe(v1Html);
    });

    it("renders byte-identical DOM for customized classic store (heading, subheading, accent, hero image)", () => {
      const legacy: LegacyTemplateSettings = {
        templateKey: "classic",
        accentColor: "#1a2b3c",
        heroHeading: "Special Summer Sale",
        heroSubheading: "Up to 40% off handcrafted goods",
        heroImagePath: "t1/store/hero.jpg",
      };

      const v1Settings = resolveTemplateSettings(sampleStore, legacy);
      const v1Html = renderComponent(ClassicTemplate, { store: sampleStore, settings: v1Settings });

      const migrated = applyLegacyToPreset(legacy);
      const engineHtml = renderComponent(TemplateRenderer, {
        document: migrated.document,
        context: { store: sampleStore },
        mode: "public",
      });

      expect(engineHtml).toBe(v1Html);
    });

    it("renders byte-identical DOM with logo, no products, and null description", () => {
      const emptyStore: StorefrontData = {
        ...sampleStore,
        products: [],
        description: null,
        logo_path: "t1/store/logo.webp",
      };

      const v1Settings = resolveTemplateSettings(emptyStore, null);
      const v1Html = renderComponent(ClassicTemplate, { store: emptyStore, settings: v1Settings });

      const engineHtml = renderComponent(TemplateRenderer, {
        document: classicPreset,
        context: { store: emptyStore },
        mode: "public",
      });

      expect(engineHtml).toBe(v1Html);
    });
  });

  describe("AC-REN-013: Migrated spotlight preset renders the same DOM as V1 SpotlightTemplate", () => {
    it("renders byte-identical DOM to V1 SpotlightTemplate for an unconfigured store", () => {
      const legacy: LegacyTemplateSettings = {
        templateKey: "spotlight",
        accentColor: null,
        heroHeading: null,
        heroSubheading: null,
        heroImagePath: null,
      };

      const v1Settings = resolveTemplateSettings(sampleStore, legacy);
      const v1Html = renderComponent(SpotlightTemplate, { store: sampleStore, settings: v1Settings });

      const migrated = applyLegacyToPreset(legacy);
      const engineHtml = renderComponent(TemplateRenderer, {
        document: migrated.document,
        context: { store: sampleStore },
        mode: "public",
      });

      expect(engineHtml).toBe(v1Html);
    });

    it("renders byte-identical DOM for customized spotlight store (heading, subheading, accent, hero image)", () => {
      const legacy: LegacyTemplateSettings = {
        templateKey: "spotlight",
        accentColor: "#ff0000",
        heroHeading: "Spotlight Spotlight",
        heroSubheading: "Exclusive spotlight collection",
        heroImagePath: "t1/store/spotlight-hero.webp",
      };

      const v1Settings = resolveTemplateSettings(sampleStore, legacy);
      const v1Html = renderComponent(SpotlightTemplate, { store: sampleStore, settings: v1Settings });

      const migrated = applyLegacyToPreset(legacy);
      const engineHtml = renderComponent(TemplateRenderer, {
        document: migrated.document,
        context: { store: sampleStore },
        mode: "public",
      });

      expect(engineHtml).toBe(v1Html);
    });
  });
});
