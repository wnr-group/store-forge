import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { dbAvailable, dbRows, dbScalar } from "./support/db";
import { runId } from "./ui";

/**
 * Direct API verification of POST /products/import against the real API and the disposable database.
 * Needs: E2E_API_URL (default http://localhost:4000/api/v1), AUTH_BFF_SECRET (same value as the API), E2E_DB_CONTAINER.
 * Without them the tests SKIP, which is reported as BLOCKED, never as a pass.
 */
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const BFF = process.env.AUTH_BFF_SECRET;
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "";
const MANAGER = process.env.E2E_MANAGER_EMAIL ?? "admin@demo.test";
const VIEWER = process.env.E2E_VIEWER_EMAIL ?? "staff@demo.test";
const PLATFORM = process.env.E2E_PLATFORM_EMAIL ?? "platform@demo.test";
const OWNER2_PASSWORD = "Owner2pass1";

type Row = { row: number } & Record<string, unknown>;
type Session = { ctx: APIRequestContext; org: string };

const rows = (id: string, n: number, extra: (i: number) => Record<string, unknown> = () => ({})): Row[] =>
  Array.from({ length: n }, (_, i) => ({ row: i + 2, name: `QA API ${id} ${i + 1}`, price: `${10 + i}.50`, ...extra(i) }));

async function login(email: string, password: string): Promise<{ ctx: APIRequestContext; memberships: { organizationId: string }[] }> {
  const ctx = await request.newContext({ extraHTTPHeaders: { "x-internal-auth": BFF! } });
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  return { ctx, memberships: (await res.json()).data.memberships };
}
const post = (s: { ctx: APIRequestContext }, org: string | null, rowsBody: unknown) =>
  s.ctx.post(`${API}/products/import`, { data: { rows: rowsBody }, headers: org ? { "X-Organization-Id": org } : {} });
const count = (org: string, like = "%") => Number(dbScalar(`select count(*) from public.products where tenant_id='${org}' and name like '${like}'`));
const total = () => Number(dbScalar("select count(*) from public.products"));

test.describe.configure({ mode: "serial" });

let org1 = "";
let org2 = "";
let manager: Session;
let viewer: Session;
let owner2: Session;
const id = runId();

test.beforeAll(async () => {
  test.skip(!BFF || !PASSWORD || !dbAvailable(), "Needs AUTH_BFF_SECRET, E2E_DEMO_PASSWORD and E2E_DB_CONTAINER: BLOCKED, never PASS");
  const m = await login(MANAGER, PASSWORD);
  org1 = m.memberships[0].organizationId;
  manager = { ctx: m.ctx, org: org1 };
  viewer = { ctx: (await login(VIEWER, PASSWORD)).ctx, org: org1 };

  // A second tenant created through the platform-admin API, so tenant isolation is tested with real, separate data.
  const platform = await login(PLATFORM, PASSWORD);
  const slug = `iso-${id}`;
  const email = `owner2-${id}@demo.test`;
  const created = await platform.ctx.post(`${API}/platform/organizations`, {
    data: { companyName: `QA Isolation ${id}`, storeName: `QA Isolation ${id}`, storeSlug: slug, ownerName: "Second Owner", ownerEmail: email, ownerPassword: OWNER2_PASSWORD },
  });
  expect(created.status(), await created.text()).toBe(201);
  const o = await login(email, OWNER2_PASSWORD);
  org2 = o.memberships[0].organizationId;
  owner2 = { ctx: o.ctx, org: org2 };
  expect(org2).not.toBe(org1);
});

test("AC-10 (API): no session is rejected with 401 and nothing is written", async () => {
  const before = total();
  const anon = await request.newContext({ extraHTTPHeaders: { "x-internal-auth": BFF! } });
  const res = await post({ ctx: anon }, org1, rows(id, 1));
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
  expect(total()).toBe(before);
});

test("AC-10 (API): a member without catalog:manage (products read) is rejected with 403 and nothing is written", async () => {
  const before = total();
  const res = await post(viewer, org1, rows(id, 1));
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("FORBIDDEN");
  expect(total()).toBe(before);
  expect(count(org1, `QA API ${id}%`)).toBe(0);
});

test("tenant isolation: a member of tenant 1 cannot import into tenant 2 by naming it in X-Organization-Id", async () => {
  const before = total();
  const res = await post(manager, org2, rows(id, 2));
  expect([403, 404], `got ${res.status()} ${await res.text()}`).toContain(res.status());
  expect(total()).toBe(before);
  expect(count(org2, `QA API ${id}%`)).toBe(0);
});

test("tenant isolation: a tenant id smuggled inside a row cannot place the product in another tenant", async () => {
  // Deliberately NOT prefixed `QA API ${id} `: the valid-row assertions below count and list that prefix, and this product exists in org 1
  // whenever the API ignores the unknown field instead of rejecting it.
  const marker = `QA SMUGGLE ${id} tenant-field`;
  const res = await post(manager, org1, [{ row: 2, name: marker, price: "5.00", tenant_id: org2, tenantId: org2 }]);
  // Either the API rejects the unknown field or it ignores it. It must never write to tenant 2.
  expect([201, 400], await res.text()).toContain(res.status());
  expect(count(org2, marker)).toBe(0);
  expect(count(org1, marker)).toBe(res.status() === 201 ? 1 : 0);
  console.log(`smuggled tenant_id: API answered ${res.status()}`);
});

