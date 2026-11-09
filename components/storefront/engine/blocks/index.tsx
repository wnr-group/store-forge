import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

import { HeadingBlock } from "./heading";
import { TextBlock } from "./text";
import { ButtonBlock } from "./button";
import { ImageBlock } from "./image";
import { LinkBlock } from "./link";
import { LinkColumnBlock } from "./link-column";
import { SocialLinkBlock } from "./social-link";
import { ColumnBlock } from "./column";
import { CollapsibleItemBlock } from "./collapsible-item";
import { TestimonialBlock } from "./testimonial";
import { GroupBlock } from "./group";
import { ProductTitleBlock } from "./product-title";
import { ProductPriceBlock } from "./product-price";
import { ProductCompareAtPriceBlock } from "./product-compare-at-price";
import { ProductSkuBlock } from "./product-sku";
import { ProductTypeBlock } from "./product-type";
import { ProductCategoryBlock } from "./product-category";
import { ProductDescriptionBlock } from "./product-description";
import { VariantPickerBlock } from "./variant-picker";
import { CollapsibleInfoBlock } from "./collapsible-info";
import { SocialShareBlock } from "./social-share";

export const BLOCK_COMPONENTS: Record<
  string,
  React.ComponentType<{ node: ComponentNode; context: RenderContext; blockId?: string; renderBlock?: (n: ComponentNode, id: string) => React.ReactNode }>
> = {
  heading: HeadingBlock,
  text: TextBlock,
  button: ButtonBlock,
  image: ImageBlock,
  link: LinkBlock,
  "link-column": LinkColumnBlock,
  "social-link": SocialLinkBlock,
  column: ColumnBlock,
  "collapsible-item": CollapsibleItemBlock,
  testimonial: TestimonialBlock,
  group: GroupBlock,
  "product-title": ProductTitleBlock,
  "product-price": ProductPriceBlock,
  "product-compare-at-price": ProductCompareAtPriceBlock,
  "product-sku": ProductSkuBlock,
  "product-type": ProductTypeBlock,
  "product-category": ProductCategoryBlock,
  "product-description": ProductDescriptionBlock,
  "variant-picker": VariantPickerBlock,
  "collapsible-info": CollapsibleInfoBlock,
  "social-share": SocialShareBlock,
};

export function renderBlockComponent(
  node: ComponentNode,
  context: RenderContext,
  blockId?: string,
): React.ReactNode {
  if (node.disabled && context.mode === "public") {
    return null;
  }

  const Component = BLOCK_COMPONENTS[node.type];
  if (!Component) {
    if (context.mode === "preview" || context.mode === "editor") {
      return (
        <div
          key={blockId}
          data-sf-block={blockId}
          className="rounded-sm border border-dashed border-amber-500 bg-amber-50 p-2 text-xs text-amber-900"
        >
          Unknown block: {node.type}
        </div>
      );
    }
    return null;
  }

  return (
    <Component
      key={blockId}
      node={node}
      context={context}
      blockId={blockId}
      renderBlock={(childNode, childId) => renderBlockComponent(childNode, context, childId)}
    />
  );
}
