import React from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";
import { resolveVariant } from "@/lib/templates/variant-selection";

interface MainProductSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function MainProductSection({ node, context, sectionId }: MainProductSectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const mediaPosition = (node.settings?.mediaPosition as string) ?? "left";

  const matchedVariant = product?.variants && context.selectedOptions
    ? resolveVariant(product.variants, context.selectedOptions)
    : undefined;

  const rawImagePath = matchedVariant?.image_path ?? product?.image_path;
  const imageUrl = rawImagePath ? publicImageUrl(rawImagePath) : null;

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12" {...sfProps}>
      <div className={`grid grid-cols-1 gap-12 lg:grid-cols-2 ${mediaPosition === "right" ? "lg:grid-flow-dense" : ""}`}>
        {/* Gallery / Media */}
        <div className={`space-y-4 ${mediaPosition === "right" ? "lg:col-start-2" : ""}`}>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted border border-border">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product?.name ?? "Product image"}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
                No product image
              </div>
            )}
          </div>
        </div>

        {/* Product Details & Blocks */}
        <div className={`flex flex-col space-y-4 ${mediaPosition === "right" ? "lg:col-start-1" : ""}`}>
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
