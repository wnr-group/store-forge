"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateBillingSettingsAction } from "@/app/(admin)/admin/commercial-actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { billingSettingsSchema, bpsToPercent } from "@/lib/validations/admin-commercial";

export type BillingSettingsView = {
  legalName: string;
  address: string | null;
  gstin: string | null;
  taxLabel: string;
  taxRateBps: number;
  dueDays: number;
  graceDays: number;
  renewalNoticeDays: number;
  paymentsConfigured: boolean;
};

/** What invoices say about the seller, the tax rate, and how renewals behave. Invoices already issued keep what they were issued with. */
export function BillingSettingsForm({ initial, canEdit }: { initial: BillingSettingsView; canEdit: boolean }) {
  const router = useRouter();
  const start = {
    legalName: initial.legalName,
    address: initial.address ?? "",
    gstin: initial.gstin ?? "",
    taxLabel: initial.taxLabel,
    taxPercent: bpsToPercent(initial.taxRateBps),
    dueDays: String(initial.dueDays),
    graceDays: String(initial.graceDays),
    renewalNoticeDays: String(initial.renewalNoticeDays),
  };
  const [v, setV] = useState(start);
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();
  const off = pending || !canEdit;
  const dirty = (Object.keys(start) as (keyof typeof start)[]).some((k) => v[k] !== start[k]);
  const field = (k: keyof typeof v, id: string) => ({
    id,
    value: v[k],
    disabled: off,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setV((cur) => ({ ...cur, [k]: e.target.value }));
      clear(k);
    },
    "aria-invalid": Boolean(errors[k]),
    "aria-describedby": `${id}-msg`,
  });

  return (
    <form
      noValidate
      className="mx-auto max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate(billingSettingsSchema, v)) return;
        send(async () => {
          const res = await updateBillingSettingsAction(v);
          if (!res.ok) return void fail(res);
          toast.success("Billing settings saved");
          router.refresh();
        });
      }}
    >
      {!canEdit ? <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">You can view the billing settings. Only a Super Admin or Billing Admin can change them.</p> : null}
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}

      <SectionCard title="Online payment" description="Organizations pay invoices through StoreForge's own Razorpay account. The keys are set on the server, never here, and are never shown.">
        <div className="flex items-center gap-2 text-sm">
          <StatusBadge tone={initial.paymentsConfigured ? "active" : "warning"}>{initial.paymentsConfigured ? "Configured" : "Not configured"}</StatusBadge>
          <span className="text-muted-foreground">
            {initial.paymentsConfigured ? "Organizations can pay invoices online." : "Organizations cannot pay online until the Razorpay keys are set on the server. You can still record offline payments."}
          </span>
        </div>
      </SectionCard>

      <SectionCard title="Seller details" description="Printed on every new invoice.">
        <FormField id="bs-name" label="Legal name" required error={errors.legalName}>
          <Input {...field("legalName", "bs-name")} />
        </FormField>
        <FormField id="bs-addr" label="Address" optional error={errors.address}>
          <Textarea {...field("address", "bs-addr")} rows={2} />
        </FormField>
        <FormField id="bs-gstin" label="GSTIN" optional error={errors.gstin} hint="15 letters and digits.">
          <Input {...field("gstin", "bs-gstin")} autoCapitalize="characters" />
        </FormField>
      </SectionCard>

      <SectionCard title="Tax" description="Added on top of the plan price. Set 0 if you do not charge tax.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="bs-label" label="Tax label" required error={errors.taxLabel}>
            <Input {...field("taxLabel", "bs-label")} />
          </FormField>
          <FormField id="bs-rate" label="Rate (%)" required error={errors.taxPercent} hint="For example 18 or 12.5.">
            <Input {...field("taxPercent", "bs-rate")} inputMode="decimal" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Renewals" description="When invoices are issued and what happens when they are not paid.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="bs-notice" label="Invoice this many days before renewal" required error={errors.renewalNoticeDays}>
            <Input {...field("renewalNoticeDays", "bs-notice")} inputMode="numeric" />
          </FormField>
          <FormField id="bs-due" label="Days to pay" required error={errors.dueDays} hint="For an invoice issued after its period has started.">
            <Input {...field("dueDays", "bs-due")} inputMode="numeric" />
          </FormField>
          <FormField id="bs-grace" label="Grace days" required error={errors.graceDays} hint="After the due date, the subscription is past due (access continues). After this many more days it expires.">
            <Input {...field("graceDays", "bs-grace")} inputMode="numeric" />
          </FormField>
        </div>
      </SectionCard>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
