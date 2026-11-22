"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCompanyStoreAction, setCompanyStudioRolloutAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { updateStoreSchema } from "@/lib/validations/admin-org";

export type StoreView = {
  name: string;
  slug: string;
  description: string | null;
  currency: string;
  timezone: string;
  status: "active" | "inactive" | "suspended";
  contactEmail: string | null;
  contactPhone: string | null;
  hasMoneyData: boolean;
};

type Props = { tenantId: string; store: StoreView; storeUrl: string | null };

const STATUS_LABEL = { active: "Active", inactive: "Inactive", suspended: "Suspended" } as const;
const STATUS_TONE = { active: "active", inactive: "draft", suspended: "warning" } as const;

// Intl.supportedValuesOf() differs between Node and the browser, so the full lists are added only after hydration (same
// approach as the merchant settings form); the server render uses the fixed base lists.
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

function EditStoreForm({ tenantId, store }: Pick<Props, "tenantId" | "store">) {
  const router = useRouter();
  const start = {
    name: store.name,
    description: store.description ?? "",
    contactEmail: store.contactEmail ?? "",
    contactPhone: store.contactPhone ?? "",
    currency: store.currency,
    timezone: store.timezone,
  };
  const [v, setV] = useState(start);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const extra = useSyncExternalStore(subscribeNever, getClientExtra, getServerExtra);
  const currencies = useMemo(() => Array.from(new Set([store.currency, "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", ...extra.currencies])), [store.currency, extra]);
  const zones = useMemo(() => Array.from(new Set([store.timezone, "Asia/Kolkata", "UTC", ...extra.zones])), [store.timezone, extra]);
  const dirty = (Object.keys(start) as (keyof typeof start)[]).some((k) => v[k] !== start[k]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    clear(k);
  };
  const common = (k: keyof typeof v, id: string) => ({
    id,
    value: v[k],
    onChange: set(k),
    onBlur: () => validateField(updateStoreSchema, v, k),
    disabled: pending,
    "aria-invalid": Boolean(errors[k]),
    "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(updateStoreSchema, v)) return;
    send(async () => {
      const res = await updateCompanyStoreAction(tenantId, v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Store updated");
      router.refresh();
    });
  };

  return (
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
      <FormField id="es-name" label="Store name" required error={errors.name}>
        <Input {...common("name", "es-name")} aria-required autoComplete="off" />
      </FormField>
      <FormField id="es-desc" label="Store description" optional error={errors.description} hint="Up to 500 characters.">
        <Textarea {...common("description", "es-desc")} rows={3} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="es-email" label="Store email" optional error={errors.contactEmail}>
          <Input {...common("contactEmail", "es-email")} type="email" autoComplete="off" />
        </FormField>
        <FormField id="es-phone" label="Store phone" optional error={errors.contactPhone}>
          <Input {...common("contactPhone", "es-phone")} type="tel" autoComplete="off" />
        </FormField>
        <FormField
          id="es-currency"
          label="Currency"
          required
          error={errors.currency}
          hint={store.hasMoneyData ? "Locked: the store already has products or orders priced in this currency." : "Cannot be changed once products or orders exist."}
        >
          <NativeSelect {...common("currency", "es-currency")} disabled={pending || store.hasMoneyData} aria-required>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="es-tz" label="Timezone" required error={errors.timezone} hint="Used for dates and analytics.">
          <NativeSelect {...common("timezone", "es-tz")} aria-required>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save store"}
        </Button>
        {dirty && !pending ? (
          <Button type="button" variant="ghost" onClick={() => setV(start)}>
            Discard
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function StudioRolloutSection({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggle = async (newVal: boolean) => {
    const promptReason = window.prompt(
      `Why are you ${newVal ? "enabling" : "disabling"} Store Forge Studio for this store?`,
      newVal ? "Enabling Studio feature rollout" : "Disabling Studio feature rollout",
    );
    if (!promptReason || !promptReason.trim()) {
      toast.error("A reason is required to change the rollout flag.");
      return;
    }
    setPending(true);
    try {
      const res = await setCompanyStudioRolloutAction(tenantId, {
        enabled: newVal,
        reason: promptReason.trim(),
      });
      if (res.ok) {
        setEnabled(newVal);
        toast.success(`Store Forge Studio ${newVal ? "enabled" : "disabled"}`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update Studio rollout");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Store Forge Studio Feature Flag</h4>
          <p className="text-xs text-muted-foreground">
            Enables schema version 2 (display rules, countdown, trust badges, readiness panel). Default off for existing stores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={enabled ? "destructive" : "default"}
            disabled={pending}
            onClick={() => toggle(!enabled)}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
            {enabled ? "Disable Studio" : "Enable Studio"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Platform Admin: the organization's primary store. Its details can be edited here; to take the store offline, suspend or delete the organization. */
export function StorePanel({ tenantId, store, storeUrl }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Store address: </span>
          {storeUrl ? (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              {storeUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span>{store.slug}</span>
          )}
          <span className="text-muted-foreground"> (cannot be changed here)</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">Store status:</span>
          <StatusBadge tone={STATUS_TONE[store.status]}>{STATUS_LABEL[store.status]}</StatusBadge>
        </span>
      </div>
      <hr />
      <StudioRolloutSection tenantId={tenantId} />
      <hr />
      <EditStoreForm key={`${store.name}|${store.description}|${store.contactEmail}|${store.contactPhone}|${store.currency}|${store.timezone}`} tenantId={tenantId} store={store} />
    </div>
  );
}
