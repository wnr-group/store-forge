import Link from "next/link";
import { resolveCollection } from "@/lib/storefront/featured";
import { cn } from "@/lib/utils";
import { EmptyProducts, SECTION_Y, gridColumns, type CardProduct } from "../../ui";
import { SHELL } from "./shell";
import type { SectionProps } from "..";
import { DisplayHeading, Eyebrow } from "./eyebrow";
import { BoutiqueProductCard } from "./product-card";

/**
 * Boutique product row. Products come from the chosen collection, or the store's newest active products when none is
 * chosen, exactly like the standard section. `tone: dark` lays the row on the theme's primary colour (the "new arrivals" band).
 */
export function BoutiqueFeaturedCollection({ node, context, sectionId }: SectionProps) {
  const store = context.store;
  const eyebrow = (node.settings?.eyebrow as string) ?? "";
  const title = (node.settings?.title as string) ?? "Featured";
  const chosen = (node.settings?.collectionId as string) ?? "";
  const productsToShow = (node.settings?.productsToShow as number) ?? 4;
  const columns = (node.settings?.columns as number) ?? 4;
  const showViewAll = Boolean(node.settings?.showViewAll ?? true);
  const tone = node.settings?.tone === "dark" ? "dark" : "light";
  const dark = tone === "dark";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const matched = resolveCollection(chosen, context.collections);
  const picked = chosen.trim().length > 0;
  const source: CardProduct[] = picked ? (matched ? (context.collectionProducts?.[matched.slug] ?? []) : []) : ((store.products ?? []) as CardProduct[]);
  const products = source.slice(0, productsToShow);
  const currency = store.currency ?? "INR";
  const viewAllHref = matched ? `/collections/${matched.slug}` : "/products";

  if (products.length === 0 && picked && !isPreview) return null;

  return (
    <section className={cn(dark && "bg-primary text-primary-foreground")} {...sfProps}>
      <div className={cn(SHELL, dark ? "py-14 md:py-16" : SECTION_Y)}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
          <div className="space-y-3">
            <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
            <DisplayHeading tone={tone}>{title}</DisplayHeading>
          </div>
          {showViewAll && products.length > 0 ? (
            <Link
              href={viewAllHref}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-5 text-[13px] font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                dark ? "border-white/35 text-white hover:bg-white hover:text-primary focus-visible:outline-white" : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground focus-visible:outline-primary",
              )}
            >
              View all
            </Link>
          ) : null}
        </div>
        {products.length === 0 ? (
          <EmptyProducts mode={context.mode} />
        ) : (
          <ul className={cn("grid gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6", gridColumns(columns))}>
            {products.map((p, i) => (
              <li key={p.slug} className="min-w-0">
                <BoutiqueProductCard product={p} currency={currency} href={`/products/${p.slug}`} tone={tone} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
