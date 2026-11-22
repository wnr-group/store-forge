"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTAINER } from "./ui";
import { useSearchSubmit } from "./use-search-submit";

/**
 * The search field at the top of the search page. A plain GET form (it works before the page hydrates and without
 * JavaScript) that, once hydrated, searches without reloading the page and shows "Searching" until the results arrive.
 * It sends `?q=` to the store's own /search page, which filters the store's public products.
 * `variant="market"` is the squarer field with an orange button; `pill` is the rounded one the other looks use.
 */
export function SearchBox({ term, basePath = "", variant = "pill", contained = true, className }: { term: string; basePath?: string; variant?: "pill" | "market"; contained?: boolean; className?: string }) {
  const action = `${basePath}/search`;
  const { onSubmit, pending } = useSearchSubmit(action);
  const market = variant === "market";
  const form = (
    <form action={action} method="get" role="search" onSubmit={onSubmit} aria-busy={pending} className={cn("flex w-full max-w-2xl items-center overflow-hidden border bg-background text-foreground focus-within:ring-2 focus-within:ring-primary/25", market ? "h-11 rounded-lg border-border bg-white" : "h-[52px] rounded-full border-border pl-5", className)}>
      {!market ? <Search className="mr-3 size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden /> : null}
      <input name="q" type="search" defaultValue={term} placeholder="Search products" aria-label="Search this store" autoComplete="off" className={cn("h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground", market && "px-3")} />
      <button type="submit" disabled={pending} className={cn("h-full shrink-0 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-80", market ? "bg-accent px-5 text-accent-foreground hover:brightness-95" : "bg-primary px-6 text-primary-foreground hover:bg-[var(--primary-hover,var(--primary))]")}>
        {pending ? "Searching…" : "Search"}
      </button>
    </form>
  );
  return contained ? <div className={cn(CONTAINER, "pb-6 pt-2")}>{form}</div> : form;
}

/** The term in a search page title ("Search: linen" gives "linen", plain "Search" gives ""), or null for any other title. */
export function searchTermOf(title: string): string | null {
  if (!/^Search(:|$)/.test(title)) return null;
  return title.replace(/^Search:?\s*/, "");
}
