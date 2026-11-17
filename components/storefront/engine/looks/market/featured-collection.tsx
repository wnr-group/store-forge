import { Zap } from "lucide-react";
import { resolveCollection } from "@/lib/storefront/featured";
import { cn } from "@/lib/utils";
import { EmptyProducts, type CardProduct } from "../../ui";
import type { SectionProps } from "..";
import { MarketProductCard } from "./product-card";
import { PANEL, PanelHeader, WRAP } from "./ui";

/** A horizontally scrolling row of product cards on a white panel with a title and "See all": the marketplace "shelf". */
export function MarketShelf({ title, subtitle, href, products, currency, deal, sfProps }: { title: string; subtitle?: string; href?: string | null; products: CardProduct[]; currency: string; deal?: boolean; sfProps?: { "data-sf-section"?: string } }) {
  return (
    <section className={cn(WRAP, "py-2")} {...sfProps}>
      <div className={cn(PANEL, deal && "border-accent/30 bg-accent/[0.06]")}>
        <PanelHeader title={title} subtitle={subtitle} href={href} leading={deal ? <Zap className="size-4 text-accent" aria-hidden /> : null} />
        <div className="p-3">
          <ul className="flex snap-x gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {products.map((p, i) => (
              <li key={p.slug} className="w-[172px] shrink-0 snap-start sm:w-[196px]">
                <MarketProductCard product={p} currency={currency} href={`/products/${p.slug}`} priority={i < 4} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Market product row. Products come from the chosen collection, or the store's newest active products when none is chosen.
 * The "dark" tone is the highlighted deal shelf (an orange tint and a bolt).
 */
export function MarketFeaturedCollection({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const title = (node.settings?.title as string) ?? "Featured";
  const chosen = (node.settings?.collectionId as string) ?? "";
  const productsToShow = (node.settings?.productsToShow as number) ?? 8;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);
  const deal = node.settings?.tone === "dark";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const matched = resolveCollection(chosen, context.collections);
  const picked = chosen.trim().length > 0;
  const source: CardProduct[] = picked ? (matched ? (context.collectionProducts?.[matched.slug] ?? []) : []) : ((store.products ?? []) as CardProduct[]);
  const products = source.slice(0, productsToShow);
  if (products.length === 0 && picked && !isPreview) return null;

  if (products.length === 0) {
    return (
      <section className={cn(WRAP, "py-2")} {...sfProps}>
        <div className={PANEL}>
          <PanelHeader title={title} subtitle={eyebrow || undefined} />
          <div className="p-3">
            <EmptyProducts mode={context.mode} />
          </div>
        </div>
      </section>
    );
  }
  return <MarketShelf title={title} subtitle={eyebrow || undefined} href={showViewAll ? (matched ? `/collections/${matched.slug}` : "/products") : null} products={products} currency={store.currency ?? "INR"} deal={deal} sfProps={sfProps} />;
}
