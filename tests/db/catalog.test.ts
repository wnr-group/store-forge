import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, onboard } from "./harness";

let db: PGlite;
let alice: string; // owner of tenant A
let bob: string; // owner of tenant B
let admin: string; // admin in A
let staff: string; // staff in A
let tenantA: string;
let tenantB: string;
let productA: string;
let productB: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
/** Rejects with the database error message, or fails the test if the statement succeeds. */
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};

beforeAll(async () => {
  db = await createDb();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  admin = await createUser(db, "admin@example.test");
  staff = await createUser(db, "staff@example.test");
  tenantA = (await onboard(db, alice, "alpha-shop")).tenant_id;
  tenantB = (await onboard(db, bob, "beta-shop")).tenant_id;
  await q("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'staff')", [tenantA, admin, staff]);
  [{ id: productA }] = await q<{ id: string }>(
    "insert into products (tenant_id, name, slug, price_minor) values ($1,'Tee','tee',1999) returning id",
    [tenantA],
  );
  [{ id: productB }] = await q<{ id: string }>(
    "insert into products (tenant_id, name, slug, price_minor) values ($1,'Mug','mug',899) returning id",
    [tenantB],
  );
});

afterAll(async () => {
  await db.close();
});

describe("roles", () => {
  it("staff can create and edit catalog data", async () => {
    await asUser(db, staff, async () => {
      const [c] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'Shirts','shirts') returning id", [tenantA]);
      await q("update products set category_id=$1, name='Tee v2' where id=$2", [c.id, productA]);
    });
    const [p] = await q<{ name: string }>("select name from products where id=$1", [productA]);
    expect(p.name).toBe("Tee v2");
  });

  it("staff cannot delete products, categories or customers; admin and owner can", async () => {
    const [cust] = await q<{ id: string }>("insert into customers (tenant_id, email, full_name) values ($1,'x@example.test','X') returning id", [tenantA]);
    const [cat] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'Temp','temp') returning id", [tenantA]);
    await asUser(db, staff, async () => {
      expect(await q("delete from products where id=$1 returning id", [productA])).toHaveLength(0);
      expect(await q("delete from categories where id=$1 returning id", [cat.id])).toHaveLength(0);
      expect(await q("delete from customers where id=$1 returning id", [cust.id])).toHaveLength(0);
    });
    await asUser(db, admin, async () => {
      expect(await q("delete from categories where id=$1 returning id", [cat.id])).toHaveLength(1);
      expect(await q("delete from customers where id=$1 returning id", [cust.id])).toHaveLength(1);
    });
    expect(await q("select 1 from products where id=$1", [productA])).toHaveLength(1);
  });

  it("only owner/admin can change store settings (contact columns included)", async () => {
    await asUser(db, staff, async () => {
      expect(await q("update stores set contact_email='x@y.test' where tenant_id=$1 returning id", [tenantA])).toHaveLength(0);
    });
    await asUser(db, admin, async () => {
      expect(await q("update stores set contact_email='shop@y.test', contact_phone='+911234567890' where tenant_id=$1 returning id", [tenantA])).toHaveLength(1);
    });
  });
});

