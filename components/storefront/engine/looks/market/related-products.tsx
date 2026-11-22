import { cn } from "@/lib/utils";
import { HIDEABLE_SECTION, isHiddenFor, presentationOf } from "@/lib/templates/product-presentation";
import { type CardProduct } from "../../ui";
import type { ProductDetailData } from "../../types";
import type { SectionProps } from "..";
import { MarketShelf } from "./featured-collection";
import { PANEL, PanelHeader, WRAP } from "./ui";
import { readCardParts } from "@/lib/templates/card-parts";

/** Market "more from ..." shelf. Same selection rules as the engine related products: only products that share this product collection or category. */
export function MarketRelatedProducts({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const current = context.resource as (ProductDetailData & { related?: CardProduct[] }) | undefined;
  const heading = (node.settings?.heading as string) ?? "You may also like";
  const productsToShow = (node.settings?.productsToShow as number) ?? 8;
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
  const related = pool.slice(0, Math.max(productsToShow, 8));
  // A product can hide its related products (per-product presentation).
  if (isHiddenFor(presentationOf(current), HIDEABLE_SECTION)) return null;
  if (related.length === 0 && !isPreview) return null;

  if (related.length === 0) {
    return (
      <section className={cn(WRAP, "py-2")} {...sfProps}>
        <div className={PANEL}>
          <PanelHeader title={heading} />
          <p className="p-4 text-xs italic text-muted-foreground">Products from the same collection or category appear here.</p>
        </div>
      </section>
    );
  }
  return <MarketShelf title={heading} href="/products" products={related} currency={store.currency ?? "INR"} sfProps={sfProps} parts={readCardParts(node.settings, false)} />;
}
