import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createUser, onboard } from "./harness";

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  removed: [] as string[][],
  removeThrows: false,
  queries: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user, requireUser: async () => h.user }));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Storage is external. verifyObjects keeps the REAL folder rule (direct child of the tenant's store folder) and treats every such path as an existing 1 KB webp.
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
      if (h.removeThrows) throw new Error("storage down");
      h.removed.push(paths);
    },
    createUploadTargets: async () => [],
  };
});

import { dbSchema, type Database } from "@/lib/db";
import { discardUploadsAction } from "@/app/(dashboard)/dashboard/uploads/discard";
import { updateStoreSettings } from "@/services/store-settings.service";
import { getTemplateSettings, saveTemplateSettings } from "@/services/template-settings.service";

let pg: PGlite;
let alice: string, mia: string, sam: string, bob: string;
let tenantA: string, tenantB: string;

const as = async <T>(user: string, fn: () => Promise<T>): Promise<T> => {
  h.user = { id: user };
  return asAppConnection(pg, fn);
};
const code = (p: Promise<unknown>) => p.then(() => "NO_ERROR", (e: { code?: string; message?: string }) => e.code ?? e.message ?? String(e));
const q = (sql: string, params: unknown[] = []) => pg.query<Record<string, unknown>>(sql, params).then((r) => r.rows);
const values = (over: Record<string, unknown> = {}) => ({ templateKey: "classic" as const, accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null, ...over });
const storeForm = (over: Record<string, unknown> = {}) => ({ name: "Alpha", slug: "alpha-shop", description: null, contactEmail: null, contactPhone: null, currency: "INR", timezone: "Asia/Kolkata", logoPath: null, ...over });
const heroA = (n: string) => `${tenantA}/store/${n}.webp`;
const settingsRow = async (tenant: string) => (await q("select * from store_template_settings where tenant_id = $1", [tenant]))[0];

beforeAll(async () => {
  pg = await createDb();
  h.orm = drizzle(pg, { schema: dbSchema, logger: { logQuery: (query: string) => void h.queries.push(query) } }) as unknown as Database;
  [alice, mia, sam, bob] = await Promise.all(["alice", "mia", "sam", "bob"].map((n) => createUser(pg, `${n}@example.test`)));
  tenantA = (await onboard(pg, alice, "alpha-shop")).tenant_id;
  tenantB = (await onboard(pg, bob, "beta-shop")).tenant_id;
  await pg.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'staff')", [tenantA, mia, sam]);
});
beforeEach(async () => {
  h.removed.length = 0;
  h.removeThrows = false;
  h.queries.length = 0;
  await q("delete from store_template_settings");
  await q("update stores set logo_url = null");
});
afterAll(async () => pg.close());

describe("saving and reading", () => {
  it("first save creates the row, later saves update it, and reads return it", async () => {
    expect(await as(alice, () => getTemplateSettings())).toBeNull();
    await as(alice, () => saveTemplateSettings(values({ templateKey: "spotlight", accentColor: "#1A2B3C", heroHeading: " Hello " })));
    expect(await as(alice, () => getTemplateSettings())).toMatchObject({ templateKey: "spotlight", accentColor: "#1a2b3c", heroHeading: "Hello", heroSubheading: null });
    await as(alice, () => saveTemplateSettings(values({ templateKey: "classic", heroHeading: "Again" })));
    expect(await as(alice, () => getTemplateSettings())).toMatchObject({ templateKey: "classic", heroHeading: "Again" });
    expect(await q("select 1 from store_template_settings")).toHaveLength(1);
  });

  it("Manager can save; Staff can read but is forbidden to save", async () => {
    await as(mia, () => saveTemplateSettings(values({ heroHeading: "By manager" })));
    expect(await code(as(sam, () => saveTemplateSettings(values({ heroHeading: "By staff" }))))).toBe("FORBIDDEN");
    expect((await as(sam, () => getTemplateSettings()))?.heroHeading).toBe("By manager");
    expect((await settingsRow(tenantA))!.hero_heading).toBe("By manager");
  });

  it("is tenant-isolated: another owner saves and reads only their own store", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroHeading: "Alpha" })));
    await as(bob, () => saveTemplateSettings(values({ templateKey: "spotlight", heroHeading: "Beta" })));
    expect((await as(alice, () => getTemplateSettings()))?.heroHeading).toBe("Alpha");
    expect((await as(bob, () => getTemplateSettings()))?.heroHeading).toBe("Beta");
    expect((await settingsRow(tenantA))!.template_key).toBe("classic");
    expect((await settingsRow(tenantB))!.template_key).toBe("spotlight");
  });

  it("re-validates at the service boundary: unknown key, bad color and long text are rejected and nothing is stored", async () => {
    for (const bad of [{ templateKey: "nope" }, { accentColor: "red" }, { heroHeading: "a".repeat(81) }, { heroSubheading: "a".repeat(201) }]) {
      expect(await code(as(alice, () => saveTemplateSettings(values(bad) as never))), JSON.stringify(bad)).toBe("VALIDATION");
    }
    expect(await settingsRow(tenantA)).toBeUndefined();
  });

  it("rejects a hero image from another tenant's folder", async () => {
    expect(await code(as(alice, () => saveTemplateSettings(values({ heroImagePath: `${tenantB}/store/x.webp` }))))).toBe("VALIDATION");
    expect(await settingsRow(tenantA)).toBeUndefined();
  });

  it("reset to default: select the default template, clear the fields, save normally", async () => {
    await as(alice, () => saveTemplateSettings(values({ templateKey: "spotlight", accentColor: "#112233", heroHeading: "X", heroSubheading: "Y", heroImagePath: heroA("a") })));
    await as(alice, () => saveTemplateSettings(values()));
    expect(await settingsRow(tenantA)).toMatchObject({ template_key: "classic", accent_color: null, hero_heading: null, hero_subheading: null, hero_image_path: null });
  });
});

