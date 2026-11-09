"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCompanyAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { updateCompanySchema } from "@/lib/validations/admin-org";

type Props = { tenantId: string; initial: { name: string; contactPhone: string | null; address: string | null } };

/** Platform Admin: edit an organization's name, contact number and address. Re-validated on the server by the action. */
export function EditOrganizationForm({ tenantId, initial }: Props) {
  const router = useRouter();
  const start = { companyName: initial.name, contactPhone: initial.contactPhone ?? "", address: initial.address ?? "" };
  const [v, setV] = useState(start);
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const dirty = v.companyName !== start.companyName || v.contactPhone !== start.contactPhone || v.address !== start.address;

  const props = (k: keyof typeof v, id: string) => ({
    id,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setV((cur) => ({ ...cur, [k]: e.target.value }));
      clear(k);
    },
    onBlur: () => validateField(updateCompanySchema, v, k),
    disabled: pending,
    "aria-invalid": Boolean(errors[k]),
    "aria-describedby": `${id}-msg`,
  });

  const submit = () => {
    if (!validate(updateCompanySchema, v)) return;
    send(async () => {
      const res = await updateCompanyAction(tenantId, v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Organization updated");
      router.refresh();
    });
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {formError ? (
        <p role="alert" className="text-sm text-error">
          {formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="eo-name" label="Organization name" required error={errors.companyName}>
          <Input {...props("companyName", "eo-name")} aria-required autoComplete="off" />
        </FormField>
        <FormField id="eo-phone" label="Contact number" optional error={errors.contactPhone}>
          <Input {...props("contactPhone", "eo-phone")} type="tel" autoComplete="off" />
        </FormField>
      </div>
      <FormField id="eo-address" label="Address" optional error={errors.address} hint="Up to 300 characters.">
        <Input {...props("address", "eo-address")} autoComplete="off" />
      </FormField>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save changes"}
        </Button>
        {dirty && !pending ? (
          <Button type="button" variant="ghost" onClick={() => { setV(start); clear("companyName"); clear("contactPhone"); clear("address"); }}>
            Discard
          </Button>
        ) : null}
      </div>
    </form>
  );
}
