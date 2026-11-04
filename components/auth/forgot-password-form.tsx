"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) setSentTo(values.email);
      else setFormError(result.error);
    });
  });

  if (sentTo) {
    return (
      <Alert>
        <MailCheck aria-hidden />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent a link to reset your password.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormError message={formError} />
      <FormField required id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={!!errors.email}
          aria-describedby="email-msg"
          {...register("email")}
        />
      </FormField>
      <SubmitButton pending={pending} pendingText="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
