import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createUser, onboard } from "./harness";

// ---- Test doubles for the Next.js / Supabase edges; the services and database are real ----
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  removed: [] as string[][],
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.user,
  requireUser: async () => h.user,
}));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Supabase Storage is external: every path passed in is treated as an existing 1 KB webp.
vi.mock("@/lib/storage/server", () => ({
  verifyObjects: async (_folder: string, paths: string[]) => paths.map((path) => ({ path, mimeType: "image/webp", sizeBytes: 1024 })),
  removeObjects: async (paths: string[]) => void h.removed.push(paths),
  createUploadTargets: async () => [],
}));

import { dbSchema, type Database } from "@/lib/db";
import { productListQuerySchema, productInputSchema, customerListQuerySchema } from "@/lib/validations/catalog";
import { getAnalytics } from "@/services/analytics.service";
import { createCategory, deleteCategory, listCategories, normalize, updateCategory } from "@/services/category.service";
import { createCollection, getCollection } from "@/services/collection.service";
import { createCustomer, deleteCustomer, getCustomer, listCustomers } from "@/services/customer.service";
import { adjustStock, listAdjustments, listInventory } from "@/services/inventory.service";
import { isCurrencyLocked, updateStoreSettings } from "@/services/store-settings.service";
import { createProduct, deleteProducts, duplicateProduct, getProduct, listProducts, setProductsStatus, updateProduct } from "@/services/product.service";

let pg: PGlite;
let alice: string; // owner A
let bob: string; // owner B
let staff: string; // staff in A
let tenantA: string;
let tenantB: string;

const as = async <T>(user: string, fn: () => Promise<T>): Promise<T> => {
  h.user = { id: user };
  return asAppConnection(pg, fn);
};
const fail = async (p: Promise<unknown>) => p.then(() => "NO_ERROR", (e: { code?: string; message?: string }) => e.code ?? e.message ?? String(e));
const uuid = () => crypto.randomUUID();
const product = (over: Record<string, unknown> = {}) => productInputSchema.parse({ id: uuid(), name: "Tee", price: "499.00", quantity: 10, ...over });
const q = (sql: string, params: unknown[] = []) => pg.query<Record<string, unknown>>(sql, params).then((r) => r.rows);

beforeAll(async () => {
  pg = await createDb();
  h.orm = drizzle(pg, { schema: dbSchema }) as unknown as Database;
  [alice, bob, staff] = await Promise.all(["alice", "bob", "sam"].map((n) => createUser(pg, `${n}@example.test`)));
  tenantA = (await onboard(pg, alice, "alpha-shop")).tenant_id;
  tenantB = (await onboard(pg, bob, "beta-shop")).tenant_id;
  await pg.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantA, staff]);
});
beforeEach(() => {
  h.removed.length = 0;
});
afterAll(async () => {
  await pg.close();
});

