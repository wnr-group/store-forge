import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { readCollectionCardParts } from "@/lib/templates/card-parts";
import { ImagePlaceholder } from "../../ui";
import type { SectionProps } from "..";
import { PANEL, PanelHeader, TILE_COLOURS, WRAP } from "./ui";

const CARD_COLS: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7", 8: "lg:grid-cols-8" };

/**
 * Market collections, in two layouts chosen by the section's Layout setting:
 *  - Automatic: a row of small category tiles (a picture or a coloured initial, and the name), with no heading, like the strip
 *    of department shortcuts under the marketplace hero.
 *  - Grid / Editorial: a white panel with a title and "See all", and larger square pictures with the name underneath.
 */
export function MarketCollectionList({ node, context, sectionId }: SectionProps) {
  const title = (node.settings?.title as string) ?? "";
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const columns = (node.settings?.columns as number) ?? 6;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);
  const parts = readCollectionCardParts(node.settings, false);
  const showCount = parts.count;
  const tiles = node.settings?.layout !== "grid" && node.settings?.layout !== "editorial";
  const all = context.collections ?? [];
  const collections = tiles ? all : all.slice(0, 16);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (collections.length === 0 && !isPreview) return null;

  if (collections.length === 0) {
    return (
      <section className={cn(WRAP, "py-2")} {...sfProps}>
        <p className={cn(PANEL, "border-dashed py-10 text-center text-sm text-muted-foreground")}>Create collections and they appear here.</p>
      </section>
    );
  }

  if (tiles) {
    return (
      <section aria-label={title || "Categories"} className={cn(WRAP, "py-2")} {...sfProps}>
        {title ? <h2 className="mb-2 text-base font-bold text-primary">{title}</h2> : null}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {collections.map((col, i) => {
            const img = publicImageUrl(col.image_path);
            return (
              <li key={col.slug || col.id} className="min-w-0">
                <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className="group flex h-full flex-col items-center gap-2 rounded-lg border border-border/80 bg-white p-2.5 shadow-sm transition-all hover:border-secondary/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary">
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg text-[15px] font-bold text-white" style={{ background: TILE_COLOURS[i % TILE_COLOURS.length] }}>
                    {img && parts.image ? <Image src={img} alt="" fill sizes="44px" className="object-cover" /> : col.name.slice(0, 1).toUpperCase()}
                  </span>
                  {parts.title ? <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-primary group-hover:text-secondary">{col.name}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className={cn(WRAP, "py-2")} {...sfProps}>
      <div className={PANEL}>
        <PanelHeader title={title || "Shop by category"} subtitle={eyebrow || undefined} href={showViewAll ? "/collections" : null} />
        <ul className={cn("grid grid-cols-3 gap-3 p-3 sm:grid-cols-4", CARD_COLS[Math.min(8, Math.max(2, columns * 2))] ?? "lg:grid-cols-6")}>
          {collections.map((col) => {
            const img = publicImageUrl(col.image_path);
            const count = showCount && typeof col.product_count === "number" ? `${col.product_count} ${col.product_count === 1 ? "item" : "items"}` : null;
            return (
              <li key={col.slug || col.id} className="min-w-0">
                <Link href={`/collections/${col.slug}`} data-sf-card="" data-sf-collection={col.id} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
                  <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-white transition-colors group-hover:border-secondary">
                    {img && parts.image ? <Image src={img} alt="" fill sizes="(min-width: 1024px) 16vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" />}
                  </span>
                  {parts.title ? <span className="mt-1.5 block text-[13px] font-semibold text-primary group-hover:text-secondary">{col.name}</span> : null}
                  {count ? <span className="block text-xs text-muted-foreground">{count}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
