import { resolveCollection } from "@/lib/storefront/featured";
import { cn } from "@/lib/utils";
import { EmptyProducts, gridColumns, type CardProduct } from "../../ui";
import type { SectionProps } from "..";
import { BAND_Y, SHELL, SportEyebrow, SportTitle, ViewAll } from "./ui";
import { rise } from "./reveal";
import { SportProductCard } from "./product-card";

/**
 * Sport product row ("Our new launches"). Products come from the chosen collection, or the store's newest active products when
 * none is chosen. Light tone is a tinted band, dark tone is a navy band.
 */
export function SportFeaturedCollection({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const title = (node.settings?.title as string) ?? "Featured";
  const chosen = (node.settings?.collectionId as string) ?? "";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);
  const dark = node.settings?.tone === "dark";
  const tone = dark ? "dark" : "light";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const matched = resolveCollection(chosen, context.collections);
  const picked = chosen.trim().length > 0;
  const source: CardProduct[] = picked ? (matched ? (context.collectionProducts?.[matched.slug] ?? []) : []) : ((store.products ?? []) as CardProduct[]);
  const products = source.slice(0, productsToShow);
  const currency = store.currency ?? "INR";
  if (products.length === 0 && picked && !isPreview) return null;

  return (
    <section className={cn(dark ? "bg-primary text-primary-foreground" : "bg-[var(--surface)]")} {...sfProps}>
      <div className={cn(SHELL, BAND_Y)}>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-12">
          <div className="space-y-4">
            <SportEyebrow tone={dark ? "light" : "dark"}>{eyebrow}</SportEyebrow>
            <SportTitle tone={dark ? "light" : "dark"}>{title}</SportTitle>
          </div>
          {showViewAll && products.length > 0 ? <ViewAll href={matched ? `/collections/${matched.slug}` : "/products"} tone={dark ? "light" : "dark"} /> : null}
        </div>
        {products.length === 0 ? (
          <EmptyProducts mode={context.mode} />
        ) : (
          <ul className={cn("grid gap-x-4 gap-y-9 sm:gap-x-6", gridColumns(columns))}>
            {products.map((p, i) => (
              <li key={p.slug} className="min-w-0" {...rise(i)}>
                <SportProductCard product={p} currency={currency} href={`/products/${p.slug}`} tone={tone} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
