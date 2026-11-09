import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, onboard } from "./harness";
import { doc, failure, insertTemplate, publish } from "./template-fixtures";

/**
 * Multi-store template assignment, isolation and layout resolution (Option A, R6, AC-DB-011, AC-DB-012, AC-SEC-002).
 * Verifies that:
 * 1. Products and collections are tenant-wide (no store_id column).
 * 2. Templates and template_assignments are store-scoped (tenant_id + store_id).
 * 3. Cross-store and cross-tenant assignment attempts fail with the explicit SQLSTATE 23503 error message:
 *    "template does not belong to this store".
 * 4. The same product can have independent template assignments in Store 1 and Store 2.
 * 5. get_public_template_layout returns each store's own assigned template for the shared product.
 * 6. The shared catalog is visible from both stores through public functions.
 */

let db: PGlite;
let ownerA: string, ownerB: string;
let tenantA: string, storeA1: string, storeA2: string;
let tenantB: string, storeB: string;
let sharedProductId: string;
let templateA1: string, templateA2: string, templateB: string;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);

beforeAll(async () => {
  db = await createDb();

  // Tenant A with Owner A
  ownerA = await createUser(db, "ownerA@demo.test");
  const onbA = await onboard(db, ownerA, "store-a1");
  tenantA = onbA.tenant_id;
  storeA1 = onbA.store_id;

  // Add a second store for Tenant A (Multi-store setup under the same tenant)
  const storeA2Rows = await asUser(db, ownerA, async () => {
    return q<{ id: string }>(
      "insert into stores (tenant_id, name, slug) values ($1, 'Store A2', 'store-a2') returning id",
      [tenantA],
    );
  });
  storeA2 = storeA2Rows[0].id;

  // Tenant B with Owner B (separate tenant)
  ownerB = await createUser(db, "ownerB@demo.test");
  const onbB = await onboard(db, ownerB, "store-b");
  tenantB = onbB.tenant_id;
  storeB = onbB.store_id;

  // Create a shared product in Tenant A (tenant-wide, no store_id)
  const prodRows = await q<{ id: string }>(
    "insert into products (tenant_id, name, slug, price_minor, status) values ($1, 'Shared Hoodie', 'shared-hoodie', 4999, 'active') returning id",
    [tenantA],
  );
  sharedProductId = prodRows[0].id;

  // Create product templates:
  // templateA1 belongs to tenantA, storeA1
  templateA1 = await insertTemplate(db, {
    tenantId: tenantA,
    storeId: storeA1,
    kind: "product",
    name: "Store 1 Product Template",
    draft: doc({ layout: "store-1-look" }),
  });
  await publish(db, {
    tenantId: tenantA,
    storeId: storeA1,
    templateId: templateA1,
    document: doc({ layout: "store-1-look" }),
  });

  // templateA2 belongs to tenantA, storeA2
  templateA2 = await insertTemplate(db, {
    tenantId: tenantA,
    storeId: storeA2,
    kind: "product",
    name: "Store 2 Product Template",
    draft: doc({ layout: "store-2-look" }),
  });
  await publish(db, {
    tenantId: tenantA,
    storeId: storeA2,
    templateId: templateA2,
    document: doc({ layout: "store-2-look" }),
  });

  // templateB belongs to tenantB, storeB
  templateB = await insertTemplate(db, {
    tenantId: tenantB,
    storeId: storeB,
    kind: "product",
    name: "Tenant B Product Template",
    draft: doc({ layout: "tenant-b-look" }),
  });
  await publish(db, {
    tenantId: tenantB,
    storeId: storeB,
    templateId: templateB,
    document: doc({ layout: "tenant-b-look" }),
  });
});

afterAll(async () => db.close());