describe("products", () => {
  it("creates a simple product: slug, minor-unit prices and defaults", async () => {
    const input = product({ name: "Classic Tee", price: "1,299.50", compareAtPrice: "1499", cost: "800", sku: "TEE-1" });
    const { id } = await as(alice, () => createProduct(input, "INR"));
    const detail = await as(alice, () => getProduct(id));
    expect(detail?.product).toMatchObject({ slug: "classic-tee", priceMinor: 129950, compareAtPriceMinor: 149900, costMinor: 80000, sku: "TEE-1", status: "draft", hasVariants: false, quantity: 10 });
  });

  it("generates a unique slug when the name repeats", async () => {
    const a = await as(alice, () => createProduct(product({ name: "Mug" }), "INR"));
    const b = await as(alice, () => createProduct(product({ name: "Mug" }), "INR"));
    const slugs = [a.id, b.id].map(async (id) => (await as(alice, () => getProduct(id)))?.product.slug);
    expect(await Promise.all(slugs)).toEqual(["mug", "mug-2"]);
  });

  it("rejects an invalid amount and a duplicate SKU with field-level messages", async () => {
    expect(await fail(as(alice, () => createProduct(product({ price: "12.345" }), "INR")))).toBe("VALIDATION");
    await as(alice, () => createProduct(product({ name: "A", sku: "DUP" }), "INR"));
    expect(await fail(as(alice, () => createProduct(product({ name: "B", sku: "DUP" }), "INR")))).toBe("CONFLICT");
  });

  it("creates variants with their own SKU, price and stock, and links images", async () => {
    const path = (id: string, n: string) => `${tenantA}/${id}/${n}.webp`;
    const id = uuid();
    const input = product({
      id,
      name: "Hoodie",
      options: [{ name: "Size", values: ["S", "M"] }, { name: "Color", values: ["Black"] }],
      variants: [
        { options: { Size: "S", Color: "Black" }, sku: "H-S", price: "999", quantity: 4, imagePath: path(id, "a") },
        { options: { Size: "M", Color: "Black" }, sku: "H-M", price: "1099", quantity: 0 },
      ],
      images: [{ path: path(id, "a") }, { path: path(id, "b"), altText: "Back" }],
    });
    await as(alice, () => createProduct(input, "INR"));
    const d = (await as(alice, () => getProduct(id)))!;
    expect(d.product).toMatchObject({ hasVariants: true, sku: null, quantity: 0 });
    expect(d.variants.map((v) => [v.title, v.sku, v.priceMinor, v.quantity])).toEqual([["S / Black", "H-S", 99900, 4], ["M / Black", "H-M", 109900, 0]]);
    expect(d.images.map((i) => [i.storagePath.split("/")[2], i.isPrimary, i.position])).toEqual([["a.webp", true, 0], ["b.webp", false, 1]]);
    expect(d.variants[0].imageId).toBe(d.images[0].id);
  });

  it("rejects variants that use undeclared option values", async () => {
    const input = product({ options: [{ name: "Size", values: ["S"] }], variants: [{ options: { Size: "XL" }, price: "1", quantity: 1 }] });
    expect(await fail(as(alice, () => createProduct(input, "INR")))).toBe("VALIDATION");
  });

  it("update syncs variants and images; removed files are deleted only after commit", async () => {
    const id = uuid();
    const p = (n: string) => `${tenantA}/${id}/${n}.webp`;
    await as(alice, () => createProduct(product({ id, name: "Cap", options: [{ name: "Size", values: ["S", "M"] }], variants: [{ options: { Size: "S" }, price: "10", quantity: 1 }, { options: { Size: "M" }, price: "10", quantity: 2 }], images: [{ path: p("1") }, { path: p("2") }] }), "INR"));
    const before = (await as(alice, () => getProduct(id)))!;
    const keep = before.variants[0];
    await as(alice, () =>
      updateProduct(
        product({ id, name: "Cap v2", price: "20", options: [{ name: "Size", values: ["S", "L"] }], variants: [{ id: keep.id, options: { Size: "S" }, price: "20", quantity: 7 }, { options: { Size: "L" }, price: "20", quantity: 3 }], images: [{ path: p("2") }] }),
        "INR",
      ),
    );
    const after = (await as(alice, () => getProduct(id)))!;
    expect(after.product.name).toBe("Cap v2");
    expect(after.variants.map((v) => v.title).sort()).toEqual(["L", "S"]);
    expect(after.variants.find((v) => v.id === keep.id)?.quantity).toBe(7); // same row updated, not recreated
    expect(after.images.map((i) => i.storagePath)).toEqual([p("2")]);
    expect(after.images[0].isPrimary).toBe(true);
    expect(h.removed).toEqual([[p("1")]]);
  });

  it("a failed update rolls back completely and deletes no files", async () => {
    const id = uuid();
    const p = `${tenantA}/${id}/1.webp`;
    await as(alice, () => createProduct(product({ id, name: "Stable", sku: "STABLE", images: [{ path: p }] }), "INR"));
    await as(alice, () => createProduct(product({ name: "Other", sku: "TAKEN" }), "INR"));
    h.removed.length = 0;
    expect(await fail(as(alice, () => updateProduct(product({ id, name: "Changed", sku: "TAKEN", images: [] }), "INR")))).toBe("CONFLICT");
    const d = (await as(alice, () => getProduct(id)))!;
    expect(d.product.name).toBe("Stable");
    expect(d.images).toHaveLength(1);
    expect(h.removed).toEqual([]);
  });

  it("publishes, unpublishes, duplicates (as draft) and deletes with image cleanup", async () => {
    const id = uuid();
    const p = `${tenantA}/${id}/1.webp`;
    await as(alice, () => createProduct(product({ id, name: "Lamp", sku: "LAMP", images: [{ path: p }] }), "INR"));
    expect(await as(alice, () => setProductsStatus([id], "active"))).toBe(1);
    expect((await as(alice, () => getProduct(id)))?.product.status).toBe("active");
    const copy = await as(alice, () => duplicateProduct(id));
    const dup = (await as(alice, () => getProduct(copy.id)))!;
    expect(dup.product).toMatchObject({ name: "Lamp (copy)", status: "draft", sku: null });
    expect(dup.images).toHaveLength(0);
    h.removed.length = 0;
    expect(await as(alice, () => deleteProducts([id]))).toBe(1);
    expect(await as(alice, () => getProduct(id))).toBeNull();
    expect(h.removed).toEqual([[p]]);
  });

  it("searches, filters, sorts and paginates on the server", async () => {
    for (let i = 1; i <= 23; i++) await as(bob, () => createProduct(product({ name: `Widget ${String(i).padStart(2, "0")}`, price: String(i), quantity: i === 1 ? 0 : i === 2 ? 3 : 50, sku: `W${i}`, status: i % 2 ? "active" : "draft" }), "INR"));
    const list = (query: object) => as(bob, () => listProducts(productListQuerySchema.parse(query)));
    const p1 = await list({ q: "widget" });
    expect([p1.total, p1.items.length, p1.pageSize]).toEqual([23, 20, 20]);
    expect((await list({ q: "widget", page: "2" })).items).toHaveLength(3);
    expect((await list({ q: "W7" })).items.map((r) => r.name)).toEqual(["Widget 07"]);
    expect((await list({ q: "widget", status: "active" })).total).toBe(12);
    const out = await list({ q: "widget", stock: "out" });
    const low = await list({ q: "widget", stock: "low" });
    expect([out.items.map((r) => r.sku), out.total]).toEqual([["W1"], 1]); // total comes from the separate count query
    expect([low.items.map((r) => r.sku), low.total]).toEqual([["W2"], 1]);
    expect((await list({ q: "widget", stock: "in" })).total).toBe(21);
    expect((await list({ q: "widget", sort: "price", dir: "asc" })).items[0].name).toBe("Widget 01");
    expect((await list({ q: "widget", sort: "name", dir: "desc" })).items[0].name).toBe("Widget 23");
    expect((await list({ q: "100%" })).total).toBe(0); // LIKE wildcards are escaped
    expect((await list({ page: "not-a-number", sort: "bogus" })).page).toBe(1); // bad URL params fall back
  });
});

