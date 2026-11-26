import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ROUTES } from "@/config/app";
import type { MyEntitlementsApi } from "@/lib/api/endpoints/billing-api";
import { bytesText } from "@/lib/billing/format";

const num = (n: number, unit: "count" | "bytes") => (unit === "bytes" ? bytesText(n) : n.toLocaleString("en-IN"));

/**
 * A short notice above every dashboard page when the subscription is not active or a limit is close or reached. Display only: the API
 * refuses what the plan does not allow whether or not this is shown. Only the Owner is sent to the billing page; others are told to ask them.
 */
export function PlanNotice({ plan, isOwner }: { plan: MyEntitlementsApi; isOwner: boolean }) {
  const lines: string[] = [];
  if (!plan.entitled && !plan.isUnrestricted) lines.push(`Your subscription is ${plan.subscriptionStatus === "expired" ? "expired" : "not active"}, so paid features are switched off.`);
  for (const l of plan.attention) {
    const have = l.used !== null && l.hard !== null ? ` (${num(l.used, l.unit)} of ${num(l.hard, l.unit)})` : "";
    lines.push(l.level === "reached" ? `${l.label}: limit reached${have}.${l.enforced ? " You cannot add more until your plan changes." : ""}` : `${l.label}: close to the limit${have}.`);
  }
  if (lines.length === 0) return null;
  const severe = !plan.entitled || plan.attention.some((l) => l.level === "reached");
  return (
    <div role="status" className={`mb-5 flex items-start gap-2 rounded-lg border p-3 text-sm ${severe ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/10"}`}>
      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${severe ? "text-destructive" : "text-warning-text"}`} aria-hidden />
      <div className="space-y-1">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p className="text-muted-foreground">
          {isOwner ? (
            <>
              See <Link href={ROUTES.billing} className="underline">Plan &amp; billing</Link> or contact Kanova Store to change your plan.
            </>
          ) : (
            "Ask the store owner to review the plan."
          )}
        </p>
      </div>
    </div>
  );
}
