import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createUser, onboard } from "./harness";
import { activateCutover, deactivateCutover, getCutoverState, resyncLegacyTemplates, type ResyncDb, type ResyncQuery } from "@/lib/templates/legacy-resync";

/**
 * Persisted, fail-closed cutover gate [AC-DB-023]. The marker (public.template_engine_cutover) is the only switch; the app reads it only through
 * public.template_engine_cutover_complete(). Covers: closed by default, privileges, partial sync cannot activate, repeat activation, regression
 * closes the gate again, the loader never touches engine tables while closed, and every failure mode reads as CLOSED.
 */
const h = vi.hoisted(() => ({ orm: null as unknown, queries: [] as string[], breakDb: false }));
vi.mock("@/lib/db", async (orig) => ({
  ...(await orig<typeof import("@/lib/db")>()),
  getDatabase: () => {
    if (h.breakDb) throw new Error("database unreachable");
    return h.orm;
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));

import { dbSchema, type Database } from "@/lib/db";
import { assertEngineReadsEnabled, EngineReadsDisabledError, isEngineReadEnabled } from "@/services/engine-cutover.service";
import { loadStorefrontPage, loadStorefrontPageIfEnabled } from "@/services/storefront-template.service";

let pg: PGlite;
const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => pg.query<T>(s, p).then((r) => r.rows);
const adapt = (): ResyncDb => {
  const wrap = (run: (s: string, p: unknown[]) => Promise<{ rows: unknown[] }>): ResyncQuery => (async (s: string, p: unknown[] = []) => (await run(s, p)).rows) as ResyncQuery;
  return { query: wrap((s, p) => pg.query(s, p)), transaction: (fn) => pg.transaction((tx) => fn(wrap((s, p) => tx.query(s, p)))) };
};
const gateFn = async () => (await q<{ ok: boolean }>("select public.template_engine_cutover_complete() as ok"))[0].ok;
type Shop = { tenant: string; store: string; slug: string };
let n = 0;
async function shop(): Promise<Shop> {
  const id = ++n;
  const u = await createUser(pg, `gate${id}@example.test`);
  const p = await onboard(pg, u, `gate-shop-${id}`);
  return { tenant: p.tenant_id, store: p.store_id, slug: p.store_slug };
}
const setV1 = (s: Shop, heading: string) =>
  q(
    `insert into store_template_settings (store_id, tenant_id, template_key, hero_heading) values ($1,$2,'classic',$3)
     on conflict (store_id) do update set hero_heading = excluded.hero_heading`,
    [s.store, s.tenant, heading],
  );
const resetMarker = () => q("update template_engine_cutover set status='pending', completed_at=null, verified_stores=null, resync_counts=null");

beforeAll(async () => {
  pg = await createDb();
  h.orm = drizzle(pg, { schema: dbSchema, logger: { logQuery: (query: string) => void h.queries.push(query) } }) as unknown as Database;
});
afterAll(async () => pg.close());

describe("[AC-DB-023] the marker and its privileges", () => {
  it("[AC-DB-023] a fresh database is CLOSED: the singleton row exists as pending and the function is false", async () => {
    expect(await q("select status, completed_at, verified_stores from template_engine_cutover")).toEqual([{ status: "pending", completed_at: null, verified_stores: null }]);
    expect(await gateFn()).toBe(false);
  });

  it("[AC-DB-023] a missing marker row reads as closed (not as open)", async () => {
    await q("delete from template_engine_cutover");
    expect(await gateFn()).toBe(false);
    await q("insert into template_engine_cutover (id, status) values (true, 'pending')");
  });

  it("[AC-DB-023] an invalid marker cannot be stored: complete needs a time and a count, only one row, only known statuses", async () => {
    await expect(q("update template_engine_cutover set status='complete'")).rejects.toThrow(/complete_check/);
    await expect(q("update template_engine_cutover set status='open'")).rejects.toThrow(/status_check/);
    await expect(q("insert into template_engine_cutover (id, status) values (false, 'pending')")).rejects.toThrow(/singleton_check|duplicate|violates/);
    expect(await gateFn()).toBe(false);
  });

  /** Runs one statement as `role` in its own transaction (a denied statement aborts the transaction it is in). */
  const asRole = (role: "authenticated" | "anon", statement: string) =>
    asAppConnection(pg, async () => {
      await pg.exec("begin");
      try {
        await pg.exec(`set local role ${role}`);
        return (await pg.query(statement)).rows;
      } finally {
        await pg.exec("rollback");
      }
    });

  it("[AC-DB-023] the application role can call the function but can neither read nor write the table", async () => {
    expect(await asRole("authenticated", "select public.template_engine_cutover_complete() as ok")).toEqual([{ ok: false }]);
    await expect(asRole("authenticated", "select * from public.template_engine_cutover")).rejects.toThrow(/permission denied/);
    await expect(asRole("authenticated", "update public.template_engine_cutover set status = 'pending'")).rejects.toThrow(/permission denied/);
    await expect(asRole("authenticated", "insert into public.template_engine_cutover (id, status) values (true, 'pending')")).rejects.toThrow(/permission denied/);
    await expect(asRole("authenticated", "delete from public.template_engine_cutover")).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", "select public.template_engine_cutover_complete()")).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", "select * from public.template_engine_cutover")).rejects.toThrow(/permission denied/);
  });
});