describe("tenant isolation and roles (through the services)", () => {
  it("another tenant can neither read, change, adjust nor delete a product", async () => {
    const { id } = await as(alice, () => createProduct(product({ name: "Secret" }), "INR"));
    expect(await as(bob, () => getProduct(id))).toBeNull();
    expect(await fail(as(bob, () => updateProduct(product({ id, name: "Hacked" }), "INR")))).toBe("NOT_FOUND");
    expect(await fail(as(bob, () => adjustStock({ productId: id, variantId: null, mode: "add", value: 5, reason: "restock" })))).toBe("NOT_FOUND");
    expect(await as(bob, () => deleteProducts([id]))).toBe(0);
    expect((await as(alice, () => getProduct(id)))?.product.name).toBe("Secret");
    expect((await as(bob, () => listProducts(productListQuerySchema.parse({ q: "secret" })))).total).toBe(0);
  });

  it("staff can create and edit but get FORBIDDEN when deleting", async () => {
    const { id } = await as(staff, () => createProduct(product({ name: "Staff made" }), "INR"));
    await as(staff, () => setProductsStatus([id], "active"));
    expect(await fail(as(staff, () => deleteProducts([id])))).toBe("FORBIDDEN");
    expect(await as(alice, () => deleteProducts([id]))).toBe(1);
  });

  it("an image path outside the product's folder is never accepted", async () => {
    const id = uuid();
    const evil = `${tenantB}/${id}/x.webp`; // the (mocked) storage layer says it exists; the DB path check must still refuse it
    expect(await fail(as(alice, () => createProduct(product({ id, images: [{ path: evil }] }), "INR")))).not.toBe("NO_ERROR");
    expect(await as(alice, () => getProduct(id))).toBeNull();
  });
});

