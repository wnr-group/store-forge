"use client";

import { RefreshCw } from "lucide-react";
import { syncRefundAction } from "@/app/(dashboard)/dashboard/payments/ledger-actions";
import { ActionButton } from "@/components/shared/action-dialog";

/** Asks Razorpay for the refund's current status (webhooks normally do this on their own). */
export function RefundSyncButton({ refundId }: { refundId: string }) {
  return (
    <ActionButton action={() => syncRefundAction(refundId)} success="Refund status updated" variant="ghost" size="icon-sm">
      <RefreshCw aria-hidden />
      <span className="sr-only">Check status with Razorpay</span>
    </ActionButton>
  );
}
