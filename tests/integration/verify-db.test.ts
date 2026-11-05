import type { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { getDatabase, dbSchema, type Database } from "@/lib/db";
import { runVerification, summarize, type Check } from "../../scripts/lib/verify";
import { createDb } from "../db/harness";

/**
 * Tests the verifier itself: it must PASS on a correctly migrated database and
 * must FAIL for each deliberately unsafe variation. (`npm run db:verify` runs
 * the same code against a real Supabase project - these tests cannot.)
 */
const journalEntries = (JSON.parse(readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as { entries: unknown[] }).entries.length;

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const fn of cleanups.reverse()) await fn().catch(() => {});
});

/** Privileged access to the single PGlite session, restoring the app role afterwards. */
const adminFor = (pg: PGlite) => async <T = Record<string, unknown>>(query: string): Promise<T[]> => {
  await pg.exec("set session authorization postgres");
  try {
    return (await pg.query<T>(query)).rows;
  } finally {
    await pg.exec("set session authorization storeforge_app");
  }
};

async function pgliteEnv(mutate?: (pg: PGlite) => Promise<void>) {
  const pg = await createDb({ fullAuth: true });
  cleanups.push(() => pg.close());
  await mutate?.(pg);
  await pg.exec("set session authorization storeforge_app");
  return { pg, app: drizzle(pg, { schema: dbSchema }) as unknown as Database, admin: adminFor(pg) };
}

const byId = (checks: Check[], id: string) => checks.find((c) => c.id === id);
const failedIds = (checks: Check[]) => checks.filter((c) => c.status === "fail").map((c) => c.id);

describe("db:verify on a correct database, over the real postgres-js driver", () => {
  it("passes every check and cleans up after itself", async () => {
    const pg = await createDb({ fullAuth: true });
    cleanups.push(() => pg.close());
    await pg.exec("set session authorization storeforge_app");
    const port = 56000 + Math.floor(Math.random() * 3000);
    const server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
    await server.start();
    process.env.DATABASE_URL = `postgresql://storeforge_app:pw@127.0.0.1:${port}/postgres`;
    cleanups.push(async () => {
      const cache = (globalThis as unknown as { __storeforgeDb?: { client?: { end: () => Promise<void> } } }).__storeforgeDb;
      await cache?.client?.end();
      await server.stop();
    });

    const admin = adminFor(pg);
    // Concurrency 1: PGlite is a single backend session. The real run uses 20.
    const checks = await runVerification({ app: getDatabase(), admin, journalEntries, concurrency: 1, readOnly: false });

    const summary = summarize(checks);
    expect(summary.failed, JSON.stringify(summary.failed, null, 1)).toEqual([]);
    expect(summary.skipped).toEqual([]);
    expect(summary.ok).toBe(true);
    expect(checks.length).toBeGreaterThanOrEqual(24);

    expect(byId(checks, "cleanup")?.status).toBe("pass");
    expect(await admin("select 1 from auth.users where email like 'dbverify-%'")).toEqual([]);
    expect(await admin("select 1 from public.tenants")).toEqual([]);
    expect(await admin("select 1 from public.profiles")).toEqual([]);
  });

  it("read-only mode creates nothing and is reported as incomplete, never as verified", async () => {
    const env = await pgliteEnv();
    const checks = await runVerification({ app: env.app, admin: env.admin, journalEntries, concurrency: 1, readOnly: true });
    const summary = summarize(checks);
    expect(summary.failed).toEqual([]);
    expect(summary.skipped.length).toBeGreaterThan(0);
    expect(summary.ok).toBe(false);
    expect(await env.admin("select 1 from auth.users")).toEqual([]);
  });
});