describe("inventory", () => {
  let simple: string;
  let withVariants: string;
  let vA: string;
  let vB: string;

  beforeAll(async () => {
    simple = (await as(alice, () => createProduct(product({ name: "Poster", quantity: 5, lowStockThreshold: 3 }), "INR"))).id;
    withVariants = (await as(alice, () => createProduct(product({ name: "Sneaker", options: [{ name: "Size", values: ["8", "9"] }], variants: [{ options: { Size: "8" }, price: "1", quantity: 10 }, { options: { Size: "9" }, price: "1", quantity: 10 }] }), "INR"))).id;
    const d = (await as(alice, () => getProduct(withVariants)))!;
    [vA, vB] = d.variants.map((v) => v.id);
  });

  it("adds, sets and records a ledger row per change", async () => {
    expect(await as(staff, () => adjustStock({ productId: simple, variantId: null, mode: "add", value: 5, reason: "restock", note: "PO-1" }))).toEqual({ quantity: 10 });
    expect(await as(alice, () => adjustStock({ productId: simple, variantId: null, mode: "set", value: 2, reason: "correction" }))).toEqual({ quantity: 2 });
    const log = (await as(alice, () => listAdjustments(50))).filter((l) => l.productId === simple);
    expect(log.map((l) => [l.delta, l.quantityAfter, l.reason]).reverse()).toEqual([[5, 10, "restock"], [-8, 2, "correction"]]);
    expect(log.map((l) => l.createdBy)).toContain(staff);
  });

  it("never allows negative stock or a no-op, and rejects untracked products", async () => {
    expect(await fail(as(alice, () => adjustStock({ productId: simple, variantId: null, mode: "add", value: -999, reason: "damage" })))).toBe("VALIDATION");
    expect(await fail(as(alice, () => adjustStock({ productId: simple, variantId: null, mode: "set", value: 2, reason: "correction" })))).toBe("VALIDATION");
    expect((await as(alice, () => getProduct(simple)))?.product.quantity).toBe(2);
    const untracked = (await as(alice, () => createProduct(product({ name: "Gift card", trackInventory: false }), "INR"))).id;
    expect(await fail(as(alice, () => adjustStock({ productId: untracked, variantId: null, mode: "add", value: 1, reason: "restock" })))).toBe("VALIDATION");
  });

  it("tracks stock per variant, never shared", async () => {
    await as(alice, () => adjustStock({ productId: withVariants, variantId: vA, mode: "add", value: -4, reason: "damage" }));
    const d = (await as(alice, () => getProduct(withVariants)))!;
    expect(d.variants.map((v) => v.quantity)).toEqual([6, 10]);
    expect(await fail(as(alice, () => adjustStock({ productId: withVariants, variantId: null, mode: "add", value: 1, reason: "restock" })))).toBe("VALIDATION");
    expect(await fail(as(alice, () => adjustStock({ productId: simple, variantId: vB, mode: "add", value: 1, reason: "restock" })))).toBe("VALIDATION");
  });

  it("concurrent adjustments serialise instead of losing updates", async () => {
    const id = (await as(alice, () => createProduct(product({ name: "Race", quantity: 0 }), "INR"))).id;
    await as(alice, () => Promise.all(Array.from({ length: 5 }, () => adjustStock({ productId: id, variantId: null, mode: "add", value: 2, reason: "restock" }))));
    expect((await as(alice, () => getProduct(id)))?.product.quantity).toBe(10);
  });

  it("lists one row per sellable unit with low/out states", async () => {
    const out = await as(alice, () => listInventory({ q: "sneaker", stock: "all", page: 1 }));
    expect(out.items.map((r) => [r.variantTitle, r.quantity, r.state])).toEqual([["8", 6, "in"], ["9", 10, "in"]]);
    await as(alice, () => adjustStock({ productId: simple, variantId: null, mode: "set", value: 0, reason: "correction" }));
    expect((await as(alice, () => listInventory({ q: "poster", stock: "out", page: 1 }))).total).toBe(1);
  });
});

