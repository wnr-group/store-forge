import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";

interface CollectionListSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

export function CollectionListSection({ node, context, sectionId }: CollectionListSectionProps) {
  const title = (node.settings?.title as string) ?? "Collections";
  const columns = (node.settings?.columns as number) ?? 3;
  const showProductCount = Boolean(node.settings?.showProductCount ?? true);

  const collections = context.collections ?? [];

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const colGridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 5
      ? "sm:grid-cols-3 lg:grid-cols-5"
      : columns === 6
      ? "sm:grid-cols-3 lg:grid-cols-6"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16" {...sfProps}>
      {title ? (
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        </div>
      ) : null}

      {collections.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
          No collections found.
        </p>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${colGridClass}`}>
          {collections.map((col) => {
            const img = publicImageUrl(col.image_path);
            return (
              <Link
                key={col.slug || col.id}
                href={`/collections/${col.slug}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md"
              >
                <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                  {img ? (
                    <Image
                      src={img}
                      alt={col.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {col.name}
                  </h3>
                  {showProductCount && col.product_count !== undefined ? (
                    <p className="mt-1 text-xs text-muted-foreground">{col.product_count} products</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
