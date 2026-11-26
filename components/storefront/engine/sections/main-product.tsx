import React, { useState } from "react";
import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { renderBlockComponent } from "../blocks";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { CONTAINER, ImagePlaceholder, RADIUS } from "../ui";
import { cn } from "@/lib/utils";
import { lookHasCart } from "../looks";
import { AddToBag } from "@/components/storefront/cart/add-to-bag";
import { effectiveGalleryLayout, effectiveMediaPosition, isHiddenFor, presentationOf } from "@/lib/templates/product-presentation";

/**
 * Picture boxes of the product page. Every picture is shown WHOLE (`object-contain`, the muted background fills any spare space), so
 * nothing is cropped; this also means a product's focal point, which only matters when a picture is cropped, is not applied here.
 * - Phones: the box is the full column width at 4:5, as before.
 * - Tablets (single column): the gallery is centred and at most 34rem wide, and a box is never taller than 75% of the screen.
 * - Desktop (two columns): the main picture box is as tall as the screen allows after the header, the sticky offset and the thumbnail
 *   row (17rem), between 22rem and 50rem, and the gallery stays in view while the details scroll.
 */
const STACKED_BOX = "relative aspect-[4/5] w-full overflow-hidden bg-muted md:max-h-[75dvh]";
const MAIN_BOX = "relative aspect-[4/5] w-full overflow-hidden bg-muted md:max-h-[75dvh] lg:aspect-auto lg:h-[calc(100dvh-17rem)] lg:max-h-[50rem] lg:min-h-[22rem]";

interface MainProductSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/**
 * The product's picture gallery beside its details. The gallery stacks above the details on phones.
 *
 * A product may carry its own presentation (gallery layout, media position, hidden blocks; its focal point is not used here, see
 * the picture boxes above). It is applied
 * here at render time only: the page document is never changed, so other products are unaffected. Precedence: the
 * product's setting, then this section's setting, then the descriptor default.
 */
export function MainProductSection({ node, context, sectionId }: MainProductSectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const presentation = presentationOf(product);
  const mediaPosition = effectiveMediaPosition(node.settings?.mediaPosition, presentation);
  const stacked = effectiveGalleryLayout(node.settings?.galleryLayout, presentation) === "stacked";
  const [picked, setPicked] = useState<string | null>(null);
  // With a cart, the option the shopper picks is shared by the picker, the price and "Add to bag"; it starts on the first value of each option.
  const withCart = lookHasCart(context.theme);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries((product?.options ?? []).filter((o) => o.values.length > 0).map((o) => [o.name, o.values[0]])));
  const ctx: RenderContext = withCart ? { ...context, selectedOptions: chosen, onSelectOption: (option: string, value: string) => setChosen((prev) => ({ ...prev, [option]: value })) } : context;

  const matchedVariant = product?.variants && ctx.selectedOptions ? resolveVariant(product.variants, ctx.selectedOptions) : undefined;

  // A variant with its own picture wins; otherwise the thumbnail the shopper chose; otherwise the first picture.
  const gallery = [...new Set([product?.image_path, ...(product?.images ?? [])].filter((p): p is string => Boolean(p)))];
  const shownPath = matchedVariant?.image_path ?? picked ?? gallery[0] ?? null;
  const imageUrl = shownPath ? publicImageUrl(shownPath) : null;
  // Stacked: every picture one under the other, a variant's own picture first.
  const variantPath = matchedVariant?.image_path;
  const stackedPaths = variantPath && gallery.includes(variantPath) ? [variantPath, ...gallery.filter((p) => p !== variantPath)] : gallery;

  const blocks = node.blocks ?? {};
  const blockOrder = (node.block_order ?? Object.keys(blocks)).filter((id) => !isHiddenFor(presentation, blocks[id]?.type ?? ""));

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const mediaRight = mediaPosition === "right";

  return (
    <section className={cn(CONTAINER, "py-8 sm:py-12 lg:py-16")} {...sfProps}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        <div className={cn("space-y-3 md:mx-auto md:w-full md:max-w-[34rem] lg:mx-0 lg:max-w-none", !stacked && "lg:sticky lg:top-24 lg:self-start", mediaRight && "lg:order-2")}>
          {stacked ? (
            stackedPaths.length > 0 ? (
              <ul className="space-y-3" aria-label="Product pictures" data-gallery="stacked">
                {stackedPaths.map((path, i) => {
                  const url = publicImageUrl(path);
                  if (!url) return null;
                  return (
                    <li key={path} className={cn(STACKED_BOX, RADIUS)}>
                      <Image src={url} alt={i === 0 ? (product?.name ?? "Product image") : ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" priority={i === 0} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-muted", RADIUS)}>
                <ImagePlaceholder className="absolute inset-0" />
                <span className="sr-only">No product image</span>
              </div>
            )
          ) : (
            <>
              <div className={cn(MAIN_BOX, RADIUS)}>
                {imageUrl ? (
                  <Image src={imageUrl} alt={product?.name ?? "Product image"} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" priority />
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
                          <Image src={url} alt="" fill sizes="100px" className="object-contain" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className={cn("flex flex-col space-y-4 lg:sticky lg:top-24 lg:self-start", mediaRight && "lg:order-1")}>
          {product?.available === false ? <p className="w-fit rounded-[calc(var(--radius,0.5rem)/2)] bg-muted px-2.5 py-1 text-xs font-medium text-foreground">Sold out</p> : null}
          {blockOrder.map((blockId) => renderBlockComponent(blocks[blockId], ctx, blockId))}
          {withCart && product ? <AddToBag product={product} selectedOptions={chosen} /> : null}
        </div>
      </div>
    </section>
  );
}
