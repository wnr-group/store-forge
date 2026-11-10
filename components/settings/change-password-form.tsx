"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SettingsSection } from "@/components/shared/settings-section";
import { Button } from "@/components/ui/button";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { changePasswordSchema } from "@/lib/validations/auth";

const EMPTY = { currentPassword: "", password: "", confirmPassword: "" };

/** Self-service password change. Use it right after the first sign-in to replace the initial password. */
export function ChangePasswordForm() {
  const [v, setV] = useState(EMPTY);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    clear(k);
  };
  const props = (k: keyof typeof EMPTY, id: string) => ({
    id, value: v[k], onChange: set(k), onBlur: () => validateField(changePasswordSchema, v, k), disabled: pending,
    "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(changePasswordSchema, v)) return;
    send(async () => {
      const res = await changePasswordAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Password changed");
      setV(EMPTY);
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SettingsSection
        title="Change password"
        description="If you were given an initial password, change it now. Nobody can view your password, including administrators."
        footer={
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Change password"}
          </Button>
        }
      >
        <div className="grid max-w-sm gap-4">
          <FormField id="cp-current" label="Current password" required error={errors.currentPassword}>
            <PasswordInput {...props("currentPassword", "cp-current")} aria-required autoComplete="current-password" />
          </FormField>
          <FormField id="cp-new" label="New password" required error={errors.password} hint="At least 8 characters with a letter and a number.">
            <PasswordInput {...props("password", "cp-new")} aria-required autoComplete="new-password" />
          </FormField>
          <FormField id="cp-confirm" label="Confirm new password" required error={errors.confirmPassword}>
            <PasswordInput {...props("confirmPassword", "cp-confirm")} aria-required autoComplete="new-password" />
          </FormField>
        </div>
        {formError && Object.keys(errors).length === 0 ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
      </SettingsSection>
    </form>
  );
}
