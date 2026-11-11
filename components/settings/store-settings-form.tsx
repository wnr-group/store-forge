"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveStoreSettingsAction } from "@/app/(dashboard)/dashboard/settings/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { storefrontHost } from "@/lib/tenant/host";
import { FormField } from "@/components/shared/form-field";
import { SettingsSection } from "@/components/shared/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { storeSettingsSchema } from "@/lib/validations/catalog";
import type { Store } from "@/lib/domain/entities";

type Props = { store: Store; canEdit: boolean; currencyLocked: boolean };

const names = (kind: "currency" | "timeZone") => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(kind);
  } catch {
    return [];
  }
};

// Intl.supportedValuesOf() returns different lists in Node and in the browser, so rendering it during SSR makes the
// <option> lists differ and hydration fails. The server (and the hydration pass) render only the fixed base lists;
// the full browser lists are added right after, via useSyncExternalStore's separate server/client snapshots.
const NO_EXTRA = { currencies: [] as string[], zones: [] as string[] };
let clientExtra: typeof NO_EXTRA | undefined;
const getClientExtra = () => (clientExtra ??= { currencies: names("currency"), zones: names("timeZone") });
const getServerExtra = () => NO_EXTRA;
const subscribeNever = () => () => {};

export function StoreSettingsForm({ store, canEdit, currencyLocked }: Props) {
  const router = useRouter();
  const [v, setV] = useState({
    name: store.name,
    slug: store.slug,
    description: store.description ?? "",
    contactEmail: store.contactEmail ?? "",
    contactPhone: store.contactPhone ?? "",
    currency: store.currency,
    timezone: store.timezone,
  });
  const [logo, setLogo] = useState<ImageItem[]>(
    store.logoUrl ? [{ key: "existing", path: store.logoUrl, altText: null, progress: 100, status: "done", saved: true }] : [],
  );
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const extra = useSyncExternalStore(subscribeNever, getClientExtra, getServerExtra);
  const currencies = useMemo(() => Array.from(new Set([store.currency, "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", ...extra.currencies])), [store.currency, extra]);
  const zones = useMemo(() => Array.from(new Set([store.timezone, "Asia/Kolkata", "UTC", ...extra.zones])), [store.timezone, extra]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV({ ...v, [k]: e.target.value });
    clear(k);
  };
  const off = pending || !canEdit;
  const buildPayload = () => ({ ...v, logoPath: logo.find((l) => l.status === "done" && l.path)?.path ?? null });
  const blur = (k: keyof typeof v) => () => validateField(storeSettingsSchema, buildPayload(), k);

  const submit = () => {
    const payload = buildPayload();
    if (!validate(storeSettingsSchema, payload)) return;
    send(async () => {
      const res = await saveStoreSettingsAction(payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Store settings saved");
      router.refresh();
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="divide-y"
    >
      {!canEdit ? <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Only owners and admins can change store settings.</p> : null}
      {formError ? <div role="alert" className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{formError}</div> : null}

      <SettingsSection title="Store profile" description="How your store is named and presented to customers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-name" label="Store name" required error={errors.name}>
            <Input id="st-name" value={v.name} onChange={set("name")} onBlur={blur("name")} disabled={off} aria-invalid={Boolean(errors.name)} aria-describedby="st-name-msg" aria-required />
          </FormField>
          <FormField id="st-slug" label="Store slug" required error={errors.slug} hint={`Your store is served at ${storefrontHost(v.slug || "your-store", process.env.NEXT_PUBLIC_ROOT_DOMAIN)}`}>
            <Input id="st-slug" value={v.slug} onChange={set("slug")} onBlur={blur("slug")} disabled={off} aria-invalid={Boolean(errors.slug)} aria-describedby="st-slug-msg" aria-required />
          </FormField>
        </div>
        <FormField id="st-desc" label="Store description" optional error={errors.description} hint="Up to 500 characters.">
          <Textarea id="st-desc" rows={3} value={v.description} onChange={set("description")} onBlur={blur("description")} disabled={off} aria-invalid={Boolean(errors.description)} aria-describedby="st-desc-msg" />
        </FormField>
        <div>
          <p className="mb-2 text-sm font-medium">Logo</p>
          <ImageUploader value={logo} onChange={setLogo} scope="store" max={1} single disabled={off} label="Store logo" />
        </div>
      </SettingsSection>

      <SettingsSection title="Contact" description="How customers can reach your store.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-email" label="Store email" optional error={errors.contactEmail}>
            <Input id="st-email" type="email" value={v.contactEmail} onChange={set("contactEmail")} onBlur={blur("contactEmail")} disabled={off} aria-invalid={Boolean(errors.contactEmail)} aria-describedby="st-email-msg" />
          </FormField>
          <FormField id="st-phone" label="Store phone" optional error={errors.contactPhone}>
            <Input id="st-phone" type="tel" value={v.contactPhone} onChange={set("contactPhone")} onBlur={blur("contactPhone")} disabled={off} aria-invalid={Boolean(errors.contactPhone)} aria-describedby="st-phone-msg" />
          </FormField>
        </div>
      </SettingsSection>

      <SettingsSection title="Regional" description="Currency and timezone used for prices, dates and analytics.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-currency" label="Currency" required error={errors.currency} hint={currencyLocked ? "Locked: you already have products or orders priced in this currency." : "Cannot be changed after you add products."}>
            <NativeSelect id="st-currency" value={v.currency} onChange={set("currency")} disabled={off || currencyLocked} aria-invalid={Boolean(errors.currency)} aria-describedby="st-currency-msg" aria-required>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="st-tz" label="Timezone" required error={errors.timezone} hint="Used for dates and analytics.">
            <NativeSelect id="st-tz" value={v.timezone} onChange={set("timezone")} disabled={off} aria-invalid={Boolean(errors.timezone)} aria-describedby="st-tz-msg" aria-required>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </SettingsSection>

      {canEdit ? (
        <div className="flex justify-end pt-4 pb-6">
          <Button type="submit" disabled={pending || logo.some((l) => l.status === "uploading")}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
