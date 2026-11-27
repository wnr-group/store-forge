"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderTree, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setProductPlacementsAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/app";
import type { CatalogProductPlacement } from "@/lib/catalog/types";

export type PlacementChoice = { id: string; label: string; levelName: string };

/**
 * Where this product sits in the catalog hierarchy, on the product page. The product is never copied: it sits on as many items as you
 * choose. The list offers only items whose level may carry products. Saving makes the product sit on exactly the chosen items.
 */
export function ProductPlacements({ productId, choices, placements, truncated, canManage }: { productId: string; choices: PlacementChoice[]; placements: CatalogProductPlacement[]; truncated: boolean; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const known = useMemo(() => new Set(choices.map((c) => c.id)), [choices]);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (f ? choices.filter((c) => c.label.toLowerCase().includes(f)) : choices).slice(0, 300);
  }, [choices, filter]);

  const begin = () => {
    setSelected(new Set(placements.map((p) => p.nodeId)));
    setFilter("");
    setError(null);
    setOpen(true);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      // A placement the list cannot show (a very large catalog is cut) is kept, never silently removed.
      const kept = placements.map((p) => p.nodeId).filter((id) => !known.has(id));
      const res = await setProductPlacementsAction(productId, [...new Set([...kept, ...[...selected].filter((id) => known.has(id))])]);
      if (!res.ok) return setError(res.error);
      toast.success("Catalog placements saved");
      setOpen(false);
      router.refresh();
    });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <section className="mt-4 rounded-lg border bg-card p-4" aria-labelledby="catalog-placements">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="catalog-placements" className="flex items-center gap-2 text-sm font-semibold">
            <FolderTree className="size-4" aria-hidden /> Catalog placements
          </h2>
          <p className="text-sm text-muted-foreground">Where shoppers find this product when they browse the catalog hierarchy. It can sit on many items; it is never copied.</p>
        </div>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={begin} disabled={choices.length === 0}>
            Edit placements
          </Button>
        ) : null}
      </div>
      {placements.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Not placed anywhere yet.{" "}
          {choices.length === 0 ? (
            <>
              Allow products on a level and add items in the{" "}
              <Link href={ROUTES.catalog} className="text-link underline underline-offset-2">
                catalog hierarchy
              </Link>{" "}
              first.
            </>
          ) : null}
        </p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border text-sm">
          {placements.map((p) => (
            <li key={p.nodeId} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">{p.names.join(" › ")}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {p.levelName}
                <StatusBadge tone={p.status === "active" ? "active" : "draft"}>{p.status === "active" ? "Active" : "Draft"}</StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Dialog open onOpenChange={(o) => !o && !pending && setOpen(false)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Catalog placements</DialogTitle>
              <DialogDescription>Tick every item this product belongs on. Unticking removes it from that item; the product itself is not deleted.</DialogDescription>
            </DialogHeader>
            <Input aria-label="Filter items" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" />
            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border" aria-label="Items that can carry products">
              {shown.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nothing matches.</li> : null}
              {shown.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={(on) => toggle(c.id, on === true)} />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.levelName}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground" role="status">
              {selected.size} selected{choices.length > shown.length ? ` · showing the first ${shown.length}, filter to find more` : ""}
              {truncated ? " · the catalog is very large; placements not listed here are kept" : ""}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save placements
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
