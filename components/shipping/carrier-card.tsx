"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Plug, Star, Unplug } from "lucide-react";
import { toast } from "sonner";
import { disconnectCarrierAction, saveCarrierAction, setCarrierDefaultAction, setCarrierEnabledAction, testCarrierAction, verifyCarrierAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { ActionButton, ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CarrierApi } from "@/lib/api/endpoints/shipping-api";

const CAPABILITY_LABELS: [keyof CarrierApi["capabilities"], string][] = [
  ["serviceability", "Serviceability"],
  ["rateQuotes", "Rate quotes"],
  ["createShipment", "Booking"],
  ["cancelShipment", "Cancellation"],
  ["labels", "Labels"],
  ["tracking", "Tracking"],
  ["trackingWebhooks", "Tracking webhooks"],
  ["cashOnDelivery", "COD"],
];

const INTEGRATION: Record<CarrierApi["integrationStatus"], { tone: "active" | "warning"; label: string }> = {
  documented: { tone: "active", label: "Built from the carrier's documentation" },
  partially_documented: { tone: "warning", label: "Partly documented" },
  unverified: { tone: "warning", label: "Not yet checked against the live service" },
};

/** One carrier: connect or edit its account, check the connection, turn it on, make it the default, or disconnect. Secrets are write-only. */
export function CarrierCard({ carrier }: { carrier: CarrierApi }) {
  const router = useRouter();
  const c = carrier.connection;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checking, startCheck] = useTransition();
  const integration = INTEGRATION[carrier.integrationStatus];

  const open = () => {
    setValues(Object.fromEntries(carrier.credentialFields.filter((f) => !f.secret).map((f) => [f.key, c.settings[f.key] ?? ""])));
    setEditing(true);
  };

  /** Only what was typed is sent: an untouched secret keeps the stored value. */
  const payload = () => {
    const out: Record<string, string> = {};
    for (const f of carrier.credentialFields) {
      const v = (values[f.key] ?? "").trim();
      if (v !== "" || (!f.secret && f.key in c.settings)) out[f.key] = v;
    }
    return out;
  };

  const check = (kind: "test" | "verify") =>
    startCheck(async () => {
      const res = await (kind === "test" ? testCarrierAction(carrier.code) : verifyCarrierAction(carrier.code));
      if (!res.ok) return void toast.error(res.error);
      const r = res.data as { valid: boolean; message: string };
      (r.valid ? toast.success : toast.error)(r.message);
      router.refresh();
    });

  const enable = async () => {
    const needsAck = carrier.integrationStatus === "unverified";
    if (needsAck && !window.confirm(`The ${carrier.name} integration has not been checked against ${carrier.name}'s real service yet. Use it anyway?`)) return { ok: true as const };
    return setCarrierEnabledAction(carrier.code, true, needsAck ? true : undefined);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {carrier.name}
            {c.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : null}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{carrier.integrationNotes}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.connected ? <StatusBadge tone={c.verificationStatus === "verified" ? "active" : c.verificationStatus === "failed" ? "danger" : "warning"}>{c.verificationStatus === "verified" ? "Verified" : c.verificationStatus === "failed" ? "Check failed" : "Not verified"}</StatusBadge> : <StatusBadge tone="draft">Not connected</StatusBadge>}
          {c.connected ? <StatusBadge tone={c.enabled ? "active" : "draft"}>{c.enabled ? "On" : "Off"}</StatusBadge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {CAPABILITY_LABELS.map(([key, label]) => (
            <span key={key} className={carrier.capabilities[key] ? "rounded border bg-muted/50 px-1.5 py-0.5" : "rounded border border-dashed px-1.5 py-0.5 text-muted-foreground line-through"}>
              {label}
            </span>
          ))}
          {carrier.capabilities.ratesAreEstimates ? <span className="rounded border border-dashed px-1.5 py-0.5 text-muted-foreground">Rates are estimates</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          <StatusBadge tone={integration.tone} className="mr-1.5">
            {integration.label}
          </StatusBadge>
        </p>
        {c.verificationError ? (
          <p role="alert" className="text-sm text-destructive">
            {c.verificationError}
          </p>
        ) : null}
        {c.updatedAt ? (
          <p className="text-xs text-muted-foreground">
            Last changed {new Date(c.updatedAt).toLocaleDateString("en-IN")}
            {c.updatedByName ? ` by ${c.updatedByName}` : ""}. Saved secrets: {c.secretFieldsSaved.length ? c.secretFieldsSaved.join(", ") : "none"}.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={c.connected ? "outline" : "default"} onClick={open}>
            {c.connected ? <KeyRound aria-hidden /> : <Plug aria-hidden />} {c.connected ? "Update credentials" : "Connect"}
          </Button>
          {c.connected ? (
            <>
              <Button type="button" variant="outline" disabled={checking} onClick={() => check("test")}>
                {checking ? <Loader2 className="animate-spin" aria-hidden /> : null} Test connection
              </Button>
              <Button type="button" variant="outline" disabled={checking} onClick={() => check("verify")}>
                <CheckCircle2 aria-hidden /> Verify
              </Button>
              {c.enabled ? (
                <ActionButton action={() => setCarrierEnabledAction(carrier.code, false)} success={`${carrier.name} turned off`}>
                  Turn off
                </ActionButton>
              ) : (
                <ActionButton action={enable} success={`${carrier.name} turned on`} disabled={c.verificationStatus === "failed"}>
                  Turn on
                </ActionButton>
              )}
              <ActionButton action={() => setCarrierDefaultAction(carrier.code, !c.isDefault)} success={c.isDefault ? "Default removed" : `${carrier.name} is now the default`}>
                <Star aria-hidden /> {c.isDefault ? "Remove default" : "Make default"}
              </ActionButton>
              <ActionButton variant="ghost" action={() => disconnectCarrierAction(carrier.code)} success={`${carrier.name} disconnected`} confirm={`Disconnect ${carrier.name}? Its saved credentials are deleted.`}>
                <Unplug aria-hidden /> Disconnect
              </ActionButton>
            </>
          ) : null}
        </div>
      </CardContent>

      <ActionDialog
        open={editing}
        onOpenChange={setEditing}
        title={`${c.connected ? "Update" : "Connect"} ${carrier.name}`}
        description="Use your own account for this carrier. Secrets are encrypted and are never shown again; leave a secret empty to keep the saved one. Changing anything switches the carrier off until you verify it again."
        submitLabel={c.connected ? "Save changes" : "Connect"}
        success={`${carrier.name} saved`}
        onSubmit={() => saveCarrierAction(carrier.code, payload())}
      >
        {carrier.credentialFields.map((f) => {
          const saved = f.secret && c.secretFieldsSaved.includes(f.key);
          const id = `cf-${carrier.code}-${f.key}`;
          return (
            <FormField key={f.key} id={id} label={f.label} required={f.required && !saved} optional={!f.required} hint={f.help}>
              {f.options?.length ? (
                <NativeSelect id={id} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  <option value="">Select</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input id={id} type={f.secret ? "password" : "text"} autoComplete="off" spellCheck={false} placeholder={saved ? "Saved. Leave empty to keep" : undefined} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </FormField>
          );
        })}
      </ActionDialog>
    </Card>
  );
}
