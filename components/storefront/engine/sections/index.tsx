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

  const Component = SECTION_COMPONENTS[node.type];

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

  return <Component key={sectionId} node={node} context={context} sectionId={sectionId} />;
}
