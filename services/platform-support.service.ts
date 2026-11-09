import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { getCurrentUser } from "@/lib/auth/session";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/services/admin-audit.service";
import { mapProvisioningError } from "@/services/platform.service";

/**
 * Internal support notes. They live in a table nobody can reach directly and are read and written only by admin-only SQL
 * functions, so an organization's own users can never see them. Only the author can edit a note. Each change is audited
 * WITHOUT copying the note text (it is free text and could contain anything): the entry records that it happened and how long it was.
 */

export type SupportNote = {
  id: string;
  tenantId: string;
  tenantName: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  /** Edited after it was written. */
  edited: boolean;
  /** True for the signed-in admin's own notes: the only ones they can edit. */
  canEdit: boolean;
};

export type SupportNotePage = { notes: SupportNote[]; total: number; page: number; pageSize: number };

const rowSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  tenant_name: z.string(),
  author_id: z.uuid(),
  author_email: z.string(),
  body: z.string(),
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]),
  total_count: z.union([z.string(), z.number(), z.bigint()]),
});

type Args = { tenantId?: string | null; q?: string; page: number; pageSize: number };

async function fetchNotes(tx: DbTx, a: Args, page: number) {
  return z.array(rowSchema).parse(
    rowsOf(await tx.execute(sql`select * from public.platform_list_support_notes(${a.tenantId ?? null}::uuid, ${a.q || null}, ${a.pageSize}, ${(page - 1) * a.pageSize})`)),
  );
}

/** One page of notes, newest first: one organization's, or everyone's (the Support page). */
export async function listSupportNotes(a: Args): Promise<SupportNotePage> {
  await requirePlatformAdmin();
  const me = (await getCurrentUser())?.id ?? null;
  return withAuthenticatedDb(async (tx) => {
    let page = a.page;
    let raw = await fetchNotes(tx, a, page);
    if (raw.length === 0 && page > 1) {
      const first = await fetchNotes(tx, a, 1);
      page = Math.max(1, Math.ceil(Number(first[0]?.total_count ?? 0) / a.pageSize));
      raw = page === 1 ? first : await fetchNotes(tx, a, page);
    }
    return {
      page,
      pageSize: a.pageSize,
      total: Number(raw[0]?.total_count ?? 0),
      notes: raw.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        authorId: r.author_id,
        authorEmail: r.author_email,
        body: r.body,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.updated_at),
        edited: new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 1000,
        canEdit: r.author_id === me,
      })),
    };
  });
}

export async function addSupportNote(tenantId: string, body: string): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ id: string }>(await tx.execute(sql`select public.platform_add_support_note(${tenantId}::uuid, ${body}) as id`));
      const id = rows[0]?.id;
      if (!id) throw new AppError("UNKNOWN", "Could not save the note. Please try again.");
      await recordAudit(tx, {
        action: "support_note.created",
        entityType: "support_note",
        entityId: id,
        organizationId: tenantId,
        description: "Added a support note",
        next: { length: body.trim().length },
      });
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

const updated = z.object({ tenant_id: z.uuid(), previous_body: z.string() });

/** Edits one of your own notes. Nothing is logged when the text is unchanged. */
export async function updateSupportNote(noteId: string, body: string): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ r: unknown }>(await tx.execute(sql`select public.platform_update_support_note(${noteId}::uuid, ${body}) as r`));
      const { tenant_id: tenantId, previous_body: previous } = updated.parse(rows[0]?.r);
      if (previous.trim() === body.trim()) return;
      await recordAudit(tx, {
        action: "support_note.updated",
        entityType: "support_note",
        entityId: noteId,
        organizationId: tenantId,
        description: "Edited a support note",
        previous: { length: previous.trim().length },
        next: { length: body.trim().length },
      });
    });
  } catch (error) {
    return mapProvisioningError(error, "That note was not found.");
  }
}
