import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * [AC-DB-022] Storage-deletion concurrency on REAL PostgreSQL with several connections.
 * PGlite is one backend session, so it cannot prove this. Runs only when both URLs are set, and only against a database whose
 * name starts with "sf_concurrency_" (a scratch database created for this test, never a shared or hosted one):
 *   SF_PG_TEST_URL      admin connection (seeding + simulating a concurrent writer)
 *   SF_PG_TEST_APP_URL  a NOBYPASSRLS, non-superuser login role that is a member of `authenticated` (like storeforge_app)
 * The schema must be the real migrations 0000-0015. See artifacts/template-engine-qa/phase-02-engine/remediation-20261109/pg-concurrency-runbook.md.
 */
const ADMIN_URL = process.env.SF_PG_TEST_URL;
const APP_URL = process.env.SF_PG_TEST_APP_URL;
const safeTarget = !!ADMIN_URL && !!APP_URL && new URL(ADMIN_URL).pathname.slice(1).startsWith("sf_concurrency_") && new URL(APP_URL).pathname.slice(1).startsWith("sf_concurrency_");

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  removed: [] as string[][],
  hook: null as null | (() => Promise<void>),
  verifyHook: null as null | (() => Promise<void>),
  /** Objects that currently exist in storage. Paths not listed here are treated as existing unless `strict` is set. */
  storage: new Set<string>(),
  strict: false,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user, requireUser: async () => h.user }));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage/server", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    // Existence check against the stateful storage; the hook lets a test hold a writer between "locked" and "verified".
    verifyObjects: async (_folder: string, paths: string[]) => {
      await h.verifyHook?.();
      return paths.map((path) => {
        if (h.strict && !h.storage.has(path)) throw new AppError("VALIDATION", "An image upload did not finish. Please upload it again.");
        return { path, mimeType: "image/webp", sizeBytes: 1024 };
      });
    },
    createUploadTargets: async () => [],
    removeObjects: async (paths: string[]) => {
      await h.hook?.();
      for (const p of paths) h.storage.delete(p);
      h.removed.push(paths);
    },
  };
});

import { lockStoragePaths, removeUnreferencedObjects } from "@/services/storage-references.service";
import { saveTemplateSettings } from "@/services/template-settings.service";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const settled = (p: Promise<unknown>, ms: number) => Promise.race([p.then(() => "done" as const), sleep(ms).then(() => "blocked" as const)]);

