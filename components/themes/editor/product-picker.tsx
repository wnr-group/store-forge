"use client";

import Image from "next/image";
import { ImageIcon, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { publicImageUrl } from "@/lib/storage/paths";
import { ActionError, usePickerProducts } from "@/lib/themes/queries";
import type { PickerProduct } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { ProductStatusBadge, type ProductStatus } from "./product-status";

type Props = {
  selectedProductId: string | null;
  /** The product being loaded into the preview, if any. */
  loadingProductId: string | null;
  /** True while a publish or reset is running: no other product may be picked meanwhile. */
  disabled?: boolean;
  onSelect: (product: PickerProduct) => void;
  /** State of a product by id; products with no entry are "Not customized". */
  statusOf: (productId: string) => ProductStatus;
  /** True when the list of customized products could not be read (the picker still works, without chips). */
  statusUnavailable: boolean;
};

/** The store's active products, searchable and paged, with each product's customization status. Picking one previews it. */
export function ProductPicker({ selectedProductId, loadingProductId, disabled, onSelect, statusOf, statusUnavailable }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(search.trim());
  const list = usePickerProducts({ page, search: deferred || undefined });

  return (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search products" aria-label="Search products" className="pl-8" />
      </div>
      <p className="text-xs text-muted-foreground">Status shows each product&apos;s own settings, not the shared page layout.</p>
      {statusUnavailable ? <p className="text-xs text-muted-foreground">Customization status could not be loaded.</p> : null}

      {list.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            {list.error instanceof ActionError ? list.error.message : "Products could not be loaded."}
            <Button size="xs" variant="outline" onClick={() => void list.refetch()}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : list.isLoading ? (
        <ul className="space-y-1.5" aria-busy="true" aria-label="Loading products">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}><Skeleton className="h-12 w-full" /></li>
          ))}
        </ul>
      ) : list.data && list.data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {deferred ? "No products match your search." : "You have no active products yet. Add and activate products under Catalog > Products to customize them here."}
        </p>
      ) : (
        <>
          <ul className={cn("space-y-1", list.isFetching && "opacity-70 transition-opacity")}>
            {list.data?.items.map((p) => {
              const selected = loadingProductId ? p.id === loadingProductId : p.id === selectedProductId;
              const url = publicImageUrl(p.imagePath);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    aria-current={selected || undefined}
                    disabled={disabled || (loadingProductId !== null && loadingProductId !== p.id)}
                    className={cn("flex w-full items-center gap-2 rounded-md border bg-card p-1.5 text-left outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60", selected && "border-primary ring-1 ring-primary")}
                  >
                    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                      {url ? <Image src={url} alt="" fill sizes="40px" className="object-cover" /> : <ImageIcon className="size-4" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <ProductStatusBadge status={loadingProductId === p.id ? "default" : statusOf(p.id)} className={cn("mt-0.5", loadingProductId === p.id && "hidden")} />
                      {loadingProductId === p.id ? <span className="mt-0.5 block text-xs text-muted-foreground">Loading…</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.data && list.data.totalPages > 1 ? (
            <nav className="flex items-center justify-between text-xs" aria-label="Product pages">
              <span className="text-muted-foreground">Page {list.data.page} of {list.data.totalPages}</span>
              <div className="flex gap-1.5">
                <Button size="xs" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="xs" variant="outline" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