describe("[AC-DB-011] [AC-SEC-002] Multi-store assignment boundaries & explicit error message", () => {
  it("rejects cross-store assignment insert within the same tenant with explicit error", async () => {
    // Attempt to assign templateA1 (belongs to storeA1) in storeA2
    const err = await failure(
      asUser(db, ownerA, () =>
        q(
          "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4)",
          [tenantA, storeA2, templateA1, sharedProductId],
        ),
      ),
    );

    expect(err).toContain("template does not belong to this store");
  });

  it("rejects cross-store assignment update within the same tenant with explicit error", async () => {
    // First create a valid assignment in storeA2 using templateA2
    const [assignment] = await asUser(db, ownerA, () =>
      q<{ id: string }>(
        "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4) returning id",
        [tenantA, storeA2, templateA2, sharedProductId],
      ),
    );

    // Attempt to update that assignment to templateA1 (belongs to storeA1)
    const err = await failure(
      asUser(db, ownerA, () =>
        q("update template_assignments set template_id = $1 where id = $2", [templateA1, assignment.id]),
      ),
    );

    expect(err).toContain("template does not belong to this store");

    // Clean up
    await asUser(db, ownerA, () => q("delete from template_assignments where id = $1", [assignment.id]));
  });

  it("rejects cross-tenant assignment insert with the same explicit error", async () => {
    // Attempt to assign templateB (Tenant B) to product in Tenant A Store A1
    const err = await failure(
      asUser(db, ownerA, () =>
        q(
          "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4)",
          [tenantA, storeA1, templateB, sharedProductId],
        ),
      ),
    );

    expect(err).toContain("template does not belong to this store");
  });

  it("raises foreign_key_violation (SQLSTATE 23503) specifically", async () => {
    try {
      await asUser(db, ownerA, () =>
        q(
          "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4)",
          [tenantA, storeA1, templateA2, sharedProductId],
        ),
      );
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const e = err as { message: string; code?: string };
      expect(e.message).toContain("template does not belong to this store");
      // PGlite error codes or fields for SQLSTATE
      if (e.code) {
        expect(e.code).toBe("23503");
      }
    }
  });
});

describe("[AC-DB-012] Multi-store independent layout resolution & shared catalog", () => {
  it("assigns the same product independently in Store 1 and Store 2", async () => {
    // Store A1 assigns templateA1
    await asUser(db, ownerA, () =>
      q(
        "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4)",
        [tenantA, storeA1, templateA1, sharedProductId],
      ),
    );

    // Store A2 assigns templateA2
    await asUser(db, ownerA, () =>
      q(
        "insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1, $2, $3, $4)",
        [tenantA, storeA2, templateA2, sharedProductId],
      ),
    );

    const assignments = await q<{ store_id: string; template_id: string }>(
      "select store_id, template_id from template_assignments where tenant_id = $1 and product_id = $2 order by store_id",
      [tenantA, sharedProductId],
    );

    expect(assignments).toEqual(
      expect.arrayContaining([
        { store_id: storeA1, template_id: templateA1 },
        { store_id: storeA2, template_id: templateA2 },
      ]),
    );
    expect(assignments).toHaveLength(2);
  });

  type PublicLayoutResult = {
    layout: {
      source: string;
      template: {
        name: string;
        document: { layout: string };
      };
    };
  };

  type PublicProductResult = {
    prod: {
      product: {
        name: string;
        slug: string;
      };
    };
  };

  it("get_public_template_layout returns each store's own assigned template for the same product slug", async () => {
    // Query Store A1
    const [resA1] = await q<PublicLayoutResult>(
      "select public.get_public_template_layout('store-a1', 'product', 'shared-hoodie') as layout",
    );
    expect(resA1.layout).not.toBeNull();
    expect(resA1.layout.source).toBe("assigned");
    expect(resA1.layout.template.name).toBe("Store 1 Product Template");
    expect(resA1.layout.template.document.layout).toBe("store-1-look");

    // Query Store A2
    const [resA2] = await q<PublicLayoutResult>(
      "select public.get_public_template_layout('store-a2', 'product', 'shared-hoodie') as layout",
    );
    expect(resA2.layout).not.toBeNull();
    expect(resA2.layout.source).toBe("assigned");
    expect(resA2.layout.template.name).toBe("Store 2 Product Template");
    expect(resA2.layout.template.document.layout).toBe("store-2-look");
  });

  it("the shared product is visible from both stores through public product reads", async () => {
    const [pStore1] = await q<PublicProductResult>(
      "select public.get_public_product('store-a1', 'shared-hoodie') as prod",
    );
    const [pStore2] = await q<PublicProductResult>(
      "select public.get_public_product('store-a2', 'shared-hoodie') as prod",
    );

    expect(pStore1.prod).not.toBeNull();
    expect(pStore2.prod).not.toBeNull();
    expect(pStore1.prod.product.name).toBe("Shared Hoodie");
    expect(pStore2.prod.product.name).toBe("Shared Hoodie");
    expect(pStore1.prod.product.slug).toBe("shared-hoodie");
    expect(pStore2.prod.product.slug).toBe("shared-hoodie");
  });
});
