import { reportRazorpayFailureAction, startRazorpayAction, verifyRazorpayAction } from "@/app/s/[slug]/checkout/actions";
import type { PublicOrderApi, RazorpaySessionApi } from "@/lib/api/endpoints/checkout-api";

/**
 * Razorpay Checkout in the shopper's browser. The server decides the amount and creates the Razorpay order; this file only
 * opens the widget with what the server returned and hands Razorpay's three success values back to the server, which checks
 * the signature and asks Razorpay itself before the order is marked paid. A "success" seen here proves nothing by itself.
 */
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", handler: (response: { error?: { description?: string; metadata?: { order_id?: string; payment_id?: string } } }) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RazorpayCtor> | null = null;
/** Why the last attempt in this window failed, so closing the widget afterwards can say so. */
let lastFailure: string | null = null;
const consumeFailure = () => {
  const m = lastFailure ?? "The payment failed.";
  lastFailure = null;
  return m;
};

export function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay did not load.")));
    el.onerror = () => {
      loading = null;
      el.remove();
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(el);
  });
  return loading;
}

export type PayOutcome =
  | { status: "paid"; order: PublicOrderApi }
  | { status: "dismissed" }
  | { status: "failed"; message: string }
  | { status: "error"; message: string };

type Ref = { storeSlug: string; orderNumber: number; token: string };

/** Starts (or retries) the payment of an unpaid online order and resolves once the shopper has paid, closed the window or failed. */
export async function payWithRazorpay(ref: Ref, storeName: string): Promise<PayOutcome> {
  lastFailure = null;
  const started = await startRazorpayAction(ref);
  if (!started.ok || !started.data) return { status: "error", message: started.ok ? "Could not start the payment." : started.error };
  const session: RazorpaySessionApi = started.data;
  let Razorpay: RazorpayCtor;
  try {
    Razorpay = await loadRazorpay();
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not load the payment window." };
  }

  return new Promise<PayOutcome>((resolve) => {
    let settled = false;
    const done = (outcome: PayOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const widget = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amountMinor,
      currency: session.currency,
      name: storeName,
      description: `Order #${session.orderNumber}`,
      prefill: session.customer,
      theme: { color: "#111111" },
      modal: { ondismiss: () => done({ status: "dismissed" }) },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verified = await verifyRazorpayAction({ ...ref, ...response });
        done(verified.ok && verified.data ? { status: "paid", order: verified.data } : { status: "error", message: verified.ok ? "We could not confirm your payment yet." : verified.error });
      },
    });
    widget.on("payment.failed", (response) => {
      const meta = response.error?.metadata;
      if (meta?.order_id && meta.payment_id) void reportRazorpayFailureAction({ ...ref, razorpay_order_id: meta.order_id, razorpay_payment_id: meta.payment_id });
      // The widget stays open for a retry; only a closed window ends the attempt, so just remember why it failed.
      lastFailure = response.error?.description ?? "The payment failed.";
    });
    widget.open();
  }).then((outcome) => (outcome.status === "dismissed" && lastFailure ? { status: "failed", message: consumeFailure() } : outcome));
}
