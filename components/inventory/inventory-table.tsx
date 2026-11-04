"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { adjustStockAction } from "@/app/(dashboard)/dashboard/inventory/actions";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { INVENTORY_REASONS } from "@/lib/db/schema/enums";
import { inventoryAdjustSchema } from "@/lib/validations/catalog";
import type { InventoryRow } from "@/services/inventory.service";

const REASON_LABELS: Record<(typeof INVENTORY_REASONS)[number], string> = {
  restock: "Restock",
  correction: "Count correction",
  return: "Customer return",
  damage: "Damaged / lost",
  sale: "Sale",
  other: "Other",
};

export function StockState({ row }: { row: Pick<InventoryRow, "state" | "quantity"> }) {
  if (row.state === "untracked") return <StatusBadge tone="neutral">Not tracked</StatusBadge>;
  if (row.state === "out") return <StatusBadge tone="danger">Out of stock</StatusBadge>;
  if (row.state === "low") return <StatusBadge tone="warning">Low stock</StatusBadge>;
  return <StatusBadge tone="active">In stock</StatusBadge>;
}

const label = (r: InventoryRow) => (r.variantTitle ? `${r.productName} – ${r.variantTitle}` : r.productName);

export function InventoryTable({ rows, canAdjust }: { rows: InventoryRow[]; canAdjust: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<InventoryRow | null>(null);
  const [mode, setMode] = useState<"add" | "set">("add");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<(typeof INVENTORY_REASONS)[number]>("restock");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (r: InventoryRow) => {
    setTarget(r);
    setMode("add");
    setValue("");
    setReason("restock");
    setNote("");
    setErrors({});
    setFormError(null);
  };

  const num = Number(value);
  const preview = target && value.trim() !== "" && Number.isInteger(num) ? (mode === "set" ? num : target.quantity + num) : null;

  const submit = () => {
    if (!target) return;
    const payload = { productId: target.productId, variantId: target.variantId, mode, value, reason, note };
    const parsed = inventoryAdjustSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    startTransition(async () => {
      const res = await adjustStockAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(`Stock updated to ${res.data?.quantity}`);
      setTarget(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Product</TableHead>
              <TableHead className="hidden sm:table-cell">SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Available</TableHead>
              {canAdjust ? <TableHead className="w-24"><span className="sr-only">Adjust</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.productId}:${r.variantId ?? ""}`}>
                <TableCell>
                  <Link href={`${ROUTES.products}/${r.productId}`} className="font-medium hover:underline">{r.productName}</Link>
                  {r.variantTitle ? <span className="block text-xs text-muted-foreground">{r.variantTitle}</span> : null}
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{r.sku ?? "—"}</TableCell>
                <TableCell><StockState row={r} /></TableCell>
                <TableCell className="text-right tabular-nums">{r.tracked ? r.quantity : "—"}</TableCell>
                {canAdjust ? (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={!r.tracked} onClick={() => open(r)} title={r.tracked ? undefined : "Inventory is not tracked for this product"}>
                      <SlidersHorizontal aria-hidden /> Adjust
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && !pending && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>{target ? `${label(target)} · currently ${target.quantity}` : ""}</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <FormField id="adj-mode" label="Change">
                <NativeSelect id="adj-mode" value={mode} onChange={(e) => setMode(e.target.value as "add" | "set")}>
                  <option value="add">Add / remove</option>
                  <option value="set">Set to exact count</option>
                </NativeSelect>
              </FormField>
              <FormField id="adj-value" label={mode === "add" ? "Quantity (+/−)" : "New count"} error={errors.value} hint={preview !== null ? `New stock: ${preview}` : undefined}>
                <Input id="adj-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(errors.value)} aria-describedby="adj-value-msg" autoFocus placeholder={mode === "add" ? "e.g. 10 or -3" : "e.g. 42"} />
              </FormField>
            </div>
            <FormField id="adj-reason" label="Reason" error={errors.reason}>
              <NativeSelect id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                {INVENTORY_REASONS.map((r) => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="adj-note" label="Note (optional)" error={errors.note}>
              <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-describedby="adj-note-msg" />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Update stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
