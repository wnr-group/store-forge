"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Search } from "lucide-react";
import { searchProductsAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { publicImageUrl } from "@/lib/storage/paths";

export type PickerProduct = { id: string; name: string; sku: string | null; partNumber: string | null; status: string; priceMinor: number; imagePath: string | null };

type Page = { items: PickerProduct[]; total: number; page: number; pageSize: number; totalPages: number };

/**
 * Search the store's products and tick any number of them: the selection survives searching and paging. Pure UI over
 * `searchProductsAction` (the server checks the permission and tenant); it never decides what the products are used for.
 */
export function ProductPicker({ selected, onChange, max, disabledIds, idPrefix = "picker" }: { selected: Map<string, PickerProduct>; onChange: (next: Map<string, PickerProduct>) => void; max: number; disabledIds?: Set<string>; idPrefix?: string }) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  /** Reads one page; only the answer sets state, so it is safe to start from an effect. */
  const fetchPage = useCallback(async (term: string, page: number) => {
    const ticket = ++latest.current;
    const res = await searchProductsAction({ search: term, page, limit: 20 });
    if (ticket !== latest.current) return; // a newer search is already running
    setLoading(false);
    if (res.ok && res.data) setData(res.data as Page);
    else if (!res.ok) setError(res.error);
  }, []);

  /** A search or page change the merchant asked for. */
  const load = (term: string, page: number) => {
    setLoading(true);
    setError(null);
    void fetchPage(term, page);
  };

  // The first page, read when the picker opens. State is set only in the answer's callback.
  useEffect(() => {
    let live = true;
    void searchProductsAction({ search: "", page: 1, limit: 20 }).then((res) => {
      if (!live || latest.current !== 0) return; // unmounted, or the merchant already searched
      setLoading(false);
      if (res.ok && res.data) setData(res.data as Page);
      else if (!res.ok) setError(res.error);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(value.trim(), 1), 300);
  };

  const toggle = (p: PickerProduct, on: boolean) => {
    const next = new Map(selected);
    if (on) {
      if (next.size >= max) return;
      next.set(p.id, p);
    } else next.delete(p.id);
    onChange(next);
  };

  const items = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search products" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name, SKU or part number" className="pl-8" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border" aria-busy={loading} aria-label="Products">
        {loading && !data ? (
          <li className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading products…
          </li>
        ) : null}
        {!loading && data && items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">{search ? "No products match your search." : "You have no products yet."}</li> : null}
        {items.map((p) => {
          const taken = disabledIds?.has(p.id) ?? false;
          const img = publicImageUrl(p.imagePath);
          const checked = selected.has(p.id);
          const full = !checked && selected.size >= max;
          return (
            <li key={p.id}>
              <label htmlFor={`${idPrefix}-${p.id}`} className={`flex items-center gap-3 px-3 py-2 text-sm ${taken || full ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}>
                <Checkbox id={`${idPrefix}-${p.id}`} checked={checked || taken} disabled={taken || full} onCheckedChange={(on) => toggle(p, on === true)} />
                <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
                  {img ? <Image src={img} alt="" fill sizes="36px" className="object-cover" /> : <ImageIcon className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {p.sku ?? "No SKU"}
                    {p.partNumber ? ` · Part no. ${p.partNumber}` : ""}
                  </span>
                </span>
                {taken ? <span className="shrink-0 text-xs text-muted-foreground">Already added</span> : <StatusBadge tone={p.status === "active" ? "active" : "draft"}>{p.status === "active" ? "Active" : "Draft"}</StatusBadge>}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p role="status">
          {selected.size} selected{selected.size >= max ? ` (the most you can add at once: ${max})` : ""}
          {data ? ` · ${data.total} ${data.total === 1 ? "product" : "products"}` : ""}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={loading || !data || data.page <= 1} onClick={() => data && load(search.trim(), data.page - 1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="px-1 tabular-nums">
            {data?.page ?? 1} / {data?.totalPages ?? 1}
          </span>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={loading || !data || data.page >= data.totalPages} onClick={() => data && load(search.trim(), data.page + 1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
