"use client";

import { Heart, ShoppingCart } from "lucide-react";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
import { useQuickAdd } from "@/components/storefront/cart/use-quick-add";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { cn } from "@/lib/utils";
import type { CardProduct } from "../../ui";
import { btnAccent } from "./ui";

/** The heart in the corner of a product picture. Renders nothing for a store without a wishlist. */
export function MarketHeart({ product, className }: { product: CardProduct; className?: string }) {
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  if (!wishlist) return null;
  const saved = wishlist.ready ? wishlist.has(product.slug) : false;
  const toggle = () => {
    const now = wishlist.toggle({
      productSlug: product.slug,
      name: product.name,
      shortDescription: product.short_description ?? null,
      imagePath: product.image_path ?? null,
      priceMinor: product.price_minor,
      compareAtMinor: product.compare_at_price_minor ?? null,
      available: product.available !== false,
    });
    cart?.notify(now ? `${product.name} saved to your wishlist` : `${product.name} removed from your wishlist`);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn("absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-md border border-border bg-white/95 shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary", className)}
    >
      <Heart className={cn("size-4", saved ? "fill-accent text-accent" : "text-muted-foreground")} aria-hidden />
    </button>
  );
}

/** The orange "Add to cart" button under a product card. A product with options opens its page instead. */
export function MarketAddButton({ product, href, className }: { product: CardProduct; href: string | null; className?: string }) {
  const soldOut = product.available === false;

  const { cart, busy, addToBag } = useQuickAdd(product, href);
  const add = () => {
    if (!soldOut) void addToBag();
  };

  if (!cart && !soldOut) return null;
  return (
    <button type="button" onClick={add} disabled={soldOut || busy} className={cn(btnAccent("sm"), "w-full", busy && "cursor-wait", className)}>
      {soldOut ? (
        "Out of stock"
      ) : (
        <>
          <ShoppingCart className="size-3.5" aria-hidden />
          {busy ? "Adding" : "Add to cart"}
        </>
      )}
    </button>
  );
}
