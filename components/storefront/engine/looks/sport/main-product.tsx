"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AddToBag } from "@/components/storefront/cart/add-to-bag";
import { formatBagPrice } from "@/lib/cart/format";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import type { ProductDetailData, RenderContext } from "../../types";
import type { SectionProps } from "..";
import { SportProductGallery } from "./product-gallery";
import { SHELL } from "./ui";

/**
 * Sport product page, laid out like the LESPARO one: breadcrumb, a sticky gallery (thumbnail rail, big rounded picture, hover
 * arrows, full-screen zoom) beside the details, which rise in on load. The details are the theme's product blocks, then Add to
 * bag, a "Key highlights" list and the collapsible info blocks in one rounded card. The chosen options are shared by the
 * option picker, the price and Add to bag. Phones get a bar with the price and a Buy now shortcut.
 */
export function SportMainProduct({ node, context, sectionId }: SectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries((product?.options ?? []).filter((o) => o.values.length > 0).map((o) => [o.name, o.values[0]])));
  const ctx: RenderContext = { ...context, selectedOptions: chosen, onSelectOption: (option: string, value: string) => setChosen((prev) => ({ ...prev, [option]: value })) };

  const matched = product?.variants ? resolveVariant(product.variants, chosen) : undefined;
  const gallery = [...new Set([product?.image_path, ...(product?.images ?? [])].filter((p): p is string => Boolean(p)))];
  const shownPath = matched?.image_path ?? picked ?? gallery[0] ?? null;
  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const currency = context.store.currency ?? "INR";

  const info = blockOrder.filter((id) => blocks[id]?.type === "collapsible-info");
  const rest = blockOrder.filter((id) => blocks[id]?.type !== "collapsible-info");
  const soldOut = product?.available === false;

  // Only facts the product holds; a row with no value is left out.
  const highlights = [
    { label: "Category", value: product?.category },
    { label: "Product type", value: product?.type },
    { label: "Reference", value: product?.sku },
    { label: "Part number", value: typeof product?.part_number === "string" ? product.part_number : null },
    { label: "Availability", value: product ? (soldOut ? "Sold out" : "In stock") : null },
  ].filter((h): h is { label: string; value: string } => Boolean(h.value));

  return (
    <section className={cn(SHELL, "py-6 pb-24 md:py-10 lg:pb-10")} {...sfProps}>
      <nav aria-label="Breadcrumb" className="mb-6 text-[12px] font-medium text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/products" className="hover:text-primary">Shop</Link>
          </li>
          {product?.category ? (
            <li className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5" aria-hidden />
              {product.category}
            </li>
          ) : null}
          {product ? (
            <li className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <span aria-current="page" className="truncate text-primary">{product.name}</span>
            </li>
          ) : null}
        </ol>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <div className="sf-up min-w-0 lg:sticky lg:top-28 lg:self-start">
          <SportProductGallery paths={gallery} shown={shownPath} onShow={setPicked} name={product?.name ?? "Product picture"} soldOut={soldOut} />
        </div>

        <div className="sf-up flex min-w-0 flex-col gap-4" style={{ ["--d" as string]: "120ms" }}>
          {product?.category ? <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-secondary">{product.category}</p> : null}
          {rest.map((id) => renderBlockComponent(blocks[id], ctx, id))}
          <div id="buy" className="scroll-mt-28 border-t border-border pt-6">
            {product ? <AddToBag product={product} selectedOptions={chosen} /> : null}
          </div>
          {highlights.length > 0 ? (
            <section aria-labelledby="sf-highlights" className="mt-4">
              <h2 id="sf-highlights" className="text-[17px] font-bold text-primary">Key highlights</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-8">
                {highlights.map((h) => (
                  <div key={h.label} className="border-b border-border py-3">
                    <dt className="text-[13px] text-muted-foreground">{h.label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-primary">{h.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {info.length > 0 ? <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-border px-5 [&>div:first-child]:border-t-0">{info.map((id) => renderBlockComponent(blocks[id], ctx, id))}</div> : null}
        </div>
      </div>

      {/* Phones: the buy panel sits below the gallery, so keep the call to action in reach. */}
      {product && !soldOut ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <span className="min-w-0 truncate text-[15px] font-bold text-primary">{formatBagPrice(matched?.price_minor ?? product.price_minor, currency)}</span>
          <a href="#buy" className="inline-flex h-11 shrink-0 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Buy now</a>
        </div>
      ) : null}
    </section>
  );
}
