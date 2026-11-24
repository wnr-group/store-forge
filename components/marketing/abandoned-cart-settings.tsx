"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveAbandonedCartSettingsAction } from "@/app/(dashboard)/dashboard/marketing/abandoned-carts/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** How long a cart sits idle before it counts as abandoned, and how long its recovery link works. */
export function AbandonedCartSettings({ minutes, days, canManage }: { minutes: number; days: number; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(String(minutes));
  const [d, setD] = useState(String(days));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const res = await saveAbandonedCartSettingsAction({ abandonmentThresholdMinutes: /^\d+$/.test(m.trim()) ? Number(m) : Number.NaN, recoveryLinkDays: /^\d+$/.test(d.trim()) ? Number(d) : Number.NaN });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Abandoned cart settings saved");
      router.refresh();
    });
  };
  const off = pending || !canManage;

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Settings" description="A cart counts as abandoned when nobody has touched it for the time below. Changing it applies to carts already waiting.">
        {formError ? (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        ) : null}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField id="ac-minutes" label="Abandoned after (minutes)" error={errors.abandonmentThresholdMinutes} hint="Between 15 minutes and 7 days (10080).">
            <Input id="ac-minutes" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} disabled={off} aria-invalid={Boolean(errors.abandonmentThresholdMinutes)} aria-describedby="ac-minutes-msg" />
          </FormField>
          <FormField id="ac-days" label="Recovery link works for (days)" error={errors.recoveryLinkDays} hint="After this a cart is expired and its link stops working.">
            <Input id="ac-days" inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} disabled={off} aria-invalid={Boolean(errors.recoveryLinkDays)} aria-describedby="ac-days-msg" />
          </FormField>
        </div>
        {canManage ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </form>
  );
}
