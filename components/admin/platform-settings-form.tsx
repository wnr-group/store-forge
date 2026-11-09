"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformSettingsAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { platformSettingsSchema } from "@/lib/validations/admin-platform";

export type SettingsView = {
  platformName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultStoreStatus: "active" | "inactive";
};

type Props = { initial: SettingsView; canEdit: boolean; updatedLine: string | null };

// Intl.supportedValuesOf() differs between Node and the browser; the full lists are added only after hydration.
const names = (kind: "currency" | "timeZone") => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(kind);
  } catch {
    return [];
  }
};
const NO_EXTRA = { currencies: [] as string[], zones: [] as string[] };
let clientExtra: typeof NO_EXTRA | undefined;
const getClientExtra = () => (clientExtra ??= { currencies: names("currency"), zones: names("timeZone") });
const getServerExtra = () => NO_EXTRA;
const subscribeNever = () => () => {};

/**
 * Platform settings. Everyone with admin access can read them; only a super admin can change them (the server and database
 * both refuse anyone else).
 */
export function PlatformSettingsForm({ initial, canEdit, updatedLine }: Props) {
  const router = useRouter();
  const start = {
    platformName: initial.platformName,
    supportEmail: initial.supportEmail ?? "",
    defaultCurrency: initial.defaultCurrency,
    defaultTimezone: initial.defaultTimezone,
    defaultStoreStatus: initial.defaultStoreStatus,
  };
  const [v, setV] = useState(start);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const extra = useSyncExternalStore(subscribeNever, getClientExtra, getServerExtra);
  const currencies = useMemo(() => Array.from(new Set([initial.defaultCurrency, "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", ...extra.currencies])), [initial.defaultCurrency, extra]);
  const zones = useMemo(() => Array.from(new Set([initial.defaultTimezone, "Asia/Kolkata", "UTC", ...extra.zones])), [initial.defaultTimezone, extra]);
  const dirty = (Object.keys(start) as (keyof typeof start)[]).some((k) => v[k] !== start[k]);
  const off = pending || !canEdit;

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    clear(k);
  };
  const common = (k: keyof typeof v, id: string) => ({
    id, value: v[k], onChange: set(k), onBlur: () => validateField(platformSettingsSchema, v, k), disabled: off,
    "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(platformSettingsSchema, v)) return;
    send(async () => {
      const res = await updatePlatformSettingsAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    });
  };

  return (
    <form noValidate className="mx-auto max-w-3xl space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {!canEdit ? <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">You can view the platform settings. Only a super admin can change them.</p> : null}
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}

      <SectionCard title="Branding" description="Shown on the sign-in page and on the page people see when their account is not linked to an organization.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="ps-name" label="Platform name" required error={errors.platformName}>
            <Input {...common("platformName", "ps-name")} autoComplete="off" />
          </FormField>
          <FormField id="ps-email" label="Support email" optional error={errors.supportEmail} hint="Where people are told to ask for help.">
            <Input {...common("supportEmail", "ps-email")} type="email" autoComplete="off" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Defaults for new organizations" description="Applied when an organization is created. Existing stores are not changed.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="ps-currency" label="Currency" required error={errors.defaultCurrency}>
            <NativeSelect {...common("defaultCurrency", "ps-currency")}>
              {currencies.map((c) => (<option key={c} value={c}>{c}</option>))}
            </NativeSelect>
          </FormField>
          <FormField id="ps-tz" label="Timezone" required error={errors.defaultTimezone}>
            <NativeSelect {...common("defaultTimezone", "ps-tz")}>
              {zones.map((z) => (<option key={z} value={z}>{z}</option>))}
            </NativeSelect>
          </FormField>
          <FormField id="ps-status" label="New stores start as" required error={errors.defaultStoreStatus} hint="Inactive stores are not shown until activated.">
            <NativeSelect {...common("defaultStoreStatus", "ps-status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </FormField>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <>
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save settings"}
            </Button>
            {dirty && !pending ? <Button type="button" variant="ghost" onClick={() => setV(start)}>Discard</Button> : null}
          </>
        ) : null}
        {updatedLine ? <p className="text-xs text-muted-foreground">{updatedLine}</p> : null}
      </div>
    </form>
  );
}
