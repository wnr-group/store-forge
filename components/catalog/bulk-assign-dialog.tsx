"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { bulkAssignmentAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { ProductPicker, type PickerProduct } from "@/components/catalog/product-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATALOG_LIMITS } from "@/lib/catalog/types";

export type Holder = { id: string; label: string; levelName: string };

/**
 * Place (or take off) many products on many items in one go. Only items whose level may carry products are offered. The API applies it
 * all or nothing, so a failure leaves everything as it was. Products are never copied: each stays one product on all of its items.
 */
export function BulkAssignDialog({ holders, onClose }: { holders: Holder[]; onClose: () => void }) {
  const router = useRouter();
  const [action, setAction] = useState<"assign" | "unassign">("assign");
  const [products, setProducts] = useState<Map<string, PickerProduct>>(new Map());
  const [nodes, setNodes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (f ? holders.filter((h) => h.label.toLowerCase().includes(f)) : holders).slice(0, 300);
  }, [holders, filter]);

  const pairs = products.size * nodes.size;
  const tooMany = nodes.size > CATALOG_LIMITS.nodesPerBulk || pairs > CATALOG_LIMITS.pairsPerBulk;
  const ready = products.size > 0 && nodes.size > 0 && !tooMany;

  const toggle = (id: string, on: boolean) =>
    setNodes((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await bulkAssignmentAction({ action, nodeIds: [...nodes], productIds: [...products.keys()] });
      if (!res.ok) return setError(res.fieldErrors ? `${res.error} ${Object.values(res.fieldErrors).join(" ")}` : res.error);
      const r = res.data as { assigned: number; alreadyAssigned: number; removed?: number };
      toast.success(action === "assign" ? `${r.assigned} placements added${r.alreadyAssigned ? `, ${r.alreadyAssigned} already existed` : ""}` : `${r.removed ?? 0} placements removed`);
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk assign products</DialogTitle>
          <DialogDescription>Choose products and the items they belong on. Every chosen product is placed on every chosen item, without copying it.</DialogDescription>
        </DialogHeader>
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">What to do</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="bulk-action" className="size-4 accent-primary" checked={action === "assign"} onChange={() => setAction("assign")} /> Place on items
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="bulk-action" className="size-4 accent-primary" checked={action === "unassign"} onChange={() => setAction("unassign")} /> Take off items
          </label>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="bulk-products">
            <h3 id="bulk-products" className="mb-2 text-sm font-medium">
              1. Products
            </h3>
            <ProductPicker selected={products} onChange={setProducts} max={CATALOG_LIMITS.productsPerRequest} idPrefix="bulk" />
          </section>
          <section aria-labelledby="bulk-items" className="space-y-3">
            <h3 id="bulk-items" className="text-sm font-medium">
              2. Items
            </h3>
            {holders.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">No item can carry products yet. Allow products on a level and add items to it first.</p>
            ) : (
              <>
                <Input aria-label="Filter items" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" />
                <ul className="max-h-72 divide-y overflow-y-auto rounded-md border" aria-label="Items that can carry products">
                  {shown.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nothing matches.</li> : null}
                  {shown.map((h) => (
                    <li key={h.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                        <Checkbox checked={nodes.has(h.id)} onCheckedChange={(on) => toggle(h.id, on === true)} />
                        <span className="min-w-0 flex-1 truncate">{h.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{h.levelName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span role="status">
                    {nodes.size} selected{holders.length > shown.length ? ` · showing the first ${shown.length}, filter to find more` : ""}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="underline underline-offset-2" onClick={() => setNodes(new Set([...nodes, ...shown.slice(0, CATALOG_LIMITS.nodesPerBulk).map((h) => h.id)].slice(0, CATALOG_LIMITS.nodesPerBulk)))}>
                      Select shown
                    </button>
                    <button type="button" className="underline underline-offset-2" onClick={() => setNodes(new Set())}>
                      Clear
                    </button>
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
        {tooMany ? (
          <p role="alert" className="text-sm text-error">
            Choose at most {CATALOG_LIMITS.nodesPerBulk} items, and no more than {CATALOG_LIMITS.pairsPerBulk.toLocaleString("en-US")} placements in all (you chose {pairs.toLocaleString("en-US")}).
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <p className="mr-auto self-center text-xs text-muted-foreground" role="status">
            {ready ? `${products.size} ${products.size === 1 ? "product" : "products"} × ${nodes.size} ${nodes.size === 1 ? "item" : "items"} = ${pairs.toLocaleString("en-US")} placements` : "Choose products and items"}
          </p>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!ready || pending} variant={action === "unassign" ? "destructive" : "default"}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {action === "assign" ? "Place products" : "Take products off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
