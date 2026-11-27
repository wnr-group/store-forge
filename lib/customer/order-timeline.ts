/**
 * The tracking timeline of an order, built only from what the API reports (the order's status, when it was placed and the time
 * of every status change). Pure, so the page and the tests share it.
 */
export type StepState = "done" | "current" | "upcoming" | "stopped";

export type TimelineStep = { key: string; label: string; state: StepState; at: string | null };

/** The order's path to the customer's door. `pending_payment` is "Order placed"; `ready_to_ship` is "Packed". */
const PATH: { key: string; label: string }[] = [
  { key: "pending_payment", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "ready_to_ship", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

const END: Record<string, string> = { cancelled: "Cancelled", returned: "Returned", failed: "Payment failed" };

/** Names shown for an order status in the customer's account. */
export const TRACKING_LABELS: Record<string, string> = {
  pending_payment: "Order placed",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_to_ship: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  failed: "Payment failed",
};

export const trackingLabel = (status: string) => TRACKING_LABELS[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function buildTimeline(order: { status: string; placedAt: string; timeline: { status: string; at: string }[] }): TimelineStep[] {
  const when = new Map<string, string>();
  for (const e of order.timeline) if (!when.has(e.status)) when.set(e.status, e.at);
  // The first step is the order itself: its time is when it was placed, whichever status it started in.
  when.set("pending_payment", order.placedAt);

  const end = END[order.status];
  if (end) {
    // A finished-early order shows the steps it really went through, then how it ended.
    const reached = PATH.filter((p) => when.has(p.key) && (p.key === "pending_payment" || order.timeline.some((e) => e.status === p.key)));
    const steps: TimelineStep[] = reached.map((p) => ({ key: p.key, label: p.label, state: "done", at: when.get(p.key) ?? null }));
    steps.push({ key: order.status, label: end, state: "stopped", at: when.get(order.status) ?? null });
    return steps;
  }

  const currentAt = PATH.findIndex((p) => p.key === order.status);
  return PATH.map((p, i) => ({
    key: p.key,
    label: p.label,
    // The last step (delivered) is finished, not "in progress".
    state: i < currentAt || (i === currentAt && p.key === "delivered") ? "done" : i === currentAt ? "current" : "upcoming",
    at: i <= currentAt ? (when.get(p.key) ?? null) : null,
  }));
}
