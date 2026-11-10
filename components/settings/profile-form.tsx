"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveProfileAction } from "@/app/(dashboard)/dashboard/settings/actions";
import { FormField } from "@/components/shared/form-field";
import { SettingsSection } from "@/components/shared/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { profileSchema } from "@/lib/validations/catalog";

export function ProfileForm({ fullName, email, role }: { fullName: string; email: string; role: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const error = errors.fullName;

  const submit = () => {
    if (!validate(profileSchema, { fullName: name })) return;
    send(async () => {
      const res = await saveProfileAction({ fullName: name });
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Profile updated");
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
    >
      <SettingsSection
        title="Your account"
        description="Visible to you and your teammates."
        footer={
          <Button type="submit" disabled={pending || name.trim() === fullName}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save profile"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pf-name" label="Full name" required error={error}>
            <Input id="pf-name" value={name} onChange={(e) => { setName(e.target.value); clear("fullName"); }} onBlur={() => validateField(profileSchema, { fullName: name }, "fullName")} disabled={pending} aria-invalid={Boolean(error)} aria-describedby="pf-name-msg" aria-required autoComplete="name" />
          </FormField>
          <FormField id="pf-email" label="Email address" hint={`Role: ${role}. Email is managed by your sign-in.`}>
            <Input id="pf-email" value={email} readOnly aria-describedby="pf-email-msg" className="bg-muted/50" />
          </FormField>
        </div>
        {formError && !error ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
      </SettingsSection>
    </form>
  );
}
