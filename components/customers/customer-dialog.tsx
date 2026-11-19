"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveCustomerAction } from "@/app/(dashboard)/dashboard/customers/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { customerInputSchema } from "@/lib/validations/catalog";

type Customer = { id: string; fullName: string; email: string; phone: string | null; notes: string | null };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; customer?: Customer; /** Where focus goes when the dialog closes (see useReturnFocus). */ finalFocus?: React.ComponentProps<typeof DialogContent>["finalFocus"] };

/** Create or edit a customer. Remount (key) per customer so the fields reset. */
export function CustomerDialog({ open, onOpenChange, customer, finalFocus }: Props) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: customer?.fullName ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "", notes: customer?.notes ?? "" });
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV({ ...v, [k]: e.target.value });
    clear(k);
  };
  const blur = (k: keyof typeof v) => () => validateField(customerInputSchema, v, k);

  const submit = () => {
    if (!validate(customerInputSchema, v)) return;
    send(async () => {
      const res = await saveCustomerAction(customer?.id ?? null, v);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(customer ? "Customer updated" : "Customer added");
      onOpenChange(false);
      if (!customer && res.data) router.push(`${ROUTES.customers}/${res.data.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>Contact details for someone who buys from your store.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id="cu-name" label="Customer name" required error={errors.fullName}>
            <Input id="cu-name" value={v.fullName} onChange={set("fullName")} onBlur={blur("fullName")} aria-invalid={Boolean(errors.fullName)} aria-describedby="cu-name-msg" aria-required autoFocus autoComplete="off" disabled={pending} />
          </FormField>
          <FormField id="cu-email" label="Email address" required error={errors.email}>
            <Input id="cu-email" type="email" value={v.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={Boolean(errors.email)} aria-describedby="cu-email-msg" aria-required autoComplete="off" disabled={pending} />
          </FormField>
          <FormField id="cu-phone" label="Phone" optional error={errors.phone} hint="Include the country code for international numbers.">
            <Input id="cu-phone" type="tel" value={v.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={Boolean(errors.phone)} aria-describedby="cu-phone-msg" autoComplete="off" disabled={pending} />
          </FormField>
          <FormField id="cu-notes" label="Notes" optional error={errors.notes}>
            <Textarea id="cu-notes" rows={3} value={v.notes} onChange={set("notes")} onBlur={blur("notes")} aria-invalid={Boolean(errors.notes)} aria-describedby="cu-notes-msg" disabled={pending} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : customer ? "Save" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
