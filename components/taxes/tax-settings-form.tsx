"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveTaxSettingsAction } from "@/app/(dashboard)/dashboard/taxes/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { GST_RATES_BPS, rateLabel } from "@/lib/tax/rates";

export type TaxSettingsView = { enabled: boolean; gstin: string; legalName: string; stateName: string | null; pricesIncludeTax: boolean; defaultRateBps: number; chargesTaxable: boolean; chargesRateBps: number };

/** GST settings. The state in the GSTIN decides CGST + SGST (delivery in the same state) or IGST (another state). */
export function TaxSettingsForm({ settings, canManage }: { settings: TaxSettingsView; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const res = await saveTaxSettingsAction({ enabled: v.enabled, gstin: v.gstin, legalName: v.legalName, pricesIncludeTax: v.pricesIncludeTax, defaultRateBps: v.defaultRateBps, chargesTaxable: v.chargesTaxable, chargesRateBps: v.chargesRateBps });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Tax settings saved");
      router.refresh();
    });
  };
  const off = pending || !canManage;
  const rates = (id: string, value: number, onChange: (n: number) => void) => (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={off}>
      {GST_RATES_BPS.map((r) => (
        <option key={r} value={r}>
          {rateLabel(r)}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="GST" description="Charge GST at checkout. Each order keeps the exact tax it was charged, so changing these settings never alters past orders.">
        {formError ? (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        ) : null}
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} disabled={off} aria-label="Charge GST" />
          <span>{v.enabled ? "GST is charged on orders" : "GST is off: no tax is charged"}</span>
        </label>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField id="tx-gstin" label="GSTIN" required={v.enabled} optional={!v.enabled} error={errors.gstin} hint={settings.stateName ? `Registered in ${settings.stateName}.` : "The first two digits are your state."}>
            <Input id="tx-gstin" value={v.gstin} maxLength={15} autoCapitalize="characters" spellCheck={false} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} aria-invalid={Boolean(errors.gstin)} aria-describedby="tx-gstin-msg" disabled={off} />
          </FormField>
          <FormField id="tx-legal" label="Registered business name" optional error={errors.legalName}>
            <Input id="tx-legal" value={v.legalName} maxLength={200} onChange={(e) => setV({ ...v, legalName: e.target.value })} disabled={off} />
          </FormField>
          <FormField id="tx-default" label="Default GST rate" hint="For products with no rate of their own (set per product on the product page).">
            {rates("tx-default", v.defaultRateBps, (n) => setV({ ...v, defaultRateBps: n }))}
          </FormField>
          <FormField id="tx-incl" label="Prices">
            <NativeSelect id="tx-incl" value={v.pricesIncludeTax ? "incl" : "excl"} onChange={(e) => setV({ ...v, pricesIncludeTax: e.target.value === "incl" })} disabled={off}>
              <option value="excl">Exclude GST (tax is added at checkout)</option>
              <option value="incl">Include GST (tax is taken out of the price)</option>
            </NativeSelect>
          </FormField>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 self-center text-sm">
            <Switch checked={v.chargesTaxable} onCheckedChange={(chargesTaxable) => setV({ ...v, chargesTaxable })} disabled={off} aria-label="Charge GST on delivery and COD charges" />
            <span>Charge GST on delivery and cash-on-delivery charges</span>
          </label>
          <FormField id="tx-charges" label="GST rate for delivery and COD charges">
            {rates("tx-charges", v.chargesRateBps, (n) => setV({ ...v, chargesRateBps: n }))}
          </FormField>
        </div>
        {canManage ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save tax settings"}
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </form>
  );
}
