import React from "react";
import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { resolveCollection } from "@/lib/storefront/featured";
import { isEditorialTheme, isGroceryTheme, isHomeTheme } from "@/lib/templates/engine/theme-style";
import { CONTAINER, EditorialHeader, EditorialProductCard, EmptyProducts, GRID_GAP, GroceryProductCard, HavenFeaturedProduct, HavenProductCard, ProductCard, SECTION_Y, SectionHeading, balancedColumns, gridColumns, type CardProduct } from "../ui";
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

  // Haven (home & furniture): large portrait cards with generous space, under a label, a big title and an "all" link.
  if (isHomeTheme(context.theme) && products.length > 0) {
    // One product becomes a feature; more are a compact card grid.
    const currency = store.currency ?? "INR";
    return (
      <section id="products" className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div className="min-w-0">
            <span aria-hidden className="block h-0.5 w-10 bg-accent" />
            <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-[1.1] tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl">{title}</h2>
          </div>
          {showViewAll ? (
            <Link href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/products"} className="group/all hidden shrink-0 items-center gap-2 border-b border-foreground/30 pb-1 text-sm font-medium text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:inline-flex">
              View all
              <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
            </Link>
          ) : null}
        </div>
        {/* Cards keep a compact size (about 215px to 272px wide) however many products there are, instead of stretching to fill the row. */}
        {products.length === 1 ? (
          <HavenFeaturedProduct product={products[0]} currency={currency} href={`/products/${products[0].slug}`} priority />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,17rem))] sm:gap-x-5 sm:gap-y-10 lg:gap-x-6 lg:gap-y-12">
            {products.map((p, i) => (
              <li key={p.slug} className="min-w-0">
                <HavenProductCard product={p} currency={currency} href={`/products/${p.slug}`} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}
        {showViewAll ? (
          <div className="mt-10 sm:hidden">
            <Link href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/products"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-button-radius,4px)] border border-foreground/25 text-sm font-medium text-foreground transition-colors duration-300 hover:bg-foreground hover:text-background">
              View all
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        ) : null}
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
