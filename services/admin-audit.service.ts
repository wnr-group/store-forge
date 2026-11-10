import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import type { AuditEntry } from "@/lib/admin/audit";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import type { AuditListQuery } from "@/lib/validations/admin-list";

/**
 * Platform Admin audit trail. Rows are written by public.platform_record_audit() (admin-only, administrator taken from the
 * session by the database) and read by public.platform_list_audit(); the table itself cannot be reached or edited.
 */

/**
 * Records one action INSIDE the caller's transaction, so the change and its log entry commit or roll back together.
 * Callers have already authorised the Platform Admin; the SQL function checks again.
 */
export async function recordAudit(tx: DbTx, e: AuditEntry): Promise<void> {
  await tx.execute(sql`select public.platform_record_audit(
    ${e.action}, ${e.entityType}, ${e.entityId ?? null}::uuid, ${e.organizationId ?? null}::uuid, ${e.description},
    ${e.previous ? JSON.stringify(e.previous) : null}::jsonb, ${e.next ? JSON.stringify(e.next) : null}::jsonb)`);
}

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
};

type AuditRaw = {
  id: string; admin_user_id: string; admin_email: string; action: string; entity_type: string; entity_id: string | null;
  organization_id: string | null; organization_name: string | null; description: string; previous_data: unknown; new_data: unknown;
  created_at: string | Date; total_count: string | number | bigint;
};

export type AuditPage = { rows: AuditRow[]; total: number; page: number; pageSize: number };

/** `YYYY-MM-DD` -> the start of that day (UTC); `plusDays` gives the exclusive end of a range. */
const day = (s: string, plusDays = 0): string | null => {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString();
};

async function fetchPage(tx: DbTx, q: AuditListQuery, page: number) {
  return rowsOf<AuditRaw>(
    await tx.execute(sql`select * from public.platform_list_audit(
      ${q.action === "all" ? null : q.action}, ${q.admin === "all" ? null : q.admin}::uuid, ${q.org || null}::uuid, ${q.q || null},
      ${day(q.from)}::timestamptz, ${day(q.to, 1)}::timestamptz, ${q.pageSize}, ${(page - 1) * q.pageSize})`),
  );
}

export async function listAuditLogs(q: AuditListQuery): Promise<AuditPage> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    let page = q.page;
    let raw = await fetchPage(tx, q, page);
    if (raw.length === 0 && page > 1) {
      // Asked for a page past the end (an old link): show the last real page instead of an empty one.
      const first = await fetchPage(tx, q, 1);
      page = Math.max(1, Math.ceil(Number(first[0]?.total_count ?? 0) / q.pageSize));
      raw = page === 1 ? first : await fetchPage(tx, q, page);
    }
    return {
      page,
      pageSize: q.pageSize,
      total: Number(raw[0]?.total_count ?? 0),
      rows: raw.map((r) => ({
        id: r.id,
        adminUserId: r.admin_user_id,
        adminEmail: r.admin_email,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        organizationId: r.organization_id,
        organizationName: r.organization_name,
        description: r.description,
        previousData: r.previous_data,
        newData: r.new_data,
        createdAt: new Date(r.created_at),
      })),
    };
  });
}

const adminRows = z.array(z.object({ admin_user_id: z.uuid(), admin_email: z.string() }));

/** Administrators who appear in the log, for the filter dropdown. */
export async function listAuditAdmins(): Promise<{ id: string; email: string }[]> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    const rows = adminRows.parse(rowsOf(await tx.execute(sql`select * from public.platform_audit_admins()`)));
    return rows.map((r) => ({ id: r.admin_user_id, email: r.admin_email })).sort((a, b) => a.email.localeCompare(b.email));
  });
}
