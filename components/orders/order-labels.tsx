import { StatusBadge, type Tone } from "@/components/shared/status-badge";

/** Human labels and badge colours for the API's order, payment and shipment statuses. Colour is never the only signal. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending_collection: "COD · to collect",
  paid: "Paid",
  collected: "COD · collected",
  failed: "Payment failed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export const FULFILLMENT_LABELS: Record<string, string> = { unfulfilled: "Unfulfilled", partial: "Partly shipped", fulfilled: "Fulfilled", returned: "Returned" };

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  creating: "Booking…",
  created: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  undelivered: "Delivery attempt failed",
  returning: "Returning",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
  failed: "Booking failed",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = { created: "Created", authorized: "Authorized", captured: "Captured", failed: "Failed", cancelled: "Cancelled", pending_collection: "To collect", collected: "Collected" };
export const REFUND_STATUS_LABELS: Record<string, string> = { pending: "Pending", processing: "Processing", processed: "Processed", failed: "Failed" };
export const METHOD_LABELS: Record<string, string> = { razorpay: "Razorpay", cod: "Cash on delivery", upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI", paylater: "Pay later", cardless_emi: "Cardless EMI", bank_transfer: "Bank transfer" };

const ORDER_TONE: Record<string, Tone> = { pending_payment: "warning", confirmed: "info", processing: "info", ready_to_ship: "info", shipped: "info", out_for_delivery: "info", delivered: "active", cancelled: "draft", failed: "danger", returned: "warning" };
const PAYMENT_TONE: Record<string, Tone> = { unpaid: "warning", pending_collection: "warning", paid: "active", collected: "active", failed: "danger", partially_refunded: "info", refunded: "neutral" };
const SHIPMENT_TONE: Record<string, Tone> = { creating: "warning", created: "info", picked_up: "info", in_transit: "info", out_for_delivery: "info", undelivered: "warning", returning: "warning", delivered: "active", returned: "warning", cancelled: "draft", failed: "danger" };
const TRANSACTION_TONE: Record<string, Tone> = { created: "draft", authorized: "warning", captured: "active", failed: "danger", cancelled: "draft", pending_collection: "warning", collected: "active" };
const REFUND_TONE: Record<string, Tone> = { pending: "warning", processing: "warning", processed: "active", failed: "danger" };

export const labelFor = (labels: Record<string, string>, value: string) => labels[value] ?? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const OrderStatusBadge = ({ status }: { status: string }) => <StatusBadge tone={ORDER_TONE[status] ?? "neutral"}>{labelFor(ORDER_STATUS_LABELS, status)}</StatusBadge>;
export const PaymentStatusBadge = ({ status }: { status: string }) => <StatusBadge tone={PAYMENT_TONE[status] ?? "neutral"}>{labelFor(PAYMENT_STATUS_LABELS, status)}</StatusBadge>;
export const ShipmentStatusBadge = ({ status }: { status: string }) => <StatusBadge tone={SHIPMENT_TONE[status] ?? "neutral"}>{labelFor(SHIPMENT_STATUS_LABELS, status)}</StatusBadge>;
export const TransactionStatusBadge = ({ status }: { status: string }) => <StatusBadge tone={TRANSACTION_TONE[status] ?? "neutral"}>{labelFor(TRANSACTION_STATUS_LABELS, status)}</StatusBadge>;
export const RefundStatusBadge = ({ status }: { status: string }) => <StatusBadge tone={REFUND_TONE[status] ?? "neutral"}>{labelFor(REFUND_STATUS_LABELS, status)}</StatusBadge>;
