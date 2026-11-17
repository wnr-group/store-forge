"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { gridColumns, type CardProduct } from "../../ui";
import { BoutiqueProductCard } from "./product-card";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/** Sorts a copy of the list; "featured" keeps the store's own order and sold-out items are never moved. */
export function sortProducts(products: CardProduct[], sort: Sort): CardProduct[] {
  const list = [...products];
  if (sort === "price-asc") list.sort((a, b) => a.price_minor - b.price_minor);
  else if (sort === "price-desc") list.sort((a, b) => b.price_minor - a.price_minor);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/** The product grid with a sort control and an "in stock only" filter. It only reorders and hides what the store already sent. */
export function SortableGrid({ products, currency, columns, basePath, linked }: { products: CardProduct[]; currency: string; columns: number; basePath: string; linked: boolean }) {
  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);
  const hasSoldOut = products.some((p) => p.available === false);
  const shown = useMemo(() => sortProducts(inStock ? products.filter((p) => p.available !== false) : products, sort), [products, sort, inStock]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-[13px]">
        <p className="text-muted-foreground" aria-live="polite">
          {shown.length} {shown.length === 1 ? "piece" : "pieces"}
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
      <ul className={cn("grid gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:gap-x-6", gridColumns(columns))}>
        {shown.map((p, i) => (
          <li key={p.slug} className="min-w-0">
            <BoutiqueProductCard product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} priority={i < 4} />
          </li>
        ))}
      </ul>
    </>
  );
}
