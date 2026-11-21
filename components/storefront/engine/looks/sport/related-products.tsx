import { cn } from "@/lib/utils";
import { readCardParts } from "@/lib/templates/card-parts";
import { gridColumns, type CardProduct } from "../../ui";
import type { ProductDetailData } from "../../types";
import type { SectionProps } from "..";
import { rise } from "./reveal";
import { SHELL, SportTitle, ViewAll } from "./ui";
import { SportProductCard } from "./product-card";

/** Sport "more from ..." row. Same selection rules as the engine's related products: only products that share this product's collection or category. */
export function SportRelatedProducts({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const current = context.resource as (ProductDetailData & { related?: CardProduct[] }) | undefined;
  const heading = (node.settings?.heading as string) ?? "You may also like";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;
  const parts = readCardParts(node.settings, true);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

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
  if (related.length === 0 && !isPreview) return null;

  return (
    <section className={cn(SHELL, "border-t border-border py-12 md:py-16")} {...sfProps}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SportTitle italic={false} className="[&_h2]:text-[2rem] md:[&_h2]:text-[2.5rem]">
          {heading}
        </SportTitle>
        {related.length > 0 ? <ViewAll href="/products" /> : null}
      </div>
      {related.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Products from the same collection or category appear here.</p>
      ) : (
        <ul className={cn("grid gap-x-4 gap-y-9 sm:gap-x-6", gridColumns(columns))}>
          {related.map((p, i) => (
            <li key={p.slug} className="min-w-0" {...rise(i % 4)}>
              <SportProductCard product={p} currency={store.currency ?? "INR"} href={`/products/${p.slug}`} parts={parts} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
