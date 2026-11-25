"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, Pencil, Repeat } from "lucide-react";
import { toast } from "sonner";
import { assignPlanAction, issueInvoiceAction, setFeatureOverrideAction, setLimitOverrideAction } from "@/app/(admin)/admin/commercial-actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { assignPlanSchema, limitOverrideSchema } from "@/lib/validations/admin-commercial";

const MB = 1_048_576;

type PlanChoice = { id: string; name: string; monthlyPrice: string; yearlyPrice: string; currency: string; trialDays: number };

/** Move an organization to another active plan, for an upgrade or a downgrade. What it may use changes straight away. */
export function ChangePlanButton({ tenantId, currentPlanId, interval, plans }: { tenantId: string; currentPlanId: string; interval: "monthly" | "yearly"; plans: PlanChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ planId: currentPlanId, billingInterval: interval, startTrial: false });
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();
  const chosen = plans.find((p) => p.id === v.planId);

  return (
    <>
      <Button variant="outline" onClick={() => { setV({ planId: currentPlanId, billingInterval: interval, startTrial: false }); setOpen(true); }}>
        <Repeat aria-hidden /> Change plan
      </Button>
      {open ? (
        <Dialog open onOpenChange={(o) => !pending && !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change plan</DialogTitle>
              <DialogDescription>Only active plans are offered. The organization gets the new plan&apos;s features and limits immediately. A paid plan is invoiced from the Billing section.</DialogDescription>
            </DialogHeader>
            <form
              noValidate
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validate(assignPlanSchema, v)) return;
                send(async () => {
                  const res = await assignPlanAction(tenantId, v);
                  if (!res.ok) return void fail(res);
                  toast.success("Plan changed");
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
              <FormField id="cp-plan" label="Plan" required error={errors.planId}>
                <NativeSelect id="cp-plan" value={v.planId} disabled={pending} onChange={(e) => { setV({ ...v, planId: e.target.value }); clear("planId"); }}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.id === currentPlanId ? " (current)" : ""}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="cp-interval" label="Billing" required error={errors.billingInterval} hint={chosen ? `${chosen.currency} ${v.billingInterval === "yearly" ? chosen.yearlyPrice : chosen.monthlyPrice} per ${v.billingInterval === "yearly" ? "year" : "month"}, before tax` : undefined}>
                <NativeSelect id="cp-interval" value={v.billingInterval} disabled={pending} onChange={(e) => setV({ ...v, billingInterval: e.target.value as "monthly" | "yearly" })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </NativeSelect>
              </FormField>
              {chosen && chosen.trialDays > 0 && chosen.id !== currentPlanId ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v.startTrial} onCheckedChange={(on) => setV({ ...v, startTrial: on === true })} disabled={pending} aria-label="Start the plan trial" />
                  Start its {chosen.trialDays}-day trial
                </label>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Change plan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/** Follow the plan, or force a feature on or off for this organization only. An exception always wins over the plan. */
export function FeatureOverrideSelect({ tenantId, featureKey, label, current, canEdit }: { tenantId: string; featureKey: string; label: string; current: boolean | null; canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const value = current === null ? "plan" : current ? "on" : "off";
  if (!canEdit) return null;
  return (
    <NativeSelect
      aria-label={`${label}: follow the plan, or make an exception`}
      value={value}
      disabled={pending}
      className="h-8 w-40 text-xs"
      onChange={async (e) => {
        setPending(true);
        const res = await setFeatureOverrideAction(tenantId, { key: featureKey, enabled: e.target.value === "plan" ? null : e.target.value === "on", note: "" });
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Saved");
        router.refresh();
      }}
    >
      <option value="plan">Follow the plan</option>
      <option value="on">Always on</option>
      <option value="off">Always off</option>
    </NativeSelect>
  );
}

/** Give this organization its own warning and hard limit for one resource, or go back to the plan's. */
export function LimitOverrideButton({ tenantId, limitKey, label, unit, soft, hard, hasOverride }: { tenantId: string; limitKey: string; label: string; unit: "count" | "bytes"; soft: number | null; hard: number | null; hasOverride: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const show = (n: number | null) => (n === null ? "" : String(unit === "bytes" ? Math.round(n / MB) : n));
  const [v, setV] = useState({ soft: show(soft), hard: show(hard), note: "" });
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();
  const unitWord = unit === "bytes" ? " (MB)" : "";
  const toBytes = (s: string) => (s.trim() === "" || unit === "count" ? s : String(Math.round(Number(s) * MB)));

  const save = (clear_: boolean) => {
    const body = { key: limitKey, clear: clear_, soft: toBytes(v.soft), hard: toBytes(v.hard), note: v.note };
    if (!clear_ && !validate(limitOverrideSchema, body)) return;
    send(async () => {
      const res = await setLimitOverrideAction(tenantId, body);
      if (!res.ok) return void fail(res);
      toast.success(clear_ ? "Back to the plan's limit" : "Limit saved for this organization");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Set a limit for ${label} for this organization`} onClick={() => { setV({ soft: show(soft), hard: show(hard), note: "" }); setOpen(true); }}>
        <Pencil aria-hidden />
      </Button>
      {open ? (
        <Dialog open onOpenChange={(o) => !pending && !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{label}: limit for this organization</DialogTitle>
              <DialogDescription>This organization&apos;s own limit replaces its plan&apos;s, whatever the plan says. Leave both boxes empty for no limit at all. It applies from the next request.</DialogDescription>
            </DialogHeader>
            <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(false); }}>
              {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="lo-soft" label={`Warn at${unitWord}`} optional error={errors.soft}>
                  <Input id="lo-soft" inputMode="numeric" value={v.soft} disabled={pending} onChange={(e) => { setV({ ...v, soft: e.target.value }); clear("soft"); }} aria-invalid={Boolean(errors.soft)} aria-describedby="lo-soft-msg" placeholder="No warning" />
                </FormField>
                <FormField id="lo-hard" label={`Hard limit${unitWord}`} optional error={errors.hard}>
                  <Input id="lo-hard" inputMode="numeric" value={v.hard} disabled={pending} onChange={(e) => { setV({ ...v, hard: e.target.value }); clear("hard"); }} aria-invalid={Boolean(errors.hard)} aria-describedby="lo-hard-msg" placeholder="No limit" />
                </FormField>
              </div>
              <FormField id="lo-note" label="Why" optional error={errors.note} hint="Shown to other admins.">
                <Input id="lo-note" value={v.note} disabled={pending} onChange={(e) => { setV({ ...v, note: e.target.value }); clear("note"); }} />
              </FormField>
              <DialogFooter className="sm:justify-between">
                {hasOverride ? (
                  <Button type="button" variant="ghost" onClick={() => save(true)} disabled={pending}>Use the plan&apos;s limit</Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save limit"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/** Issue the invoice for the period the organization is in now, or the next one. A period is only ever invoiced once. */
export function IssueInvoiceButtons({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"current" | "next" | null>(null);
  const issue = async (period: "current" | "next") => {
    setPending(period);
    const res = await issueInvoiceAction(tenantId, { period });
    setPending(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Invoice ${res.data?.number ?? ""} issued`);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => issue("current")}>
        {pending === "current" ? <Loader2 className="animate-spin" aria-hidden /> : <FilePlus2 aria-hidden />} Invoice current period
      </Button>
      <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => issue("next")}>
        {pending === "next" ? <Loader2 className="animate-spin" aria-hidden /> : <FilePlus2 aria-hidden />} Invoice next period
      </Button>
    </div>
  );
}
