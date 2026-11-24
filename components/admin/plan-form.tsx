"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPlanAction, updatePlanAction } from "@/app/(admin)/admin/commercial-actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import type { PlanApi, PlanCatalogApi } from "@/lib/api/endpoints/platform-business-api";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { planFormSchema, planUpdateSchema } from "@/lib/validations/admin-commercial";

const MB = 1_048_576;
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

type Limits = Record<string, { soft: string; hard: string }>;

/** Storage is stored in bytes but typed in megabytes; counts are typed as they are. */
const toField = (n: number | null, unit: "count" | "bytes") => (n === null ? "" : String(unit === "bytes" ? Math.round(n / MB) : n));
const fromField = (s: string, unit: "count" | "bytes") => (s.trim() === "" ? "" : unit === "bytes" ? String(Math.round(Number(s) * MB)) : s.trim());

type Props = { catalog: PlanCatalogApi; plan?: PlanApi; canEdit: boolean };

/**
 * Create or edit a subscription plan. Which features and limits exist comes from the API's catalog, so a capability added to the
 * product appears here without a change to this screen. The plan code is permanent. Plans on a restricted list of features are
 * what tenants get from the moment they are assigned: nothing here is cached anywhere else.
 */
export function PlanForm({ catalog, plan, canEdit }: Props) {
  const router = useRouter();
  const editing = Boolean(plan);
  const unitOf = useMemo(() => Object.fromEntries(catalog.limits.map((l) => [l.key, l.unit])) as Record<string, "count" | "bytes">, [catalog]);

  const [v, setV] = useState({
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    currency: plan?.currency ?? "INR",
    monthlyPrice: plan?.monthlyPrice ?? "0",
    yearlyPrice: plan?.yearlyPrice ?? "0",
    trialDays: String(plan?.trialDays ?? 0),
    sortOrder: String(plan?.sortOrder ?? 0),
    isDefault: plan?.isDefault ?? false,
    isUnrestricted: plan?.isUnrestricted ?? false,
  });
  const [features, setFeatures] = useState<Record<string, boolean>>(() => Object.fromEntries(catalog.features.map((f) => [f.key, plan?.features[f.key] ?? false])));
  const [limits, setLimits] = useState<Limits>(() =>
    Object.fromEntries(catalog.limits.map((l) => [l.key, { soft: toField(plan?.limits[l.key]?.soft ?? null, l.unit), hard: toField(plan?.limits[l.key]?.hard ?? null, l.unit) }])),
  );
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();
  const off = pending || !canEdit;
  const currencies = CURRENCIES.includes(v.currency) ? CURRENCIES : [v.currency, ...CURRENCIES];
  const groups = useMemo(() => {
    const map = new Map<string, PlanCatalogApi["features"]>();
    for (const f of catalog.features) map.set(f.group, [...(map.get(f.group) ?? []), f]);
    return [...map];
  }, [catalog]);

  const text = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    clear(k);
  };
  const field = (k: keyof typeof v, id: string) => ({ id, value: String(v[k]), onChange: text(k), disabled: off, "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg` });

  const payload = () => ({
    ...v,
    features,
    limits: Object.fromEntries(Object.entries(limits).map(([k, l]) => [k, { soft: fromField(l.soft, unitOf[k]), hard: fromField(l.hard, unitOf[k]) }])),
  });

  const save = () => {
    const body = payload();
    if (!validate(editing ? planUpdateSchema : planFormSchema, body)) return;
    send(async () => {
      const res = editing && plan ? await updatePlanAction(plan.id, body) : await createPlanAction(body);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(editing ? "Plan saved" : "Plan created");
      if (editing) router.refresh();
      else router.push(ROUTES.adminPlans);
    });
  };

  return (
    <form noValidate className="mx-auto max-w-4xl space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {!canEdit ? <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">You can view this plan. Only a Super Admin or Platform Admin can change it.</p> : null}
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
      {editing && plan && plan.subscriberCount > 0 ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {plan.subscriberCount} tenant{plan.subscriberCount === 1 ? " is" : "s are"} on this plan. Changes to features and limits apply to them immediately.
        </p>
      ) : null}

      <SectionCard title="Plan" description="What the plan is called and what it is for.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pl-code" label="Code" required={!editing} error={errors.code} hint={editing ? "The code is permanent." : "Lowercase letters, numbers, - and _. Cannot be changed later."}>
            <Input {...field("code", "pl-code")} disabled={off || editing} autoComplete="off" placeholder="starter" />
          </FormField>
          <FormField id="pl-name" label="Name" required error={errors.name}>
            <Input {...field("name", "pl-name")} placeholder="Starter" />
          </FormField>
        </div>
        <FormField id="pl-desc" label="Description" optional error={errors.description}>
          <Textarea {...field("description", "pl-desc")} rows={2} placeholder="For small stores that are just starting out." />
        </FormField>
      </SectionCard>

      <SectionCard title="Pricing" description="Prices are what is invoiced each period, before tax. Enter 0 for a free plan.">
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField id="pl-cur" label="Currency" required error={errors.currency}>
            <NativeSelect {...field("currency", "pl-cur")}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="pl-monthly" label="Monthly price" required error={errors.monthlyPrice}>
            <Input {...field("monthlyPrice", "pl-monthly")} inputMode="decimal" />
          </FormField>
          <FormField id="pl-yearly" label="Yearly price" required error={errors.yearlyPrice}>
            <Input {...field("yearlyPrice", "pl-yearly")} inputMode="decimal" />
          </FormField>
          <FormField id="pl-trial" label="Trial days" required error={errors.trialDays} hint="0 for no trial.">
            <Input {...field("trialDays", "pl-trial")} inputMode="numeric" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Features" description="What a tenant on this plan can use. Anything left off is not available to it.">
        <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <Switch checked={v.isUnrestricted} onCheckedChange={(on) => setV((cur) => ({ ...cur, isUnrestricted: on }))} disabled={off} aria-label="Unrestricted plan" />
          <span>
            <span className="block font-medium">Unrestricted</span>
            <span className="text-muted-foreground">Every feature on and no limits, including features added later. Meant for grandfathered or internal plans; the choices below are ignored while this is on.</span>
          </span>
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          {groups.map(([group, items]) => (
            <fieldset key={group} className="space-y-2" disabled={off || v.isUnrestricted}>
              <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</legend>
              {items.map((f) => (
                <label key={f.key} className="flex items-start gap-2.5 text-sm">
                  <Checkbox checked={v.isUnrestricted || features[f.key]} onCheckedChange={(on) => setFeatures((cur) => ({ ...cur, [f.key]: on === true }))} className="mt-0.5" aria-label={f.label} />
                  <span>
                    <span className="block">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Limits" description="Leave a box empty for no limit. The warning limit only raises a notice; the hard limit refuses new items once reached.">
        <div className="space-y-4">
          {catalog.limits.map((l) => (
            <div key={l.key} className="grid items-start gap-3 sm:grid-cols-[1fr_9rem_9rem]">
              <div>
                <p className="text-sm font-medium">{l.label}{l.unit === "bytes" ? " (MB)" : ""}</p>
                <p className="text-xs text-muted-foreground">{l.description}{l.enforced ? "" : " Never blocks anything."}</p>
              </div>
              {(["soft", "hard"] as const).map((kind) => (
                <FormField key={kind} id={`pl-${l.key}-${kind}`} label={kind === "soft" ? "Warn at" : "Hard limit"} error={errors[`limits.${l.key}.${kind}`]} optional>
                  <Input
                    id={`pl-${l.key}-${kind}`}
                    inputMode="numeric"
                    value={limits[l.key][kind]}
                    onChange={(e) => {
                      setLimits((cur) => ({ ...cur, [l.key]: { ...cur[l.key], [kind]: e.target.value } }));
                      clear(`limits.${l.key}.${kind}`);
                    }}
                    disabled={off || v.isUnrestricted}
                    aria-invalid={Boolean(errors[`limits.${l.key}.${kind}`])}
                    aria-describedby={`pl-${l.key}-${kind}-msg`}
                    placeholder="No limit"
                  />
                </FormField>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Defaults" description="How the plan is offered.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={v.isDefault} onCheckedChange={(on) => setV((cur) => ({ ...cur, isDefault: on }))} disabled={off || (editing && plan?.isDefault) || (editing && plan?.status === "inactive")} aria-label="Default plan" />
            <span>
              <span className="block font-medium">Default plan</span>
              <span className="text-muted-foreground">{editing && plan?.isDefault ? "New tenants get this plan. To change the default, make another plan the default." : "New tenants start on this plan unless you choose another."}</span>
            </span>
          </label>
          <FormField id="pl-sort" label="List order" error={errors.sortOrder} hint="Lower numbers are listed first.">
            <Input {...field("sortOrder", "pl-sort")} inputMode="numeric" />
          </FormField>
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={ROUTES.adminPlans} className={buttonVariants({ variant: "outline" })}>{canEdit ? "Cancel" : "Back"}</Link>
        {canEdit ? (
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : editing ? "Save changes" : "Create plan"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
