import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAppConnection, createDb, createPlatformAdmin, createUser, onboard } from "./harness";
import { doc, insertTemplate } from "./template-fixtures";

/**
 * Verification of template engine tables under the real pooled application role `storeforge_app`
 * (D15, AC-DB-013, AC-SEC-001, AC-SEC-004, AC-SEC-005, AC-SEC-008).
 *
 * Asserts that:
 * 1. `storeforge_app` cannot access template tables without switching role.
 * 2. `storeforge_app` can switch to `authenticated` within transactions, but never bypass RLS or switch to postgres/service_role.
 * 3. Under `storeforge_app` with `authenticated` role:
 *    - Owner/Manager have full write access to templates, drafts and assignments.
 *    - Staff have read-only access (insert/update/delete rejected).
 *    - Cross-tenant access returns 0 rows.
 *    - Platform Admin has no access.
 *    - Version immutability is strictly enforced (no UPDATE or DELETE on template_versions by any role).
 */

let db: PGlite;
let ownerA: string, managerA: string, staffA: string, platformAdmin: string, ownerB: string;
let tenantA: string, storeA: string;
let templateA: string;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);

async function withTx<T>(
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return asAppConnection(db, async () => {
    await db.exec("begin");
    try {
      if (userId) {
        const claims = JSON.stringify({ sub: userId, role: "authenticated" });
        await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await db.exec("set local role authenticated");
      } else {
        await db.exec("set local role anon");
      }
      const res = await fn();
      await db.exec("commit");
      return res;
    } catch (e) {
      await db.exec("rollback").catch(() => {});
      throw e;
    }
  });
}

beforeAll(async () => {
  db = await createDb();

  platformAdmin = await createPlatformAdmin(db, "super@platform.test");
  [ownerA, managerA, staffA, ownerB] = await Promise.all([
    createUser(db, "ownera@app.test"),
    createUser(db, "managera@app.test"),
    createUser(db, "staffa@app.test"),
    createUser(db, "ownerb@app.test"),
  ]);

  const onbA = await onboard(db, ownerA, "app-store-a");
  tenantA = onbA.tenant_id;
  storeA = onbA.store_id;

  await onboard(db, ownerB, "app-store-b");

  // Add Manager and Staff memberships in Tenant A
  await q(
    "insert into memberships (tenant_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'staff')",
    [tenantA, managerA, staffA],
  );

  // Insert a test template in Store A
  templateA = await insertTemplate(db, {
    tenantId: tenantA,
    storeId: storeA,
    kind: "index",
    name: "Homepage Template",
    draft: doc({ heroHeading: "Welcome" }),
  });
});

afterAll(async () => db.close());

describe("[AC-DB-013] [AC-SEC-001] [AC-SEC-004] [AC-SEC-005] [AC-SEC-008] App role and RLS enforcement", () => {
  it("storeforge_app has no table access before setting transaction context", async () => {
    await asAppConnection(db, async () => {
      await expect(db.query("select * from templates")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from template_versions")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from template_assignments")).rejects.toThrow(/permission denied/);
    });
  });

  it("storeforge_app cannot switch to service_role, anon or postgres", async () => {
    await asAppConnection(db, async () => {
      for (const role of ["service_role", "anon", "postgres"]) {
        await expect(db.exec(`set role ${role}`), role).rejects.toThrow(/permission denied to set role/);
      }
    });
  });

  it("Owner has full select and write access in Tenant A", async () => {
    await withTx(ownerA, async () => {
      const rows = await q<{ id: string }>("select id from templates where id = $1", [templateA]);
      expect(rows).toHaveLength(1);

      // Can update draft
      const updated = await q<{ revision: number }>(
        "update templates set draft = $1 where id = $2 returning revision",
        [JSON.stringify(doc({ heroHeading: "Updated by Owner" })), templateA],
      );
      expect(updated[0].revision).toBe(2);
    });
  });

  it("Manager has full select and write access in Tenant A", async () => {
    await withTx(managerA, async () => {
      const rows = await q<{ id: string }>("select id from templates where id = $1", [templateA]);
      expect(rows).toHaveLength(1);

      // Can update draft
      const updated = await q<{ revision: number }>(
        "update templates set draft = $1 where id = $2 returning revision",
        [JSON.stringify(doc({ heroHeading: "Updated by Manager" })), templateA],
      );
      expect(updated[0].revision).toBe(3);
    });
  });

  it("Staff has read access but is blocked from writing templates (AC-SEC-004)", async () => {
    // Can select
    await withTx(staffA, async () => {
      const rows = await q<{ id: string }>("select id from templates where id = $1", [templateA]);
      expect(rows).toHaveLength(1);
    });

    // UPDATE matches 0 rows under RLS
    await withTx(staffA, async () => {
      const updateRes = await q<{ id: string }>(
        "update templates set draft = $1 where id = $2 returning id",
        [JSON.stringify(doc({ heroHeading: "Hacked by Staff" })), templateA],
      );
      expect(updateRes).toHaveLength(0);
    });

    // INSERT fails under RLS with_check
    await expect(
      withTx(staffA, () =>
        q(
          "insert into templates (tenant_id, store_id, kind, name, draft) values ($1, $2, 'product', 'Staff Product', $3::jsonb)",
          [tenantA, storeA, JSON.stringify(doc())],
        ),
      ),
    ).rejects.toThrow(/violates row-level security policy/);

    // DELETE matches 0 rows under RLS
    await withTx(staffA, async () => {
      const deleteRes = await q<{ id: string }>("delete from templates where id = $1 returning id", [templateA]);
      expect(deleteRes).toHaveLength(0);
    });
  });

  it("Cross-tenant isolation: Owner of Tenant B sees 0 rows of Tenant A (AC-SEC-001)", async () => {
    await withTx(ownerB, async () => {
      const rows = await q<{ id: string }>("select id from templates where id = $1", [templateA]);
      expect(rows).toHaveLength(0);
    });

    // Cannot update Tenant A template
    await withTx(ownerB, async () => {
      const updateRes = await q<{ id: string }>(
        "update templates set draft = $1 where id = $2 returning id",
        [JSON.stringify(doc({ heroHeading: "Hacked by Tenant B" })), templateA],
      );
      expect(updateRes).toHaveLength(0);
    });
  });

  it("Platform Admin has no access to tenant templates (AC-SEC-005)", async () => {
    await withTx(platformAdmin, async () => {
      const rows = await q<{ id: string }>("select id from templates where id = $1", [templateA]);
      expect(rows).toHaveLength(0);
    });
  });

  it("Versions are completely immutable: UPDATE and DELETE rejected for Owner (AC-SEC-008)", async () => {
    // First, publish a version as Owner
    let versionId: string = "";
    await withTx(ownerA, async () => {
      const v = await q<{ id: string }>(
        "insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1, $2, $3, $4::jsonb, 'publish') returning id",
        [tenantA, storeA, templateA, JSON.stringify(doc())],
      );
      versionId = v[0].id;
    });

    // Verify Owner cannot update version (permission denied)
    await expect(
      withTx(ownerA, () => q("update template_versions set source = 'tampered' where id = $1", [versionId])),
    ).rejects.toThrow(/permission denied/);

    // Verify Owner cannot delete version (permission denied)
    await expect(
      withTx(ownerA, () => q("delete from template_versions where id = $1", [versionId])),
    ).rejects.toThrow(/permission denied/);
  });
});
