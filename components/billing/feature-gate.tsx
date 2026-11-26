import { FeatureLocked } from "@/components/billing/feature-locked";
import { PageHeader } from "@/components/shared/page-header";
import { FEATURE_LABEL, featureAccess, type FeatureAccess, type FeatureKey } from "@/lib/billing/features";
import { requireWorkspace } from "@/lib/tenant/context";
import { getMyEntitlements } from "@/services/billing.service";

/** What the plan answers for this workspace. A plan that cannot be read answers "unknown", never "enabled". */
export async function loadPlanAccess() {
  const [{ active }, plan] = await Promise.all([requireWorkspace(), getMyEntitlements().catch(() => null)]);
  const isOwner = active.role === "owner";
  const labelOf = (key: FeatureKey) => plan?.features.find((f) => f.key === key)?.label ?? FEATURE_LABEL[key];
  return { isOwner, access: (key: FeatureKey): FeatureAccess => featureAccess(plan, key), labelOf };
}

/**
 * Wraps a screen (default) or one section (`inline`) that needs a plan feature, and shows the "not included" state instead of it when the
 * plan lacks the feature or cannot be read. Use it in a layout to guard a whole route against direct URLs.
 */
export async function FeatureGate({ feature, inline = false, children }: { feature: FeatureKey; inline?: boolean; children: React.ReactNode }) {
  const { isOwner, access, labelOf } = await loadPlanAccess();
  const state = access(feature);
  if (state === "enabled") return <>{children}</>;
  const locked = <FeatureLocked label={labelOf(feature)} access={state} isOwner={isOwner} />;
  return inline ? locked : <><PageHeader title={labelOf(feature)} />{locked}</>;
}
