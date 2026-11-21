"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Store } from "lucide-react";
import { useOptionalCart } from "@/components/storefront/cart/cart-provider";
import { useOptionalWishlist } from "@/components/storefront/wishlist/wishlist-provider";
import { formatBagPrice } from "@/lib/cart/format";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import type { ProductDetailData } from "../../types";
import { Price, btnAccent, btnOutline, btnPrimary } from "./ui";

/**
 * The buy box on the right of the Market product page: the price for the chosen options, the stock state, a quantity menu,
 * "Add to cart", "Buy now" and "Add to wishlist", and who sells it. A product with options can only be bought once the
 * chosen options match a real variant; a sold-out product cannot be added.
 */
export function MarketBuyBox({ product, selectedOptions, currency, storeName, showReference = true }: { product: ProductDetailData; selectedOptions: Record<string, string>; currency: string; storeName: string; showReference?: boolean }) {
  const cart = useOptionalCart();
  const wishlist = useOptionalWishlist();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  const variants = product.variants ?? [];
  const needsVariant = variants.length > 0;
  const variant = needsVariant ? resolveVariant(variants, selectedOptions) : undefined;
  const soldOut = product.available === false;
  const blocked = soldOut || (needsVariant && !variant) || !cart || cart.storeSlug === "";
  const price = variant?.price_minor ?? product.price_minor;
  const compareAt = (variant?.compare_at_price_minor ?? product.compare_at_price_minor) ?? null;
  const saved = wishlist?.ready ? wishlist.has(product.slug) : false;

  const line = () => ({
    productSlug: product.slug,
    variantId: variant?.id ?? null,
    name: product.name,
    variantTitle: variant?.title ?? null,
    imagePath: variant?.image_path ?? product.image_path ?? null,
    unitPriceMinor: price,
    compareAtMinor: compareAt,
    quantity,
  });
  const add = () => {
    if (blocked || !cart) return;
    cart.add(line());
    setQuantity(1);
  };
  const buyNow = () => {
    if (blocked || !cart) return;
    cart.add(line(), { openDrawer: false });
    router.push("/cart");
  };
  const toggleSaved = () => {
    if (!wishlist) return;
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
    <div id="buy" className="scroll-mt-28 rounded-xl border border-border/80 bg-white p-4 shadow-sm">
      <Price minor={price} compareAt={compareAt} currency={currency} size="lg" />
      <p className={cn("mt-3 text-[15px] font-bold", soldOut ? "text-red-600" : "text-emerald-700")}>{soldOut ? "Currently unavailable" : "In stock"}</p>

      {cart && !soldOut ? (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="mf-qty" className="text-[13px] text-muted-foreground">Qty</label>
          <select id="mf-qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="h-9 w-[76px] rounded-md border border-border bg-white px-2 text-sm text-primary outline-none focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {quantity > 1 ? <span className="text-xs tabular-nums text-muted-foreground">= {formatBagPrice(price * quantity, currency)}</span> : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {cart ? (
          <>
            <button type="button" onClick={add} disabled={blocked} className={cn(btnAccent("lg"), "w-full")}>
              <ShoppingCart className="size-4" aria-hidden />
              {soldOut ? "Sold out" : needsVariant && !variant ? "Select options" : "Add to cart"}
            </button>
            <button type="button" onClick={buyNow} disabled={blocked} className={cn(btnPrimary("lg"), "w-full")}>
              Buy now
            </button>
          </>
        ) : null}
        {wishlist ? (
          <button type="button" onClick={toggleSaved} aria-pressed={saved} className={cn(btnOutline("md"), "w-full")}>
            <Heart className={cn("size-4", saved && "fill-accent text-accent")} aria-hidden />
            {saved ? "Saved to wishlist" : "Add to wishlist"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Sold by</span>
          <span className="flex items-center gap-1 text-right font-medium text-primary">
            <Store className="size-3.5 text-muted-foreground" aria-hidden />
            {storeName}
          </span>
        </div>
        {product.sku && showReference ? (
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Reference</span>
            <span className="text-right text-primary">{product.sku}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
