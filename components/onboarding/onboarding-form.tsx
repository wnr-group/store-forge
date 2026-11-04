"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkSlugAction, createWorkspaceAction } from "@/app/(dashboard)/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils/slug";
import { onboardingSchema, type OnboardingInput, type OnboardingValues } from "@/lib/validations/onboarding";

type SlugState = { status: "idle" | "checking" | "available" | "unavailable"; reason?: string };

export function OnboardingForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ slug: string; available: boolean; reason?: string } | null>(null);
  const slugTouched = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<OnboardingInput, unknown, OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { businessName: "", storeName: "", storeSlug: "", description: "" },
  });

  const storeName = useWatch({ control, name: "storeName" });
  const storeSlug = useWatch({ control, name: "storeSlug" });

  // Suggest a slug from the store name until the user edits the slug themselves.
  useEffect(() => {
    if (!slugTouched.current) setValue("storeSlug", slugify(storeName ?? ""), { shouldValidate: false });
  }, [storeName, setValue]);

  // Debounced availability hint (the database remains the authority on submit).
  // State is only set from the async result; "idle"/"checking" are derived.
  const slug = (storeSlug ?? "").trim().toLowerCase();
  useEffect(() => {
    if (slug.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkSlugAction(slug);
      if (!cancelled) setChecked({ slug, available: res.available, reason: res.reason });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const slugState: SlugState =
    slug.length < 3
      ? { status: "idle" }
      : checked?.slug === slug
        ? { status: checked.available ? "available" : "unavailable", reason: checked.reason }
        : { status: "checking" };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createWorkspaceAction(values);
      if (result && !result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          if (field in values) setError(field as keyof OnboardingInput, { message });
        }
      }
    });
  });

  const slugHint =
    slugState.status === "available" ? (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Check className="size-3" aria-hidden /> Available
      </span>
    ) : slugState.status === "unavailable" ? (
      <span className="inline-flex items-center gap-1 text-destructive">
        <X className="size-3" aria-hidden /> {slugState.reason ?? "Already taken"}
      </span>
    ) : slugState.status === "checking" ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Checking…
      </span>
    ) : undefined;

  const { onChange: slugOnChange, ...slugRegister } = register("storeSlug");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormError message={formError} />
      <FormField required id="businessName" label="Business name" error={errors.businessName?.message} hint="Your legal or trading name">
        <Input
          id="businessName"
          autoComplete="organization"
          placeholder="Acme Trading Co."
          aria-invalid={!!errors.businessName}
          aria-describedby="businessName-msg"
          {...register("businessName")}
        />
      </FormField>
      <FormField required id="storeName" label="Store name" error={errors.storeName?.message}>
        <Input
          id="storeName"
          placeholder="Acme Store"
          aria-invalid={!!errors.storeName}
          aria-describedby="storeName-msg"
          {...register("storeName")}
        />
      </FormField>
      <FormField required id="storeSlug" label="Store slug" error={errors.storeSlug?.message}>
        <div className="flex items-center">
          <Input
            id="storeSlug"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!errors.storeSlug}
            aria-describedby="storeSlug-msg storeSlug-status"
            className="rounded-r-none"
            onChange={(e) => {
              slugTouched.current = true;
              void slugOnChange(e);
            }}
            {...slugRegister}
          />
          <span className="flex h-8 items-center rounded-r-lg border border-l-0 bg-muted px-2.5 text-sm text-muted-foreground">
            .storeforge.app
          </span>
        </div>
        <p id="storeSlug-status" aria-live="polite" className="mt-1.5 min-h-4 text-xs text-muted-foreground">
          {slugHint}
        </p>
      </FormField>
      <FormField optional id="description" label="Description" error={errors.description?.message}>
        <textarea
          id="description"
          rows={3}
          placeholder="What do you sell?"
          aria-invalid={!!errors.description}
          aria-describedby="description-msg"
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
          {...register("description")}
        />
      </FormField>
      <SubmitButton pending={pending} pendingText="Creating your store…" disabled={slugState.status === "unavailable"}>
        Create store
      </SubmitButton>
    </form>
  );
}
