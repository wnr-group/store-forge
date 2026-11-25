"use client";

import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { runBillingAction } from "@/app/(admin)/admin/commercial-actions";
import { Button } from "@/components/ui/button";

/** Does what the scheduler does (renewal invoices, past due, expiry). Safe to press again: a second run changes nothing. */
export function RunBillingButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await runBillingAction();
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        const r = res.data!;
        toast.success(
          r.invoicesIssued + r.markedPastDue + r.expired === 0
            ? "Nothing was due: no invoices to issue and no subscriptions to move"
            : `${r.invoicesIssued} invoice(s) issued, ${r.markedPastDue} marked past due, ${r.expired} expired`,
        );
        router.refresh();
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle aria-hidden />} Run billing now
    </Button>
  );
}
