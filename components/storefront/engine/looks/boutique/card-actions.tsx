"use client";

import { Heart } from "lucide-react";
import { useQuickAdd } from "@/components/storefront/cart/use-quick-add";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { cn } from "@/lib/utils";
import { useWording, useWordingMarker } from "../../use-wording";
import type { CardProduct } from "../../ui";

/**
 * What sits over a product card's picture: a heart (save for later) and an "Add to bag" bar that slides up when the card
 * is hovered or focused (always shown on touch screens, which have no hover). Rendered only where the store has a wishlist
 * or a bag. It sits OUTSIDE the card's link, so the card is never an anchor that contains buttons.
 */
export function CardActions({ product, href, aspect = "aspect-[3/4]", inset = "inset-x-3 bottom-3", round = "" }: { product: CardProduct; href: string | null; aspect?: string; inset?: string; round?: string }) {
  const { cart, busy, addToBag } = useQuickAdd(product, href);
  const wishlist = useOptionalWishlist();
  const { addToBagLabel } = useWording();
  // Editor and preview only: a click on the button jumps to Theme > Shopping wording > Add to bag label.
  const themeTarget = useWordingMarker("addToBagLabel");
  const soldOut = product.available === false;
  const saved = wishlist?.ready ? wishlist.has(product.slug) : false;

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
    cart?.notify(nowSaved ? `${product.name} saved to your wishlist` : `${product.name} removed from your wishlist`);
  };


  if (!wishlist && !cart) return null;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-0", aspect)}>
      {wishlist ? (
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="pointer-events-auto absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-foreground transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Heart className={cn("size-[17px] transition-colors", saved && "fill-primary text-primary")} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
      {cart && !soldOut ? (
        <button
          type="button"
          onClick={addToBag}
          disabled={busy}
          {...themeTarget}
          className={cn("pointer-events-auto absolute flex h-10 translate-y-2 items-center justify-center bg-primary text-[11px] font-[450] uppercase tracking-[0.15em] text-primary-foreground opacity-0 transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:bg-[var(--primary-hover,var(--primary))] focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100", inset, round)}
        >
          {busy ? "Adding" : addToBagLabel}
        </button>
      ) : null}
    </div>
  );
}
