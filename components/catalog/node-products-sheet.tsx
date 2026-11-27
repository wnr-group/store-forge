"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, PackagePlus, PackageX, Search } from "lucide-react";
import { toast } from "sonner";
import { assignProductsAction, listNodeProductsAction, unassignProductsAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { ProductPicker, type PickerProduct } from "@/components/catalog/product-picker";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CATALOG_LIMITS, type CatalogNode, type CatalogNodeProduct, type CatalogPage } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";

/**
 * The products placed on one item: look them up, add more (one product can sit on many items, nothing is copied) and take products off.
 * Whether the item may carry products is its level's setting; the API refuses a placement on a level that does not allow it.
 */
export function NodeProductsSheet({ node, canHold, canManage, currency, onClose }: { node: CatalogNode; canHold: boolean; canManage: boolean; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [descendants, setDescendants] = useState(false);
  const [data, setData] = useState<CatalogPage<CatalogNodeProduct> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Map<string, PickerProduct>>(new Map());
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  /** Reads one page; only the answer sets state, so it is safe to start from an effect. */
  const fetchPage = useCallback(
    async (term: string, page: number, withDescendants: boolean) => {
      const ticket = ++latest.current;
      const res = await listNodeProductsAction(node.id, { search: term || undefined, page, limit: 20, includeDescendants: withDescendants });
      if (ticket !== latest.current) return;
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data as CatalogPage<CatalogNodeProduct>);
        setSelected(new Set());
      } else if (!res.ok) setError(res.error);
    },
    [node.id],
  );

  const load = async (term: string, page: number, withDescendants: boolean) => {
    setLoading(true);
    setError(null);
    await fetchPage(term, page, withDescendants);
  };

  // The first page, read when the sheet opens. State is set only in the answer's callback.
  useEffect(() => {
    let live = true;
    void listNodeProductsAction(node.id, { page: 1, limit: 20, includeDescendants: false }).then((res) => {
      if (!live || latest.current !== 0) return; // closed, or the merchant already searched
      setLoading(false);
      if (res.ok && res.data) setData(res.data as CatalogPage<CatalogNodeProduct>);
      else if (!res.ok) setError(res.error);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [node.id]);

  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(value.trim(), 1, descendants), 300);
  };

  const remove = (ids: string[]) =>
    startTransition(async () => {
      const res = await unassignProductsAction(node.id, ids);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${ids.length} ${ids.length === 1 ? "product" : "products"} taken off ${node.name}`);
      await load(search.trim(), data?.page ?? 1, descendants);
      router.refresh();
    });

  const addPicked = () =>
    startTransition(async () => {
      const ids = [...picked.keys()];
      const res = await assignProductsAction(node.id, ids);
      if (!res.ok) return void toast.error(res.error);
      const r = res.data as { assigned: number; alreadyAssigned: number };
      toast.success(r.assigned > 0 ? `${r.assigned} added${r.alreadyAssigned > 0 ? `, ${r.alreadyAssigned} were already here` : ""}` : "They were already on this item");
      setAdding(false);
      setPicked(new Map());
      await load(search.trim(), 1, descendants);
      router.refresh();
    });

  const items = data?.items ?? [];
  const allOn = items.length > 0 && items.every((p) => selected.has(p.id));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-3 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Products on {node.name}</SheetTitle>
          <SheetDescription>
            {canHold ? `${node.levelName} item. A product can sit on any number of items; adding it here does not copy it.` : `Products cannot be placed on ${node.levelName} items. Allow it for the level first.`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search products on this item" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search name, SKU or part number" className="pl-8" />
            </div>
            {canManage && canHold ? (
              <Button type="button" size="sm" onClick={() => setAdding(true)}>
                <PackagePlus aria-hidden /> Add products
              </Button>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={descendants}
              onCheckedChange={(on) => {
                setDescendants(on);
                void load(search.trim(), 1, on);
              }}
              aria-label="Include products of the items below"
            />
            Include products of the items below
          </label>
          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          {canManage && items.length > 0 && !descendants ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={allOn} onCheckedChange={(on) => setSelected(on === true ? new Set(items.map((p) => p.id)) : new Set())} aria-label="Select all products on this page" />
                {selected.size > 0 ? `${selected.size} selected` : "Select all"}
              </label>
              <Button type="button" variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => remove([...selected])}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PackageX aria-hidden />} Take off
              </Button>
            </div>
          ) : null}
          <ul className="divide-y rounded-md border" aria-busy={loading} aria-label="Products on this item">
            {loading && !data ? (
              <li className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading products…
              </li>
            ) : null}
            {!loading && data && items.length === 0 ? <li className="px-3 py-8 text-center text-sm text-muted-foreground">{search ? "No products match your search." : "No products here yet."}</li> : null}
            {items.map((p) => {
              const img = publicImageUrl(p.imagePath);
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {canManage && !descendants ? <Checkbox checked={selected.has(p.id)} onCheckedChange={(on) => setSelected((prev) => { const next = new Set(prev); if (on === true) next.add(p.id); else next.delete(p.id); return next; })} aria-label={`Select ${p.name}`} /> : null}
                  <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
                    {img ? <Image src={img} alt="" fill sizes="40px" className="object-cover" /> : <ImageIcon className="size-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {p.sku ?? "No SKU"}
                      {p.partNumber ? ` · Part no. ${p.partNumber}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className="block tabular-nums">{formatMoney(p.priceMinor, currency)}</span>
                    <StatusBadge tone={p.status === "active" ? "active" : "draft"}>{p.status === "active" ? "Active" : "Draft"}</StatusBadge>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span role="status">{data ? `${data.total} ${data.total === 1 ? "product" : "products"}` : ""}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={loading || !data || data.page <= 1} onClick={() => data && void load(search.trim(), data.page - 1, descendants)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="px-1 tabular-nums">
                {data?.page ?? 1} / {data?.totalPages ?? 1}
              </span>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={loading || !data || data.page >= data.totalPages} onClick={() => data && void load(search.trim(), data.page + 1, descendants)}>
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      {adding ? (
        <Dialog open onOpenChange={(o) => !o && !pending && setAdding(false)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add products to {node.name}</DialogTitle>
              <DialogDescription>Choose the products that belong here. A product already on this item is left as it is.</DialogDescription>
            </DialogHeader>
            <ProductPicker selected={picked} onChange={setPicked} max={CATALOG_LIMITS.productsPerRequest} idPrefix="node-add" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" disabled={picked.size === 0 || pending} onClick={addPicked}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Add {picked.size > 0 ? picked.size : ""} {picked.size === 1 ? "product" : "products"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Sheet>
  );
}
