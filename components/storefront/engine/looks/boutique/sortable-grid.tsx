"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBagPrice } from "@/lib/cart/format";
import { currencyDigits } from "@/lib/money";
import { inBand, priceBands, type PriceBand } from "@/lib/storefront/price-bands";
import { cn } from "@/lib/utils";
import { gridColumns, type CardProduct } from "../../ui";
import { BoutiqueProductCard } from "./product-card";
import type { CardParts } from "@/lib/templates/card-parts";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/** Sorts a copy of the list; "featured" keeps the store's own order. */
export function sortProducts(products: CardProduct[], sort: Sort): CardProduct[] {
  const list = [...products];
  if (sort === "price-asc") list.sort((a, b) => a.price_minor - b.price_minor);
  else if (sort === "price-desc") list.sort((a, b) => b.price_minor - a.price_minor);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

type Tab = { slug: string; name: string };

const chip = "inline-flex h-9 items-center rounded-full border px-4 text-[13px] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const chipOff = "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary";
const chipOn = "border-primary bg-primary text-primary-foreground";

function bandLabel(band: PriceBand, currency: string): string {
  if (band.minMinor === null) return `Under ${formatBagPrice(band.maxMinor!, currency)}`;
  if (band.maxMinor === null) return `${formatBagPrice(band.minMinor, currency)} and above`;
  return `${formatBagPrice(band.minMinor, currency)} to ${formatBagPrice(band.maxMinor, currency)}`;
}

/**
 * The product listing with its filters: collection tabs (links to each collection, the current one highlighted), price
 * bands worked out from this list, an in-stock filter and sorting. It only narrows and reorders what the store sent.
 */
export function SortableGrid({ products, currency, columns, basePath, linked, collections = [], activeCollection = null, parts }: { parts?: CardParts; products: CardProduct[]; currency: string; columns: number; basePath: string; linked: boolean; collections?: Tab[]; activeCollection?: string | null }) {
  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);
  const [bandId, setBandId] = useState<string | null>(null);
  const bands = useMemo(() => priceBands(products.map((p) => p.price_minor), currencyDigits(currency)), [products, currency]);
  const band = bands.find((b) => b.id === bandId) ?? null;
  const hasSoldOut = products.some((p) => p.available === false);

  const shown = useMemo(() => {
    let list = products;
    if (inStock) list = list.filter((p) => p.available !== false);
    if (band) list = list.filter((p) => inBand(p.price_minor, band));
    return sortProducts(list, sort);
  }, [products, sort, inStock, band]);
  const filtered = inStock || band !== null;

  return (
    <>
      {collections.length > 0 ? (
        <nav aria-label="Shop by collection" className="-mx-5 mb-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <ul className="flex gap-2 whitespace-nowrap">
            <li>
              <Link href="/products" aria-current={activeCollection === null ? "page" : undefined} className={cn(chip, activeCollection === null ? chipOn : chipOff)}>
                All
              </Link>
            </li>
            {collections.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} aria-current={activeCollection === c.slug ? "page" : undefined} className={cn(chip, activeCollection === c.slug ? chipOn : chipOff)}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mb-6 space-y-3 border-y border-border py-3 text-[13px]">
        {bands.length > 0 ? (
          <div role="group" aria-label="Filter by price" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
            <button type="button" aria-pressed={band === null} onClick={() => setBandId(null)} className={cn(chip, "h-8 shrink-0", band === null ? chipOn : chipOff)}>
              Any price
            </button>
            {bands.map((b) => (
              <button key={b.id} type="button" aria-pressed={bandId === b.id} onClick={() => setBandId(bandId === b.id ? null : b.id)} className={cn(chip, "h-8 shrink-0", bandId === b.id ? chipOn : chipOff)}>
                {bandLabel(b, currency)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground" aria-live="polite">
            {shown.length} {shown.length === 1 ? "piece" : "pieces"}
            {filtered ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    setInStock(false);
                    setBandId(null);
                  }}
                  className="ml-1 text-foreground underline underline-offset-4"
                >
                  Clear filters
                </button>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {hasSoldOut ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-foreground">
                <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                In stock only
              </label>
            ) : null}
            <label className="inline-flex items-center gap-2 text-foreground">
              <span className="text-muted-foreground">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="border border-dashed border-border py-14 text-center text-sm text-muted-foreground">No pieces match these filters.</p>
      ) : (
        <ul className={cn("grid gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6", gridColumns(columns))}>
          {shown.map((p, i) => (
            <li key={p.slug} className="min-w-0">
              <BoutiqueProductCard product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} priority={i < 4} parts={parts} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
