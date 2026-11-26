"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { startCheckoutAction, verifyCheckoutAction } from "@/app/(auth)/onboarding/actions";
import { priceView, type Interval } from "@/components/landing/pricing-utils";
import { loadRazorpay } from "@/components/storefront/checkout/razorpay";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";
import type { PublicPlan } from "@/services/public-plans.service";

type Outcome = "paid" | "dismissed" | "failed";

/**
 * Pays for the chosen plan with Razorpay Checkout. The server works out the price and creates the Razorpay order; this component only opens
 * the widget with what the server returned and hands Razorpay's three success values back, which the API checks with Razorpay before it
 * marks anything paid. The widget closing "successfully" proves nothing by itself, and no card detail ever reaches StoreForge.
 *
 * A failed or abandoned payment can simply be tried again: the button asks for the same order, so nobody needs another account.
 */
export function PaymentStep({
  plan,
  interval,
  lastFailure,
  prefill,
}: {
  plan: PublicPlan;
  interval: Interval;
  /** Why the previous attempt failed, when the API recorded it (for example a declined card). */
  lastFailure: string | null;
  prefill: { name: string; email: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(lastFailure ? `Your last payment did not go through: ${lastFailure}` : null);
  const price = priceView(plan, interval);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const started = await startCheckoutAction({ planCode: plan.code, billingInterval: interval });
      if (!started.ok) return void setError(started.error);
      const checkout = started.data;
      if (!checkout) return void setError("Could not start the payment. Please try again.");
      // Nothing to pay (a free plan) or already paid: the store step is next.
      if (!checkout.payment) return void router.refresh();

      const Razorpay = await loadRazorpay();
      const outcome = await new Promise<Outcome>((resolve) => {
        let settled = false;
        const done = (value: Outcome) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        const widget = new Razorpay({
          key: checkout.payment!.keyId,
          order_id: checkout.payment!.orderId,
          amount: checkout.totalMinor ?? undefined,
          currency: checkout.currency ?? "INR",
          name: APP_NAME,
          description: `${plan.name} plan (${interval})`,
          prefill: { name: prefill.name, email: prefill.email },
          handler: async (response: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
            const verified = await verifyCheckoutAction({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (!verified.ok) {
              setError(verified.error);
              return done("failed");
            }
            done("paid");
          },
          modal: { ondismiss: () => done("dismissed") },
        });
        widget.on("payment.failed", (r) => {
          setError(r.error?.description ?? "The payment failed. You have not been charged; please try again.");
        });
        widget.open();
      });
      // Whatever happened, ask the server again what state the purchase is in: only it knows whether the payment counts.
      if (outcome === "paid") router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-lp-border bg-lp-soft p-4">
        <p className="text-sm text-lp-text">Your plan</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold text-lp-heading">{plan.name}</p>
          <p>
            <span className="text-xl font-extrabold text-lp-heading">{price.amount}</span>
            {price.per ? <span className="ml-1 text-sm text-lp-text">{price.per}</span> : null}
          </p>
        </div>
        {price.note ? <p className="mt-1 text-sm text-lp-text">{price.note}</p> : null}
        {!price.free ? <p className="mt-2 text-xs text-lp-text">Taxes, if any, are added at checkout. You will see the exact total before you pay.</p> : null}
      </div>

      <FormError message={error} />

      <Button type="button" size="lg" onClick={pay} disabled={busy} className="h-11 w-full rounded-full font-semibold">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
        {price.free ? "Continue" : error ? "Try the payment again" : "Pay securely"}
      </Button>
      {!price.free ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-lp-text">
          <Lock className="size-3.5" aria-hidden /> Payments are processed by Razorpay. We never see your card details.
        </p>
      ) : null}
    </div>
  );
}
