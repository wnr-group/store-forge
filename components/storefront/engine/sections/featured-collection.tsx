import React from "react";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { CONTAINER, GRID_GAP, ProductCard, SECTION_Y, SectionHeading, balancedColumns, gridColumns, type CardProduct } from "../ui";
import { cn } from "@/lib/utils";

interface FeaturedCollectionSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function FeaturedCollectionSection({ node, context, sectionId }: FeaturedCollectionSectionProps) {
  const store = context.store;
  const title = (node.settings?.title as string) ?? "Featured Collection";
  const collectionId = (node.settings?.collectionId as string) ?? "";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);

  const matchedCollection = context.collections?.find((c) => c.id === collectionId || c.slug === collectionId);
  const products = ((store.products ?? []) as CardProduct[]).slice(0, productsToShow);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  return (
    <section id="products" className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <SectionHeading
        title={title}
        action={
          showViewAll ? (
            <Link href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/products"} className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground">
              View all
            </Link>
          ) : null
        }
      />
      {products.length === 0 ? (
        <p className="rounded-[var(--radius,0.5rem)] border border-dashed py-16 text-center text-sm text-muted-foreground">No products in this collection.</p>
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
