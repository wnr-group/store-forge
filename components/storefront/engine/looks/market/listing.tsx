"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Filter, LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";
import { formatBagPrice } from "@/lib/cart/format";
import { currencyDigits } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CardProduct } from "../../ui";
import { sortProducts } from "../boutique/sortable-grid";
import { toMinor } from "../sport/listing";
import { MarketProductCard } from "./product-card";
import { PANEL, btnAccent, btnOutline } from "./ui";
import type { CardParts } from "@/lib/templates/card-parts";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const FIELD = "h-9 w-full rounded-md border border-border bg-white px-2.5 text-[13px] text-primary outline-none placeholder:text-muted-foreground focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20";
const GROUP = "space-y-2.5 py-4";
const GROUP_TITLE = "text-[13px] font-semibold text-primary";

/**
 * The Market product listing: a filter panel on the left (collections, price with quick bands, in stock), and on the right a
 * result count, a sort menu, a grid / list switch, removable filter chips and the products. It only narrows and reorders
 * the products the store already sent; on phones the filters open as a panel under the bar.
 */
export function MarketListing({ products, currency, columns, basePath, linked, collections, activeCollection, gridParts, listParts }: { gridParts?: CardParts; listParts?: CardParts; products: CardProduct[]; currency: string; columns: number; basePath: string; linked: boolean; collections: { slug: string; name: string }[]; activeCollection: string | null }) {
  const digits = currencyDigits(currency);
  const [sort, setSort] = useState<Sort>("featured");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [inStock, setInStock] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [range, setRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [panel, setPanel] = useState(false);
  const hasSoldOut = products.some((p) => p.available === false);
  const prices = products.map((p) => p.price_minor);
  const lowest = prices.length ? Math.min(...prices) : 0;
  const highest = prices.length ? Math.max(...prices) : 0;
  const whole = (minor: number) => String(Math.round(minor / 10 ** digits));

  // Four price bands spread evenly over the store's own range, so the shortcuts always match what is for sale.
  const bands = useMemo(() => {
    if (!prices.length || highest <= lowest) return [] as { min: number | null; max: number | null }[];
    const step = (highest - lowest) / 4;
    const cut = (n: number) => Math.round((lowest + step * n) / 10 ** digits) * 10 ** digits;
    return [{ min: null, max: cut(1) }, { min: cut(1), max: cut(2) }, { min: cut(2), max: cut(3) }, { min: cut(3), max: null }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowest, highest, digits]);

  const shown = useMemo(() => {
    let list = products;
    if (inStock) list = list.filter((p) => p.available !== false);
    if (range.min !== null) list = list.filter((p) => p.price_minor >= range.min!);
    if (range.max !== null) list = list.filter((p) => p.price_minor <= range.max!);
    return sortProducts(list, sort);
  }, [products, inStock, range, sort]);

  const priceOn = range.min !== null || range.max !== null;
  const chips: { label: string; clear: () => void }[] = [];
  if (priceOn) chips.push({ label: range.min !== null && range.max !== null ? `${formatBagPrice(range.min, currency)} – ${formatBagPrice(range.max, currency)}` : range.max !== null ? `Under ${formatBagPrice(range.max, currency)}` : `Over ${formatBagPrice(range.min!, currency)}`, clear: () => { setRange({ min: null, max: null }); setMinText(""); setMaxText(""); } });
  if (inStock) chips.push({ label: "In stock", clear: () => setInStock(false) });
  const reset = () => {
    setInStock(false);
    setMinText("");
    setMaxText("");
    setRange({ min: null, max: null });
  };
  const bandLabel = (b: { min: number | null; max: number | null }) => (b.min === null ? `Under ${formatBagPrice(b.max!, currency)}` : b.max === null ? `Over ${formatBagPrice(b.min, currency)}` : `${formatBagPrice(b.min, currency)} – ${formatBagPrice(b.max, currency)}`);

  const filters = (
    <div className="divide-y divide-border/70">
      {collections.length > 0 ? (
        <nav aria-label="Category" className={GROUP}>
          <p className={GROUP_TITLE}>Category</p>
          <ul className="space-y-2">
            {[{ slug: "", name: "All products" }, ...collections].map((c) => {
              const on = (c.slug || null) === activeCollection;
              return (
                <li key={c.slug || "all"}>
                  <Link href={c.slug ? `/collections/${c.slug}` : "/products"} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-2 text-[13px] transition-colors", on ? "font-semibold text-secondary" : "text-foreground/80 hover:text-secondary")}>
                    <span aria-hidden className={cn("grid size-4 place-items-center rounded border", on ? "border-secondary bg-secondary" : "border-border bg-white")}>
                      {on ? <span className="size-1.5 rounded-sm bg-white" /> : null}
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
        className={GROUP}
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ min: toMinor(minText, digits), max: toMinor(maxText, digits) });
        }}
      >
        <p className={GROUP_TITLE}>Price</p>
        <div className="flex items-center gap-2">
          <input inputMode="decimal" value={minText} onChange={(e) => setMinText(e.target.value)} placeholder={whole(lowest)} aria-label="Lowest price" className={FIELD} />
          <span aria-hidden className="text-xs text-muted-foreground">to</span>
          <input inputMode="decimal" value={maxText} onChange={(e) => setMaxText(e.target.value)} placeholder={whole(highest)} aria-label="Highest price" className={FIELD} />
        </div>
        {bands.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {bands.map((b) => {
              const on = range.min === b.min && range.max === b.max;
              return (
                <button key={bandLabel(b)} type="button" onClick={() => { setRange(b); setMinText(b.min === null ? "" : whole(b.min)); setMaxText(b.max === null ? "" : whole(b.max)); }} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", on ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-foreground/70 hover:border-foreground/30")}>
                  {bandLabel(b)}
                </button>
              );
            })}
          </div>
        ) : null}
        <button type="submit" className={cn(btnOutline("sm"), "w-full")}>Apply price</button>
      </form>
      {hasSoldOut ? (
        <div className={GROUP}>
          <p className={GROUP_TITLE}>Availability</p>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 accent-[var(--secondary)]" />
            In stock only
          </label>
        </div>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-primary">{shown.length}</span> of {products.length} {products.length === 1 ? "result" : "results"}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPanel((v) => !v)} aria-expanded={panel} className={cn(btnOutline("sm"), "lg:hidden")}>
            <SlidersHorizontal className="size-4" aria-hidden /> Filters{chips.length ? ` (${chips.length})` : ""}
          </button>
          <label className="relative flex h-8 items-center rounded-md border border-border bg-white pl-2.5 pr-8 text-[13px] text-primary shadow-sm">
            <span className="text-muted-foreground">Sort:&nbsp;</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort products" className="appearance-none bg-transparent pr-1 font-medium outline-none">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-4 text-muted-foreground" aria-hidden />
          </label>
          <div className="hidden h-8 items-center overflow-hidden rounded-md border border-border bg-white sm:flex">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-label={label} aria-pressed={view === v} className={cn("grid h-full w-8 place-items-center", v === "list" && "border-l border-border", view === v ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-secondary">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="grid size-4 place-items-center rounded-full hover:bg-secondary/20">
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={reset} className="ml-1 text-xs font-semibold text-secondary hover:underline">Clear all</button>
        </div>
      ) : null}

      <div className="mt-4 flex items-start gap-5">
        <aside className="sticky top-[116px] hidden w-[248px] shrink-0 lg:block">
          <div className={cn(PANEL, "max-h-[calc(100vh-140px)] overflow-y-auto px-3.5 py-1")}>
            <div className="flex items-center justify-between border-b border-border/70 py-3">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-primary"><Filter className="size-3.5" aria-hidden /> Filters</span>
              {chips.length > 0 ? <button type="button" onClick={reset} className="text-xs text-secondary hover:underline">Reset</button> : null}
            </div>
            {filters}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {panel ? <div className={cn(PANEL, "mb-4 px-3.5 py-1 lg:hidden")}>{filters}</div> : null}
          {shown.length === 0 ? (
            <div className={cn(PANEL, "px-6 py-14 text-center")}>
              <p className="text-sm font-semibold text-primary">No products match these filters</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Try widening the price range or removing a filter.</p>
              <button type="button" onClick={reset} className={cn(btnAccent("sm"), "mt-4")}>Clear all filters</button>
            </div>
          ) : view === "grid" ? (
            <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", columns >= 4 ? "xl:grid-cols-4" : columns === 3 ? "xl:grid-cols-3" : "")}>
              {shown.map((p, i) => (
                <li key={p.slug} className="min-w-0">
                  <MarketProductCard product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} priority={i < 4} parts={gridParts} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {shown.map((p) => (
                <li key={p.slug}>
                  <MarketProductCard layout="list" product={p} currency={currency} href={linked && p.slug ? `${basePath}/products/${p.slug}` : null} parts={listParts} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
