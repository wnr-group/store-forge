"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removePaymentConfigAction, savePaymentConfigAction } from "@/app/(dashboard)/dashboard/payments/actions";
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
  | { configured: true; keyIdMasked: string; mode: "test" | "live"; updatedAtLabel: string; updatedByName: string | null };

const EMPTY = { keyId: "", keySecret: "" };

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
    if (!validate(paymentConfigSchema, v)) return;
    send(async () => {
      const res = await savePaymentConfigAction(v);
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
            </div>
            {config.configured ? (
              <div className="space-y-1 text-sm">
                <p>
                  Key ID <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{config.keyIdMasked}</code>
                </p>
                <p className="text-muted-foreground">These credentials are saved, not verified. Store Forge does not contact Razorpay.</p>
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
