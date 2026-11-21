"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { lookCard, type SectionProps } from "../engine/looks";
import { SHELL } from "../engine/looks/boutique/shell";
import { gridColumns, type CardProduct } from "../engine/ui";
import { useOptionalWishlist } from "./wishlist-provider";

const DISPLAY = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" } as const;
const MUTED = "text-[color:var(--sf-color-muted)]";

/**
 * The wishlist page: the products the shopper saved for THIS store in this browser. On opening, they are refreshed from the
 * store's live products, so a deleted product disappears and prices and availability are current.
 */
export function WishlistPageSection({ context, sectionId }: SectionProps) {
  const wishlist = useOptionalWishlist();
  const [notice, setNotice] = useState<string | null>(null);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const currency = typeof context.store.currency === "string" ? context.store.currency : "INR";

  const ready = wishlist?.ready ?? false;
  const hasItems = (wishlist?.items.length ?? 0) > 0;
  const revalidate = wishlist?.revalidate;
  const checked = useRef(false);
  useEffect(() => {
    // Once per visit, as soon as the saved list has been read.
    if (checked.current || !ready || !hasItems || !revalidate || isPreview) return;
    checked.current = true;
    void revalidate().then((result) => {
      if (!result) return;
      setNotice(result.removed.length > 0 ? `${result.removed.join(", ")} ${result.removed.length === 1 ? "is" : "are"} no longer available and ${result.removed.length === 1 ? "was" : "were"} removed from your wishlist.` : null);
    });
  }, [ready, hasItems, revalidate, isPreview]);

  if (!wishlist) return null;
  const Card = lookCard(context.theme);
  const products: CardProduct[] = wishlist.items.map((i) => ({
    name: i.name,
    slug: i.productSlug,
    short_description: i.shortDescription,
    price_minor: i.priceMinor,
    compare_at_price_minor: i.compareAtMinor,
    image_path: i.imagePath,
    available: i.available,
  }));

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} {...sfProps}>
      <nav aria-label="Breadcrumb" className={cn("text-[11px] uppercase tracking-[0.16em]", MUTED)}>
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden className="opacity-50">
            /
          </li>
          <li aria-current="page" className="text-foreground">
            Wishlist
          </li>
        </ol>
      </nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-8 md:mt-[30px] md:pb-10">
        <h1 className="text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-foreground md:text-[3.5rem]" style={DISPLAY}>
          Wishlist
        </h1>
        {ready && hasItems ? (
          <p className={cn("pb-1 text-[13px]", MUTED)} aria-live="polite">
            {products.length} saved {products.length === 1 ? "piece" : "pieces"}
          </p>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="mt-6 border border-border bg-white px-4 py-3 text-[13px] text-foreground">
          {notice}
        </p>
      ) : null}

      {!ready ? (
        <div className="h-48 animate-pulse bg-secondary/60 mt-10" aria-busy="true" aria-label="Loading your wishlist" />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-start gap-6 py-16 md:py-24">
          <p className="text-[1.75rem] leading-tight md:text-[2.25rem]" style={DISPLAY}>
            Nothing saved yet
          </p>
          <p className={cn("max-w-md text-[15px] leading-7", MUTED)}>Tap the heart on any piece to keep it here, saved in this browser for this store.</p>
          <Link href="/products" className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))]">
            Continue shopping
          </Link>
        </div>
      ) : (
        <ul className={cn("mt-10 grid gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6", gridColumns(4))}>
          {products.map((p) => (
            <li key={p.slug} className="min-w-0">
              <Card product={p} currency={currency} href={`/products/${p.slug}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
