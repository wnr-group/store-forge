import { cn } from "@/lib/utils";
import { EmptyProducts, type CardProduct } from "../../ui";
import type { SectionProps } from "..";
import { SportListing } from "./listing";
import { SHELL } from "./ui";
import { readCardParts } from "@/lib/templates/card-parts";

/** Sport product listing section: every product of the store (or of the collection being shown) with filters, search and sort. */
export function SportProductGrid({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const resource = context.resource as { slug?: string; products?: CardProduct[] } | undefined;
  const products = resource?.products ?? (store.products as CardProduct[] | undefined) ?? [];
  const columns = (node.settings?.columns as number) ?? 4;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const linked = context.linkCards === true || (context.basePath !== undefined && context.basePath !== null);

  return (
    <section id="products" className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-10")} {...sfProps}>
      {products.length === 0 ? (
        <EmptyProducts mode={context.mode} title={resource ? "Nothing in this collection yet" : undefined} />
      ) : (
        <SportListing parts={readCardParts(node.settings, true)} products={products} currency={store.currency ?? "INR"} columns={columns} basePath={String(context.basePath ?? "")} linked={linked} collections={(context.collections ?? []).map((c) => ({ slug: c.slug, name: c.name }))} activeCollection={resource?.slug ?? null} />
      )}
    </section>
  );
}
