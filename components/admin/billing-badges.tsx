import { StatusBadge } from "@/components/shared/status-badge";

/** Invoice and payment states as words, never colour alone. */
export function InvoiceBadge({ status, overdue }: { status: "open" | "paid" | "void"; overdue?: boolean }) {
  if (status === "open" && overdue) return <StatusBadge tone="danger">Overdue</StatusBadge>;
  if (status === "open") return <StatusBadge tone="info">Unpaid</StatusBadge>;
  if (status === "paid") return <StatusBadge tone="active">Paid</StatusBadge>;
  return <StatusBadge tone="draft">Void</StatusBadge>;
}

const PAYMENT: Record<string, { tone: "info" | "active" | "danger" | "neutral" | "warning"; label: string }> = {
  pending: { tone: "info", label: "Pending" },
  succeeded: { tone: "active", label: "Successful" },
  failed: { tone: "danger", label: "Failed" },
  refunded: { tone: "neutral", label: "Refunded" },
  partially_refunded: { tone: "warning", label: "Partly refunded" },
};
export function PaymentBadge({ status }: { status: string }) {
  const p = PAYMENT[status] ?? { tone: "neutral" as const, label: status };
  return <StatusBadge tone={p.tone}>{p.label}</StatusBadge>;
}

const SUBSCRIPTION: Record<string, { tone: "info" | "active" | "danger" | "neutral" | "warning" | "draft"; label: string }> = {
  active: { tone: "active", label: "Active" },
  trialing: { tone: "info", label: "Trial" },
  past_due: { tone: "warning", label: "Past due" },
  expired: { tone: "danger", label: "Expired" },
  canceled: { tone: "draft", label: "Canceled" },
};
export function SubscriptionBadge({ status }: { status: string }) {
  const s = SUBSCRIPTION[status] ?? { tone: "neutral" as const, label: status };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
