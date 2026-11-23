"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveCodSettingsAction } from "@/app/(dashboard)/dashboard/payments/ledger-actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { currencyDigits } from "@/lib/money";

export type CodView = { configured: boolean; enabled: boolean; minOrderMinor: number; maxOrderMinor: number | null; feeMinor: number };

const toText = (minor: number | null, currency: string) => (minor === null ? "" : (minor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency)));

/** Cash-on-delivery rules. Which zones and delivery methods allow COD is set on each zone and method (Shipping). */
export function CodSettingsForm({ cod, currency }: { cod: CodView; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(cod.enabled);
  const [min, setMin] = useState(toText(cod.minOrderMinor, currency));
  const [max, setMax] = useState(toText(cod.maxOrderMinor, currency));
  const [fee, setFee] = useState(toText(cod.feeMinor, currency));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const res = await saveCodSettingsAction({ enabled, min, max, fee, currency });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Cash on delivery settings saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Cash on delivery" description="Offer cash on delivery at checkout. An order is never marked paid until you record the cash as collected.">
        {formError ? (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        ) : null}
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable cash on delivery" />
          <span>{enabled ? "Cash on delivery is on" : "Cash on delivery is off"}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="cod-min" label={`Minimum order (${currency})`} error={errors.min} hint="0 means no minimum.">
            <Input id="cod-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} aria-invalid={Boolean(errors.min)} aria-describedby="cod-min-msg" disabled={pending} />
          </FormField>
          <FormField id="cod-max" label={`Maximum order (${currency})`} optional error={errors.max} hint="Leave empty for no maximum.">
            <Input id="cod-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={Boolean(errors.max)} aria-describedby="cod-max-msg" disabled={pending} />
          </FormField>
          <FormField id="cod-fee" label={`COD charge (${currency})`} error={errors.fee} hint="Added to the order total.">
            <Input id="cod-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} aria-invalid={Boolean(errors.fee)} aria-describedby="cod-fee-msg" disabled={pending} />
          </FormField>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save COD settings"}
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}
