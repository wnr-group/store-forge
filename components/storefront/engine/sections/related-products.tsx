import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";

interface RelatedProductsSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function RelatedProductsSection({ node, context, sectionId }: RelatedProductsSectionProps) {
  const store = context.store;
  const currentProduct = context.resource as ProductDetailData | undefined;

  const heading = (node.settings?.heading as string) ?? "You May Also Like";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;

  const allProducts = store.products ?? [];

  // AC-REN-010: Filter related products strictly by shared active collection or same category
  const relatedProducts = allProducts.filter((p: {
    slug: string;
    collection_id?: string | null;
    category_id?: string | null;
    category?: string | null;
  }) => {
    // Exclude current product itself
    if (currentProduct && p.slug === currentProduct.slug) {
      return false;
    }

    if (!currentProduct) {
      return true;
    }

    // 1. Shared collection
    if (currentProduct.collection_id && p.collection_id) {
      return p.collection_id === currentProduct.collection_id;
    }

    // 2. Shared category ID or category name
    if (currentProduct.category_id && p.category_id) {
      return p.category_id === currentProduct.category_id;
    }
    if (currentProduct.category && p.category) {
      return p.category === currentProduct.category;
    }

    return false;
  }).slice(0, productsToShow);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  if (relatedProducts.length === 0) {
    if (isPreview) {
      return (
        <section className="mx-auto w-full max-w-6xl px-4 py-8" {...sfProps}>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{heading}</h2>
          <p className="mt-2 text-xs text-muted-foreground italic">
            No related products found sharing this product&apos;s collection or category.
          </p>
        </section>
      );
    }
    return null;
  }

  const colGridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16" {...sfProps}>
      <h2 className="mb-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{heading}</h2>

      <ul className={`grid grid-cols-2 gap-6 ${colGridClass}`}>
        {relatedProducts.map((p) => {
          const img = publicImageUrl(p.image_path);
          return (
            <li key={p.slug} className="group overflow-hidden rounded-xl border border-border bg-card">
              <Link href={`/products/${p.slug}`} className="block">
                <div className="relative aspect-square bg-muted">
                  {img ? (
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(p.price_minor, store.currency ?? "INR")}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
