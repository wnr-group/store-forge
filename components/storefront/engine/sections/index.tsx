import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

import { AnnouncementBarSection } from "./announcement-bar";
import { HeaderSection } from "./header";
import { FooterSection } from "./footer";
import { HeroSection } from "./hero";
import { ImageBannerSection } from "./image-banner";
import { RichTextSection } from "./rich-text";
import { ImageWithTextSection } from "./image-with-text";
import { MulticolumnSection } from "./multicolumn";
import { CollapsibleContentSection } from "./collapsible-content";
import { TestimonialsSection } from "./testimonials";
import { ProductGridSection } from "./product-grid";
import { CollectionListSection } from "./collection-list";
import { FeaturedCollectionSection } from "./featured-collection";
import { CollectionBannerSection } from "./collection-banner";
import { MainProductSection } from "./main-product";
import { RelatedProductsSection } from "./related-products";
import { PromotionalBannerSection } from "./promotional-banner";
import { LogoListSection } from "./logo-list";
import { lookSection } from "../looks";
import { hasStyleOverrides, UNWRAPPED_SECTIONS } from "@/lib/editor/render";
import { overrideValue } from "@/lib/editor/style";
import { readTextOverrides } from "@/lib/editor/text";
import { TextOverrides } from "../text-overrides";
import { CartPageSection } from "@/components/storefront/cart/cart-page";
import { WishlistPageSection } from "@/components/storefront/wishlist/wishlist-page";
import { CheckoutPageSection } from "@/components/storefront/checkout/checkout-page";
import { OrderPageSection, OrdersListSection } from "@/components/storefront/checkout/order-page";

export const SECTION_COMPONENTS: Record<
  string,
  React.ComponentType<{ node: ComponentNode; context: RenderContext; sectionId?: string }>
> = {
  "announcement-bar": AnnouncementBarSection,
  header: HeaderSection,
  footer: FooterSection,
  hero: HeroSection,
  "image-banner": ImageBannerSection,
  "rich-text": RichTextSection,
  "image-with-text": ImageWithTextSection,
  multicolumn: MulticolumnSection,
  "collapsible-content": CollapsibleContentSection,
  testimonials: TestimonialsSection,
  "product-grid": ProductGridSection,
  "collection-list": CollectionListSection,
  "featured-collection": FeaturedCollectionSection,
  "collection-banner": CollectionBannerSection,
  "main-product": MainProductSection,
  "related-products": RelatedProductsSection,
  "promotional-banner": PromotionalBannerSection,
  "logo-list": LogoListSection,
  /** The bag page. Only the generated cart document uses it; it is not an editor section. */
  cart: CartPageSection,
  /** The wishlist page. Only the generated wishlist document uses it; it is not an editor section. */
  wishlist: WishlistPageSection,
  /** Checkout, one order and the shopper's order list. Only the generated documents use them; they are not editor sections. */
  checkout: CheckoutPageSection,
  order: OrderPageSection,
  orders: OrdersListSection,
};

export function renderSectionComponent(
  node: ComponentNode,
  context: RenderContext,
  sectionId?: string,
): React.ReactNode {
  // AC-REN-015: Disabled components are not rendered publicly
  if (node.disabled && context.mode === "public") {
    return null;
  }

  // A theme's look may draw this section itself; every other section is the engine's own component.
  const Component = lookSection(context.theme, node.type) ?? SECTION_COMPONENTS[node.type];

  // AC-REN-014: Unknown component skipped publicly, warning in editor/preview
  if (!Component) {
    if (context.mode === "preview" || context.mode === "editor") {
      return (
        <div
          key={sectionId}
          data-sf-section={sectionId}
          className="mx-auto my-4 max-w-6xl rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 p-6 text-center text-sm font-medium text-amber-900"
        >
          Unknown section type: <code className="font-mono font-bold">{node.type}</code>
        </div>
      );
    }
    return null;
  }

  let out: React.ReactNode = <Component node={node} context={context} sectionId={sectionId} />;
  // A section with style overrides sits in a box the generated stylesheet can reach (see lib/editor/render.ts).
  if (sectionId && hasStyleOverrides(node)) {
    // A sticky section gets a box-less wrapper: only inherited properties (fonts) can reach it, and sticky positioning survives.
    out = <div data-sf-ov={overrideValue(sectionId)} style={UNWRAPPED_SECTIONS.has(node.type) ? { display: "contents" } : undefined}>{out}</div>;
  }
  // Replaced words (see lib/editor/text.ts). The wrapper has no box, so it is safe around a sticky header too.
  const texts = readTextOverrides(node.settings);
  if (texts.length > 0) out = <TextOverrides overrides={texts}>{out}</TextOverrides>;
  return <React.Fragment key={sectionId}>{out}</React.Fragment>;
}
