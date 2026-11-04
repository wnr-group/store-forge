"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { resetPasswordSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/types/action";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who the password is for, e.g. "Olivia Owner (owner@acme.com)". */
  subject: string;
  /** Server action that sets the new password. The old one is never shown. */
  onSubmit: (password: string) => Promise<ActionResult<unknown>>;
};

/**
 * Admin-assisted password reset. The new password is typed once here, sent to the server over the
 * action channel, and not stored anywhere in the browser. Hand it to the user through a secure channel
 * and ask them to change it after first sign-in (Settings -> Change password).
 */
export function ResetPasswordDialog({ open, onOpenChange, subject, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();

  const submit = () => {
    if (!validate(resetPasswordSchema, { password })) return;
    send(async () => {
      const res = await onSubmit(password);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Password updated");
      setPassword("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {subject}. Share it securely (not by chat or email in plain text) and ask them to change it after signing in.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="rp-password" label="New password" required error={errors.password} hint="At least 8 characters with a letter and a number.">
            <PasswordInput
              id="rp-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clear("password"); }}
              onBlur={() => validateField(resetPasswordSchema, { password }, "password")}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="rp-password-msg"
              aria-required
              autoComplete="new-password"
              autoFocus
              disabled={pending}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
