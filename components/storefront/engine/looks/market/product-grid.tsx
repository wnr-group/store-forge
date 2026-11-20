import { cn } from "@/lib/utils";
import { EmptyProducts, type CardProduct } from "../../ui";
import type { SectionProps } from "..";
import { MarketListing } from "./listing";
import { WRAP } from "./ui";
import { readCardParts } from "@/lib/templates/card-parts";

/** Market product listing section: every product of the store (or of the collection being shown) with filters, sort and a grid or list view. */
export function MarketProductGrid({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const resource = context.resource as { slug?: string; products?: CardProduct[] } | undefined;
  const products = resource?.products ?? (store.products as CardProduct[] | undefined) ?? [];
  const columns = (node.settings?.columns as number) ?? 4;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const linked = context.linkCards === true || (context.basePath !== undefined && context.basePath !== null);

  return (
    <section id="products" className={cn(WRAP, "pb-10 pt-4")} {...sfProps}>
      {products.length === 0 ? (
        <EmptyProducts mode={context.mode} title={resource ? "Nothing in this collection yet" : undefined} />
      ) : (
        <MarketListing gridParts={readCardParts(node.settings, false)} listParts={readCardParts(node.settings, true)} products={products} currency={store.currency ?? "INR"} columns={columns} basePath={String(context.basePath ?? "")} linked={linked} collections={(context.collections ?? []).map((c) => ({ slug: c.slug, name: c.name }))} activeCollection={resource?.slug ?? null} />
      )}
    </section>
  );
}
