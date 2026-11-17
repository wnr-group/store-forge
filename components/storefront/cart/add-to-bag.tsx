"use client";

import { useState } from "react";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import type { ProductDetailData } from "../engine/types";
import { useOptionalCart } from "./cart-provider";
import { QtyStepper } from "./qty-stepper";

/**
 * Quantity and "Add to bag" for the product page. A product with variants can only be added once the chosen options
 * match a real variant, and a sold-out product cannot be added at all; the line records that variant's own id and price.
 * Renders nothing where there is no cart (themes without one, pages outside a store).
 */
export function AddToBag({ product, selectedOptions }: { product: ProductDetailData; selectedOptions: Record<string, string> }) {
  const cart = useOptionalCart();
  const [quantity, setQuantity] = useState(1);
  if (!cart || !product.slug) return null;

  const variants = product.variants ?? [];
  const needsVariant = variants.length > 0;
  const variant = needsVariant ? resolveVariant(variants, selectedOptions) : undefined;
  const soldOut = product.available === false;
  const blocked = soldOut || (needsVariant && !variant) || cart.storeSlug === "";
  const label = soldOut ? "Sold out" : needsVariant && !variant ? "Select options" : "Add to bag";

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
    <div className="flex items-stretch gap-3 pt-2">
      <QtyStepper value={quantity} onChange={setQuantity} label={product.name} className="h-12 w-28 text-[14px]" />
      <button type="button" onClick={add} disabled={blocked} className={cn("flex h-12 flex-1 items-center justify-center bg-primary px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", blocked && "cursor-not-allowed opacity-55 hover:bg-primary")}>
        {label}
      </button>
    </div>
  );
}