describe("[AC-DB-023] activation: partial synchronization cannot open the gate", () => {
  it("[AC-DB-023] with a store still out of sync the gate stays closed and the marker records pending", async () => {
    await resetMarker();
    const a = await shop();
    const b = await shop();
    await setV1(a, "a1");
    await setV1(b, "b1");
    await resyncLegacyTemplates(adapt(), { storeIds: [a.store] }); // only store A is synced
    const r = await activateCutover(adapt());
    expect(r.activated).toBe(false);
    expect(r.result.pending).toBeGreaterThanOrEqual(1);
    expect(await gateFn()).toBe(false);
    expect((await getCutoverState(adapt())).status).toBe("pending");
    expect((await q<{ resync_counts: Record<string, number> }>("select resync_counts from template_engine_cutover"))[0].resync_counts).toMatchObject({ created: expect.any(Number) });
  });

  it("[AC-DB-023] a failed store keeps the gate closed too", async () => {
    await resetMarker();
    const bad = await shop();
    await setV1(bad, "ok");
    await q("alter table store_template_settings drop constraint if exists store_template_settings_hero_image_path_check");
    await q("update store_template_settings set hero_image_path = $1 where store_id = $2", [`${(await shop()).tenant}/store/x.webp`, bad.store]); // another tenant's path: invalid document
    await resyncLegacyTemplates(adapt());
    const r = await activateCutover(adapt());
    expect(r.activated).toBe(false);
    expect(r.result.failed).toBeGreaterThanOrEqual(1);
    expect(await gateFn()).toBe(false);
    await q("delete from store_template_settings where store_id = $1", [bad.store]);
  });

  it("[AC-DB-023] after a full re-sync, activation opens the gate; repeating it is safe and keeps the original completion time", async () => {
    await resetMarker();
    await resyncLegacyTemplates(adapt());
    const first = await activateCutover(adapt());
    expect(first.activated).toBe(true);
    expect(await gateFn()).toBe(true);
    const t1 = (await q<{ completed_at: string }>("select completed_at from template_engine_cutover"))[0].completed_at;
    const second = await activateCutover(adapt());
    expect(second.activated).toBe(true);
    expect((await q<{ completed_at: string }>("select completed_at from template_engine_cutover"))[0].completed_at).toEqual(t1);
    expect(await gateFn()).toBe(true);
    expect((await getCutoverState(adapt())).status).toBe("complete");
    expect((await q("select 1 from template_engine_cutover")).length).toBe(1);
  });

  it("[AC-DB-023] a later V1 change makes the next activation CLOSE the gate again until the re-sync is repeated", async () => {
    const s = await shop();
    await setV1(s, "before");
    await resyncLegacyTemplates(adapt());
    expect((await activateCutover(adapt())).activated).toBe(true);
    await setV1(s, "after"); // a V1 save lands after cutover
    const r = await activateCutover(adapt());
    expect(r.activated).toBe(false);
    expect(await gateFn()).toBe(false);
    await resyncLegacyTemplates(adapt());
    expect((await activateCutover(adapt())).activated).toBe(true);
    expect(await gateFn()).toBe(true);
  });

  it("[AC-DB-023] stores changed in the engine (engine wins) do not block activation; deactivation closes the gate and is idempotent", async () => {
    const s = await shop();
    await setV1(s, "v1");
    await resyncLegacyTemplates(adapt(), { storeIds: [s.store] });
    await q("update templates set name = 'Custom home' where store_id = $1 and kind = 'index'", [s.store]);
    await setV1(s, "v1-newer");
    await resyncLegacyTemplates(adapt());
    expect((await activateCutover(adapt())).activated).toBe(true);
    await deactivateCutover(adapt());
    await deactivateCutover(adapt());
    expect(await gateFn()).toBe(false);
    expect((await getCutoverState(adapt())).status).toBe("pending");
  });
});

describe("[AC-DB-023] the application gate is fail-closed and guards the loader", () => {
  it("[AC-DB-023] closed: isEngineReadEnabled is false, assert throws, and loadStorefrontPage never queries engine tables or functions", async () => {
    await deactivateCutover(adapt());
    h.queries.length = 0;
    await asAppConnection(pg, async () => {
      expect(await isEngineReadEnabled()).toBe(false);
      await expect(assertEngineReadsEnabled()).rejects.toBeInstanceOf(EngineReadsDisabledError);
      await expect(loadStorefrontPage("index", "gate-shop-1")).rejects.toBeInstanceOf(EngineReadsDisabledError);
      expect(await loadStorefrontPageIfEnabled("product", "gate-shop-1", "x")).toBeNull();
    });
    const sqlSeen = h.queries.join("\n").toLowerCase();
    expect(sqlSeen).toContain("template_engine_cutover_complete");
    expect(sqlSeen).not.toContain("get_public_template_layout");
    expect(sqlSeen).not.toContain("get_public_storefront");
  });

  it("[AC-DB-023] open: the gate passes and the loader proceeds (unknown store -> null, not an error)", async () => {
    await resyncLegacyTemplates(adapt());
    expect((await activateCutover(adapt())).activated).toBe(true);
    await asAppConnection(pg, async () => {
      expect(await isEngineReadEnabled()).toBe(true);
      await expect(assertEngineReadsEnabled()).resolves.toBeUndefined();
      expect(await loadStorefrontPage("index", "no-such-store")).toBeNull();
    });
  });

  it("[AC-DB-023] a database failure reads as CLOSED, never open", async () => {
    h.breakDb = true;
    try {
      expect(await isEngineReadEnabled()).toBe(false);
      await expect(loadStorefrontPage("index", "gate-shop-1")).rejects.toBeInstanceOf(EngineReadsDisabledError);
    } finally {
      h.breakDb = false;
    }
  });

  it("[AC-DB-023] a missing function (migration 0016 not applied) reads as CLOSED", async () => {
    await q("alter function public.template_engine_cutover_complete() rename to template_engine_cutover_complete_hidden");
    try {
      await asAppConnection(pg, async () => expect(await isEngineReadEnabled()).toBe(false));
    } finally {
      await q("alter function public.template_engine_cutover_complete_hidden() rename to template_engine_cutover_complete");
    }
  });
});
