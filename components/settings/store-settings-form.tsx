"use client";

import { useMemo, useState, useTransition } from "react";
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currencies = useMemo(() => Array.from(new Set([store.currency, "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", ...names("currency")])), [store.currency]);
  const zones = useMemo(() => Array.from(new Set([store.timezone, "Asia/Kolkata", "UTC", ...names("timeZone")])), [store.timezone]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const off = pending || !canEdit;

  const submit = () => {
    setFormError(null);
    const done = logo.find((l) => l.status === "done" && l.path);
    const payload = { ...v, logoPath: done?.path ?? null };
    const parsed = storeSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveStoreSettingsAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
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
      {formError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div> : null}

      <SectionCard title="Store profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-name" label="Store name" error={errors.name}>
            <Input id="st-name" value={v.name} onChange={set("name")} disabled={off} aria-invalid={Boolean(errors.name)} aria-describedby="st-name-msg" />
          </FormField>
          <FormField id="st-slug" label="Store address" error={errors.slug} hint={`${v.slug || "your-store"}.storeforge.app`}>
            <Input id="st-slug" value={v.slug} onChange={set("slug")} disabled={off} aria-invalid={Boolean(errors.slug)} aria-describedby="st-slug-msg" />
          </FormField>
        </div>
        <FormField id="st-desc" label="Description" error={errors.description}>
          <Textarea id="st-desc" rows={3} value={v.description} onChange={set("description")} disabled={off} maxLength={500} aria-describedby="st-desc-msg" />
        </FormField>
        <div>
          <p className="mb-2 text-sm font-medium">Logo</p>
          <ImageUploader value={logo} onChange={setLogo} scope="store" max={1} single disabled={off} label="Store logo" />
        </div>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-email" label="Contact email" error={errors.contactEmail}>
            <Input id="st-email" type="email" value={v.contactEmail} onChange={set("contactEmail")} disabled={off} aria-invalid={Boolean(errors.contactEmail)} aria-describedby="st-email-msg" />
          </FormField>
          <FormField id="st-phone" label="Contact phone" error={errors.contactPhone}>
            <Input id="st-phone" type="tel" value={v.contactPhone} onChange={set("contactPhone")} disabled={off} aria-describedby="st-phone-msg" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Regional">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-currency" label="Currency" error={errors.currency} hint={currencyLocked ? "Locked: you already have products or orders priced in this currency." : "Cannot be changed after you add products."}>
            <NativeSelect id="st-currency" value={v.currency} onChange={set("currency")} disabled={off || currencyLocked} aria-describedby="st-currency-msg">
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="st-tz" label="Timezone" error={errors.timezone} hint="Used for dates and analytics.">
            <NativeSelect id="st-tz" value={v.timezone} onChange={set("timezone")} disabled={off} aria-describedby="st-tz-msg">
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
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}
