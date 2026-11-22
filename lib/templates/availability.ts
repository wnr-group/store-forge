/**
 * Runtime availability of a component. Pure: the caller supplies the approvals that really exist and whether the purchase flow
 * is live. Nothing here invents an approval.
 */
import type { ComponentNode, TemplateDocument } from "./document";
import { walkKeys } from "./engine/tree-walk";
import { manifestKey, type ComponentManifest } from "./manifest";

export type ApprovalRecord = { featureKey: string };
export type AvailabilityContext = { approvals: readonly ApprovalRecord[]; purchaseFlowLive: boolean };
export type UnavailableReason = "manifest_unavailable" | "manifest_deprecated" | "legal_approval_missing" | "purchase_flow_not_live";

export type AvailabilityResult = { available: true } | { available: false; reasons: UnavailableReason[] };

export function resolveAvailability(manifest: ComponentManifest, ctx: AvailabilityContext): AvailabilityResult {
  const reasons: UnavailableReason[] = [];
  if (manifest.availability === "unavailable") reasons.push("manifest_unavailable");
  if (manifest.availability === "deprecated") reasons.push("manifest_deprecated");
  if (manifest.legal.required) {
    const key = manifest.legal.featureKey;
    if (!key || !ctx.approvals.some((a) => a.featureKey === key)) reasons.push("legal_approval_missing");
  }
  if (manifest.requiresPurchaseFlow && !ctx.purchaseFlowLive) reasons.push("purchase_flow_not_live");
  return reasons.length === 0 ? { available: true } : { available: false, reasons };
}

export const COMPONENT_UNAVAILABLE_RULE = "component.unavailable";

export type ComponentUnavailableIssue = {
  rule: typeof COMPONENT_UNAVAILABLE_RULE;
  severity: "BLOCKER";
  nodeId: string;
  kind: "section" | "block";
  componentType: string;
  reasons: UnavailableReason[];
  messageKey: "readiness.component.unavailable";
};

/**
 * The `component.unavailable` readiness check: one BLOCKER issue per used node whose manifest resolves unavailable. Types with
 * no manifest are not reported here (an unknown type is a validation error). Disabled nodes are skipped: they do not render.
 * The readiness framework calls this; it is not part of it.
 */
export function checkComponentUnavailable(
  doc: Pick<TemplateDocument, "sections" | "order">,
  manifests: ReadonlyMap<string, ComponentManifest>,
  ctx: AvailabilityContext,
): ComponentUnavailableIssue[] {
  const issues: ComponentUnavailableIssue[] = [];
  const visit = (nodes: Record<string, ComponentNode>, order: readonly string[], kind: "section" | "block") => {
    for (const id of walkKeys(order, nodes)) {
      const node = nodes[id];
      if (!node || node.disabled) continue;
      const manifest = manifests.get(manifestKey({ kind, id: node.type }));
      if (manifest) {
        const result = resolveAvailability(manifest, ctx);
        if (!result.available) {
          issues.push({ rule: COMPONENT_UNAVAILABLE_RULE, severity: "BLOCKER", nodeId: id, kind, componentType: node.type, reasons: result.reasons, messageKey: "readiness.component.unavailable" });
        }
      }
      visit(node.blocks ?? {}, node.block_order ?? [], "block");
    }
  };
  visit(doc.sections, doc.order, "section");
  return issues;
}
