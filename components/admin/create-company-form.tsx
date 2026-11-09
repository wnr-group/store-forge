"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCompanyAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shared/password-input";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { createCompanySchema } from "@/lib/validations/company";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { slugify } from "@/lib/utils/slug";

// Inlined at build time (NEXT_PUBLIC_*), so it is available in this client component.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

const EMPTY = {
  companyName: "", storeName: "", storeSlug: "", storeDescription: "", contactPhone: "", address: "",
  ownerName: "", ownerEmail: "", ownerPassword: "",
};

export function CreateCompanyForm() {
  const router = useRouter();
  const [v, setV] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setV((cur) => {
      const next = { ...cur, [k]: value };
      if (k === "storeName" && !slugTouched) next.storeSlug = slugify(value).slice(0, 40);
      return next;
    });
    clear(k);
    if (k === "storeName" && !slugTouched) clear("storeSlug");
  };
  const blur = (k: keyof typeof EMPTY) => () => validateField(createCompanySchema, v, k);
  const props = (k: keyof typeof EMPTY, id: string) => ({
    id, value: v[k], onChange: set(k), onBlur: blur(k), disabled: pending,
    "aria-invalid": Boolean(errors[k]), "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(createCompanySchema, v)) return;
    send(async () => {
      const res = await createCompanyAction(v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(`Organization created. ${res.data?.ownerEmail ?? "The owner"} can now sign in.`);
      router.push(res.data ? `${ROUTES.adminCompanies}/${res.data.tenantId}` : ROUTES.adminCompanies);
    });
  };

  return (
    <form
      noValidate
      className="mx-auto max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}

      <SectionCard title="Organization" description="The business that will use StoreForge.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cc-company" label="Organization name" required error={errors.companyName}>
            <Input {...props("companyName", "cc-company")} aria-required autoComplete="off" autoFocus />
          </FormField>
          <FormField id="cc-phone" label="Contact number" optional error={errors.contactPhone}>
            <Input {...props("contactPhone", "cc-phone")} type="tel" autoComplete="off" />
          </FormField>
        </div>
        <FormField id="cc-address" label="Address" optional error={errors.address}>
          <Textarea {...props("address", "cc-address")} rows={2} />
        </FormField>
      </SectionCard>

      <SectionCard title="First store" description="Created together with the organization.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cc-store" label="Store name" required error={errors.storeName}>
            <Input {...props("storeName", "cc-store")} aria-required autoComplete="off" />
          </FormField>
          <FormField
            id="cc-slug"
            label="Store subdomain"
            required
            error={errors.storeSlug}
            hint={
              v.storeSlug && !errors.storeSlug
                ? `The store will be live at ${storefrontUrl(v.storeSlug, ROOT_DOMAIN) ?? v.storeSlug}`
                : "Lowercase letters, numbers and hyphens. Must be unique."
            }
          >
            <div className="flex items-center gap-2">
              <Input
                {...props("storeSlug", "cc-slug")}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("storeSlug")(e);
                }}
                aria-required
                autoComplete="off"
                className="min-w-0 flex-1"
              />
              {ROOT_DOMAIN ? (
                <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
                  .{ROOT_DOMAIN}
                </span>
              ) : null}
            </div>
            <span className="sr-only">{storefrontHost(v.storeSlug || "your-store", ROOT_DOMAIN)}</span>
          </FormField>
        </div>
        <FormField id="cc-desc" label="Store description" optional error={errors.storeDescription}>
          <Textarea {...props("storeDescription", "cc-desc")} rows={3} />
        </FormField>
      </SectionCard>

      <SectionCard
        title="Owner account"
        description="Signs in with this email and password; no verification email is sent. Share the password securely and ask the owner to change it after first sign-in."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cc-owner" label="Owner name" required error={errors.ownerName}>
            <Input {...props("ownerName", "cc-owner")} aria-required autoComplete="off" />
          </FormField>
          <FormField id="cc-email" label="Owner email" required error={errors.ownerEmail}>
            <Input {...props("ownerEmail", "cc-email")} type="email" aria-required autoComplete="off" />
          </FormField>
        </div>
        <FormField id="cc-password" label="Initial password" required error={errors.ownerPassword} hint="At least 8 characters with a letter and a number. It is not shown again.">
          <PasswordInput {...props("ownerPassword", "cc-password")} aria-required autoComplete="new-password" />
        </FormField>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Creating…" : "Create organization"}
        </Button>
      </div>
    </form>
  );
}
