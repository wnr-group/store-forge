"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { currencyDigits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { gridColumns, type CardProduct } from "../../ui";
import { sortProducts } from "../boutique/sortable-grid";
import { SportProductCard } from "./product-card";
import type { CardParts } from "@/lib/templates/card-parts";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const LABEL = "text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground";
const FIELD = "h-11 w-full rounded-[0.5rem] border border-border bg-background px-3 text-[13px] text-primary outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

/** A typed amount in the store's currency ("1,250.50") as minor units, or null when empty or not a number. */
export function toMinor(input: string, digits: number): number | null {
  const clean = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Math.round(Number(clean) * 10 ** digits);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * The Sport product listing: a filter sidebar (collections as links, price range, in stock) beside a search field, a sort
 * menu and the product grid. It only narrows and reorders the products the store already sent; on phones the filters fold
 * into one "Filters" disclosure above the grid.
 */
export function SportListing({ products, currency, columns, basePath, linked, collections, activeCollection, parts }: { parts?: CardParts; products: CardProduct[]; currency: string; columns: number; basePath: string; linked: boolean; collections: { slug: string; name: string }[]; activeCollection: string | null }) {
  const digits = currencyDigits(currency);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [range, setRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const hasSoldOut = products.some((p) => p.available === false);
  const prices = products.map((p) => p.price_minor);
  const lowest = prices.length ? Math.min(...prices) : 0;
  const highest = prices.length ? Math.max(...prices) : 0;
  const money = (minor: number) => String(Math.round(minor / 10 ** digits));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.short_description ?? "").toLowerCase().includes(q));
    if (inStock) list = list.filter((p) => p.available !== false);
    if (range.min !== null) list = list.filter((p) => p.price_minor >= range.min!);
    if (range.max !== null) list = list.filter((p) => p.price_minor <= range.max!);
    return sortProducts(list, sort);
  }, [products, query, inStock, range, sort]);
  const filtered = query.trim() !== "" || inStock || range.min !== null || range.max !== null;
  const clear = () => {
    setQuery("");
    setInStock(false);
    setMinText("");
    setMaxText("");
    setRange({ min: null, max: null });
  };

  const sidebar = (
    <div className="space-y-8 text-[13px]">
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        <span className="font-semibold text-primary">{shown.length}</span> {shown.length === 1 ? "product" : "products"}
        {filtered ? (
          <button type="button" onClick={clear} className="ml-2 text-primary underline underline-offset-4">
            Clear
          </button>
        ) : null}
      </p>
      {collections.length > 0 ? (
        <nav aria-label="Category">
          <p className={LABEL}>Category</p>
          <ul className="mt-3 space-y-2.5">
            {[{ slug: "", name: "All" }, ...collections].map((c) => {
              const on = (c.slug || null) === activeCollection;
              return (
                <li key={c.slug || "all"}>
                  <Link href={c.slug ? `/collections/${c.slug}` : "/products"} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-2.5 transition-colors", on ? "font-semibold text-primary" : "text-foreground/75 hover:text-primary")}>
                    <span aria-hidden className={cn("flex size-3.5 items-center justify-center rounded-full border", on ? "border-primary" : "border-border")}>
                      {on ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                    </span>
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      <form
        aria-label="Price"
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ min: toMinor(minText, digits), max: toMinor(maxText, digits) });
        }}
      >
        <p className={LABEL}>Price</p>
        <div className="mt-3 flex items-center gap-2">
          <input inputMode="decimal" value={minText} onChange={(e) => setMinText(e.target.value)} placeholder={money(lowest)} aria-label="Lowest price" className={FIELD} />
          <span aria-hidden className="text-muted-foreground">–</span>
          <input inputMode="decimal" value={maxText} onChange={(e) => setMaxText(e.target.value)} placeholder={money(highest)} aria-label="Highest price" className={FIELD} />
        </div>
        <button type="submit" className="mt-3 h-10 w-full rounded-[0.5rem] border border-border text-[13px] font-medium text-primary transition-colors hover:border-primary hover:bg-[var(--surface)]">
          Apply price
        </button>
      </form>
      {hasSoldOut ? (
        <label className="flex cursor-pointer items-center gap-2.5 text-primary">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          In stock only
        </label>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:border-r lg:border-border lg:pr-8">
        <details className="group rounded-[0.75rem] border border-border lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-primary">
            Filters ({shown.length})
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border p-4">{sidebar}</div>
        </details>
        <div className="hidden lg:block">{sidebar}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex h-[50px] min-w-[14rem] flex-1 items-center gap-3 rounded-full border border-border bg-background px-5 text-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or description" aria-label="Search these products" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
          </label>
          <label className="relative flex h-[50px] items-center rounded-full border border-border bg-background pl-5 pr-11 text-[14px] text-primary">
            <span className="text-muted-foreground">Sort:&nbsp;</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort products" className="appearance-none bg-transparent pr-2 font-medium outline-none">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 size-4" aria-hidden />
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-[1rem] border border-dashed border-border py-16 text-center text-sm text-muted-foreground">No products match these filters.</p>
        ) : (
          <ul className={cn("grid gap-x-4 gap-y-9 sm:gap-x-5", gridColumns(Math.min(columns, 4)).replace("lg:grid-cols-4", "md:grid-cols-3 xl:grid-cols-4"))}>
            {shown.map((p, i) => (
              <li key={p.slug} className="min-w-0">
                <SportProductCard product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} priority={i < 4} parts={parts} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
