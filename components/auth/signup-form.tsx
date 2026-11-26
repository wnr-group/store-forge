"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerAction } from "@/app/(auth)/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { PlanChoice } from "@/lib/onboarding/path";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

/**
 * Full name, email, password and the Terms. There is no email verification: on success the visitor is already signed in and continues to
 * the plan and payment steps. The API checks everything again, so this form only gives quick feedback.
 */
export function SignupForm({ plan }: { plan: PlanChoice | null }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      // On success the action redirects; it only returns on failure.
      const result = await registerAction(values, plan ?? undefined);
      if (result && !result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          if (field in values) setError(field as keyof RegisterInput, { message });
        }
      }
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-1">
      <FormError message={formError} />
      <FormField required id="fullName" label="Full name" error={errors.fullName?.message}>
        <Input
          className="h-9 rounded-lg px-3 text-sm"
          id="fullName"
          autoComplete="name"
          placeholder="Your full name"
          aria-invalid={!!errors.fullName}
          aria-describedby="fullName-msg"
          {...register("fullName")}
        />
      </FormField>
      <FormField required id="email" label="Email" error={errors.email?.message}>
        <Input
          className="h-9 rounded-lg px-3 text-sm"
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={!!errors.email}
          aria-describedby="email-msg"
          {...register("email")}
        />
      </FormField>
      <FormField required id="password" label="Password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          className="h-9 rounded-lg px-3 text-sm"
          aria-invalid={!!errors.password}
          aria-describedby="password-msg"
          {...register("password")}
        />
      </FormField>
      <FormField required id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          className="h-9 rounded-lg px-3 text-sm"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirmPassword-msg"
          {...register("confirmPassword")}
        />
      </FormField>
      <div className="space-y-1.5 pt-1" data-invalid={errors.acceptTerms ? "true" : undefined}>
        <div className="flex items-start gap-2.5">
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={!!errors.acceptTerms}
                aria-describedby="acceptTerms-msg"
                className="mt-0.5"
              />
            )}
          />
          <label htmlFor="acceptTerms" className="text-sm leading-5 text-lp-text">
            I accept the Terms and Conditions
          </label>
        </div>
        <p id="acceptTerms-msg" role={errors.acceptTerms ? "alert" : undefined} className="min-h-4 text-xs text-error">
          {errors.acceptTerms?.message}
        </p>
      </div>
      <SubmitButton pending={pending} pendingText="Creating your account…" className="mt-2 h-10 w-full rounded-full font-semibold">
        Create account
      </SubmitButton>
    </form>
  );
}
