"use client";

import { useState, useTransition } from "react";
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
import { customerInputSchema } from "@/lib/validations/catalog";

type Customer = { id: string; fullName: string; email: string; phone: string | null; notes: string | null };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; customer?: Customer };

/** Create or edit a customer. Remount (key) per customer so the fields reset. */
export function CustomerDialog({ open, onOpenChange, customer }: Props) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: customer?.fullName ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "", notes: customer?.notes ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const submit = () => {
    setFormError(null);
    const parsed = customerInputSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveCustomerAction(customer?.id ?? null, v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
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
      <DialogContent>
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
          {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          <FormField id="cu-name" label="Full name" error={errors.fullName}>
            <Input id="cu-name" value={v.fullName} onChange={set("fullName")} aria-invalid={Boolean(errors.fullName)} aria-describedby="cu-name-msg" autoFocus autoComplete="off" />
          </FormField>
          <FormField id="cu-email" label="Email" error={errors.email}>
            <Input id="cu-email" type="email" value={v.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} aria-describedby="cu-email-msg" autoComplete="off" />
          </FormField>
          <FormField id="cu-phone" label="Phone (optional)" error={errors.phone}>
            <Input id="cu-phone" type="tel" value={v.phone} onChange={set("phone")} aria-invalid={Boolean(errors.phone)} aria-describedby="cu-phone-msg" autoComplete="off" />
          </FormField>
          <FormField id="cu-notes" label="Notes (optional)" error={errors.notes}>
            <Textarea id="cu-notes" rows={3} value={v.notes} onChange={set("notes")} aria-describedby="cu-notes-msg" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {customer ? "Save" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
