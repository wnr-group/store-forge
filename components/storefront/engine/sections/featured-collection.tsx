import React from "react";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { resolveCollection } from "@/lib/storefront/featured";
import { CONTAINER, EmptyProducts, GRID_GAP, ProductCard, SECTION_Y, SectionHeading, balancedColumns, gridColumns, type CardProduct } from "../ui";
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
