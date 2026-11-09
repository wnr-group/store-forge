import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createUser, onboard } from "./harness";
import { doc, insertTemplate, publish } from "./template-fixtures";

/**
 * Reference protection for uploaded files [AC-DB-022].
 * Reported failure: replacing the V1 hero deleted a file that migration 0013 had copied into a published template
 * version (and the draft). These tests reproduce that exact sequence, then cover every other reference location,
 * the unreferenced control cases, tenant isolation, structural (non-substring) matching and lock ordering.
 */

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  removed: [] as string[][],
  queries: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user, requireUser: async () => h.user }));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage/server", async () => {
  const { isDirectChild } = await import("@/lib/storage/paths");
  const { AppError } = await import("@/lib/errors");
  return {
    verifyObjects: async (folder: string, paths: string[]) =>
      paths.map((path) => {
        if (!isDirectChild(path, folder)) throw new AppError("VALIDATION", "An uploaded image has an invalid path.");
        return { path, mimeType: "image/webp", sizeBytes: 1024 };
      }),
    removeObjects: async (paths: string[]) => {
      h.removed.push(paths);
    },
    createUploadTargets: async () => [],
  };
});

import { dbSchema, type Database } from "@/lib/db";
import { discardUploadsAction } from "@/app/(dashboard)/dashboard/uploads/discard";
import { createCollection, updateCollection } from "@/services/collection.service";
import { updateStoreSettings } from "@/services/store-settings.service";
import { saveTemplateSettings } from "@/services/template-settings.service";
import { removeUnreferencedObjects } from "@/services/storage-references.service";

let pg: PGlite;
let alice: string, bob: string;
let tenantA: string, tenantB: string, storeA: string, storeB: string;

const as = async <T>(user: string, fn: () => Promise<T>): Promise<T> => {
  h.user = { id: user };
  return asAppConnection(pg, fn);
};
const q = (sql: string, params: unknown[] = []) => pg.query<Record<string, unknown>>(sql, params).then((r) => r.rows);
const values = (over: Record<string, unknown> = {}) => ({ templateKey: "classic" as const, accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null, ...over });
const storeForm = (over: Record<string, unknown> = {}) => ({ name: "Alpha", slug: "alpha-shop", description: null, contactEmail: null, contactPhone: null, currency: "INR", timezone: "Asia/Kolkata", logoPath: null, ...over });
let n = 0;
const fresh = (tenant = tenantA) => `${tenant}/store/img_${++n}.webp`;
/** The migrated hero document shape from 0013: the image is `{ path, alt }` inside the hero section settings. */
const heroDoc = (path: string) =>
  doc({ sections: { hero: { type: "hero", settings: { image: { path, alt: "" } }, blocks: {}, block_order: [] } }, order: ["hero"] });
const removedFlat = () => h.removed.flat();

beforeAll(async () => {
  pg = await createDb();
  h.orm = drizzle(pg, { schema: dbSchema, logger: { logQuery: (query: string) => void h.queries.push(query) } }) as unknown as Database;
  [alice, bob] = await Promise.all(["alice", "bob"].map((x) => createUser(pg, `${x}@example.test`)));
  tenantA = (await onboard(pg, alice, "alpha-shop")).tenant_id;
  tenantB = (await onboard(pg, bob, "beta-shop")).tenant_id;
  storeA = (await q("select id from stores where tenant_id = $1", [tenantA]))[0].id as string;
  storeB = (await q("select id from stores where tenant_id = $1", [tenantB]))[0].id as string;
});
beforeEach(async () => {
  h.removed.length = 0;
  h.queries.length = 0;
  await q("delete from store_template_settings");
  await q("update stores set logo_url = null");
});
afterAll(async () => pg.close());

