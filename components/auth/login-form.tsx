"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction } from "@/app/(auth)/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      // On success the action redirects; it only returns on failure.
      const result = await loginAction(values, next);
      if (result && !result.ok) setFormError(result.error);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-3">
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
      <FormField required id="password" label="Password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-msg"
          {...register("password")}
        />
      </FormField>
      <SubmitButton pending={pending} pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
