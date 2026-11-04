"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerAction } from "@/app/(auth)/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

export function RegisterForm() {
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
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result && !result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          if (field in values) setError(field as keyof RegisterInput, { message });
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormError message={formError} />
      <FormField required id="fullName" label="Full name" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          placeholder="Jane Doe"
          aria-invalid={!!errors.fullName}
          aria-describedby="fullName-msg"
          {...register("fullName")}
        />
      </FormField>
      <FormField required id="email" label="Work email" error={errors.email?.message}>
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
      <FormField required id="password" label="Password" error={errors.password?.message} hint="8+ characters with a letter and a number">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-msg"
          {...register("password")}
        />
      </FormField>
      <FormField required id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirmPassword-msg"
          {...register("confirmPassword")}
        />
      </FormField>
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
                aria-invalid={!!errors.acceptTerms}
                className="mt-0.5"
              />
            )}
          />
          <label htmlFor="acceptTerms" className="text-sm leading-snug text-muted-foreground">
            I agree to the{" "}
            <Link href="#" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="underline">
              Privacy Policy
            </Link>
            .
          </label>
        </div>
        {errors.acceptTerms ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>
      <SubmitButton pending={pending} pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
