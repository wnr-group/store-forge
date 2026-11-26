"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import type { ProductDetailData } from "../engine/types";
import { useWording } from "../engine/use-wording";
import { useOptionalCart } from "./cart-provider";
import { useOptionalWishlist } from "../wishlist/wishlist-provider";
import { QtyStepper } from "./qty-stepper";

/**
 * Quantity and "Add to bag" for the product page. A product with variants can only be added once the chosen options
 * match a real variant, and a sold-out product cannot be added at all; the line records that variant's own id and price.
 * Renders nothing where there is no cart (themes without one, pages outside a store).
 */
export function AddToBag({ product, selectedOptions }: { product: ProductDetailData; selectedOptions: Record<string, string> }) {
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  const { addToBagLabel } = useWording();
  const [quantity, setQuantity] = useState(1);
  if (!cart || !product.slug) return null;
  const saved = wishlist?.ready ? wishlist.has(product.slug) : false;

  // Saves the product itself (not a variant): the wishlist is a list of products.
  const toggleSaved = () => {
    if (!wishlist) return;
    const nowSaved = wishlist.toggle({
      productSlug: product.slug,
      name: product.name,
      shortDescription: product.short_description ?? null,
      imagePath: product.image_path ?? null,
      priceMinor: product.price_minor,
      compareAtMinor: product.compare_at_price_minor ?? null,
      available: product.available !== false,
    });
    cart.notify(nowSaved ? `${product.name} saved to your wishlist` : `${product.name} removed from your wishlist`);
  };

  const variants = product.variants ?? [];
  const needsVariant = variants.length > 0;
  const variant = needsVariant ? resolveVariant(variants, selectedOptions) : undefined;
  const soldOut = product.available === false;
  const blocked = soldOut || (needsVariant && !variant) || cart.storeSlug === "";
  const label = soldOut ? "Sold out" : needsVariant && !variant ? "Select options" : addToBagLabel;

  const add = () => {
    if (blocked) return;
    cart.add({
      productSlug: product.slug,
      variantId: variant?.id ?? null,
      name: product.name,
      variantTitle: variant?.title ?? null,
      imagePath: variant?.image_path ?? product.image_path ?? null,
      unitPriceMinor: variant?.price_minor ?? product.price_minor,
      compareAtMinor: (variant?.compare_at_price_minor ?? product.compare_at_price_minor) ?? null,
      quantity,
    });
    setQuantity(1);
  };

  return (
    <div className="flex w-full max-w-sm items-stretch gap-2 pt-2">
      <QtyStepper value={quantity} onChange={setQuantity} label={product.name} className="h-11 w-24 shrink-0" />
      <button type="button" onClick={add} disabled={blocked} className={cn("flex h-11 min-w-0 flex-1 items-center justify-center bg-primary px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", blocked && "cursor-not-allowed opacity-55 hover:bg-primary")}>
        {label}
      </button>
      {wishlist ? (
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
          title={saved ? "Remove from wishlist" : "Add to wishlist"}
          className="flex size-11 shrink-0 items-center justify-center border border-border bg-transparent text-foreground transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Heart className={cn("size-[18px] transition-colors", saved && "fill-primary text-primary")} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
