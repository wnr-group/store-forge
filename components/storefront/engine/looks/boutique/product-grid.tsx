import { cn } from "@/lib/utils";
import { EmptyProducts, SECTION_Y, type CardProduct } from "../../ui";
import { SHELL } from "./shell";
import type { SectionProps } from "..";
import { DisplayHeading, Eyebrow } from "./eyebrow";
import { SortableGrid } from "./sortable-grid";

/** Boutique product listing: every product of the store, or of the collection being shown, with sorting. */
export function BoutiqueProductGrid({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const collection = context.resource as { name?: string; products?: CardProduct[] } | undefined;
  const products = collection?.products ?? (store.products as CardProduct[] | undefined) ?? [];
  const columns = (node.settings?.columns as number) ?? 4;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const linked = context.linkCards === true || (context.basePath !== undefined && context.basePath !== null);

  return (
    <section id="products" className={cn(SHELL, collection ? "pt-8 pb-16 md:pb-24" : SECTION_Y)} {...sfProps}>
      {collection ? null : (
        <div className="mb-8 space-y-3 md:mb-10">
          <Eyebrow>The collection</Eyebrow>
          <DisplayHeading>All products</DisplayHeading>
        </div>
      )}
      {products.length === 0 ? (
        <EmptyProducts mode={context.mode} title={collection ? "Nothing in this collection yet" : undefined} />
      ) : (
        <SortableGrid products={products} currency={store.currency ?? "INR"} columns={columns} basePath={String(context.basePath ?? "")} linked={linked} />
      )}
    </section>
  );
}
