"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startInvoicePaymentAction, verifyInvoicePaymentAction } from "@/app/(dashboard)/dashboard/billing/actions";
import { loadRazorpay } from "@/components/storefront/checkout/razorpay";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/admin/format";

/**
 * Pays one Kanova Store invoice with Razorpay Checkout. The server creates the Razorpay order for the amount stored on the invoice; this
 * button only opens the widget with what the server returned and hands Razorpay's three success values back, which the API checks with
 * Razorpay before it marks the invoice paid. The widget closing "successfully" proves nothing by itself, and no card detail ever
 * reaches Kanova Store.
 */
export function PayInvoiceButton({ invoiceId, number, totalMinor, currency, label }: { invoiceId: string; number: string; totalMinor: number; currency: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const started = await startInvoicePaymentAction(invoiceId);
      if (!started.ok) return void setError(started.error);
      if (!started.data) return void setError("Could not start the payment. Please try again.");
      const { orderId, keyId, amountMinor, currency: cur, invoiceNumber } = started.data;
      const Razorpay = await loadRazorpay();
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        const checkout = new Razorpay({
          key: keyId,
          order_id: orderId,
          amount: amountMinor,
          currency: cur,
          name: "Kanova Store",
          description: `Invoice ${invoiceNumber}`,
          handler: async (response: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
            const verified = await verifyInvoicePaymentAction({ razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature });
            if (!verified.ok) setError(verified.error);
            else if (verified.data?.invoiceStatus === "paid") toast.success(`Invoice ${invoiceNumber} is paid. Thank you.`);
            else toast.message("We received your payment and are confirming it. This page updates shortly.");
            router.refresh();
            done();
          },
          modal: { ondismiss: done },
        });
        checkout.on("payment.failed", (r) => setError(r.error?.description ?? "The payment failed. You have not been charged for the invoice; try again."));
        checkout.open();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" onClick={pay} disabled={busy} aria-label={`Pay invoice ${number}`}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />} {label ?? `Pay ${money(totalMinor, currency)}`}
      </Button>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
