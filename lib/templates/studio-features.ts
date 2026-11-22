/**
 * Studio feature availability as the API reports it (`GET store/studio/status` -> `features`), and what it means for components.
 * Pure. An absent or unknown key is `unavailable`; nothing here ever invents an approval.
 */
import type { ApprovalRecord, AvailabilityContext, UnavailableReason } from "./availability";
import type { MessageKey } from "../i18n/messages";

export type FeatureState = "available" | "unavailable";
export const STUDIO_FEATURE_KEYS = Object.freeze(["badge_upload", "review_import"] as const);
export type StudioFeatureKey = (typeof STUDIO_FEATURE_KEYS)[number];
export type StudioFeatures = Record<StudioFeatureKey, FeatureState>;

export const NO_FEATURES: StudioFeatures = Object.freeze({ badge_upload: "unavailable", review_import: "unavailable" });

/** Reads the `features` field of the status answer. Anything that is not exactly "available" for a known key reads as unavailable. */
export function parseStudioFeatures(input: unknown): StudioFeatures {
  const raw = input !== null && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const state = (k: StudioFeatureKey): FeatureState => (Object.hasOwn(raw, k) && raw[k] === "available" ? "available" : "unavailable");
  return { badge_upload: state("badge_upload"), review_import: state("review_import") };
}

/** Component legal feature key -> the Studio status feature whose availability is its approval. Countdown has none: no approval can exist yet. */
const APPROVAL_FROM_FEATURE: Readonly<Record<string, StudioFeatureKey>> = Object.freeze({ trust_badges: "badge_upload" });

/** The approvals the status answer proves. `trust_badges` is approved only when `badge_upload` is available. */
export function approvalsFromFeatures(features: StudioFeatures | undefined): ApprovalRecord[] {
  const out: ApprovalRecord[] = [];
  for (const [featureKey, studioKey] of Object.entries(APPROVAL_FROM_FEATURE)) {
    if (features?.[studioKey] === "available") out.push({ featureKey });
  }
  return out;
}

export const availabilityContextFor = (features: StudioFeatures | undefined): AvailabilityContext => ({ approvals: approvalsFromFeatures(features), purchaseFlowLive: false });

/** The merchant-facing catalogue key for the first reason a component is unavailable. */
export function unavailableReasonKey(reasons: readonly UnavailableReason[]): MessageKey {
  const first = reasons[0];
  if (first === "legal_approval_missing") return "component.unavailable.reason.legal";
  if (first === "manifest_unavailable") return "component.unavailable.reason.manifest";
  if (first === "manifest_deprecated") return "component.unavailable.reason.deprecated";
  if (first === "purchase_flow_not_live") return "component.unavailable.reason.purchaseFlow";
  return "component.unavailable.reason";
}