describe("tenant isolation", () => {
  it("cannot see, edit or delete another tenant's products", async () => {
    await asUser(db, alice, async () => {
      expect(await q("select id from products where id=$1", [productB])).toHaveLength(0);
      expect(await q("update products set name='pwned' where id=$1 returning id", [productB])).toHaveLength(0);
      expect(await q("update products set quantity=500 where id=$1 returning id", [productB])).toHaveLength(0);
      expect(await q("delete from products where id=$1 returning id", [productB])).toHaveLength(0);
    });
  });

  it("cannot insert into another tenant, move rows between tenants or reference foreign categories", async () => {
    const [catB] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'B Cat','b-cat') returning id", [tenantB]);
    await asUser(db, alice, async () => {
      expect(await failure(q("insert into products (tenant_id, name, slug) values ($1,'Evil','evil')", [tenantB]))).toMatch(/row-level security/);
      expect(await failure(q("insert into products (tenant_id, name, slug, category_id) values ($1,'Mine','mine',$2)", [tenantA, catB.id]))).toMatch(/row-level security/);
      expect(await failure(q("update products set tenant_id=$1 where id=$2", [tenantB, productA]))).toMatch(/permission denied/);
      expect(await failure(q("insert into categories (tenant_id, name, slug, parent_id) values ($1,'Kid','kid',$2)", [tenantA, catB.id]))).toMatch(/row-level security/);
    });
  });

  it("customers are tenant-scoped and unique per tenant, case-insensitively", async () => {
    await q("insert into customers (tenant_id, email, full_name) values ($1,'Dana@Example.test','Dana')", [tenantA]);
    await q("insert into customers (tenant_id, email, full_name) values ($1,'dana@example.test','Dana B')", [tenantB]);
    await expect(q("insert into customers (tenant_id, email, full_name) values ($1,'DANA@example.test','Dup')", [tenantA])).rejects.toThrow(/customers_tenant_id_email_key/);
    await asUser(db, alice, async () => {
      const rows = await q<{ full_name: string }>("select full_name from customers where lower(email)='dana@example.test'");
      expect(rows.map((r) => r.full_name)).toEqual(["Dana"]);
    });
  });
});

describe("cross-tenant references are impossible at the database level", () => {
  it("variants, images, collection links and stock rows must use their product's own tenant", async () => {
    await expect(
      q("insert into product_variants (tenant_id, product_id, title, options) values ($1,$2,'M','{\"Size\":\"M\"}')", [tenantB, productA]),
    ).rejects.toThrow(/product_variants_product_fk/);
    const [colB] = await q<{ id: string }>("insert into collections (tenant_id, name, slug) values ($1,'B Col','b-col') returning id", [tenantB]);
    await expect(
      q("insert into collection_products (tenant_id, collection_id, product_id) values ($1,$2,$3)", [tenantA, colB.id, productA]),
    ).rejects.toThrow(/collection_products_collection_fk/);
  });
});

describe("variants and inventory", () => {
  let variant: string;

  it("rejects duplicate option combinations and negative stock", async () => {
    [{ id: variant }] = await q<{ id: string }>(
      "insert into product_variants (tenant_id, product_id, title, options, quantity) values ($1,$2,'M / Black','{\"Size\":\"M\",\"Color\":\"Black\"}',5) returning id",
      [tenantA, productA],
    );
    await expect(
      q("insert into product_variants (tenant_id, product_id, title, options) values ($1,$2,'dup','{\"Color\":\"Black\",\"Size\":\"M\"}')", [tenantA, productA]),
    ).rejects.toThrow(/product_variants_product_id_options_key/);
    await expect(q("update product_variants set quantity = quantity - 6 where id=$1", [variant])).rejects.toThrow(/quantity_check/);
  });

  it("stock is per variant and the ledger is append-only", async () => {
    await asUser(db, staff, async () => {
      await q("update product_variants set quantity = quantity + 10 where id=$1", [variant]);
      await q(
        "insert into inventory_adjustments (tenant_id, product_id, variant_id, delta, quantity_after, reason, created_by) values ($1,$2,$3,10,15,'restock',$4)",
        [tenantA, productA, variant, staff],
      );
      expect(await failure(q("update inventory_adjustments set delta=99"))).toMatch(/permission denied/);
      expect(await failure(q("delete from inventory_adjustments"))).toMatch(/permission denied/);
    });
    const [p] = await q<{ quantity: number }>("select quantity from products where id=$1", [productA]);
    expect(p.quantity).toBe(0); // product-level stock untouched by variant changes
  });

  it("a variant's image must belong to the same product", async () => {
    const [img] = await q<{ id: string }>(
      "insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes) values ($1,$2,$3,'image/webp',1000) returning id",
      [tenantB, productB, `${tenantB}/${productB}/a.webp`],
    );
    await asUser(db, staff, async () => {
      expect(await failure(q("update product_variants set image_id=$1 where id=$2", [img.id, variant]))).toMatch(/row-level security|violates/);
    });
  });
});

