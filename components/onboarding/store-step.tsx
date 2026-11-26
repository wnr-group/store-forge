"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStoreAction } from "@/app/(auth)/onboarding/actions";
import { FormError } from "@/components/shared/form-error";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { storeNameSchema, type StoreNameInput } from "@/lib/validations/onboarding";

/**
 * The last step: just a store name. The store's web address is made from it by the server (and given a different ending if another store
 * already has it), so there is nothing to choose. The server only creates the store for a plan whose payment it has confirmed.
 */
export function StoreStep() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StoreNameInput>({ resolver: zodResolver(storeNameSchema), defaultValues: { storeName: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      // On success the action redirects to the new dashboard; it only returns on failure.
      const result = await createStoreAction(values);
      if (result && !result.ok) {
        setFormError(result.error);
        if (result.fieldErrors?.storeName) setError("storeName", { message: result.fieldErrors.storeName });
      }
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-1">
      <FormError message={formError} />
      <FormField required id="storeName" label="Store name" error={errors.storeName?.message} hint="This is the name your customers will see.">
        <Input
          className="h-9 rounded-lg px-3 text-sm"
          id="storeName"
          autoComplete="organization"
          placeholder="For example, Blue Door Coffee"
          aria-invalid={!!errors.storeName}
          aria-describedby="storeName-msg"
          {...register("storeName")}
        />
      </FormField>
      <SubmitButton pending={pending} pendingText="Creating your store…" className="mt-2 h-10 w-full rounded-full font-semibold">
        Create my store
      </SubmitButton>
    </form>
  );
}
