import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ROUTES } from "@/config/app";
import type { FeatureAccess } from "@/lib/billing/features";

type Props = { label: string; access: Exclude<FeatureAccess, "enabled">; isOwner: boolean; className?: string };

/**
 * Shown instead of a screen (or a section) the plan does not include. Only the Owner can change the plan, so only they get the button;
 * everyone else is told who to ask. Display only: the API refuses the calls too.
 */
export function FeatureLocked({ label, access, isOwner, className }: Props) {
  const title = access === "unknown" ? `${label} is unavailable right now` : access === "inactive" ? `${label} is switched off` : `${label} is not included in your plan`;
  const description =
    access === "unknown"
      ? "We could not check what your plan includes. Reload the page, or try again in a moment."
      : access === "inactive"
        ? "Your subscription is not active, so paid features are off. Renew your plan to use this again."
        : "Upgrade your plan to use this feature.";
  return (
    <EmptyState
      className={className}
      icon={Lock}
      title={title}
      description={isOwner || access === "unknown" ? description : `${description} Ask the store owner to change the plan.`}
      action={
        access === "unknown" ? null : isOwner ? (
          <Link href={ROUTES.billing} className={buttonVariants()}>
            Upgrade plan
          </Link>
        ) : null
      }
    />
  );
}
