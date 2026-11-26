import "server-only";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { listAuditAdminsApi, listAuditLogsApi } from "@/lib/api/endpoints/platform-api";
import type { AuditListQuery } from "@/lib/validations/admin-list";

/**
 * Platform Admin audit trail, read through the StoreForge API (`/platform/audit-logs`). Entries are written by the API
 * inside the same transaction as the change they describe (append-only table); the frontend never writes them.
 */
export type AuditRow = {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  description: string;
  previousData: unknown;
  newData: unknown;
  createdAt: Date;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};

export type AuditPage = { rows: AuditRow[]; total: number; page: number; pageSize: number };

/** A page past the end answers with the last real page (the API clamps it). */
export async function listAuditLogs(q: AuditListQuery): Promise<AuditPage> {
  await requirePlatformAdmin();
  const { items, meta } = await listAuditLogsApi({ page: q.page, limit: q.pageSize, action: q.action, entity: q.entity, admin: q.admin, org: q.org, search: q.q, from: q.from, to: q.to });
  return { page: meta.page, pageSize: q.pageSize, total: meta.total, rows: items.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })) };
}

/** Administrators who appear in the log, for the filter dropdown. */
export async function listAuditAdmins(): Promise<{ id: string; email: string }[]> {
  await requirePlatformAdmin();
  return (await listAuditAdminsApi()).sort((a, b) => a.email.localeCompare(b.email));
}
