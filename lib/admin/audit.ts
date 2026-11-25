/**
 * Every action a Platform Admin can leave in the audit log, with the label shown on the Activity page.
 * The database only checks the shape (`entity.verb`); this list is the single source of truth for what the app records.
 * The list matches the API (`GET /platform/audit-logs/filters`), including plans, subscriptions, entitlements and billing.
 */
export const AUDIT_ACTIONS = [
  "organization.created",
  "organization.updated",
  "organization.suspended",
  "organization.reactivated",
  "store.updated",
  "team_member.added",
  "team_member.disabled",
  "team_member.reactivated",
  "team_member.removed",
  "ownership.transferred",
  "platform_admin.added",
  "platform_admin.removed",
  "platform_admin.role_changed",
  "platform_settings.updated",
  "organization.deleted",
  "plan.created",
  "plan.updated",
  "plan.activated",
  "plan.deactivated",
  "plan.default_changed",
  "subscription.created",
  "subscription.changed",
  "entitlement.feature_overridden",
  "entitlement.feature_override_removed",
  "entitlement.limit_overridden",
  "entitlement.limit_override_removed",
  "invoice.issued",
  "invoice.voided",
  "payment.manual_recorded",
  "payment.refunded",
  "payment.refund_failed",
  "billing.settings_updated",
  "billing.run_completed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "organization.created": "Organization created",
  "organization.updated": "Organization updated",
  "organization.suspended": "Organization suspended",
  "organization.reactivated": "Organization reactivated",
  "store.updated": "Store updated",
  "team_member.added": "Team member added",
  "team_member.disabled": "Team member disabled",
  "team_member.reactivated": "Team member reactivated",
  "team_member.removed": "Team member removed",
  "ownership.transferred": "Ownership transferred",
  "platform_admin.added": "Platform admin added",
  "platform_admin.removed": "Platform admin removed",
  "platform_admin.role_changed": "Platform admin level changed",
  "platform_settings.updated": "Platform settings updated",
  "organization.deleted": "Organization deleted",
  "plan.created": "Plan created",
  "plan.updated": "Plan updated",
  "plan.activated": "Plan activated",
  "plan.deactivated": "Plan deactivated",
  "plan.default_changed": "Default plan changed",
  "subscription.created": "Subscription started",
  "subscription.changed": "Subscription changed",
  "entitlement.feature_overridden": "Feature exception set",
  "entitlement.feature_override_removed": "Feature exception removed",
  "entitlement.limit_overridden": "Limit exception set",
  "entitlement.limit_override_removed": "Limit exception removed",
  "invoice.issued": "Invoice issued",
  "invoice.voided": "Invoice voided",
  "payment.manual_recorded": "Offline payment recorded",
  "payment.refunded": "Refund started",
  "payment.refund_failed": "Refund failed",
  "billing.settings_updated": "Billing settings updated",
  "billing.run_completed": "Billing run completed",
};

/**
 * Labels for actions the app no longer performs but whose entries remain in the log (the log is permanent). They are shown
 * on the Activity page but are not offered as filters and are never written again.
 */
export const LEGACY_AUDIT_ACTION_LABELS: Record<string, string> = {
  "support_note.created": "Support note added (feature removed)",
  "support_note.updated": "Support note edited (feature removed)",
  "store.status_changed": "Store status changed (feature removed)",
};
