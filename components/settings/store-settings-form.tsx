"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveStoreSettingsAction } from "@/app/(dashboard)/dashboard/settings/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { storeSettingsSchema } from "@/lib/validations/catalog";
import type { Store } from "@/lib/db/schema";

type Props = { store: Store; canEdit: boolean; currencyLocked: boolean };

const names = (kind: "currency" | "timeZone") => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(kind);
  } catch {
    return [];
  }
};

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
  const currencies = useMemo(() => Array.from(new Set([store.currency, "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", ...names("currency")])), [store.currency]);
  const zones = useMemo(() => Array.from(new Set([store.timezone, "Asia/Kolkata", "UTC", ...names("timeZone")])), [store.timezone]);
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
      className="space-y-4"
    >
      {!canEdit ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Only owners and admins can change store settings.</p> : null}
      {formError ? <div role="alert" className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{formError}</div> : null}

      <SectionCard title="Store profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-name" label="Store name" required error={errors.name}>
            <Input id="st-name" value={v.name} onChange={set("name")} onBlur={blur("name")} disabled={off} aria-invalid={Boolean(errors.name)} aria-describedby="st-name-msg" aria-required />
          </FormField>
          <FormField id="st-slug" label="Store slug" required error={errors.slug} hint={`${v.slug || "your-store"}.storeforge.app`}>
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
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-email" label="Store email" optional error={errors.contactEmail}>
            <Input id="st-email" type="email" value={v.contactEmail} onChange={set("contactEmail")} onBlur={blur("contactEmail")} disabled={off} aria-invalid={Boolean(errors.contactEmail)} aria-describedby="st-email-msg" />
          </FormField>
          <FormField id="st-phone" label="Store phone" optional error={errors.contactPhone}>
            <Input id="st-phone" type="tel" value={v.contactPhone} onChange={set("contactPhone")} onBlur={blur("contactPhone")} disabled={off} aria-invalid={Boolean(errors.contactPhone)} aria-describedby="st-phone-msg" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Regional">
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
      </SectionCard>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || logo.some((l) => l.status === "uploading")}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
