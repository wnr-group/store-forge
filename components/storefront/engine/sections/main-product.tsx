import React, { useState } from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { CONTAINER, ImagePlaceholder, RADIUS } from "../ui";
import { cn } from "@/lib/utils";

interface MainProductSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** The product's picture gallery beside its details. The gallery stacks above the details on phones. */
export function MainProductSection({ node, context, sectionId }: MainProductSectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const mediaPosition = (node.settings?.mediaPosition as string) ?? "left";
  const [picked, setPicked] = useState<string | null>(null);

  const matchedVariant = product?.variants && context.selectedOptions ? resolveVariant(product.variants, context.selectedOptions) : undefined;

  // A variant with its own picture wins; otherwise the thumbnail the shopper chose; otherwise the first picture.
  const gallery = [...new Set([product?.image_path, ...(product?.images ?? [])].filter((p): p is string => Boolean(p)))];
  const shownPath = matchedVariant?.image_path ?? picked ?? gallery[0] ?? null;
  const imageUrl = shownPath ? publicImageUrl(shownPath) : null;

  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const mediaRight = mediaPosition === "right";

  return (
    <section className={cn(CONTAINER, "py-8 sm:py-12 lg:py-16")} {...sfProps}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        <div className={cn("space-y-3", mediaRight && "lg:order-2")}>
          <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-muted", RADIUS)}>
            {imageUrl ? (
              <Image src={imageUrl} alt={product?.name ?? "Product image"} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" priority />
            ) : (
              <>
                <ImagePlaceholder className="absolute inset-0" />
                <span className="sr-only">No product image</span>
              </>
            )}
          </div>
          {gallery.length > 1 ? (
            <ul className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Product pictures">
              {gallery.slice(0, 5).map((path, i) => {
                const url = publicImageUrl(path);
                if (!url) return null;
                return (
                  <li key={path}>
                    <button type="button" onClick={() => setPicked(path)} aria-label={`Show picture ${i + 1}`} aria-pressed={shownPath === path} className={cn("relative block aspect-square w-full overflow-hidden border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring", RADIUS, shownPath === path ? "border-foreground" : "border-transparent opacity-80 hover:opacity-100")}>
                      <Image src={url} alt="" fill sizes="100px" className="object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className={cn("flex flex-col space-y-4 lg:sticky lg:top-24 lg:self-start", mediaRight && "lg:order-1")}>
          {product?.available === false ? <p className="w-fit rounded-[calc(var(--radius,0.5rem)/2)] bg-muted px-2.5 py-1 text-xs font-medium text-foreground">Sold out</p> : null}
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], context, blockId))}
        </div>
      </div>
    </section>
  );
}
