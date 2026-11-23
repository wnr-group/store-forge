"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removePaymentConfigAction, savePaymentConfigAction, setPaymentEnabledAction, verifyPaymentConfigAction } from "@/app/(dashboard)/dashboard/payments/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SettingsSection } from "@/components/shared/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { paymentConfigSchema } from "@/lib/validations/payments";

/** What the page knows about the saved credentials. The Key Secret is never part of it. */
export type PaymentConfigView =
  | { configured: false }
  | { configured: true; keyIdMasked: string; mode: "test" | "live"; webhookSecretConfigured: boolean; enabled: boolean; verificationStatus: "unverified" | "verified" | "failed"; verificationError: string | null; verifiedAtLabel: string | null; webhookPath: string | null; updatedAtLabel: string; updatedByName: string | null };

const EMPTY = { keyId: "", keySecret: "", webhookSecret: "" };

/**
 * The connection status and the two switches that put Razorpay at checkout: check the saved keys with Razorpay, then turn it
 * on. The API refuses to turn it on before a successful check, and replacing the keys turns it off again.
 */
function RazorpayStatus({ config }: { config: Extract<PaymentConfigView, { configured: true }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const verify = () =>
    start(async () => {
      const res = await verifyPaymentConfigAction();
      if (!res.ok) return void toast.error(res.error);
      if (res.data?.status === "verified") toast.success("Connected to Razorpay. You can turn it on now.");
      else toast.error(res.data?.error ?? "Razorpay did not accept these keys.");
      router.refresh();
    });
  const toggle = () =>
    start(async () => {
      const res = await setPaymentEnabledAction(!config.enabled);
      if (!res.ok) return void toast.error(res.error);
      toast.success(config.enabled ? "Razorpay is off at checkout" : "Razorpay is on at checkout");
      router.refresh();
    });
  const status = config.verificationStatus;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "verified" ? "default" : "secondary"}>{status === "verified" ? "Connection verified" : status === "failed" ? "Check failed" : "Not verified yet"}</Badge>
        <Badge variant={config.enabled ? "default" : "outline"}>{config.enabled ? "On at checkout" : "Off at checkout"}</Badge>
      </div>
      {status === "verified" && config.verifiedAtLabel ? <p className="text-muted-foreground">Checked with Razorpay {config.verifiedAtLabel}.</p> : null}
      {status === "failed" && config.verificationError ? (
        <p role="alert" className="text-destructive">
          {config.verificationError}
        </p>
      ) : null}
      {status !== "verified" ? <p className="text-muted-foreground">Check the keys with Razorpay, then turn Razorpay on so shoppers can pay online.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={verify} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Check connection
        </Button>
        <Button type="button" size="sm" variant={config.enabled ? "outline" : "default"} onClick={toggle} disabled={pending || (!config.enabled && status !== "verified")}>
          {config.enabled ? "Turn off at checkout" : "Turn on at checkout"}
        </Button>
      </div>
      {config.webhookPath ? (
        <p className="text-xs text-muted-foreground">
          Webhook address for Razorpay (Settings, Webhooks): <code className="break-all rounded bg-muted px-1 py-0.5 font-mono">{config.webhookPath}</code> on your API host.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Owner-only Razorpay credentials. "Configured" means saved, NOT verified: nothing is sent to Razorpay. The Key Secret input
 * is always empty: it is never prefilled from anything, and it is cleared after a successful save.
 */
export function PaymentConfigForm({ config }: { config: PaymentConfigView }) {
  const [v, setV] = useState(EMPTY);
  const [removeOpen, setRemoveOpen] = useState(false);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    clear(k);
  };
  const props = (k: keyof typeof EMPTY, id: string) => ({
    id, value: v[k], onChange: set(k), onBlur: () => validateField(paymentConfigSchema, v, k), disabled: pending,
    "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    // An empty webhook secret is left out, so a saved one is kept.
    const payload = v.webhookSecret === "" ? { keyId: v.keyId, keySecret: v.keySecret } : v;
    if (!validate(paymentConfigSchema, payload)) return;
    send(async () => {
      const res = await savePaymentConfigAction(payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(config.configured ? "Razorpay credentials replaced" : "Razorpay credentials saved");
      setV(EMPTY); // the secret is never kept in the page after it was sent
    });
  };

  return (
    <>
      <form
        noValidate
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <SettingsSection
          title="Razorpay credentials"
          description="Your Razorpay Key ID and Key Secret. The secret is stored encrypted and can never be viewed again. Only you, the owner, can change or remove them."
          footer={
            <>
              {config.configured ? (
                <Button type="button" variant="outline" onClick={() => setRemoveOpen(true)} disabled={pending}>
                  Remove credentials
                </Button>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}{" "}
                {pending ? "Saving…" : config.configured ? "Replace credentials" : "Save credentials"}
              </Button>
            </>
          }
        >
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={config.configured ? "default" : "secondary"}>{config.configured ? "Configured (saved)" : "Not configured"}</Badge>
              {config.configured ? <Badge variant="outline">{config.mode === "live" ? "Live" : "Test"}</Badge> : null}
              {config.configured ? <Badge variant={config.webhookSecretConfigured ? "default" : "secondary"}>{config.webhookSecretConfigured ? "Webhook secret saved" : "No webhook secret"}</Badge> : null}
            </div>
            {config.configured ? (
              <div className="space-y-1 text-sm">
                <p>
                  Key ID <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{config.keyIdMasked}</code>
                </p>
                <RazorpayStatus config={config} />
                <p className="text-muted-foreground">
                  Last updated {config.updatedAtLabel} by {config.updatedByName ?? "a former team member"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing is saved yet. Enter your Razorpay keys below.</p>
            )}
          </div>

          <div className="grid max-w-md gap-4">
            <FormField id="pay-key-id" label="Key ID" required error={errors.keyId} hint="Starts with rzp_test_ or rzp_live_.">
              <Input {...props("keyId", "pay-key-id")} aria-required autoComplete="off" spellCheck={false} placeholder="rzp_test_..." />
            </FormField>
            <FormField
              id="pay-key-secret"
              label="Key Secret"
              required
              error={errors.keySecret}
              hint={config.configured ? "Secret saved, enter a new value to replace it" : "Stored encrypted. You will not be able to view it again."}
            >
              <PasswordInput {...props("keySecret", "pay-key-secret")} aria-required autoComplete="new-password" spellCheck={false} />
            </FormField>
            <FormField
              id="pay-webhook-secret"
              label="Webhook Secret"
              error={errors.webhookSecret}
              hint={
                config.configured && config.webhookSecretConfigured
                  ? "Webhook secret saved. Leave empty to keep it, or enter a new value to replace it."
                  : "Optional. The secret you set in Razorpay under Settings > Webhooks. Stored encrypted."
              }
            >
              <PasswordInput {...props("webhookSecret", "pay-webhook-secret")} autoComplete="new-password" spellCheck={false} />
            </FormField>
          </div>
          {formError && Object.keys(errors).length === 0 ? (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          ) : null}
        </SettingsSection>
      </form>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove Razorpay credentials?"
        description="This permanently deletes the saved Key ID and Key Secret. You can enter new ones at any time."
        confirmLabel="Remove credentials"
        // A network failure rejects the action call; show it in the dialog instead of letting it reach an error boundary.
        onConfirm={() => removePaymentConfigAction().catch(() => ({ ok: false as const, error: "Something went wrong. Please check your connection and try again." }))}
        successMessage="Razorpay credentials removed"
      />
    </>
  );
}
