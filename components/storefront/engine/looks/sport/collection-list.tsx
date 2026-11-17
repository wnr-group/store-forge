import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { ImagePlaceholder } from "../../ui";
import type { SectionProps } from "..";
import { BAND_Y, HEADLINE_FONT, SHELL, SportEyebrow, SportTitle, ViewAll } from "./ui";

const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};
const colClass = (columns: number, count: number) => COLS[Math.min(6, Math.max(2, Math.min(columns, Math.max(2, count))))] ?? COLS[4];

/**
 * Sport collections, in three layouts chosen by the section's Layout setting:
 *  - Automatic: compact rounded tiles with the name and an arrow ("Explore the range").
 *  - Grid: tall picture cards with the name in slanted capitals over the picture ("Shop by category").
 *  - Editorial: staggered square pictures with a ruled caption and arrow, on a tinted band.
 */
export function SportCollectionList({ node, context, sectionId }: SectionProps) {
  const title = (node.settings?.title as string) ?? "Collections";
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const columns = (node.settings?.columns as number) ?? 4;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);
  const showCount = Boolean(node.settings?.showProductCount ?? false);
  const layout = node.settings?.layout === "grid" ? "overlay" : node.settings?.layout === "editorial" ? "editorial" : "compact";
  const all = context.collections ?? [];
  // The big-card and editorial layouts are a short, featured selection: as many cards as columns. Compact shows every collection.
  const collections = layout === "compact" ? all : all.slice(0, Math.min(6, Math.max(2, columns)));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  if (collections.length === 0 && !isPreview) return null;
  const editorial = layout === "editorial";

  return (
    <section className={cn(editorial && "bg-[var(--surface)]")} {...sfProps}>
      <div className={cn(SHELL, BAND_Y)}>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-12">
          <div className="space-y-4">
            <SportEyebrow>{eyebrow}</SportEyebrow>
            <SportTitle italic={!editorial} bar={!editorial}>
              {title}
            </SportTitle>
          </div>
          {showViewAll && collections.length > 0 ? <ViewAll href="/collections">{editorial ? "Shop everything" : "View all"}</ViewAll> : null}
        </div>

        {collections.length === 0 ? (
          <p className="rounded-[1rem] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Create collections and they appear here.</p>
        ) : (
          <ul className={cn("grid", layout === "compact" ? "gap-x-4 gap-y-8 sm:gap-x-6" : layout === "overlay" ? "gap-x-5 gap-y-9 sm:gap-x-6" : "gap-x-5 gap-y-10 sm:gap-x-6", colClass(layout === "compact" ? Math.max(columns, 6) : columns, collections.length))}>
            {collections.map((col, i) => {
              const img = publicImageUrl(col.image_path);
              const href = `/collections/${col.slug}`;
              const link = "group block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
              const count = showCount && typeof col.product_count === "number" ? `${col.product_count} ${col.product_count === 1 ? "piece" : "pieces"}` : null;
              if (layout === "overlay") {
                return (
                  <li key={col.slug || col.id} className="min-w-0">
                    <Link href={href} className={link}>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--surface)]">
                        {img ? <Image src={img} alt="" fill priority={i < 4} sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" />}
                        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/65 to-transparent" />
                        <p className="absolute inset-x-6 bottom-6 text-balance text-[1.5rem] font-extrabold uppercase italic leading-none tracking-[-0.02em] text-white sm:text-[1.875rem]" style={HEADLINE_FONT}>
                          {col.name}
                        </p>
                      </div>
                      <p className="mt-3.5 inline-flex items-center gap-2 px-1 text-[15px] font-medium text-primary">
                        Shop now <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
                      </p>
                    </Link>
                  </li>
                );
              }
              if (layout === "editorial") {
                return (
                  <li key={col.slug || col.id} className={cn("min-w-0", i % 2 === 1 && "lg:mt-10")}>
                    <Link href={href} className={link}>
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        {img ? <Image src={img} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" />}
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t-2 border-primary pt-3.5">
                        <p className="text-[15px] font-bold uppercase tracking-[0.02em] text-primary">
                          {col.name}
                          {count ? <span className="ml-2 font-medium normal-case tracking-normal text-muted-foreground">{count}</span> : null}
                        </p>
                        <ArrowRight className="size-5 shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden />
                      </div>
                    </Link>
                  </li>
                );
              }
              return (
                <li key={col.slug || col.id} className="min-w-0">
                  <Link href={href} className={link}>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-[var(--surface)]">
                      {img ? <Image src={img} alt="" fill priority={i < 6} sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] motion-reduce:transition-none" /> : <ImagePlaceholder className="absolute inset-0" />}
                    </div>
                    <p className="mt-3.5 flex items-center justify-between gap-2 px-1.5 text-[17px] font-semibold text-primary">
                      <span className="truncate">{col.name}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} aria-hidden />
                    </p>
                    {count ? <p className="px-1.5 text-[13px] text-muted-foreground">{count}</p> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
