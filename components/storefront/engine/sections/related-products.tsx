import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { ProductDetailData, RenderContext } from "../types";
import { CONTAINER, GRID_GAP, ProductCard, SECTION_Y, SectionHeading, gridColumns, type CardProduct } from "../ui";
import { cn } from "@/lib/utils";
import { HIDEABLE_SECTION, isHiddenFor, presentationOf } from "@/lib/templates/product-presentation";

interface RelatedProductsSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/**
 * Products shown under a product. On the live storefront the API sends the related products with the product itself
 * (same collection or category); in the editor, which has no such list, the store's other products stand in.
 */
export function RelatedProductsSection({ node, context, sectionId }: RelatedProductsSectionProps) {
  const store = context.store;
  const current = context.resource as (ProductDetailData & { related?: CardProduct[] }) | undefined;
  // A product can hide this whole section for itself. Render time only: the page document is not touched.
  if (isHiddenFor(presentationOf(current), HIDEABLE_SECTION)) return null;
  const heading = (node.settings?.heading as string) ?? "You May Also Like";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  // The API sends related products with the product (same collection or category). Without that list, only products
  // that share this product's collection or category count (AC-REN-010); nothing is padded in.
  const pool: CardProduct[] = Array.isArray(current?.related)
    ? current.related
    : ((store.products ?? []) as (CardProduct & { collection_id?: string | null; category_id?: string | null; category?: string | null })[]).filter((p) => {
        if (current && p.slug === current.slug) return false;
        if (!current) return true;
        if (current.collection_id && p.collection_id) return p.collection_id === current.collection_id;
        if (current.category_id && p.category_id) return p.category_id === current.category_id;
        if (current.category && p.category) return p.category === current.category;
        return false;
      });
  const related = pool.slice(0, productsToShow);

  if (related.length === 0) {
    if (!isPreview) return null;
    return (
      <section className={cn(CONTAINER, "py-8")} {...sfProps}>
        <h2 className="text-xl tracking-tight text-foreground">{heading}</h2>
        <p className="mt-2 text-xs text-muted-foreground italic">Products from the same collection or category appear here.</p>
      </section>
    );
  }

  return (
    <section className={cn(CONTAINER, "border-t border-border", SECTION_Y)} {...sfProps}>
      <SectionHeading title={heading} />
      <ul className={cn("grid", gridColumns(columns), GRID_GAP)}>
        {related.map((p) => (
          <li key={p.slug}>
            <ProductCard product={p} currency={store.currency ?? "INR"} href={`/products/${p.slug}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
