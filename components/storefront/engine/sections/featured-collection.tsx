import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";

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

  const matchedCollection = context.collections?.find(
    (c) => c.id === collectionId || c.slug === collectionId
  );

  const allProducts = store.products ?? [];
  const displayProducts = allProducts.slice(0, productsToShow);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const colGridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : columns === 5
      ? "sm:grid-cols-3 lg:grid-cols-5"
      : columns === 6
      ? "sm:grid-cols-3 lg:grid-cols-6"
      : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16" {...sfProps}>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        {showViewAll ? (
          <Link
            href={matchedCollection ? `/collections/${matchedCollection.slug}` : "/collections"}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all &rarr;
          </Link>
        ) : null}
      </div>

      {displayProducts.length === 0 ? (
        <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground text-sm">
          No products in this collection.
        </p>
      ) : (
        <ul className={`grid grid-cols-2 gap-4 ${colGridClass}`}>
          {displayProducts.map((p) => {
            const img = publicImageUrl(p.image_path);
            const onSale =
              p.compare_at_price_minor !== null &&
              p.compare_at_price_minor !== undefined &&
              p.compare_at_price_minor > p.price_minor;

            return (
              <li key={p.slug} className="overflow-hidden rounded-xl border border-border bg-card">
                <Link href={`/products/${p.slug}`} className="group block">
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
                    {p.short_description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.short_description}</p>
                    ) : null}
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">{formatMoney(p.price_minor, store.currency ?? "INR")}</span>
                      {onSale && p.compare_at_price_minor ? (
                        <span className="ml-2 text-xs text-muted-foreground line-through">
                          {formatMoney(p.compare_at_price_minor, store.currency ?? "INR")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
