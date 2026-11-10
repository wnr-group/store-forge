import type { AdminAuditEntityType } from "@/lib/db/schema";

/**
 * Every action a Platform Admin can leave in the audit log, with the label shown on the Activity page.
 * The database only checks the shape (`entity.verb`); this list is the single source of truth for what the app records.
 * Organization deletion is intentionally not here: that flow is unchanged.
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

export type AuditEntry = {
  action: AuditAction;
  entityType: AdminAuditEntityType;
  entityId?: string | null;
  organizationId?: string | null;
  description: string;
  /** Plain facts about the change. Never put credentials here (the database strips obvious ones as a second line of defence). */
  previous?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
};
