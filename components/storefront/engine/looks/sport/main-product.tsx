"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AddToBag } from "@/components/storefront/cart/add-to-bag";
import { publicImageUrl } from "@/lib/storage/paths";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { cn } from "@/lib/utils";
import { renderBlockComponent } from "../../blocks";
import type { ProductDetailData, RenderContext } from "../../types";
import { ImagePlaceholder } from "../../ui";
import type { SectionProps } from "..";
import { SHELL } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Sport product page: a vertical rail of thumbnails beside a large rounded picture with a counter, and the details (the
 * theme's product blocks, then quantity, Add to bag and the wishlist heart). The chosen options are shared by the option
 * picker, the price and Add to bag.
 */
export function SportMainProduct({ node, context, sectionId }: SectionProps) {
  const product = context.resource as ProductDetailData | undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries((product?.options ?? []).filter((o) => o.values.length > 0).map((o) => [o.name, o.values[0]])));
  const ctx: RenderContext = { ...context, selectedOptions: chosen, onSelectOption: (option: string, value: string) => setChosen((prev) => ({ ...prev, [option]: value })) };

  const matched = product?.variants ? resolveVariant(product.variants, chosen) : undefined;
  const gallery = [...new Set([product?.image_path, ...(product?.images ?? [])].filter((p): p is string => Boolean(p)))];
  const shownPath = matched?.image_path ?? picked ?? gallery[0] ?? null;
  const imageUrl = shownPath ? publicImageUrl(shownPath) : null;
  const index = Math.max(0, gallery.indexOf(shownPath ?? ""));
  const blocks = node.blocks ?? {};
  const blockOrder = node.block_order ?? Object.keys(blocks);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const info = blockOrder.filter((id) => blocks[id]?.type === "collapsible-info");
  const rest = blockOrder.filter((id) => blocks[id]?.type !== "collapsible-info");

  return (
    <section className={cn(SHELL, "py-6 md:py-10")} {...sfProps}>
      <nav aria-label="Breadcrumb" className="mb-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-primary">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/products" className="hover:text-primary">Shop</Link>
          </li>
          {product?.category ? (
            <>
              <li aria-hidden>/</li>
              <li>{product.category}</li>
            </>
          ) : null}
        </ol>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          {gallery.length > 1 ? (
            <ul className="flex shrink-0 gap-2.5 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-visible" aria-label="Product pictures">
              {gallery.slice(0, 8).map((path, i) => {
                const url = publicImageUrl(path);
                if (!url) return null;
                return (
                  <li key={path} className="w-16 shrink-0 sm:w-full">
                    <button type="button" onClick={() => setPicked(path)} aria-label={`Show picture ${i + 1}`} aria-pressed={shownPath === path} className={cn("relative block aspect-[3/4] w-full overflow-hidden rounded-[0.75rem] border-2 bg-[var(--surface)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary", shownPath === path ? "border-primary" : "border-transparent opacity-75 hover:opacity-100")}>
                      <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="relative aspect-[3/4] min-w-0 flex-1 overflow-hidden rounded-[1.5rem] bg-[var(--surface)]">
            {imageUrl ? <Image src={imageUrl} alt={product?.name ?? "Product picture"} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" /> : <ImagePlaceholder className="absolute inset-0" />}
            {gallery.length > 1 ? <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold tabular-nums tracking-[0.12em] text-primary">{pad(index + 1)} / {pad(gallery.length)}</span> : null}
            {product?.available === false ? <span className="absolute left-4 top-4 rounded-full bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Sold out</span> : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          {rest.map((id) => renderBlockComponent(blocks[id], ctx, id))}
          {product ? <AddToBag product={product} selectedOptions={chosen} /> : null}
          {info.length > 0 ? <div className="mt-4 rounded-[1rem] border border-border px-5 py-1">{info.map((id) => renderBlockComponent(blocks[id], ctx, id))}</div> : null}
        </div>
      </div>
    </section>
  );
}