test("tenant isolation: the same SKU in two tenants never conflicts, and the other tenant's product is untouched", async () => {
  const [sku, before] = dbRows(`select sku, name||'#'||updated_at from public.products where tenant_id='${org1}' and sku is not null order by sku limit 1`)[0];
  const res = await post(owner2, org2, [{ row: 2, name: `QA API ${id} cross-sku`, price: "9.00", sku }]);
  expect(res.status(), await res.text()).toBe(201);
  expect(dbScalar(`select tenant_id from public.products where sku='${sku}' and name='QA API ${id} cross-sku'`)).toBe(org2);
  expect(dbScalar(`select name||'#'||updated_at from public.products where tenant_id='${org1}' and sku='${sku}'`)).toBe(before);
  expect(Number(dbScalar(`select count(*) from public.products where sku='${sku}'`))).toBe(2);
});

test("tenant isolation: another tenant's categories are not resolvable (row error, nothing created)", async () => {
  const before = total();
  const res = await post(owner2, org2, [{ row: 2, name: `QA API ${id} cross-cat`, price: "9.00", category: "Clothing" }]);
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe("PRODUCT_IMPORT_INVALID");
  expect(body.error.details.errors).toEqual([expect.objectContaining({ row: 2, column: "category", value: "Clothing", message: expect.stringContaining("not found") })]);
  expect(total()).toBe(before);
});

test("all-or-nothing: one invalid row among valid rows creates nothing; the error names row, column, message and value", async () => {
  const before = total();
  const beforeTenant = count(org1);
  const body = rows(id, 4);
  body[3] = { ...body[3], price: "abc" }; // spreadsheet row 5 is invalid; rows 2-4 are valid
  const res = await post(manager, org1, body);
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.error.code).toBe("PRODUCT_IMPORT_INVALID");
  expect(json.error.details.total).toBe(1);
  expect(json.error.details.errors).toEqual([{ row: 5, column: "price", message: expect.any(String), value: "abc" }]);
  expect(json.error.details.errors[0].message.length).toBeGreaterThan(0);
  console.log(`rollback error: ${JSON.stringify(json.error.details.errors)}`);
  expect(total()).toBe(before);
  expect(count(org1)).toBe(beforeTenant);
  expect(count(org1, `QA API ${id} %`)).toBe(0); // none of the 3 valid rows leaked
});

test("all-or-nothing: a fully valid request creates every row with the manual-form defaults, owned by the caller's tenant", async () => {
  const before = count(org1);
  const clothing = dbScalar(`select id from public.categories where tenant_id='${org1}' and name='Clothing'`);
  const body = rows(id, 5, (i) => (i === 0 ? { sku: `QA-API-${id}-1`, status: "active", quantity: "7", category: "Clothing" } : {}));
  const res = await post(manager, org1, body);
  expect(res.status(), await res.text()).toBe(201);
  expect((await res.json()).data.count).toBe(5);
  expect(count(org1)).toBe(before + 5);
  const db = dbRows(`select name, price_minor, status, quantity, track_inventory, low_stock_threshold, has_variants, coalesce(sku,''), coalesce(category_id::text,''), tenant_id from public.products where tenant_id='${org1}' and name like 'QA API ${id} %' order by name`);
  expect(db).toHaveLength(5);
  db.forEach(([name, price, status, qty, track, low, variants, sku, cat, tenant], i) => {
    expect(name).toBe(`QA API ${id} ${i + 1}`);
    expect(price).toBe(String((10 + i) * 100 + 50));
    expect(tenant).toBe(org1);
    expect(variants).toBe("f");
    expect(track).toBe("t");
    expect(low).toBe("5");
    expect(status).toBe(i === 0 ? "active" : "draft");
    expect(qty).toBe(i === 0 ? "7" : "0");
    expect(sku).toBe(i === 0 ? `QA-API-${id}-1` : "");
    expect(cat).toBe(i === 0 ? clothing : "");
  });
  // Tenant 2 legitimately owns the earlier "cross-sku" product, so only the numbered rows of THIS import are checked.
  expect(Number(dbScalar(`select count(*) from public.products where tenant_id='${org2}' and name ~ '^QA API ${id} [0-9]+$'`))).toBe(0);
});

test("duplicate submission (server side): concurrent identical requests that carry a SKU yield exactly one product", async () => {
  const sku = `QA-DUP-${id}`;
  const body = [{ row: 2, name: `QA API ${id} dupe-sku`, price: "3.00", sku }];
  const results = await Promise.all([0, 1, 2, 3].map(() => post(manager, org1, body)));
  const statuses = results.map((r) => r.status()).sort();
  console.log(`concurrent same-SKU statuses: ${statuses.join(",")}`);
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);
  expect(statuses.every((s) => [201, 400, 409].includes(s))).toBe(true); // never a 500
  expect(Number(dbScalar(`select count(*) from public.products where tenant_id='${org1}' and sku='${sku}'`))).toBe(1);
});

test("duplicate submission (server side), characterization: resubmitting rows WITHOUT a SKU creates them again (no idempotency protection)", async () => {
  const body = [{ row: 2, name: `QA API ${id} resubmit`, price: "4.00" }];
  const first = await post(manager, org1, body);
  const second = await post(manager, org1, body);
  console.log(`sequential no-SKU resubmit statuses: ${first.status()},${second.status()}`);
  expect([first.status(), second.status()]).toEqual([201, 201]);
  // Documents the actual behaviour: the server has no idempotency key; only SKU and slug uniqueness stop a duplicate.
  expect(count(org1, `QA API ${id} resubmit`)).toBe(2);
});
