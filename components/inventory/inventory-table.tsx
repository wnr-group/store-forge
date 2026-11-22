"use client";

import { useState } from "react";
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
import { INVENTORY_REASONS } from "@/lib/domain/enums";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
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
  const finalFocus = useReturnFocus(target !== null);
  const [mode, setMode] = useState<"add" | "set">("add");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<(typeof INVENTORY_REASONS)[number]>("restock");
  const [note, setNote] = useState("");
  const { errors, formError, pending, validate, validateField, clear, fail, reset, submit: send } = useFormErrors();

  const open = (r: InventoryRow) => {
    setTarget(r);
    setMode("add");
    setValue("");
    setReason("restock");
    setNote("");
    reset();
  };

  const num = Number(value);
  const preview = target && value.trim() !== "" && Number.isInteger(num) ? (mode === "set" ? num : target.quantity + num) : null;

  const payloadOf = (t: InventoryRow) => ({ productId: t.productId, variantId: t.variantId, mode, value, reason, note });
  const blur = (field: string) => () => target && validateField(inventoryAdjustSchema, payloadOf(target), field);

  const submit = () => {
    if (!target) return;
    const payload = payloadOf(target);
    if (!validate(inventoryAdjustSchema, payload)) return;
    send(async () => {
      const res = await adjustStockAction(payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(`Stock updated to ${res.data?.quantity}`);
      setTarget(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Product</TableHead>
              <TableHead className="hidden sm:table-cell">SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Available</TableHead>
              {canAdjust ? <TableHead className="w-24"><span className="sr-only">Adjust</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.productId}:${r.variantId ?? ""}`}>
                <TableCell>
                  <Link href={`${ROUTES.products}/${r.productId}`} className="font-medium hover:text-primary hover:underline">{r.productName}</Link>
                  {r.variantTitle ? <span className="block text-xs text-muted-foreground">{r.variantTitle}</span> : null}
                  {r.tracked ? <span className="block text-xs tabular-nums text-muted-foreground sm:hidden">{r.quantity} available</span> : null}
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{r.sku ?? "—"}</TableCell>
                <TableCell><StockState row={r} /></TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.tracked ? r.quantity : "—"}</TableCell>
                {canAdjust ? (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={!r.tracked} onClick={() => open(r)} aria-label={`Adjust stock for ${label(r)}`} title={r.tracked ? undefined : "Inventory is not tracked for this product"}>
                      <SlidersHorizontal aria-hidden /> <span className="hidden sm:inline">Adjust</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && !pending && setTarget(null)}>
        <DialogContent finalFocus={finalFocus}>
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
            {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <FormField id="adj-mode" label="Adjustment type" required>
                <NativeSelect id="adj-mode" value={mode} onChange={(e) => { setMode(e.target.value as "add" | "set"); clear("value"); }} aria-required disabled={pending}>
                  <option value="add">Add / remove</option>
                  <option value="set">Set to exact count</option>
                </NativeSelect>
              </FormField>
              <FormField id="adj-value" label={mode === "add" ? "Quantity (+/−)" : "New count"} required error={errors.value} hint={preview !== null ? `New stock: ${preview}` : undefined}>
                <Input id="adj-value" inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); clear("value"); }} onBlur={blur("value")} aria-invalid={Boolean(errors.value)} aria-describedby="adj-value-msg" aria-required disabled={pending} autoFocus placeholder={mode === "add" ? "e.g. 10 or -3" : "e.g. 42"} />
              </FormField>
            </div>
            <FormField id="adj-reason" label="Reason" required error={errors.reason}>
              <NativeSelect id="adj-reason" value={reason} onChange={(e) => { setReason(e.target.value as typeof reason); clear("reason"); }} aria-invalid={Boolean(errors.reason)} aria-describedby="adj-reason-msg" aria-required disabled={pending}>
                {INVENTORY_REASONS.map((r) => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="adj-note" label="Note" optional error={errors.note}>
              <Input id="adj-note" value={note} onChange={(e) => { setNote(e.target.value); clear("note"); }} onBlur={blur("note")} aria-invalid={Boolean(errors.note)} aria-describedby="adj-note-msg" disabled={pending} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Updating…" : "Update stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
