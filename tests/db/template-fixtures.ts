import type { PGlite } from "@electric-sql/pglite";

/** Privileged (superuser) fixture helpers for the template engine DB suites. Role and RLS behaviour is tested separately. */
export const doc = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, layout: "classic", sections: {}, order: [], ...extra });

export async function insertTemplate(
  db: PGlite,
  t: { tenantId: string; storeId: string; kind: string; name?: string; isDefault?: boolean; status?: string; draft?: unknown },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    "insert into templates (tenant_id, store_id, kind, name, is_default, status, draft) values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning id",
    [t.tenantId, t.storeId, t.kind, t.name ?? `${t.kind} template`, t.isDefault ?? false, t.status ?? "active", JSON.stringify(t.draft ?? doc())],
  );
  return r.rows[0].id;
}

/** Publishes `document` the way the service will: insert a version, then move the pointer. Returns the version id. */
export async function publish(
  db: PGlite,
  t: { tenantId: string; storeId: string; templateId: string; document?: unknown; source?: string; rolledBackFrom?: string | null },
): Promise<string> {
  const v = await db.query<{ id: string }>(
    "insert into template_versions (tenant_id, store_id, template_id, document, source, rolled_back_from) values ($1,$2,$3,$4::jsonb,$5,$6) returning id",
    [t.tenantId, t.storeId, t.templateId, JSON.stringify(t.document ?? doc()), t.source ?? "publish", t.rolledBackFrom ?? null],
  );
  await db.query("update templates set published_version_id = $1 where id = $2", [v.rows[0].id, t.templateId]);
  return v.rows[0].id;
}

export const errorText = (e: unknown): string => {
  const parts: string[] = [];
  for (let c: unknown = e; c instanceof Error; c = (c as { cause?: unknown }).cause) parts.push(c.message);
  return parts.join(" | ");
};

export async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "";
  } catch (e) {
    return errorText(e);
  }
}
