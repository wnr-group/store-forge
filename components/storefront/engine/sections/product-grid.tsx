import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { CONTAINER, EmptyProducts, GRID_GAP, GroceryProductCard, ProductCard, gridColumns, type CardProduct } from "../ui";
import { cn } from "@/lib/utils";
import { readCardParts } from "@/lib/templates/card-parts";
import { LegacyProductGridSection } from "./legacy-product-grid";
import { hasTheme, isGroceryTheme } from "@/lib/templates/engine/theme-style";

interface ProductGridSectionProps {
  node: ComponentNode;
  context: RenderContext;
  sectionId?: string;
}

/** Every product of the store (or of the collection being shown), in a responsive grid. */
export function ProductGridSection({ node, context, sectionId }: ProductGridSectionProps) {
  // No theme applied: the store keeps its built-in template, whose markup must not change.
  if (!hasTheme(context.theme)) return <LegacyProductGridSection node={node} context={context} sectionId={sectionId} />;
  const store = context.store;
  const accent = (node.settings?.accentColor as string) || null;
  const collectionResource = context.resource as { products?: CardProduct[] } | undefined;
  const products = collectionResource?.products ?? (store.products as CardProduct[] | undefined) ?? [];

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const parts = readCardParts(node.settings, false);
  const linked = context.linkCards === true || (context.basePath !== undefined && context.basePath !== null);
  const basePath = context.basePath ?? "";

  if (products.length === 0) {
    return (
      <section className={cn(CONTAINER, "py-12")} {...sfProps}>
        <EmptyProducts mode={context.mode} title={collectionResource ? "Nothing in this collection yet" : undefined} />
      </section>
    );
  }

  // Freshly (grocery): a heading row with the item count, then the same dense white cards as the trending section.
  if (isGroceryTheme(context.theme)) {
    const columns = (node.settings?.columns as number) ?? 6;
    const currency = store.currency ?? "INR";
    return (
      <section id="all-products" className={cn(CONTAINER, "py-12 sm:py-16 lg:py-20")} {...sfProps}>
        {collectionResource ? null : (
          <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{products.length} {products.length === 1 ? "item" : "items"}</p>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">All products</h2>
            </div>
          </div>
        )}
        <ul className={cn("grid gap-3 sm:gap-4", gridColumns(columns))}>
          {products.map((p, i) => (
            <li key={p.slug} className="min-w-0">
              <GroceryProductCard product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} priority={i < 6} parts={parts} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className={cn(CONTAINER, "pt-8 pb-12 sm:pt-10 sm:pb-16 lg:pb-24")} {...sfProps}>
      <ul className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", GRID_GAP)}>
        {products.map((p, i) => (
          <li key={p.slug}>
            <ProductCard product={p} currency={store.currency ?? "INR"} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} accent={accent} priority={i < 4} parts={parts} />
          </li>
        ))}
      </ul>
    </section>
  );
}