describe("db:verify FAILS on unsafe databases (the verifier is not vacuous)", () => {
  const cases: Array<{ name: string; mutate: (pg: PGlite) => Promise<void>; expectFail: string[] }> = [
    {
      name: "the app role can BYPASS RLS",
      mutate: async (pg) => void (await pg.exec("alter role storeforge_app bypassrls")),
      expectFail: ["role-attributes"],
    },
    {
      name: "the app role inherits privileges (works without a user context)",
      // PG16+: inheritance lives on the membership grant, so change both the attribute and the grant.
      mutate: async (pg) =>
        void (await pg.exec("alter role storeforge_app inherit; grant authenticated to storeforge_app with inherit true")),
      expectFail: ["role-attributes", "role-membership", "no-context-no-data"],
    },
    {
      name: "only the role ATTRIBUTE says inherit (grant unchanged): attribute check still flags it",
      mutate: async (pg) => void (await pg.exec("alter role storeforge_app inherit")),
      expectFail: ["role-attributes"],
    },
    {
      name: "the app role is also allowed to become service_role",
      mutate: async (pg) => void (await pg.exec("grant service_role to storeforge_app")),
      expectFail: ["role-membership", "no-role-escalation"],
    },
    {
      name: "RLS is disabled on stores",
      mutate: async (pg) => void (await pg.exec("alter table public.stores disable row level security")),
      expectFail: ["rls-enabled", "rls-isolation"],
    },
    {
      name: "an extra permissive INSERT policy lets users create tenants directly",
      mutate: async (pg) =>
        void (await pg.exec(
          "grant insert on public.tenants to authenticated; create policy sneaky on public.tenants for insert to authenticated with check (true)",
        )),
      expectFail: ["policies", "table-grants", "rls-isolation"],
    },
    {
      name: "anon may execute the platform provisioning function",
      mutate: async (pg) => void (await pg.exec("grant execute on function public.platform_provision_tenant(uuid,text,text,text,text,text,text) to anon")),
      expectFail: ["function-grants"],
    },
    {
      name: "the old self-service create_tenant_with_store() is back",
      mutate: async (pg) =>
        void (await pg.exec(
          "create function public.create_tenant_with_store(a text, b text, c text, d text) returns jsonb language sql as $$ select '{}'::jsonb $$",
        )),
      expectFail: ["no-self-service-onboarding"],
    },
    {
      name: "authenticated can read and write platform_admins (self-promotion)",
      mutate: async (pg) => void (await pg.exec("grant select, insert on public.platform_admins to authenticated")),
      expectFail: ["platform-admins-private", "platform-boundaries"],
    },
    {
      name: "tenant owners may edit tenants.status (they could un-suspend themselves)",
      mutate: async (pg) => void (await pg.exec("grant update (status) on public.tenants to authenticated")),
      expectFail: ["tenant-status-columns", "platform-boundaries"],
    },
    {
      name: "the Platform Admin check was weakened to always return true",
      mutate: async (pg) =>
        void (await pg.exec("create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$ select true $$")),
      expectFail: ["platform-boundaries"],
    },
    {
      name: "a SECURITY DEFINER helper has no pinned search_path",
      mutate: async (pg) => void (await pg.exec("alter function public.is_tenant_member(uuid) reset search_path")),
      expectFail: ["definer-search-path"],
    },
    {
      name: "the profile trigger on auth.users is missing",
      mutate: async (pg) => void (await pg.exec("drop trigger on_auth_user_created on auth.users")),
      expectFail: ["triggers", "fixtures"],
    },
    {
      name: "migrations were not fully applied",
      mutate: async (pg) => void (await pg.exec("delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)")),
      expectFail: ["migrations-applied"],
    },
  ];

  it.each(cases)("$name", async ({ mutate, expectFail }) => {
    const env = await pgliteEnv(mutate);
    const checks = await runVerification({ app: env.app, admin: env.admin, journalEntries, concurrency: 1, readOnly: false });
    const failed = failedIds(checks);
    for (const id of expectFail) expect(failed, `${id} should have failed; failed = ${failed.join(",")}`).toContain(id);
    expect(summarize(checks).ok).toBe(false);
    // Whatever happens, the verifier must not leave throwaway rows behind.
    expect(await env.admin("select 1 from auth.users where email like 'dbverify-%'")).toEqual([]);
  });
});

describe("db:verify does not mistake an unreachable database for a denial", () => {
  it("fails (never passes) the denial checks when every query errors with ECONNREFUSED", async () => {
    const down = () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1"), { code: "ECONNREFUSED" }));
    const app = { execute: down, transaction: down } as unknown as Database;
    const env = await pgliteEnv();
    const checks = await runVerification({ app, admin: env.admin, journalEntries, concurrency: 1, readOnly: false });
    for (const id of ["no-context-no-data", "no-role-escalation", "app-identity"]) {
      expect(byId(checks, id)?.status, id).toBe("fail");
    }
    expect(summarize(checks).ok).toBe(false);
    expect(await env.admin("select 1 from auth.users where email like 'dbverify-%'")).toEqual([]);
  });
});
