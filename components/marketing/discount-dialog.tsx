"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveDiscountAction } from "@/app/(dashboard)/dashboard/marketing/discounts/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { DiscountDetailApi } from "@/lib/api/endpoints/marketing-api";
import { bpsToPercentText, discountFormToPayload, isoToZonedLocal, type DiscountFormValues } from "@/lib/marketing/forms";
import { minorToInput } from "@/lib/money";
import { TargetPicker, type PickOption } from "./target-picker";

export type DiscountDialogContext = { currency: string; timeZone: string; products: PickOption[]; collections: PickOption[]; campaigns: PickOption[]; /** Choosing products needs catalog access; said so when it is missing. */ catalogAccess: boolean };

const fromDiscount = (d: DiscountDetailApi | undefined, ctx: DiscountDialogContext): DiscountFormValues =>
  d
    ? {
        code: d.code,
        description: d.description ?? "",
        kind: d.kind,
        value: d.kind === "percentage" ? bpsToPercentText(d.value) : minorToInput(d.value, ctx.currency),
        minSubtotal: d.minSubtotalMinor > 0 ? minorToInput(d.minSubtotalMinor, ctx.currency) : "",
        maxDiscount: d.maxDiscountMinor ? minorToInput(d.maxDiscountMinor, ctx.currency) : "",
        startsAt: isoToZonedLocal(d.startsAt, ctx.timeZone),
        expiresAt: isoToZonedLocal(d.expiresAt, ctx.timeZone),
        usageLimit: d.usageLimit ? String(d.usageLimit) : "",
        perCustomerLimit: d.perCustomerLimit ? String(d.perCustomerLimit) : "",
        appliesTo: d.appliesTo,
        productIds: d.products.map((p) => p.id),
        collectionIds: d.collections.map((c) => c.id),
        campaignId: d.campaignId ?? "",
        isActive: d.isActive,
      }
    : { code: "", description: "", kind: "percentage", value: "", minSubtotal: "", maxDiscount: "", startsAt: "", expiresAt: "", usageLimit: "", perCustomerLimit: "", appliesTo: "all", productIds: [], collectionIds: [], campaignId: "", isActive: true };

