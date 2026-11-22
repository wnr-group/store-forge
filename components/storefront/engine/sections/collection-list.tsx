import React from "react";
import { ArrowUpRight, Leaf } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";
import { CONTAINER, EditorialArt, EditorialHeader, ImagePlaceholder, RADIUS, SECTION_Y, SectionHeading } from "../ui";
import { cn } from "@/lib/utils";
import { readCollectionCardParts, type CollectionCardParts } from "@/lib/templates/card-parts";
import { isEditorialTheme, isGroceryTheme, isHomeTheme } from "@/lib/templates/engine/theme-style";

interface CollectionListSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** Collections as tall picture cards with the name over the picture: two per row on phones, up to `columns` on desktop. */
export function CollectionListSection({ node, context, sectionId }: CollectionListSectionProps) {
  const title = (node.settings?.title as string) ?? "Collections";
  const columns = (node.settings?.columns as number) ?? 3;
  // What each card shows is the merchant's choice; the product count keeps its own setting.
  const parts = readCollectionCardParts(node.settings, true);
  const showProductCount = parts.count;
  const collections = context.collections ?? [];

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  // Atelier (serif headings, square buttons) always gets the editorial layout, including stores that applied it before the layout setting existed.
  const isAtelier = isEditorialTheme(context.theme);
  const chosen = node.settings?.layout;
  const layout = chosen === "grid" || chosen === "editorial" ? chosen : isAtelier ? "editorial" : "grid";
  if (layout === "editorial" && collections.length > 0) {
    return <EditorialCollections title={title} showProductCount={showProductCount} parts={parts} collections={collections} sfProps={sfProps} />;
  }

  // Haven (home & furniture) gets arched room cards with a staggered rhythm.
  if (isHomeTheme(context.theme) && chosen !== "grid" && chosen !== "editorial" && collections.length > 0) {
    return <RoomCollections title={title} showProductCount={showProductCount} parts={parts} columns={columns} collections={collections} sfProps={sfProps} />;
  }

  // Freshly (grocery) gets compact tinted tiles with a round picture, built for scanning many categories at a glance.
  if (isGroceryTheme(context.theme) && chosen !== "grid" && chosen !== "editorial" && collections.length > 0) {
    return <GroceryCategories title={title} showProductCount={showProductCount} parts={parts} collections={collections} sfProps={sfProps} />;
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
                <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className={cn("group relative block aspect-[4/5] overflow-hidden sm:aspect-[4/3] lg:aspect-[5/6] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", RADIUS)}>
                  {img && parts.image ? <Image src={img} alt={col.name} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep />}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white sm:p-5">
                    {parts.title ? <span className="text-base leading-tight font-medium sm:text-xl">{col.name}</span> : null}
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
function EditorialCollections({ title, showProductCount, parts, collections, sfProps }: { title: string; showProductCount: boolean; parts: CollectionCardParts; collections: NonNullable<RenderContext["collections"]>; sfProps: { "data-sf-section"?: string } }) {
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
              <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className="group flex h-full flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                <div className={cn("relative w-full overflow-hidden bg-muted", RADIUS, isFeature ? "aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem] lg:flex-1" : stacked ? "aspect-[3/4] lg:aspect-[16/9]" : "aspect-[3/4]")}>
                  {img && parts.image ? <Image src={img} alt={col.name} fill sizes={isFeature ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]" /> : <EditorialArt name={col.name} index={i} large={isFeature} />}
                  <span aria-hidden className="pointer-events-none absolute inset-3 border border-white/0 transition-colors duration-500 group-hover:border-white/70 sm:inset-4" />
                  <span aria-hidden className="absolute top-3 left-3 text-xs tracking-[0.2em] text-white mix-blend-difference sm:top-4 sm:left-4">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {parts.title ? <h3 className={cn("leading-tight tracking-tight text-foreground", isFeature ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>{col.name}</h3> : null}
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

/** Soft fruit-and-vegetable tints the tiles cycle through. All are light enough for dark text at 4.5:1 or better. */
const GROCERY_TINTS = ["#e7f5ea", "#ffefdc", "#fff6cc", "#fde5e1", "#eaf4d3", "#e2f3ee"];

/**
 * Grocery layout: a heading row with a "View all" pill, then tinted rounded tiles (2 per row on phones, 3 on tablets, 6 on desktop).
 * Each tile has a round picture on a white ring, the bold name and an item count; hover lifts the tile and nudges the arrow.
 */
function GroceryCategories({ title, showProductCount, parts, collections, sfProps }: { title: string; showProductCount: boolean; parts: CollectionCardParts; collections: NonNullable<RenderContext["collections"]>; sfProps: { "data-sf-section"?: string } }) {
  return (
    <section className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Leaf className="size-4" aria-hidden />
            Fresh aisles
          </p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">{title}</h2>
        </div>
        <Link href="/collections" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          View all
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {collections.map((col, i) => {
          const img = publicImageUrl(col.image_path);
          return (
            <li key={col.slug || col.id} className="min-w-0">
              <Link
                href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id}
                style={{ backgroundColor: GROCERY_TINTS[i % GROCERY_TINTS.length] }}
                className="group relative isolate flex h-full transform-gpu flex-col items-center rounded-3xl px-3 pb-4 pt-5 text-center outline-none ring-1 ring-black/5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {/* The lift shadow fades in on its own layer: animating box-shadow itself repaints every frame and looks choppy. */}
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-0 shadow-[0_22px_34px_-18px_rgba(20,35,26,0.4)] transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                <span className="relative isolate block aspect-square w-full max-w-[8.5rem] transform-gpu overflow-hidden rounded-full bg-white shadow-[0_8px_20px_-10px_rgba(20,35,26,0.4)] ring-4 ring-white">
                  {img && parts.image ? <Image src={img} alt="" fill sizes="(min-width: 1024px) 140px, 40vw" className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.08] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep />}
                </span>
                {parts.title ? <span className="mt-4 block text-[15px] font-bold leading-tight text-foreground">{col.name}</span> : null}
                <span className="mt-1.5 inline-flex min-h-6 items-center gap-1 text-xs font-medium text-foreground/70">
                  {showProductCount && typeof col.product_count === "number" ? `${col.product_count} ${col.product_count === 1 ? "item" : "items"}` : "Shop now"}
                  <ArrowUpRight className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Desktop spans (12-column grid, fixed row height) for each room, and whether the first is a large feature. */
function roomPlan(count: number, index: number): string {
  if (count === 1) return "lg:col-span-12 lg:row-span-2";
  if (count === 2) return "lg:col-span-6 lg:row-span-2";
  if (count === 3) return index === 0 ? "lg:col-span-6 lg:row-span-2" : "lg:col-span-6";
  if (count === 4) return index === 0 ? "lg:col-span-6 lg:row-span-2" : index === 3 ? "lg:col-span-6" : "lg:col-span-3";
  if (count === 5) return index === 0 ? "lg:col-span-6 lg:row-span-2" : "lg:col-span-3";
  return "lg:col-span-4 lg:row-span-2";
}

/**
 * Room layout: a gallery of large photo tiles. The first room is a big feature beside smaller ones (a plain even grid from six
 * rooms up), with the room name over the picture, a thin frame that draws in on hover and an arrow that rises into view.
 * Only `transform` and `opacity` animate, so it stays smooth.
 */
function RoomCollections({ title, showProductCount, parts, collections, sfProps }: { title: string; showProductCount: boolean; parts: CollectionCardParts; columns: number; collections: NonNullable<RenderContext["collections"]>; sfProps: { "data-sf-section"?: string } }) {
  const count = collections.length;
  const feature = (i: number) => i === 0 && count >= 3 && count <= 5;
  return (
    <section className={cn(CONTAINER, SECTION_Y)} {...sfProps}>
      <div className="mb-8 flex items-end justify-between gap-6 sm:mb-12">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-accent">Room by room</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-[1.1] tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl">{title}</h2>
        </div>
        <Link href="/collections" className="group/all hidden shrink-0 items-center gap-2 border-b border-foreground/30 pb-1 text-sm font-medium text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:inline-flex">
          All rooms
          <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12 lg:auto-rows-[15rem] lg:gap-5 xl:auto-rows-[17rem]">
        {collections.map((col, i) => {
          const img = publicImageUrl(col.image_path);
          const big = feature(i) || count <= 2;
          return (
            <li key={col.slug || col.id} className={cn("min-w-0", feature(i) && "col-span-2", roomPlan(count, i))}>
              <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className="group relative isolate block aspect-[4/5] size-full transform-gpu overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 sm:aspect-[4/3] lg:aspect-auto">
                {img && parts.image ? <Image src={img} alt="" fill sizes={big ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.06] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" icon={false} deep />}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span aria-hidden className="pointer-events-none absolute inset-3 rounded-md border border-white/0 transition-colors duration-500 group-hover:border-white/60 sm:inset-4 motion-reduce:transition-none" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-6">
                  <span className="min-w-0">
                    {showProductCount && typeof col.product_count === "number" ? <span className="block text-xs tracking-wide text-white/80">{col.product_count} {col.product_count === 1 ? "piece" : "pieces"}</span> : null}
                    {parts.title ? <span className={cn("mt-0.5 block font-semibold leading-tight tracking-tight", big ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>{col.name}</span> : null}
                  </span>
                  <span aria-hidden className="flex size-10 shrink-0 translate-y-1 items-center justify-center rounded-full bg-white text-neutral-950 opacity-90 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none sm:size-11">
                    <ArrowUpRight className="size-5" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
