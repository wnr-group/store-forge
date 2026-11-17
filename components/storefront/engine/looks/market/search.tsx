"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileClock, LayoutGrid, Package, Search } from "lucide-react";
import { formatBagPrice } from "@/lib/cart/format";
import { cn } from "@/lib/utils";
import { useSearchSubmit } from "../../use-search-submit";
import { Badge } from "./ui";

type Product = { name: string; slug: string; price_minor: number };
type Collection = { name: string; slug: string };

const recentKey = (slug: string) => `sf-recent-search:v1:${slug}`;
const readRecent = (slug: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(recentKey(slug)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
};

/**
 * The Market navbar search bar, built like the marketplace one: a white field with a category menu on the left, the input
 * and an orange search button. Typing opens a panel of matches (collections as categories, products with their price, and a
 * "search for" row); with nothing typed it shows the shopper's recent searches and the store's categories. Recent searches
 * stay in this browser only. The category menu narrows the search to that collection (`?cat=`).
 */
export function MarketSearch({ storeSlug, storeName, currency, products, collections, action, className }: { storeSlug: string; storeName: string; currency: string; products: Product[]; collections: Collection[]; action: string; className?: string }) {
  const { onSubmit, pending } = useSearchSubmit(action);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const categoryHits = words.length ? collections.filter((c) => hit(c.name)).slice(0, 3) : [];
  const productHits = words.length ? products.filter((p) => hit(p.name)).slice(0, 5) : [];
  const typed = words.length > 0;

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    try {
      window.localStorage.setItem(recentKey(storeSlug), JSON.stringify([t, ...readRecent(storeSlug).filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6)));
    } catch {
      /* private mode: recent searches are a convenience only */
    }
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    remember(q);
    setOpen(false);
    onSubmit(e);
  };
  const run = (term: string) => {
    setQ(term);
    remember(term);
    setOpen(false);
    // The input is controlled, so the form is submitted after React has put the term in it.
    window.setTimeout(() => ref.current?.requestSubmit(), 0);
  };

  const row = "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted";
  const tile = "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground";
  const showPanel = open && (typed || recent.length > 0 || collections.length > 0);

  return (
    <form ref={ref} action={action} method="get" role="search" onSubmit={submit} aria-busy={pending} className={cn("relative min-w-0 flex-1", className)}>
      <div className={cn("flex h-10 overflow-hidden rounded-lg bg-white ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-accent", pending && "opacity-80")}>
        {collections.length > 0 ? (
          <select name="cat" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Search category" className="hidden h-full max-w-[132px] cursor-pointer border-r border-border bg-muted px-2.5 text-xs text-foreground/80 focus:outline-none sm:block">
            <option value="all">All categories</option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          name="q"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent(storeSlug));
            setOpen(true);
          }}
          placeholder={products.length > 0 ? `Search ${products.length.toLocaleString("en-IN")} ${products.length === 1 ? "product" : "products"} in ${storeName}` : `Search ${storeName}`}
          aria-label="Search the store"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-primary outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" aria-label="Search" disabled={pending} className="grid w-11 place-items-center bg-accent text-accent-foreground transition-colors hover:brightness-95 disabled:cursor-wait">
          <Search className="size-[18px]" aria-hidden />
        </button>
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 animate-in overflow-hidden rounded-lg border border-border bg-white text-foreground shadow-xl fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none">
          {typed ? (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              <li>
                <button type="button" onClick={() => run(q.trim())} className={row}>
                  <span className={tile}><Search className="size-3.5" aria-hidden /></span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-primary">Search for “{q.trim()}”</span>
                  <Badge>Search</Badge>
                </button>
              </li>
              {categoryHits.map((c) => (
                <li key={`c-${c.slug}`}>
                  <Link href={`/collections/${c.slug}`} onClick={() => setOpen(false)} className={row}>
                    <span className={tile}><LayoutGrid className="size-3.5" aria-hidden /></span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-primary">{c.name}</span>
                    <Badge>Category</Badge>
                  </Link>
                </li>
              ))}
              {productHits.map((p) => (
                <li key={`p-${p.slug}`}>
                  <Link href={`/products/${p.slug}`} onClick={() => { remember(q); setOpen(false); }} className={row}>
                    <span className={tile}><Package className="size-3.5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-primary">{p.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{formatBagPrice(p.price_minor, currency)}</span>
                    </span>
                    <Badge>Product</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent searches</p>
                {recent.length > 0 ? (
                  <ul className="space-y-0.5">
                    {recent.slice(0, 4).map((r) => (
                      <li key={r}>
                        <button type="button" onClick={() => run(r)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] text-foreground/80 hover:bg-muted">
                          <FileClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{r}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">Your searches appear here.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Browse categories</p>
                <ul className="space-y-0.5">
                  {collections.slice(0, 5).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/collections/${c.slug}`} onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] text-foreground/80 hover:bg-muted">
                        <LayoutGrid className="size-3.5 shrink-0 text-accent" aria-hidden />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