describe("[AC-DB-022] the reported failure: replacing the V1 hero after migration 0013", () => {
  it("[AC-DB-022] keeps the old hero file when a published version and the draft still reference it, and the version still points at it", async () => {
    const old = fresh();
    const next = fresh();
    // State right after migration 0013: V1 row with the hero, default index template whose draft AND published v1 contain it.
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: old })));
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", isDefault: false, draft: heroDoc(old) });
    const versionId = await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: heroDoc(old), source: "migration" });
    h.removed.length = 0;

    // The merchant replaces the hero in the legacy settings form.
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: next })));

    expect(removedFlat(), "the old file is still shown by the published version").not.toContain(old);
    const [v] = await q("select document -> 'sections' -> 'hero' -> 'settings' -> 'image' ->> 'path' as p from template_versions where id = $1", [versionId]);
    expect(v.p).toBe(old);
    expect((await q("select hero_image_path from store_template_settings where tenant_id = $1", [tenantA]))[0].hero_image_path).toBe(next);
  });

  it("[AC-DB-022] control: the same replacement with NO engine reference still removes the old hero file", async () => {
    const old = fresh();
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: old })));
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: fresh() })));
    expect(removedFlat()).toEqual([old]);
  });
});

describe("[AC-DB-022] every reference location protects a file", () => {
  it("[AC-DB-022] a draft-only reference (never published) protects it", async () => {
    const p = fresh();
    await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: heroDoc(p) });
    await as(alice, () => removeUnreferencedObjects(tenantA, [p]));
    expect(removedFlat()).toEqual([]);
  });

  it("[AC-DB-022] an OLD published version protects it even after a newer version dropped it (rollback must still work)", async () => {
    const p = fresh();
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: doc() });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: heroDoc(p) });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: doc() });
    await as(alice, () => removeUnreferencedObjects(tenantA, [p]));
    expect(removedFlat()).toEqual([]);
  });

  it("[AC-DB-022] an image nested inside blocks protects it", async () => {
    const p = fresh();
    const nested = doc({
      sections: { s: { type: "hero", settings: {}, blocks: { b: { type: "image", settings: { gallery: [{ image: { path: p } }] }, blocks: {}, block_order: [] } }, block_order: ["b"] } },
      order: ["s"],
    });
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: doc() });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: nested });
    await as(alice, () => removeUnreferencedObjects(tenantA, [p]));
    expect(removedFlat()).toEqual([]);
  });

  it("[AC-DB-022] a store logo, a collection image and the V1 hero each protect a file", async () => {
    const logo = fresh();
    const hero = fresh();
    const collId = crypto.randomUUID();
    const coll = `${tenantA}/collections/${collId}/c_${++n}.webp`;
    await q("update stores set logo_url = $1 where id = $2", [logo, storeA]);
    await q("insert into store_template_settings (tenant_id, store_id, template_key, hero_image_path) values ($1,$2,'classic',$3)", [tenantA, storeA, hero]);
    await q("insert into collections (id, tenant_id, name, slug, image_path) values ($1,$2,'C','c-ref',$3)", [collId, tenantA, coll]);
    await as(alice, () => removeUnreferencedObjects(tenantA, [logo, hero, coll]));
    expect(removedFlat()).toEqual([]);
  });

  it("[AC-DB-022] the discard action refuses a file a published version references, and removes an unreferenced upload", async () => {
    const live = fresh();
    const orphan = fresh();
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: doc() });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: heroDoc(live) });
    const res = await as(alice, () => discardUploadsAction([live, orphan]));
    expect(res.ok).toBe(true);
    expect(removedFlat()).toEqual([orphan]);
  });

  it("[AC-DB-022] replacing the store logo keeps the old file while a published version references it, removes it otherwise", async () => {
    const referenced = fresh();
    const plain = fresh();
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: doc() });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: heroDoc(referenced) });
    await q("update stores set logo_url = $1 where id = $2", [referenced, storeA]);
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: fresh() })));
    expect(removedFlat()).not.toContain(referenced);

    await q("update stores set logo_url = $1 where id = $2", [plain, storeA]);
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: fresh() })));
    expect(removedFlat()).toEqual([plain]);
  });

  it("[AC-DB-022] replacing a collection image keeps a version-referenced file and removes an unreferenced one", async () => {
    const id1 = crypto.randomUUID();
    const folder = `${tenantA}/collections/${id1}`;
    const referenced = `${folder}/a.webp`;
    const plain = `${folder}/b.webp`;
    const input = (imagePath: string | null) => ({ name: "Col", slug: "col-img", description: null, status: "active" as const, imagePath, productIds: [] });
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: doc() });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: heroDoc(referenced) });
    await as(alice, () => createCollection(id1, input(referenced) as never));
    await as(alice, () => updateCollection(id1, input(plain) as never));
    expect(removedFlat(), "referenced by a published version").not.toContain(referenced);
    await as(alice, () => updateCollection(id1, input(null) as never));
    expect(removedFlat(), "unreferenced").toEqual([plain]);
  });
});

