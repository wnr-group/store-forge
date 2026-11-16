import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { resolveCollection } from "@/lib/storefront/featured";
import { isEditorialTheme, isGroceryTheme } from "@/lib/templates/engine/theme-style";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";
import { CONTAINER, EditorialHeader, EditorialProductCard, EmptyProducts, GRID_GAP, ImagePlaceholder, ProductCard, SECTION_Y, SectionHeading, balancedColumns, gridColumns, type CardProduct } from "../ui";
import { cn } from "@/lib/utils";

interface FeaturedCollectionSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/**
 * A row of products. With a collection chosen it shows THAT collection's active products, in the collection's order; with
 * none chosen it shows the store's newest active products. Products always come from the store being shown, never from a
 * theme: an empty catalogue shows an empty state, and a collection that is empty or gone hides the section from shoppers.
 */
export function FeaturedCollectionSection({ node, context, sectionId }: FeaturedCollectionSectionProps) {
  const store = context.store;
  const title = (node.settings?.title as string) ?? "Featured Collection";
  const chosen = (node.settings?.collectionId as string) ?? "";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const matchedCollection = resolveCollection(chosen, context.collections);
  const pickedCollection = chosen.trim().length > 0;
  const source: CardProduct[] = pickedCollection ? (matchedCollection ? (context.collectionProducts?.[matchedCollection.slug] ?? []) : []) : ((store.products ?? []) as CardProduct[]);
  const products = source.slice(0, productsToShow);

  // A section pointing at an empty or deleted collection is hidden from shoppers; the merchant still sees it, with a hint.
  if (products.length === 0 && pickedCollection && !isPreview) return null;

  if (isEditorialTheme(context.theme) && products.length > 0) {
    const cols = balancedColumns(products.length, columns);
    return (
      <section id="products" className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
        <EditorialHeader eyebrow="Just in" title={title} href={showViewAll ? (matchedCollection ? `/collections/${matchedCollection.slug}` : "/products") : null} />
        <ul className={cn("grid gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:gap-x-6", gridColumns(cols))}>
          {products.map((p, i) => (
            <li key={p.slug} className="min-w-0">
              <EditorialProductCard product={p} currency={store.currency ?? "INR"} href={`/products/${p.slug}`} index={i} priority={i < 2} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // Freshly (grocery): a tinted full-width band with a dense grid of white product cards.
  if (isGroceryTheme(context.theme) && products.length > 0) {
    const cols = balancedColumns(products.length, columns);
    return (
      <section id="products" className="w-full bg-[var(--surface,var(--muted))]" {...sfProps}>
        <div className={cn(CONTAINER, SECTION_Y)}>
          <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                <Flame className="size-4" aria-hidden />
                Trending now
              </p>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">{title}</h2>
            </div>
            {showViewAll ? (
              <Link href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/products"} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-background px-5 text-sm font-semibold text-foreground ring-1 ring-border transition-colors duration-200 hover:bg-primary hover:text-primary-foreground hover:ring-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                View all
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          <ul className={cn("grid gap-3 sm:gap-4", gridColumns(cols))}>
            {products.map((p, i) => (
              <li key={p.slug} className="min-w-0">
                <GroceryProductCard product={p} currency={store.currency ?? "INR"} href={`/products/${p.slug}`} priority={i < 4} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <SectionHeading
        title={title}
        action={
          showViewAll && products.length > 0 ? (
            <Link href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/products"} className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground">
              View all
            </Link>
          ) : null
        }
      />
      {products.length === 0 ? (
        <EmptyProducts mode={context.mode} title={pickedCollection ? (matchedCollection ? `Nothing in ${matchedCollection.name} yet` : "This collection is no longer available") : undefined} />
      ) : (
        <ul className={cn("grid", gridColumns(balancedColumns(products.length, columns)), GRID_GAP)}>
          {products.map((p, i) => (
            <li key={p.slug}>
              <ProductCard product={p} currency={store.currency ?? "INR"} href={`/products/${p.slug}`} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Grocery product card: a white card with the picture on a soft panel, a real discount badge (worked out from the compare-at
 * price, never invented), the name, price and an arrow chip. The hover lift and shadow animate on their own layers so they stay smooth.
 */
function GroceryProductCard({ product, currency, href, priority }: { product: CardProduct; currency: string; href: string; priority: boolean }) {
  const img = publicImageUrl(product.image_path);
  const compare = product.compare_at_price_minor;
  const onSale = compare != null && compare > product.price_minor;
  const off = onSale ? Math.max(1, Math.round((1 - product.price_minor / compare!) * 100)) : 0;
  const soldOut = product.available === false;
  return (
    <Link href={href} className="group relative isolate flex h-full transform-gpu flex-col rounded-3xl bg-background p-2.5 outline-none ring-1 ring-border transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-0 shadow-[0_22px_34px_-18px_rgba(20,35,26,0.4)] transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
      <span className="relative isolate block aspect-square w-full transform-gpu overflow-hidden rounded-2xl bg-muted">
        {img ? (
          <Image src={img} alt="" fill priority={priority} sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 46vw" className={cn("object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.07] motion-reduce:transition-none", soldOut && "opacity-60")} />
        ) : (
          <ImagePlaceholder className="absolute inset-0" />
        )}
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded-full bg-background px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">Sold out</span>
        ) : onSale ? (
          <span className="absolute left-2 top-2 rounded-full bg-[color-mix(in_srgb,var(--accent,#ea580c)_82%,black)] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">{off}% off</span>
        ) : null}
      </span>
      <span className="mt-3 flex flex-1 flex-col px-1 pb-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{product.name}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="flex min-w-0 flex-col leading-tight">
            {onSale ? <span className="text-xs text-muted-foreground line-through">{formatMoney(compare!, currency)}</span> : null}
            <span className="text-base font-extrabold text-foreground">{formatMoney(product.price_minor, currency)}</span>
          </span>
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </span>
    </Link>
  );
}
