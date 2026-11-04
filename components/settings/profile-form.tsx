"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveProfileAction } from "@/app/(dashboard)/dashboard/settings/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileSchema } from "@/lib/validations/catalog";

export function ProfileForm({ fullName, email, role }: { fullName: string; email: string; role: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const parsed = profileSchema.safeParse({ fullName: name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    startTransition(async () => {
      const res = await saveProfileAction({ fullName: name });
      if (!res.ok) return setError(res.fieldErrors?.fullName ?? res.error);
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
      <SectionCard title="Your account" description="Visible to you and your teammates.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pf-name" label="Your name" error={error}>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} aria-invalid={Boolean(error)} aria-describedby="pf-name-msg" autoComplete="name" />
          </FormField>
          <FormField id="pf-email" label="Email" hint={`Role: ${role}. Email is managed by your sign-in.`}>
            <Input id="pf-email" value={email} readOnly aria-describedby="pf-email-msg" className="bg-muted/50" />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || name.trim() === fullName}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save profile
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}