describe("hero image replacement and cleanup", () => {
  it("removes the previous hero file after the save commits, and nothing on the first save", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("one") })));
    expect(h.removed).toEqual([]);
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("two") })));
    expect(h.removed).toEqual([[heroA("one")]]);
    h.removed.length = 0;
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("two"), heroHeading: "same image" })));
    expect(h.removed).toEqual([]);
  });

  it("a cleanup failure after commit never fails the save, and the orphaned path is logged", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("one") })));
    h.removeThrows = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("two") })));
    expect((await settingsRow(tenantA))!.hero_image_path).toBe(heroA("two"));
    expect(log.mock.calls.flat().join(" ")).toContain(heroA("one"));
    log.mockRestore();
  });
});

describe("logo / hero collision (both directions)", () => {
  it("saving a hero that is the current logo is rejected, nothing changes, nothing is deleted", async () => {
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: heroA("shared") })));
    h.removed.length = 0;
    expect(await code(as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("shared") }))))).toBe("VALIDATION");
    expect(await settingsRow(tenantA)).toBeUndefined();
    expect(h.removed).toEqual([]);
  });

  it("saving a logo that is the current hero is rejected, nothing changes, nothing is deleted", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("shared") })));
    h.removed.length = 0;
    expect(await code(as(alice, () => updateStoreSettings(storeForm({ logoPath: heroA("shared") }))))).toBe("VALIDATION");
    expect((await q("select logo_url from stores where tenant_id = $1", [tenantA]))[0].logo_url).toBeNull();
    expect(h.removed).toEqual([]);
  });

  it("existing logo behavior is unchanged: set, replace (previous file removed), clear", async () => {
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: heroA("l1") })));
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: heroA("l2") })));
    expect(h.removed).toEqual([[heroA("l1")]]);
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: null })));
    expect((await q("select logo_url from stores where tenant_id = $1", [tenantA]))[0].logo_url).toBeNull();
  });

  it("both save paths lock the store row BEFORE checking or writing (transaction ordering)", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("a") })));
    const t = h.queries.map((s) => s.toLowerCase());
    const lock = t.findIndex((s) => s.includes('from "stores"') && s.includes("for update"));
    const write = t.findIndex((s) => s.includes("insert into public.store_template_settings"));
    expect(lock, "store row lock").toBeGreaterThanOrEqual(0);
    expect(write, "settings write").toBeGreaterThan(lock);

    h.queries.length = 0;
    await as(alice, () => updateStoreSettings(storeForm({ logoPath: heroA("b") })));
    const u = h.queries.map((s) => s.toLowerCase());
    const lock2 = u.findIndex((s) => s.includes('from "stores"') && s.includes("for update"));
    const write2 = u.findIndex((s) => s.includes('update "stores"'));
    expect(lock2, "store row lock").toBeGreaterThanOrEqual(0);
    expect(write2, "store write").toBeGreaterThan(lock2);
  });
  // PGlite is a single backend session, so two transactions cannot truly run in parallel here.
  // The lock itself is proven in tests/db/template-settings.test.ts (SELECT ... FOR UPDATE under the real grants);
  // real concurrency is checked manually/E2E against a multi-connection database.
});

describe("discardUploadsAction protects the hero image", () => {
  it("never removes a referenced hero image, but does remove an unreferenced upload", async () => {
    await as(alice, () => saveTemplateSettings(values({ heroImagePath: heroA("live") })));
    h.removed.length = 0;
    const res = await as(alice, () => discardUploadsAction([heroA("live"), heroA("orphan-upload")]));
    expect(res.ok).toBe(true);
    expect(h.removed.flat()).toEqual([heroA("orphan-upload")]);
  });

  it("still refuses paths outside the caller's tenant folder", async () => {
    const res = await as(alice, () => discardUploadsAction([`${tenantB}/store/x.webp`]));
    expect(res.ok).toBe(false);
    expect(h.removed).toEqual([]);
  });
});
