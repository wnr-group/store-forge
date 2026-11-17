"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart } from "lucide-react";
import { quickAddAction } from "@/app/s/[slug]/cart/actions";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
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
  const cart = useOptionalCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const soldOut = product.available === false;

  const add = async () => {
    if (!cart || busy || soldOut) return;
    setBusy(true);
    try {
      const result = await quickAddAction({ storeSlug: cart.storeSlug, productSlug: product.slug });
      if (result.status === "ok") cart.add(result.item, { openDrawer: false });
      else if (result.status === "options") {
        if (href) router.push(href);
      } else if (result.status === "unavailable") cart.notify(`${product.name} is sold out`);
      else if (result.status === "gone") cart.notify(`${product.name} is no longer available`);
      else cart.notify("Could not add this item. Please try again.");
    } catch {
      cart.notify("Could not add this item. Please try again.");
    } finally {
      setBusy(false);
    }
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