/** Create or edit a discount code. Remount (key) per code so the fields reset. */
export function DiscountDialog({ open, onOpenChange, discount, ctx }: { open: boolean; onOpenChange: (open: boolean) => void; discount?: DiscountDetailApi; ctx: DiscountDialogContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<DiscountFormValues>(() => fromDiscount(discount, ctx));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!discount;
  const patch = (p: Partial<DiscountFormValues>, clear: string[] = Object.keys(p)) => {
    setV((x) => ({ ...x, ...p }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))));
  };
  const disabled = pending;

  const submit = () => {
    setFormError(null);
    const r = discountFormToPayload(v, { currency: ctx.currency, timeZone: ctx.timeZone, creating: !editing });
    if (!r.ok) {
      setErrors(r.errors);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    start(async () => {
      const res = await saveDiscountAction(discount?.id ?? null, editing ? { ...r.value, code: discount.code } : r.value);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(editing ? "Discount code updated" : "Discount code created");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${discount.code}` : "Create discount code"}</DialogTitle>
          <DialogDescription>Shoppers type the code at checkout. Whether it applies is always decided by your store when the order is priced, never in the browser.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {formError ? (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField id="dc-code" label="Code" required error={errors.code} hint={editing ? "A code cannot be changed after it is created." : "Letters, numbers, hyphens. Saved in capitals."}>
              <Input id="dc-code" value={v.code} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} disabled={disabled || editing} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={32} aria-invalid={Boolean(errors.code)} aria-describedby="dc-code-msg" autoFocus={!editing} />
            </FormField>
            <FormField id="dc-kind" label="Type">
              <NativeSelect id="dc-kind" value={v.kind} onChange={(e) => patch({ kind: e.target.value as DiscountFormValues["kind"], value: "", maxDiscount: "" }, ["value", "maxDiscount"])} disabled={disabled}>
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </NativeSelect>
            </FormField>
            <FormField id="dc-value" label={v.kind === "percentage" ? "Percentage" : `Amount off (${ctx.currency})`} required error={errors.value} hint={v.kind === "percentage" ? "For example 10 for 10% off." : "Taken off the items in the bag."}>
              <Input id="dc-value" inputMode="decimal" value={v.value} onChange={(e) => patch({ value: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.value)} aria-describedby="dc-value-msg" placeholder={v.kind === "percentage" ? "10" : "250"} />
            </FormField>
            {v.kind === "percentage" ? (
              <FormField id="dc-max" label={`Maximum discount (${ctx.currency})`} optional error={errors.maxDiscount} hint="The most one order can get off.">
                <Input id="dc-max" inputMode="decimal" value={v.maxDiscount} onChange={(e) => patch({ maxDiscount: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.maxDiscount)} aria-describedby="dc-max-msg" />
              </FormField>
            ) : null}
            <FormField id="dc-min" label={`Minimum purchase (${ctx.currency})`} optional error={errors.minSubtotal} hint="The eligible items must add up to at least this.">
              <Input id="dc-min" inputMode="decimal" value={v.minSubtotal} onChange={(e) => patch({ minSubtotal: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.minSubtotal)} aria-describedby="dc-min-msg" />
            </FormField>
          </div>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField id="dc-start" label="Starts" optional error={errors.startsAt} hint={`In your store time zone (${ctx.timeZone}).`}>
              <Input id="dc-start" type="datetime-local" value={v.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.startsAt)} aria-describedby="dc-start-msg" />
            </FormField>
            <FormField id="dc-end" label="Expires" optional error={errors.expiresAt} hint="Leave empty for no expiry.">
              <Input id="dc-end" type="datetime-local" value={v.expiresAt} onChange={(e) => patch({ expiresAt: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.expiresAt)} aria-describedby="dc-end-msg" />
            </FormField>
            <FormField id="dc-uses" label="Total uses" optional error={errors.usageLimit} hint="Orders that can use it in all.">
              <Input id="dc-uses" inputMode="numeric" value={v.usageLimit} onChange={(e) => patch({ usageLimit: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.usageLimit)} aria-describedby="dc-uses-msg" />
            </FormField>
            <FormField id="dc-per" label="Uses per customer" optional error={errors.perCustomerLimit} hint="Counted by email address.">
              <Input id="dc-per" inputMode="numeric" value={v.perCustomerLimit} onChange={(e) => patch({ perCustomerLimit: e.target.value })} disabled={disabled} aria-invalid={Boolean(errors.perCustomerLimit)} aria-describedby="dc-per-msg" />
            </FormField>
          </div>

          <FormField id="dc-applies" label="Applies to">
            <NativeSelect id="dc-applies" value={v.appliesTo} onChange={(e) => patch({ appliesTo: e.target.value as DiscountFormValues["appliesTo"] }, ["productIds", "collectionIds"])} disabled={disabled}>
              <option value="all">Everything in the bag</option>
              <option value="products">Selected products</option>
              <option value="collections">Selected collections</option>
            </NativeSelect>
          </FormField>
          {v.appliesTo === "products" ? (
            <TargetPicker id="dc-products" label="Products" options={ctx.products} value={v.productIds} onChange={(productIds) => patch({ productIds })} error={errors.productIds} disabled={disabled} emptyText={ctx.catalogAccess ? "You have no products yet." : "Choosing products needs access to products and inventory."} />
          ) : null}
          {v.appliesTo === "collections" ? (
            <TargetPicker id="dc-collections" label="Collections" options={ctx.collections} value={v.collectionIds} onChange={(collectionIds) => patch({ collectionIds })} error={errors.collectionIds} disabled={disabled} emptyText={ctx.catalogAccess ? "You have no collections yet." : "Choosing collections needs access to products and inventory."} />
          ) : null}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField id="dc-campaign" label="Campaign" optional hint="A code in a campaign works only while the campaign is live.">
              <NativeSelect id="dc-campaign" value={v.campaignId} onChange={(e) => patch({ campaignId: e.target.value })} disabled={disabled}>
                <option value="">None</option>
                {ctx.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="dc-desc" label="Note" optional error={errors.description} hint="Only you see this.">
              <Input id="dc-desc" value={v.description} onChange={(e) => patch({ description: e.target.value })} disabled={disabled} maxLength={500} aria-describedby="dc-desc-msg" />
            </FormField>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Switch checked={v.isActive} onCheckedChange={(isActive) => patch({ isActive }, [])} disabled={disabled} aria-label="Code is active" />
            <span>{v.isActive ? "Active: shoppers can use it" : "Off: shoppers cannot use it"}</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : editing ? "Save changes" : "Create code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
