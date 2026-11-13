import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { CONTAINER, EmptyProducts, GRID_GAP, ProductCard, type CardProduct } from "../ui";
import { cn } from "@/lib/utils";
import { LegacyProductGridSection } from "./legacy-product-grid";
import { hasTheme } from "@/lib/templates/engine/theme-style";

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
  const linked = context.linkCards === true || (context.basePath !== undefined && context.basePath !== null);
  const basePath = context.basePath ?? "";

  if (products.length === 0) {
    return (
      <section className={cn(CONTAINER, "py-12")} {...sfProps}>
        <EmptyProducts mode={context.mode} title={collectionResource ? "Nothing in this collection yet" : undefined} />
      </section>
    );
  }

  return (
    <section className={cn(CONTAINER, "pt-8 pb-12 sm:pt-10 sm:pb-16 lg:pb-24")} {...sfProps}>
      <ul className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", GRID_GAP)}>
        {products.map((p, i) => (
          <li key={p.slug}>
            <ProductCard product={p} currency={store.currency ?? "INR"} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} accent={accent} priority={i < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
