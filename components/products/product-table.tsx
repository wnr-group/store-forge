"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, ImageIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteProductsAction,
  duplicateProductAction,
  setProductsStatusAction,
} from "@/app/(dashboard)/dashboard/products/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { formatMoney } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/services/product.service";

type Props = { rows: ProductRow[]; currency: string; canManage: boolean; canDelete: boolean };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Thumb({ path, name }: { path: string | null; name: string }) {
  const src = publicImageUrl(path);
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
      {src ? <Image src={src} alt={name} fill sizes="40px" className="object-cover" /> : <ImageIcon className="size-4" aria-hidden />}
    </span>
  );
}

function StockCell({ row }: { row: ProductRow }) {
  if (!row.trackInventory) return <span className="text-muted-foreground">Not tracked</span>;
  const variants = row.hasVariants ? ` · ${row.variantCount} variant${row.variantCount === 1 ? "" : "s"}` : "";
  if (row.stock <= 0) return <StatusBadge tone="danger">Out of stock{variants}</StatusBadge>;
  if (row.stock <= row.lowStockThreshold) return <StatusBadge tone="warning">{`Low · ${row.stock}${variants}`}</StatusBadge>;
  return <span className="tabular-nums">{row.stock} in stock{variants}</span>;
}

export function ProductTable({ rows, currency, canManage, canDelete }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set());

  const setStatus = (ids: string[], status: "active" | "draft") =>
    startTransition(async () => {
      const res = await setProductsStatusAction(ids, status);
      if (res.ok) {
        toast.success(status === "active" ? "Published" : "Moved to draft");
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });

  const duplicate = (id: string) =>
    startTransition(async () => {
      const res = await duplicateProductAction(id);
      if (res.ok && res.data) {
        toast.success("Duplicated as a draft");
        router.push(`${ROUTES.products}/${res.data.id}`);
      } else if (!res.ok) toast.error(res.error);
    });

  const selectedIds = [...selected].filter((id) => rows.some((r) => r.id === id));

  return (
    <>
      {selectedIds.length > 0 && canManage ? (
        <div role="region" aria-label="Bulk actions" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
          <span className="font-medium tabular-nums">{selectedIds.length} selected</span>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus(selectedIds, "active")}>
            <Eye aria-hidden /> Publish
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus(selectedIds, "draft")}>
            <EyeOff aria-hidden /> Move to draft
          </Button>
          {canDelete ? (
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirm({ ids: selectedIds, label: `${selectedIds.length} products` })}>
              <Trash2 aria-hidden /> Delete
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {canManage ? (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(c === true)} aria-label="Select all products on this page" />
                </TableHead>
              ) : null}
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="hidden xl:table-cell">Updated</TableHead>
              <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined} className="group">
                {canManage ? (
                  <TableCell>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => toggle(r.id, c === true)} aria-label={`Select ${r.name}`} />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link href={`${ROUTES.products}/${r.id}`} className="flex items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Thumb path={r.imagePath} name={r.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.sku ? `SKU ${r.sku}` : r.hasVariants ? "Multiple SKUs" : "No SKU"}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={r.status === "active" ? "active" : "draft"}>{r.status === "active" ? "Active" : "Draft"}</StatusBadge>
                </TableCell>
                <TableCell><StockCell row={r} /></TableCell>
                <TableCell className="text-right tabular-nums">{r.hasVariants ? "From " : ""}{formatMoney(r.priceMinor, currency)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{r.categoryName ?? "—"}</TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">{dateFmt.format(r.updatedAt)}</TableCell>
                <TableCell>
                  <RowMenu row={r} canManage={canManage} canDelete={canDelete} onStatus={setStatus} onDuplicate={duplicate} onDelete={() => setConfirm({ ids: [r.id], label: `"${r.name}"` })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            {canManage ? <Checkbox className="mt-1" checked={selected.has(r.id)} onCheckedChange={(c) => toggle(r.id, c === true)} aria-label={`Select ${r.name}`} /> : null}
            <Link href={`${ROUTES.products}/${r.id}`} className="flex min-w-0 flex-1 items-start gap-3">
              <Thumb path={r.imagePath} name={r.name} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <StatusBadge tone={r.status === "active" ? "active" : "draft"}>{r.status === "active" ? "Active" : "Draft"}</StatusBadge>
                  <span className="tabular-nums">{r.hasVariants ? "From " : ""}{formatMoney(r.priceMinor, currency)}</span>
                </span>
                <span className="block text-xs"><StockCell row={r} /></span>
              </span>
            </Link>
            <RowMenu row={r} canManage={canManage} canDelete={canDelete} onStatus={setStatus} onDuplicate={duplicate} onDelete={() => setConfirm({ ids: [r.id], label: `"${r.name}"` })} />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.label ?? ""}?`}
        description="This permanently removes the product, its variants and its images. This cannot be undone."
        confirmLabel="Delete"
        successMessage="Deleted"
        onConfirm={async () => {
          const res = await deleteProductsAction(confirm?.ids ?? []);
          if (res.ok) {
            setSelected(new Set());
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}

function RowMenu({
  row,
  canManage,
  canDelete,
  onStatus,
  onDuplicate,
  onDelete,
}: {
  row: ProductRow;
  canManage: boolean;
  canDelete: boolean;
  onStatus: (ids: string[], status: "active" | "draft") => void;
  onDuplicate: (id: string) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={`Actions for ${row.name}`}>
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem render={<Link href={`${ROUTES.products}/${row.id}`} />}>
          <Pencil aria-hidden /> {canManage ? "Edit" : "View"}
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onClick={() => onStatus([row.id], row.status === "active" ? "draft" : "active")}>
              {row.status === "active" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              {row.status === "active" ? "Move to draft" : "Publish"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(row.id)}>
              <Copy aria-hidden /> Duplicate
            </DropdownMenuItem>
          </>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
