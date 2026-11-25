"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Banknote, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { recordManualPaymentAction, refundPaymentAction, voidInvoiceAction } from "@/app/(admin)/admin/commercial-actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/admin/format";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { manualPaymentSchema, refundSchema, voidInvoiceSchema } from "@/lib/validations/admin-commercial";
import type { ActionResult } from "@/types/action";

type Which = "void" | "pay" | null;

/** A small dialog with a form: validates with the schema the server uses, shows server errors in place, closes and refreshes on success. */
function FormDialog({ title, description, submitLabel, pendingLabel, destructive, children, onClose, onSubmit, validateWith, values }: {
  title: string;
  description: React.ReactNode;
  submitLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  children: (e: { errors: Record<string, string>; pending: boolean; clear: (k: string) => void }) => React.ReactNode;
  onClose: () => void;
  onSubmit: () => Promise<ActionResult<unknown>>;
  validateWith: Parameters<ReturnType<typeof useFormErrors>["validate"]>[0];
  values: unknown;
}) {
  const router = useRouter();
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();
  return (
    <Dialog open onOpenChange={(o) => !pending && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate(validateWith, values)) return;
            send(async () => {
              const res = await onSubmit();
              if (!res.ok) return void fail(res);
              toast.success(`${title} done`);
              onClose();
              router.refresh();
            });
          }}
        >
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          {children({ errors, pending, clear })}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Void an unpaid invoice, or record that it was paid outside Razorpay. Only shown to people who can manage billing. */
export function InvoiceActions({ invoiceId, number, status, totalMinor, currency }: { invoiceId: string; number: string; status: "open" | "paid" | "void"; totalMinor: number; currency: string }) {
  const [which, setWhich] = useState<Which>(null);
  const [reason, setReason] = useState("");
  const [pay, setPay] = useState({ reference: "", method: "Bank transfer", note: "" });
  if (status !== "open") return null;
  const close = () => setWhich(null);

  return (
    <>
      <Button onClick={() => setWhich("pay")}><Banknote aria-hidden /> Record offline payment</Button>
      <Button variant="outline" onClick={() => setWhich("void")}><Ban aria-hidden /> Void invoice</Button>

      {which === "pay" ? (
        <FormDialog
          title="Record offline payment"
          description={`Marks ${number} paid for ${money(totalMinor, currency)} and extends the subscription, as an online payment would. Use this only when the money has really arrived.`}
          submitLabel="Record payment"
          pendingLabel="Recording…"
          onClose={close}
          validateWith={manualPaymentSchema}
          values={pay}
          onSubmit={() => recordManualPaymentAction(invoiceId, pay)}
        >
          {({ errors, pending, clear }) => (
            <>
              <FormField id="mp-method" label="How was it paid?" required error={errors.method}>
                <Input id="mp-method" value={pay.method} disabled={pending} onChange={(e) => { setPay({ ...pay, method: e.target.value }); clear("method"); }} aria-invalid={Boolean(errors.method)} aria-describedby="mp-method-msg" />
              </FormField>
              <FormField id="mp-ref" label="Reference" required error={errors.reference} hint="The bank, cheque or transfer reference, for your records.">
                <Input id="mp-ref" value={pay.reference} disabled={pending} onChange={(e) => { setPay({ ...pay, reference: e.target.value }); clear("reference"); }} aria-invalid={Boolean(errors.reference)} aria-describedby="mp-ref-msg" autoFocus />
              </FormField>
              <FormField id="mp-note" label="Note" optional error={errors.note}>
                <Textarea id="mp-note" rows={2} value={pay.note} disabled={pending} onChange={(e) => { setPay({ ...pay, note: e.target.value }); clear("note"); }} />
              </FormField>
            </>
          )}
        </FormDialog>
      ) : null}

      {which === "void" ? (
        <FormDialog
          title="Void invoice"
          description={`${number} will be cancelled and can no longer be paid. Use it for a billing mistake. A payment that still arrives is kept and flagged for refund.`}
          submitLabel="Void invoice"
          pendingLabel="Voiding…"
          destructive
          onClose={close}
          validateWith={voidInvoiceSchema}
          values={{ reason }}
          onSubmit={() => voidInvoiceAction(invoiceId, { reason })}
        >
          {({ errors, pending, clear }) => (
            <FormField id="vi-reason" label="Reason" required error={errors.reason}>
              <Textarea id="vi-reason" rows={3} value={reason} disabled={pending} onChange={(e) => { setReason(e.target.value); clear("reason"); }} aria-invalid={Boolean(errors.reason)} aria-describedby="vi-reason-msg" autoFocus />
            </FormField>
          )}
        </FormDialog>
      ) : null}
    </>
  );
}

/**
 * Refund a payment, in full or in part. The request id is made when the dialog opens and kept until it closes, so pressing the button
 * twice, or again after a network failure, is the same refund and can never pay out twice.
 */
export function RefundButton({ paymentId, remainingMinor, currency, label }: { paymentId: string; remainingMinor: number; currency: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [v, setV] = useState({ amount: "", reason: "" });
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRequestId(crypto.randomUUID());
          setV({ amount: "", reason: "" });
          setOpen(true);
        }}
      >
        <Undo2 aria-hidden /> Refund
      </Button>
      {open ? (
        <FormDialog
          title="Refund payment"
          description={`${label}. Up to ${money(remainingMinor, currency)} can still be refunded. Leave the amount empty to refund all of it. Razorpay refunds can take a few days to reach the customer.`}
          submitLabel="Refund"
          pendingLabel="Refunding…"
          destructive
          onClose={() => setOpen(false)}
          validateWith={refundSchema}
          values={v}
          onSubmit={() => refundPaymentAction(paymentId, requestId, v)}
        >
          {({ errors, pending, clear }) => (
            <>
              <FormField id="rf-amount" label={`Amount (${currency})`} optional error={errors.amount} hint="Empty refunds everything that is left.">
                <Input id="rf-amount" inputMode="decimal" value={v.amount} disabled={pending} onChange={(e) => { setV({ ...v, amount: e.target.value }); clear("amount"); }} aria-invalid={Boolean(errors.amount)} aria-describedby="rf-amount-msg" />
              </FormField>
              <FormField id="rf-reason" label="Reason" required error={errors.reason}>
                <Textarea id="rf-reason" rows={2} value={v.reason} disabled={pending} onChange={(e) => { setV({ ...v, reason: e.target.value }); clear("reason"); }} aria-invalid={Boolean(errors.reason)} aria-describedby="rf-reason-msg" autoFocus />
              </FormField>
            </>
          )}
        </FormDialog>
      ) : null}
    </>
  );
}
