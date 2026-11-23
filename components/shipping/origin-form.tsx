"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveOriginAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { INDIAN_STATE_NAMES } from "@/lib/checkout/states";

export type OriginView = { name: string; phone: string; email: string; line1: string; line2: string; city: string; state: string; postalCode: string };

/** Where parcels are picked up. Carriers need it to quote and book, so booking is refused until it is saved. */
export function OriginForm({ origin, canManage }: { origin: OriginView; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(origin);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof OriginView) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const res = await saveOriginAction(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Pickup address saved");
      router.refresh();
    });
  };

  const field = (k: keyof OriginView, label: string, opts: { optional?: boolean; className?: string; type?: string } = {}) => (
    <FormField id={`or-${k}`} label={label} optional={opts.optional} required={!opts.optional} error={errors[k]} className={opts.className}>
      <Input id={`or-${k}`} type={opts.type} value={v[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} aria-describedby={`or-${k}-msg`} disabled={pending || !canManage} />
    </FormField>
  );

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Pickup address" description="Where carriers collect your parcels. Used to check serviceability and book shipments.">
        {formError ? (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        ) : null}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {field("name", "Contact name")}
          {field("phone", "Phone", { type: "tel" })}
          {field("email", "Email", { optional: true, type: "email" })}
          {field("line1", "Address")}
          {field("line2", "Address line 2", { optional: true })}
          {field("city", "City")}
          <FormField id="or-state" label="State" required error={errors.state}>
            <NativeSelect id="or-state" value={v.state} onChange={set("state")} aria-invalid={Boolean(errors.state)} disabled={pending || !canManage}>
              <option value="">Select</option>
              {INDIAN_STATE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {field("postalCode", "PIN code")}
        </div>
        {canManage ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save pickup address"}
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </form>
  );
}
