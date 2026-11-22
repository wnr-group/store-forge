"use client";

import { StoreAccessLink } from "@/components/storefront/store-access-link";
import React from "react";
import Image from "next/image";
import { Store } from "lucide-react";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import type { RenderContext, RenderMode, TemplateRendererProps } from "./types";
import { StorefrontContext } from "./context";
import { renderSectionComponent } from "./sections";
import { publicImageUrl } from "@/lib/storage/paths";
import { resolveBinding } from "@/lib/templates/engine/bindings";
import { themeToStyle } from "@/lib/templates/engine/theme-style";
import { documentsCss } from "@/lib/editor/render";
import { lookHasCart } from "./looks";
import { CartProvider } from "@/components/storefront/cart/cart-provider";
import { CartChrome } from "@/components/storefront/cart/cart-drawer";
import { WishlistProvider } from "@/components/storefront/wishlist/wishlist-provider";

/**
 * Resolves data-bound settings against store/resource context (AC-REN-016).
 * Missing bound data returns fallback, else empty in public mode and placeholder in editor/preview.
 */
function resolveNodeSettings(
  settings: Record<string, unknown> | undefined,
  context: RenderContext,
  mode: RenderMode,
): Record<string, unknown> {
  if (!settings) return {};
  const resolved: Record<string, unknown> = {};

  const resource = context.resource as Record<string, unknown> | undefined;
  const isProduct = resource && "price_minor" in resource;
  const isCollection = resource && "products" in resource;

  const bindingCtx = {
    store: {
      name: context.store.name,
      description: context.store.description ?? undefined,
    },
    product: isProduct
      ? {
          title: typeof resource.name === "string" ? resource.name : undefined,
          description: typeof resource.short_description === "string" ? resource.short_description : undefined,
          price: typeof resource.price_minor === "number" ? resource.price_minor : undefined,
          compare_at_price: typeof resource.compare_at_price_minor === "number" ? resource.compare_at_price_minor : undefined,
          sku: typeof resource.sku === "string" ? resource.sku : undefined,
          featured_image: typeof resource.image_path === "string" ? { path: resource.image_path } : undefined,
        }
      : undefined,
    collection: isCollection
      ? {
          title: typeof resource.name === "string" ? resource.name : undefined,
          description: typeof resource.description === "string" ? resource.description : undefined,
          featured_image: typeof resource.image_path === "string" ? { path: resource.image_path } : undefined,
        }
      : undefined,
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value && typeof value === "object" && "source" in value && typeof (value as Record<string, unknown>).source === "string") {
      const binding = value as { source: string; fallback?: unknown };
      const result = resolveBinding(binding, bindingCtx);
      if (result !== undefined) {
        resolved[key] = result;
      } else if (mode === "preview" || mode === "editor") {
        resolved[key] = `[${binding.source}]`;
      } else {
        resolved[key] = "";
      }
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function resolveDocumentWithBindings(
  doc: TemplateDocument,
  context: RenderContext,
  mode: RenderMode,
): TemplateDocument {
  const resolvedSections: Record<string, ComponentNode> = {};

  for (const [secId, section] of Object.entries(doc.sections || {})) {
    const resolvedBlocks: Record<string, ComponentNode> = {};
    for (const [blkId, block] of Object.entries(section.blocks || {})) {
      resolvedBlocks[blkId] = {
        ...block,
        settings: resolveNodeSettings(block.settings, context, mode),
      };
    }
    resolvedSections[secId] = {
      ...section,
      settings: resolveNodeSettings(section.settings, context, mode),
      blocks: resolvedBlocks,
    };
  }

  return {
    ...doc,
    sections: resolvedSections,
  };
}

/**
 * Shared Storefront Template Renderer (AC-REN-001).
 * Single renderer imported by both public storefront pages and the authenticated preview.
 */
export function TemplateRenderer({ document, context, mode = "public" }: TemplateRendererProps) {
  const activeMode: RenderMode = mode ?? context.mode ?? "public";
  const enrichedContext: RenderContext = { ...context, mode: activeMode };

  // Without a theme the markup is exactly what it always was (the V1 equivalence tests depend on it).
  const themeStyle = themeToStyle(enrichedContext.theme);
  const themed = Object.keys(themeStyle).length > 0;

  const doc = resolveDocumentWithBindings(document, enrichedContext, activeMode);
  const layout = doc.layout || "classic";
  const store = enrichedContext.store;
  const logo = publicImageUrl(store.logo_path);

  const sections = doc.sections || {};
  const order = doc.order || Object.keys(sections);

  // Group templates (Phase 4 integration hooks)
  const groupHeader = enrichedContext.groupHeader as TemplateDocument | undefined;
  const groupFooter = enrichedContext.groupFooter as TemplateDocument | undefined;
  const groupAnnouncement = enrichedContext.groupAnnouncement as TemplateDocument | undefined;

  // Extract accent color and hero heading for layout header styling
  const heroSection = sections["hero"];
  // Style overrides the merchant set in the visual editor, as one stylesheet for the page and its shared groups. The CSS is
  // built only from validated values and contains nothing a text node would escape (see lib/editor/style.ts).
  const overrideCss = documentsCss([doc, groupHeader, groupFooter, groupAnnouncement]);

  const accentColor = (heroSection?.settings?.accentColor as string) || null;
  const classicHeading = (heroSection?.settings?.heading as string) || store.name;

  // Split hero section out when layout is spotlight and hero variant is spotlight
  const isSpotlightHero = layout === "spotlight" && heroSection && heroSection.settings?.variant === "spotlight";

  const cartEnabled = themed && typeof store.slug === "string" && store.slug.length > 0;
  const cartChrome = cartEnabled && lookHasCart(enrichedContext.theme);
  const withCart = (node: React.ReactNode) =>
    cartEnabled ? (
      // Editor and theme preview keep their cart in memory only, so they never touch a shopper's saved bag.
      <CartProvider storeSlug={store.slug} currency={typeof store.currency === "string" ? store.currency : "INR"} persist={activeMode === "public"}>
        <WishlistProvider storeSlug={store.slug} persist={activeMode === "public"}>
          {node}
        </WishlistProvider>
      </CartProvider>
    ) : (
      node
    );

  return withCart(
    <StorefrontContext.Provider value={enrichedContext}>
      <div className={themed ? "sf-theme flex min-h-dvh flex-col bg-background text-foreground" : "flex min-h-dvh flex-col"} style={themed ? themeStyle : undefined}>
        {overrideCss ? <style>{overrideCss}</style> : null}
        {/* Optional Announcement Group */}
        {groupAnnouncement ? (
          <div>
            {(groupAnnouncement.order || Object.keys(groupAnnouncement.sections || {})).map((secId) =>
              renderSectionComponent(groupAnnouncement.sections[secId], enrichedContext, secId)
            )}
          </div>
        ) : null}

        {/* Header: Group Header if present, otherwise Layout Chrome Header */}
        {groupHeader ? (
          // `contents`: a sticky header cannot stick outside its parent, so the wrapper must not be a box of its own.
          <div className="contents">
            {(groupHeader.order || Object.keys(groupHeader.sections || {})).map((secId) =>
              renderSectionComponent(groupHeader.sections[secId], enrichedContext, secId)
            )}
          </div>
        ) : layout === "spotlight" ? (
          /* V1 Spotlight Template Header */
          <header className="border-b">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
              <span className="hidden w-24 sm:block" aria-hidden />
              <div className="flex min-w-0 items-center gap-2">
                {logo ? (
                  <Image src={logo} alt="" width={28} height={28} className="size-7 rounded-md object-cover" />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Store className="size-4" aria-hidden />
                  </span>
                )}
                <span className="truncate text-sm font-semibold tracking-tight">{store.name}</span>
              </div>
              <StoreAccessLink className="shrink-0 text-right text-sm text-muted-foreground hover:text-foreground hover:underline sm:w-24" />
            </div>
          </header>
        ) : (
          /* V1 Classic Template Header */
          <header className="border-b" style={accentColor ? { borderColor: accentColor } : undefined}>
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
              {logo ? (
                <Image src={logo} alt="" width={36} height={36} className="size-9 rounded-md object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Store className="size-5" aria-hidden />
                </span>
              )}
              <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{classicHeading}</h1>
              <StoreAccessLink className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline" />
            </div>
          </header>
        )}

        {/* In Spotlight layout, full-width Hero Banner sits outside main */}
        {isSpotlightHero && !heroSection.disabled ? (
          renderSectionComponent(heroSection, enrichedContext, "hero")
        ) : null}

        {/* Main Page Content */}
        <main className={themed ? "w-full flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8"}>
          {order.map((secId) => {
            const sec = sections[secId];
            if (!sec) return null;
            // Hero in spotlight is already rendered above main
            if (secId === "hero" && isSpotlightHero) return null;
            return renderSectionComponent(sec, enrichedContext, secId);
          })}
        </main>

        {/* Footer: Group Footer if present, otherwise Layout Chrome Footer */}
        {groupFooter ? (
          <div>
            {(groupFooter.order || Object.keys(groupFooter.sections || {})).map((secId) =>
              renderSectionComponent(groupFooter.sections[secId], enrichedContext, secId)
            )}
          </div>
        ) : (
          <footer className="border-t py-6 text-center text-sm text-muted-foreground">
            {store.name} · Powered by StoreForge
          </footer>
        )}
        {cartChrome ? <CartChrome /> : null}
      </div>
    </StorefrontContext.Provider>
  );
}
