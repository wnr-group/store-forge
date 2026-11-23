"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { refundAction } from "@/app/(dashboard)/dashboard/payments/ledger-actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

/**
 * Refund a captured Razorpay payment, in full or in part. The idempotency key is made when the dialog opens and kept until it
 * closes, so a double click or a retry after a dropped connection can never refund twice. The API checks that the total
 * refunded never exceeds what was captured.
 */
export function RefundButton({ transactionId, currency, refundableMinor }: { transactionId: string; currency: string; refundableMinor: number }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(newKey);
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={refundableMinor <= 0}
        onClick={() => {
          setKey(newKey());
          setOpen(true);
        }}
      >
        <Undo2 aria-hidden /> Refund
      </Button>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Refund this payment"
        description={`Up to ${formatMoney(refundableMinor, currency)} can still be refunded to the customer through Razorpay.`}
        submitLabel={full ? `Refund ${formatMoney(refundableMinor, currency)}` : "Refund amount"}
        pendingLabel="Sending to Razorpay…"
        success="Refund requested"
        onSubmit={() => refundAction(transactionId, { full, amount, currency, reason, idempotencyKey: key })}
      >
        <div role="radiogroup" aria-label="Refund type" className="grid gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="rf-type" checked={full} onChange={() => setFull(true)} /> Full refund of what is left
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="rf-type" checked={!full} onChange={() => setFull(false)} /> Partial refund
          </label>
        </div>
        {!full ? (
          <FormField id="rf-amount" label={`Amount (${currency})`} required>
            <Input id="rf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
        ) : null}
        <FormField id="rf-reason" label="Reason" required hint="Kept in your records.">
          <Textarea id="rf-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </ActionDialog>
    </>
  );
}