describe("[AC-DB-022] matching is structural and tenant-scoped, never a substring search", () => {
  it("[AC-DB-022] a longer path, a path in prose and a different key do not protect the file", async () => {
    const p = fresh();
    const lookalike = doc({
      sections: {
        s: {
          type: "hero",
          settings: {
            image: { path: `${p}.bak` },
            heading: `see ${p} for details`,
            other: { url: p, paths: [p] },
          },
          blocks: {},
          block_order: [],
        },
      },
      order: ["s"],
    });
    const templateId = await insertTemplate(pg, { tenantId: tenantA, storeId: storeA, kind: "index", draft: lookalike });
    await publish(pg, { tenantId: tenantA, storeId: storeA, templateId, document: lookalike });
    await as(alice, () => removeUnreferencedObjects(tenantA, [p]));
    expect(removedFlat()).toEqual([p]);
  });

  it("[AC-DB-022] another tenant's template that holds the same path string does not protect it", async () => {
    const p = fresh();
    await insertTemplate(pg, { tenantId: tenantB, storeId: storeB, kind: "index", draft: heroDoc(p) });
    await as(alice, () => removeUnreferencedObjects(tenantA, [p]));
    expect(removedFlat()).toEqual([p]);
  });

  it("[AC-DB-022] never removes a path outside the caller's tenant folder", async () => {
    await as(alice, () => removeUnreferencedObjects(tenantA, [`${tenantB}/store/x.webp`, `${tenantA}/../${tenantB}/x.webp`]));
    expect(removedFlat()).toEqual([]);
  });
});

describe("[AC-DB-022] concurrency: writers and the remover share per-path locks, taken before any check or write", () => {
  // PGlite is one backend session, so two transactions cannot interleave here. What is proven is the ordering that makes
  // the real race safe: lock first, then check/write, then (remover only) delete while still holding the lock.
  it("[AC-DB-022] the remover locks before it checks references", async () => {
    await as(alice, () => removeUnreferencedObjects(tenantA, [fresh()]));
    const t = h.queries.map((s) => s.toLowerCase());
    const lock = t.findIndex((s) => s.includes("pg_advisory_xact_lock"));
    const check = t.findIndex((s) => s.includes("jsonb_path_exists"));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThan(lock);
  });

  it("[AC-DB-022] the V1 hero save locks the new path after the store row lock and before the write", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: fresh() })));
    const t = h.queries.map((s) => s.toLowerCase());
    const row = t.findIndex((s) => s.includes('from "stores"') && s.includes("for update"));
    const lock = t.findIndex((s) => s.includes("pg_advisory_xact_lock"));
    const write = t.findIndex((s) => s.includes("insert into public.store_template_settings"));
    expect(row).toBeGreaterThanOrEqual(0);
    expect(lock).toBeGreaterThan(row);
    expect(write).toBeGreaterThan(lock);
  });

  it("[AC-DB-022] an unreferenced path is removed and the call resolves without throwing", async () => {
    const p = fresh();
    await expect(as(alice, () => removeUnreferencedObjects(tenantA, [p]))).resolves.toBeUndefined();
    expect(removedFlat()).toEqual([p]);
  });
});
