import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";

let db: PGlite;
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const N = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  db = await createDb({ fullAuth: true });
  await db.exec(readFileSync(join(process.cwd(), "scripts", "seed.sql"), "utf8"));
});
afterAll(async () => db.close());

describe("development seed", () => {
  it("creates users, profiles (via trigger), tenants, memberships and stores", async () => {
    expect((await db.query("select 1 from profiles")).rows).toHaveLength(4);
    expect((await db.query("select 1 from platform_admins")).rows).toHaveLength(1);
    expect((await db.query("select 1 from stores")).rows).toHaveLength(2);
    expect((await db.query("select 1 from memberships")).rows).toHaveLength(3);
  });

  it("is idempotent", async () => {
    await db.exec(readFileSync(join(process.cwd(), "scripts", "seed.sql"), "utf8"));
    expect((await db.query("select 1 from tenants")).rows).toHaveLength(2);
  });

  it("seeded users see the right tenants under RLS (multi-tenant user sees both)", async () => {
    const names = async (uid: string) =>
      asUser(db, uid, async () => (await db.query<{ slug: string }>("select slug from tenants order by slug")).rows.map((r) => r.slug));
    expect(await names(A)).toEqual(["alpha-goods"]);
    expect(await names(B)).toEqual(["alpha-goods", "beta-wares"]);
    expect(await names(N)).toEqual([]);
  });
});
