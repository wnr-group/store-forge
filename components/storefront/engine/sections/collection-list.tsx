import React from "react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { CONTAINER, EditorialArt, EditorialHeader, ImagePlaceholder, RADIUS, SECTION_Y, SectionHeading } from "../ui";
import { cn } from "@/lib/utils";
import { isEditorialTheme } from "@/lib/templates/engine/theme-style";

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

  // Atelier (serif headings, square buttons) always gets the editorial layout, including stores that applied it before the layout setting existed.
  const isAtelier = isEditorialTheme(context.theme);
  const chosen = node.settings?.layout;
  const layout = chosen === "grid" || chosen === "editorial" ? chosen : isAtelier ? "editorial" : "grid";
  if (layout === "editorial" && collections.length > 0) {
    return <EditorialCollections title={title} showProductCount={showProductCount} collections={collections} sfProps={sfProps} />;
  }

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

/** Column spans on desktop (12-column grid) for each card, and whether the first card is a tall feature spanning two rows. */
function editorialPlan(count: number): { feature: boolean; span: string } {
  if (count === 1) return { feature: false, span: "lg:col-span-12" };
  if (count === 2) return { feature: false, span: "lg:col-span-6" };
  if (count === 3) return { feature: true, span: "lg:col-span-6" };
  if (count === 4 || count >= 7) return { feature: false, span: "lg:col-span-3" };
  if (count === 5) return { feature: true, span: "lg:col-span-3" };
  return { feature: false, span: "lg:col-span-4" };
}

/**
 * Editorial layout: a tall feature picture beside a grid of portraits, each with its caption below the picture
 * (index number, serif name, product count and an arrow) instead of text laid over it. Corners follow the theme.
 */
function EditorialCollections({ title, showProductCount, collections, sfProps }: { title: string; showProductCount: boolean; collections: NonNullable<RenderContext["collections"]>; sfProps: { "data-sf-section"?: string } }) {
  const { feature, span } = editorialPlan(collections.length);
  return (
    <section className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <EditorialHeader eyebrow="The collections" title={title} href="/collections" />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-12">
        {collections.map((col, i) => {
          const isFeature = feature && i === 0;
          const img = publicImageUrl(col.image_path);
          const stacked = feature && collections.length === 3 && i > 0;
          return (
            <li key={col.slug || col.id} className={cn("min-w-0", span, isFeature && "col-span-2 lg:row-span-2")}>
              <Link href={`/collections/${col.slug}`} className="group flex h-full flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                <div className={cn("relative w-full overflow-hidden bg-muted", RADIUS, isFeature ? "aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem] lg:flex-1" : stacked ? "aspect-[3/4] lg:aspect-[16/9]" : "aspect-[3/4]")}>
                  {img ? <Image src={img} alt={col.name} fill sizes={isFeature ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]" /> : <EditorialArt name={col.name} index={i} large={isFeature} />}
                  <span aria-hidden className="pointer-events-none absolute inset-3 border border-white/0 transition-colors duration-500 group-hover:border-white/70 sm:inset-4" />
                  <span aria-hidden className="absolute top-3 left-3 text-xs tracking-[0.2em] text-white mix-blend-difference sm:top-4 sm:left-4">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className={cn("leading-tight tracking-tight text-foreground", isFeature ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>{col.name}</h3>
                    {showProductCount && typeof col.product_count === "number" ? <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{col.product_count} {col.product_count === 1 ? "piece" : "pieces"}</p> : null}
                  </div>
                  <ArrowUpRight className="mt-1 size-5 shrink-0 text-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" strokeWidth={1.25} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
