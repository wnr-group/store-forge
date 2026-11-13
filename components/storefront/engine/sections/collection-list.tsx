import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { CONTAINER, ImagePlaceholder, RADIUS, SECTION_Y, SectionHeading } from "../ui";
import { cn } from "@/lib/utils";

interface CollectionListSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** Collections as tall picture cards with the name over the picture: two per row on phones, up to `columns` on desktop. */
export function CollectionListSection({ node, context, sectionId }: CollectionListSectionProps) {
  const title = (node.settings?.title as string) ?? "Collections";
  const columns = (node.settings?.columns as number) ?? 3;
  const showProductCount = Boolean(node.settings?.showProductCount ?? true);
  const collections = context.collections ?? [];

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  // Avoid a lone card on the last row: four collections sit in four columns, not three plus one.
  const effective = collections.length === 4 && columns === 3 ? 4 : collections.length > 0 && collections.length < columns ? Math.max(2, collections.length) : columns;
  const colGridClass =
    effective <= 2 ? "grid-cols-1 sm:grid-cols-2" : effective === 4 ? "grid-cols-2 lg:grid-cols-4" : effective === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : effective >= 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-3";

  return (
    <section className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <SectionHeading title={title} />
      {collections.length === 0 ? (
        <p className="rounded-[var(--radius,0.5rem)] border border-dashed py-12 text-center text-sm text-muted-foreground">No collections found.</p>
      ) : (
        <ul className={cn("grid gap-3 sm:gap-5", colGridClass)}>
          {collections.map((col) => {
            const img = publicImageUrl(col.image_path);
            return (
              <li key={col.slug || col.id}>
                <Link href={`/collections/${col.slug}`} className={cn("group relative block aspect-[4/5] overflow-hidden sm:aspect-[4/3] lg:aspect-[5/6] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", RADIUS)}>
                  {img ? <Image src={img} alt={col.name} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep />}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white sm:p-5">
                    <span className="text-base leading-tight font-medium sm:text-xl">{col.name}</span>
                    {showProductCount && typeof col.product_count === "number" ? <span className="text-xs text-white/80">{col.product_count} {col.product_count === 1 ? "product" : "products"}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