describe.skipIf(!safeTarget)("[AC-DB-022] real PostgreSQL: advisory path locks across connections", () => {
  let admin: ReturnType<typeof postgres>;
  let appClient: ReturnType<typeof postgres>;
  let writerDb: ReturnType<typeof drizzle>;
  let tenant: string, store: string;
  let n = 0;
  const fresh = () => `${tenant}/store/pg_${Date.now()}_${++n}.webp`;
  const refDoc = (path: string) => ({ schemaVersion: 1, layout: "classic", sections: { hero: { type: "hero", settings: { image: { path, alt: "" } }, blocks: {}, block_order: [] } }, order: ["hero"] });
  const insertReference = (tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, path: string) =>
    tx.execute(sql`insert into public.templates (tenant_id, store_id, kind, name, draft) values (${tenant}, ${store}, 'index', ${"ref " + path.slice(-20)}, ${JSON.stringify(refDoc(path))}::jsonb)`);

  beforeAll(async () => {
    admin = postgres(ADMIN_URL!, { max: 4, prepare: false, onnotice: () => {} });
    appClient = postgres(APP_URL!, { max: 6, prepare: false, onnotice: () => {} });
    writerDb = drizzle(admin);
    h.orm = drizzle(appClient);
    const email = `pgconc_${Date.now()}@example.test`;
    const [{ id: owner }] = await admin`insert into auth.users (email) values (${email}) returning id`;
    const [{ id: adminUser }] = await admin`insert into auth.users (email) values (${"admin_" + email}) returning id`;
    await admin`insert into public.platform_admins (user_id) values (${adminUser})`;
    const claims = JSON.stringify({ sub: adminUser, role: "authenticated" });
    const prov = (await admin.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await tx.unsafe("set local role authenticated");
      return tx`select public.platform_provision_tenant(${owner}, 'Conc Inc', 'Conc Store', ${"conc-" + Date.now()}) as r`;
    })) as unknown as Array<{ r: { tenant_id: string; store_id: string } }>;
    tenant = prov[0].r.tenant_id;
    store = prov[0].r.store_id;
    h.user = { id: owner as string };
  });
  beforeEach(() => {
    h.removed.length = 0;
    h.hook = null;
    h.verifyHook = null;
    h.strict = false;
    h.storage.clear();
  });
  afterAll(async () => {
    await appClient?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });

  it("[AC-DB-022] a remover blocks while a writer holds the path lock, then sees the writer's committed reference and keeps the file", async () => {
    const p = fresh();
    const held = deferred();
    const release = deferred();
    const writer = writerDb.transaction(async (tx) => {
      await lockStoragePaths(tx as never, [p]);
      held.resolve();
      await release.promise; // the writer has not committed yet
      await insertReference(tx, p);
    });
    await held.promise;
    const remover = removeUnreferencedObjects(tenant, [p]);
    expect(await settled(remover, 600), "the remover must wait for the writer's lock").toBe("blocked");
    expect(h.removed).toEqual([]);
    release.resolve();
    await writer;
    await remover;
    expect(h.removed.flat(), "the committed reference protects the file").not.toContain(p);
  });

  it("[AC-DB-022] control: a writer that does NOT take the lock is not waited for, and the file is deleted under its uncommitted reference (the race the lock closes)", async () => {
    const p = fresh();
    const held = deferred();
    const release = deferred();
    const writer = writerDb.transaction(async (tx) => {
      await insertReference(tx, p); // uncommitted, no lock
      held.resolve();
      await release.promise;
    });
    await held.promise;
    await removeUnreferencedObjects(tenant, [p]);
    expect(h.removed.flat(), "without the lock the remover cannot see the uncommitted reference").toContain(p);
    release.resolve();
    await writer;
  });

  it("[AC-DB-022] a writer waits for a remover that holds the lock (checked and deleted under it)", async () => {
    const p = fresh();
    const removerInside = deferred();
    const letRemoverFinish = deferred();
    // Keep the remover inside its lock (it is deleting) until the test lets it finish.
    h.hook = async () => {
      removerInside.resolve();
      await letRemoverFinish.promise;
    };
    const remover = removeUnreferencedObjects(tenant, [p]);
    await removerInside.promise;
    const writerLocked = writerDb.transaction(async (tx) => {
      await lockStoragePaths(tx as never, [p]);
    });
    expect(await settled(writerLocked, 600), "the writer must wait for the remover").toBe("blocked");
    letRemoverFinish.resolve();
    await remover;
    await writerLocked;
    expect(h.removed.flat()).toContain(p);
    h.hook = null;
  });

  it("[AC-DB-022] opposite path orders from two removers never deadlock (locks are taken in sorted order)", async () => {
    const a = fresh();
    const b = fresh();
    const both = await Promise.race([
      Promise.all([removeUnreferencedObjects(tenant, [a, b]), removeUnreferencedObjects(tenant, [b, a]), removeUnreferencedObjects(tenant, [b, a])]).then(() => "done" as const),
      sleep(15_000).then(() => "deadlock-or-timeout" as const),
    ]);
    expect(both).toBe("done");
    expect(h.removed.flat().filter((x) => x === a || x === b).length).toBe(6);
  });

  it("[AC-DB-022] opposite path orders from two competing writers never deadlock (locks are taken in sorted order)", async () => {
    const a = fresh();
    const b = fresh();
    const w1Held = deferred();
    const w1Release = deferred();
    const w1 = writerDb.transaction(async (tx) => {
      await lockStoragePaths(tx as never, [a, b]);
      w1Held.resolve();
      await w1Release.promise;
      await insertReference(tx, a);
    });
    await w1Held.promise;
    const w2 = writerDb.transaction(async (tx) => {
      await lockStoragePaths(tx as never, [b, a]);
      await insertReference(tx, b);
    });
    expect(await settled(w2, 600), "the competing writer must wait for w1's lock").toBe("blocked");
    w1Release.resolve();
    await Promise.all([w1, w2]);
  });

  // ---- Revised protocol: writers lock BEFORE they check the object exists, so a remover can never delete a file a writer has verified. ----
  const heroValues = (heroImagePath: string) => ({ templateKey: "classic" as const, accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath });
  const heroRow = async () => (await admin`select hero_image_path from public.store_template_settings where store_id = ${store}`)[0]?.hero_image_path ?? null;

  it("[AC-DB-022] remover first: the writer waits for the lock, THEN finds the file gone and fails; no reference to a deleted file is ever stored", async () => {
    const p = fresh();
    await admin`delete from public.store_template_settings where store_id = ${store}`;
    h.strict = true;
    h.storage.add(p);
    const inside = deferred();
    const finish = deferred();
    h.hook = async () => {
      inside.resolve();
      await finish.promise; // the remover is deleting, holding the path lock
    };
    const remover = removeUnreferencedObjects(tenant, [p]);
    await inside.promise;
    const writer = saveTemplateSettings(heroValues(p)).then(() => "saved" as const, (e: { code?: string }) => e.code ?? "failed");
    expect(await settled(writer, 700), "the writer must wait for the remover's lock before it even checks existence").toBe("blocked");
    finish.resolve();
    await remover;
    expect(h.storage.has(p), "the remover deleted the file").toBe(false);
    expect(await writer).toBe("VALIDATION"); // the existence check now runs after the lock and sees the file gone
    expect(await heroRow(), "no reference to the deleted file was written").toBeNull();
  });

  it("[AC-DB-022] writer first: the writer holds the lock through verification and commit, the remover waits, sees the committed reference and keeps the file", async () => {
    const p = fresh();
    await admin`delete from public.store_template_settings where store_id = ${store}`;
    h.strict = true;
    h.storage.add(p);
    const verifying = deferred();
    const proceed = deferred();
    h.verifyHook = async () => {
      verifying.resolve();
      await proceed.promise; // the writer has locked and is verifying
    };
    const writer = saveTemplateSettings(heroValues(p));
    await verifying.promise;
    const remover = removeUnreferencedObjects(tenant, [p]);
    expect(await settled(remover, 700), "the remover must wait for the writer").toBe("blocked");
    proceed.resolve();
    await writer;
    await remover;
    expect(await heroRow()).toBe(p);
    expect(h.storage.has(p), "the file referenced by the committed save is still in storage").toBe(true);
    expect(h.removed.flat()).not.toContain(p);
  });

  it("[AC-DB-022] control: if the check ran BEFORE the lock (the old protocol) the remover could delete a file after it was verified", async () => {
    // Models the old order explicitly: verify, then a remover takes the lock and deletes, then the writer would commit its reference.
    const p = fresh();
    h.strict = true;
    h.storage.add(p);
    const storage = await import("@/lib/storage/server");
    const verified = await storage.verifyObjects("f", [p]); // old order: existence checked outside the lock
    expect(verified).toHaveLength(1);
    await removeUnreferencedObjects(tenant, [p]); // remover is free to run: nothing is locked or referenced yet
    expect(h.storage.has(p)).toBe(false); // the writer would now commit a reference to a deleted file
  });
});
