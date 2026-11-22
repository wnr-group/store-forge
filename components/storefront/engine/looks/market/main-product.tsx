"use client";

import { useState } from "react";
import { isHiddenFor, presentationOf } from "@/lib/templates/product-presentation";
import Image from "next/image";
import { publicImageUrl } from "@/lib/storage/paths";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import type { ProductDetailData, RenderContext } from "../../types";
import { ImagePlaceholder } from "../../ui";
import type { SectionProps } from "..";
import { MarketHeart } from "./card-actions";
import { MarketBuyBox } from "./buy-box";
import { Badge, Breadcrumbs, PANEL, WRAP, discount } from "./ui";

/**
 * Market product page, laid out like the marketplace one in three columns: the picture panel (with small thumbnails under
 * it), the details (the theme's product blocks, then the info blocks as "About this product") and a sticky buy box. The
 * chosen options are shared by the option picker, the price and the buy box. On phones the columns stack and a bar with the
 * price and a "Buy now" shortcut stays at the foot of the screen.
 */
export function MarketMainProduct({ node, context, sectionId }: SectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries((product?.options ?? []).filter((o) => o.values.length > 0).map((o) => [o.name, o.values[0]])));
  const ctx: RenderContext = { ...context, selectedOptions: chosen, onSelectOption: (option: string, value: string) => setChosen((prev) => ({ ...prev, [option]: value })) };

  const matched = product?.variants ? resolveVariant(product.variants, chosen) : undefined;
  const gallery = [...new Set([product?.image_path, ...(product?.images ?? [])].filter((p): p is string => Boolean(p)))];
  const shownPath = matched?.image_path ?? picked ?? gallery[0] ?? null;
  const index = Math.max(0, gallery.indexOf(shownPath ?? ""));
  const blocks = node.blocks ?? {};
  // A product can hide blocks of its own (per-product presentation): description, SKU, type, category, share links.
  const presentation = presentationOf(product);
  const blockOrder = (node.block_order ?? Object.keys(blocks)).filter((id) => !isHiddenFor(presentation, blocks[id]?.type ?? ""));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const currency = context.store.currency ?? "INR";
  const soldOut = product?.available === false;
  const off = product ? discount(matched?.price_minor ?? product.price_minor, matched?.compare_at_price_minor ?? product.compare_at_price_minor) : 0;

  const info = blockOrder.filter((id) => blocks[id]?.type === "collapsible-info");
  const rest = blockOrder.filter((id) => blocks[id]?.type !== "collapsible-info");

  return (
    <section className={cn(WRAP, "py-4 pb-20 lg:pb-6")} {...sfProps}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/products" }, ...(product?.category && !isHiddenFor(presentation, "product-category") ? [{ label: product.category }] : []), ...(product ? [{ label: product.name }] : [])]} />

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)_320px]">
        <div className="self-start lg:sticky lg:top-[116px]">
          <div className={cn(PANEL, "p-3")}>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-white">
              {gallery.map((path, i) => {
                const url = publicImageUrl(path);
                return url ? <Image key={path} src={url} alt={i === index ? (product?.name ?? "Product picture") : ""} aria-hidden={i !== index} fill priority={i === 0} sizes="(min-width: 1024px) 400px, 100vw" className={cn("object-cover transition-opacity duration-300 motion-reduce:transition-none", i === index ? "opacity-100" : "opacity-0")} /> : null;
              })}
              {gallery.length === 0 ? <ImagePlaceholder className="absolute inset-0" /> : null}
              <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
                {soldOut ? <Badge tone="danger">Sold out</Badge> : off ? <Badge tone="accent">{off}% off</Badge> : null}
              </div>
              {product ? <MarketHeart product={{ name: product.name, slug: product.slug, short_description: product.short_description, price_minor: product.price_minor, compare_at_price_minor: product.compare_at_price_minor, image_path: product.image_path, available: product.available }} className="right-2 top-2 size-9" /> : null}
            </div>
            {gallery.length > 1 ? (
              <ul className="mt-2.5 flex gap-2 overflow-x-auto" aria-label="Product pictures">
                {gallery.map((path, i) => {
                  const url = publicImageUrl(path);
                  if (!url) return null;
                  return (
                    <li key={path} className="shrink-0">
                      <button type="button" onClick={() => setPicked(path)} aria-label={`Show picture ${i + 1} of ${gallery.length}`} aria-pressed={i === index} className={cn("relative block size-14 overflow-hidden rounded-md border-2 bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary", i === index ? "border-secondary" : "border-border hover:border-foreground/30")}>
                        <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {product?.category && !isHiddenFor(presentation, "product-category") ? <p className="text-[13px] font-semibold text-secondary">{product.category}</p> : null}
          {rest.map((id) => renderBlockComponent(blocks[id], ctx, id))}
          {info.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/80 bg-white px-4 shadow-sm [&>div:first-child]:border-t-0">{info.map((id) => renderBlockComponent(blocks[id], ctx, id))}</div>
          ) : null}
        </div>

        {product ? (
          <div className="self-start lg:sticky lg:top-[116px]">
            <MarketBuyBox product={product} selectedOptions={chosen} currency={currency} storeName={context.store.name} showReference={!isHiddenFor(presentation, "product-sku")} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