describe("categories and collections", () => {
  it("manages a hierarchy, blocks cycles, and uncategorises products on delete", async () => {
    const parent = await as(alice, () => createCategory(normalize({ name: "Apparel", parentId: null })));
    const child = await as(alice, () => createCategory(normalize({ name: "Shirts", parentId: parent.id })));
    expect(await fail(as(alice, () => updateCategory(parent.id, normalize({ name: "Apparel", parentId: child.id }))))).toBe("VALIDATION");
    const { id } = await as(alice, () => createProduct(product({ name: "Polo", categoryId: child.id }), "INR"));
    const rows = await as(alice, () => listCategories());
    expect(rows.find((r) => r.id === child.id)).toMatchObject({ parentName: "Apparel", productCount: 1 });
    expect(await fail(as(staff, () => deleteCategory(child.id)))).toBe("FORBIDDEN");
    await as(alice, () => deleteCategory(child.id));
    expect((await as(alice, () => getProduct(id)))?.product.categoryId).toBeNull();
  });

  it("rejects a category from another tenant on a product", async () => {
    const foreign = await as(bob, () => createCategory(normalize({ name: "Bob's", parentId: null })));
    expect(await fail(as(alice, () => createProduct(product({ categoryId: foreign.id }), "INR")))).toBe("VALIDATION");
  });

  it("collections hold manually assigned products and reject foreign ones", async () => {
    const a = (await as(alice, () => createProduct(product({ name: "C1" }), "INR"))).id;
    const b = (await as(alice, () => createProduct(product({ name: "C2" }), "INR"))).id;
    const foreign = (await as(bob, () => createProduct(product({ name: "Foreign" }), "INR"))).id;
    const colId = uuid();
    const base = { name: "Summer", status: "active" as const, productIds: [a, b], description: undefined, imagePath: null, slug: undefined };
    await as(alice, () => createCollection(colId, { ...base, description: null } as never));
    expect((await as(alice, () => getCollection(colId)))?.productIds).toEqual([a, b]);
    expect(await fail(as(alice, () => createCollection(uuid(), { ...base, name: "Bad", productIds: [foreign], description: null } as never)))).toBe("VALIDATION");
    expect(await as(bob, () => getCollection(colId))).toBeNull();
  });
});