describe("product images", () => {
  it("storage_path must live under the image's own tenant and product folder", async () => {
    await expect(
      q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes) values ($1,$2,$3,'image/png',10)", [tenantA, productA, `${tenantB}/${productA}/x.png`]),
    ).rejects.toThrow(/product_images_path_check/);
    await expect(
      q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes) values ($1,$2,$3,'image/png',10)", [tenantA, productA, `${tenantA}/${productA}/../x.png`]),
    ).rejects.toThrow(/product_images_path_check/);
    await expect(
      q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes) values ($1,$2,$3,'image/svg+xml',10)", [tenantA, productA, `${tenantA}/${productA}/x.svg`]),
    ).rejects.toThrow(/product_images_mime_check/);
  });

  it("allows only one primary image per product", async () => {
    await q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes, is_primary) values ($1,$2,$3,'image/webp',10,true)", [tenantA, productA, `${tenantA}/${productA}/1.webp`]);
    await expect(
      q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes, is_primary) values ($1,$2,$3,'image/webp',10,true)", [tenantA, productA, `${tenantA}/${productA}/2.webp`]),
    ).rejects.toThrow(/product_images_one_primary_idx/);
  });

  it("deleting a product removes its image rows, variants and stock history", async () => {
    const [p] = await q<{ id: string }>("insert into products (tenant_id, name, slug) values ($1,'Gone','gone') returning id", [tenantA]);
    await q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes) values ($1,$2,$3,'image/webp',10)", [tenantA, p.id, `${tenantA}/${p.id}/1.webp`]);
    await asUser(db, admin, async () => {
      expect(await q("delete from products where id=$1 returning id", [p.id])).toHaveLength(1);
    });
    expect(await q("select 1 from product_images where product_id=$1", [p.id])).toHaveLength(0);
  });
});

describe("orders are read-only for merchants", () => {
  it("members can read their orders but never write them", async () => {
    await q("insert into orders (tenant_id, order_number, status, currency, subtotal_minor, total_minor) values ($1,1001,'paid','INR',1000,1000)", [tenantA]);
    await asUser(db, staff, async () => {
      expect(await q("select 1 from orders")).toHaveLength(1);
      expect(await failure(q("insert into orders (tenant_id, order_number, currency, subtotal_minor, total_minor) values ($1,1002,'INR',1,1)", [tenantA]))).toMatch(/permission denied/);
      expect(await failure(q("update orders set status='refunded'"))).toMatch(/permission denied/);
    });
    await asUser(db, bob, async () => {
      expect(await q("select 1 from orders")).toHaveLength(0);
    });
  });
});

describe("storage path helpers (used by the Supabase Storage policies)", () => {
  it("extracts the tenant from the first path segment, NULL for anything else", async () => {
    const f = async (name: string) => (await q<{ t: string | null }>("select public.storage_path_tenant($1) t", [name]))[0].t;
    expect(await f(`${tenantA}/${productA}/a.webp`)).toBe(tenantA);
    expect(await f("not-a-uuid/a.webp")).toBeNull();
    expect(await f("")).toBeNull();
  });

  it("owner/admin/staff may write catalog media; store assets need owner/admin; other tenants are denied", async () => {
    const can = async (user: string, name: string) =>
      asUser(db, user, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) ok", [name]))[0].ok);
    const media = `${tenantA}/${productA}/a.webp`;
    const logo = `${tenantA}/store/logo.webp`;
    expect([await can(alice, media), await can(admin, media), await can(staff, media)]).toEqual([true, true, true]);
    expect([await can(alice, logo), await can(admin, logo), await can(staff, logo)]).toEqual([true, true, false]);
    expect(await can(bob, media)).toBe(false);
    expect(await can(bob, "garbage")).toBe(false);
  });
});