describe("customers and analytics (real orders only)", () => {
  it("starts empty with an honest empty analytics state", async () => {
    const a = await as(bob, () => getAnalytics(30, "Asia/Kolkata"));
    expect(a).toMatchObject({ hasOrders: false, totalSalesMinor: 0, orders: 0, averageOrderMinor: 0, bestSellers: [], recentOrders: [] });
    expect(a.series).toHaveLength(30);
    expect(a.series.every((s) => s.salesMinor === 0 && s.orders === 0)).toBe(true);
  });

  it("aggregates spend from paid/fulfilled orders only, scoped to the tenant", async () => {
    const dana = await as(alice, () => createCustomer({ fullName: "Dana Lee", email: "dana@example.test", phone: "+911234567890", notes: null }));
    const eli = await as(alice, () => createCustomer({ fullName: "Eli Kay", email: "eli@example.test", phone: null, notes: null }));
    expect(await fail(as(alice, () => createCustomer({ fullName: "Dup", email: "DANA@example.test", phone: null, notes: null })))).toBe("CONFLICT");
    const order = (n: number, status: string, total: number, customer: string | null, tenant = tenantA) =>
      q("insert into orders (tenant_id, customer_id, order_number, status, currency, subtotal_minor, total_minor, placed_at) values ($1,$2,$3,$4,'INR',$5,$5, now() - interval '1 day') returning id", [tenant, customer, n, status, total]);
    const [{ id: o1 }] = await order(1, "paid", 100000, dana.id);
    await order(2, "fulfilled", 50000, dana.id);
    await order(3, "cancelled", 999999, dana.id);
    await order(4, "pending", 777777, eli.id);
    await q("insert into order_items (tenant_id, order_id, name, quantity, unit_price_minor, total_minor) values ($1,$2,'Tee',3,30000,90000)", [tenantA, o1]);
    await order(1, "paid", 424242, null, tenantB);

    const list = await as(alice, () => listCustomers(customerListQuerySchema.parse({ sort: "spent" })));
    expect(list.items.map((c) => [c.fullName, c.orderCount, c.totalSpentMinor])).toEqual([["Dana Lee", 3, 150000], ["Eli Kay", 1, 0]]);
    expect(list.items[0].lastOrderAt).toBeInstanceOf(Date);
    expect((await as(alice, () => listCustomers(customerListQuerySchema.parse({ q: "eli" })))).total).toBe(1);
    expect((await as(bob, () => listCustomers(customerListQuerySchema.parse({})))).total).toBe(0);

    const detail = await as(alice, () => getCustomer(dana.id));
    expect(detail?.orders).toHaveLength(3);
    expect(await as(bob, () => getCustomer(dana.id))).toBeNull();
    expect(await fail(as(staff, () => deleteCustomer(eli.id)))).toBe("FORBIDDEN");

    const a = await as(alice, () => getAnalytics(30, "Asia/Kolkata"));
    expect(a).toMatchObject({ hasOrders: true, totalSalesMinor: 150000, orders: 3, customers: 2, averageOrderMinor: 75000 });
    expect(a.bestSellers).toEqual([{ name: "Tee", units: 3, salesMinor: 90000 }]);
    expect(a.series.reduce((s, p) => s + p.salesMinor, 0)).toBe(150000);
    expect(a.recentOrders[0].customerName).toBeTruthy();
    // Tenant B's own order never leaks into A's numbers, and vice versa.
    expect((await as(bob, () => getAnalytics(30, "Asia/Kolkata"))).totalSalesMinor).toBe(424242);
  });
});

describe("store settings", () => {
  const settings = (over: Record<string, unknown> = {}) => ({
    name: "Alpha Shop", slug: "alpha-shop", description: null, contactEmail: "hello@alpha.test", contactPhone: "+911234567890",
    currency: "INR", timezone: "Asia/Kolkata", logoPath: null, ...over,
  });

  it("owner can update; staff get FORBIDDEN", async () => {
    await as(alice, () => updateStoreSettings(settings({ description: "Hand made", timezone: "UTC" })));
    const [s] = await q("select description, timezone, contact_email from stores where tenant_id=$1", [tenantA]);
    expect(s).toMatchObject({ description: "Hand made", timezone: "UTC", contact_email: "hello@alpha.test" });
    expect(await fail(as(staff, () => updateStoreSettings(settings({ name: "Hacked" }))))).toBe("FORBIDDEN");
  });

  it("rejects a taken store address and an unknown timezone", async () => {
    expect(await fail(as(alice, () => updateStoreSettings(settings({ slug: "beta-shop" }))))).toBe("CONFLICT");
    expect(await fail(as(alice, () => updateStoreSettings(settings({ timezone: "Mars/Olympus" }))))).toBe("VALIDATION");
  });

  it("locks the currency once products exist (stored minor units would change meaning)", async () => {
    expect(await as(alice, () => isCurrencyLocked())).toBe(true);
    expect(await fail(as(alice, () => updateStoreSettings(settings({ currency: "JPY" }))))).toBe("VALIDATION");
    const [s] = await q("select currency from stores where tenant_id=$1", [tenantA]);
    expect(s.currency).toBe("INR");
  });

  it("the logo path must sit in the tenant's store/ folder (database check)", async () => {
    await expect(q("update stores set logo_url=$1 where tenant_id=$2", [`${tenantB}/store/logo.png`, tenantA])).rejects.toThrow(/stores_logo_path_check/);
  });
});
