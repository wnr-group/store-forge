import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "../../lib/db";
import { rowsOf, withUserContext } from "../../lib/db/user-context";

/**
 * Database security verification. Used by `npm run db:verify` against a real
 * Supabase project and by the test suite (which also proves this verifier FAILS
 * when something is unsafe).
 *
 *   app   - the PRODUCTION client: getDatabase() = postgres-js as `storeforge_app`
 *           through the transaction pooler. Every behavioural check goes through it.
 *   admin - a privileged connection (DIRECT_URL, `postgres`) used only to read the
 *           catalog, create/clean up throwaway fixtures and to inspect raw state.
 */
export type Check = { id: string; title: string; status: "pass" | "fail" | "skip"; detail?: string };

export type VerifyDeps = {
  app: Database;
  admin: <T = Record<string, unknown>>(query: string) => Promise<T[]>;
  /** Number of entries in drizzle/meta/_journal.json. */
  journalEntries: number;
  /** Parallel mixed-user transactions fired at the pool. */
  concurrency: number;
  /** Catalog + connection checks only; creates no rows. */
  readOnly: boolean;
};

const TABLES = ["profiles", "tenants", "memberships", "stores"] as const;

const EXPECTED_POLICIES = [
  "memberships_delete", "memberships_insert_managers", "memberships_select_members", "memberships_update_owner",
  "profiles_select_own", "profiles_update_own",
  "stores_delete_owner", "stores_insert_admins", "stores_select_members", "stores_update_admins",
  "tenants_delete_owner", "tenants_select_members", "tenants_update_admins",
].sort();

const FUNCTIONS = {
  authenticatedOnly: [
    "public.create_tenant_with_store(text,text,text,text)",
    "public.is_store_slug_available(text)",
    "public.is_valid_store_slug(text)",
    "public.is_tenant_member(uuid)",
    "public.has_tenant_role(uuid,text[])",
  ],
  nobody: ["public.handle_new_user()"],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const chain = (e: unknown) => {
  const parts: string[] = [];
  for (let err: unknown = e; err instanceof Error; err = err.cause) parts.push(err.message);
  return parts.join(" | ");
};
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

export async function runVerification(deps: VerifyDeps): Promise<Check[]> {
  const { app, admin } = deps;
  const checks: Check[] = [];

  /** Runs one check; a thrown error is a FAIL with the message as detail. */
  async function check(id: string, title: string, fn: () => Promise<string | void>) {
    try {
      const detail = await fn();
      checks.push({ id, title, status: "pass", detail: detail || undefined });
    } catch (e) {
      checks.push({ id, title, status: "fail", detail: chain(e) });
    }
  }
  const skip = (id: string, title: string, why: string) => checks.push({ id, title, status: "skip", detail: why });
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(msg);
  };
  const eq = (actual: unknown, expected: unknown, what: string) =>
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  /**
   * Passes only if `p` fails with the SPECIFIC expected error. Any other failure
   * (connection refused, timeout, syntax error...) is not evidence of a denial,
   * so it fails the check instead of silently passing it.
   */
  const denied = async (p: Promise<unknown>, what: string, expected: RegExp) => {
    let msg: string;
    try {
      await p;
    } catch (e) {
      msg = chain(e);
      if (expected.test(msg)) return msg;
      throw new Error(`${what} failed, but not with the expected denial (${expected}): ${msg}`);
    }
    throw new Error(`${what} was ALLOWED but must be denied`);
  };

  // =========================================================================
  // 1. Role, grants, function permissions (catalog, via admin)
  // =========================================================================
  await check("role-attributes", "storeforge_app cannot bypass RLS and has no elevated attributes", async () => {
    const [r] = await admin<Record<string, boolean>>(
      "select rolcanlogin, rolbypassrls, rolsuper, rolinherit, rolcreatedb, rolcreaterole, rolreplication from pg_roles where rolname = 'storeforge_app'",
    );
    assert(r, "role storeforge_app does not exist (run the migrations)");
    eq(r, { rolcanlogin: true, rolbypassrls: false, rolsuper: false, rolinherit: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false }, "storeforge_app attributes");
  });

  await check("role-membership", "storeforge_app is a member of `authenticated` and nothing else", async () => {
    const rows = await admin<{ rolname: string }>(
      "select r.rolname from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member where u.rolname = 'storeforge_app' order by 1",
    );
    eq(rows.map((r) => r.rolname), ["authenticated"], "role memberships");
    // PostgreSQL 16+ stores inheritance per membership grant (the role attribute only sets the
    // default at GRANT time), so check the grant itself. The column does not exist on PG15.
    let grants: { inherit_option: boolean }[] | null = null;
    try {
      grants = await admin<{ inherit_option: boolean }>(
        "select m.inherit_option from pg_auth_members m join pg_roles u on u.oid = m.member where u.rolname = 'storeforge_app'",
      );
    } catch {
      grants = null;
    }
    assert(
      !grants || grants.every((g) => !g.inherit_option),
      "the membership in `authenticated` has INHERIT: the app role would hold authenticated's privileges without a user context",
    );
  });

  await check("request-role", "`authenticated` (the request role) cannot bypass RLS", async () => {
    const [r] = await admin<{ rolbypassrls: boolean; rolsuper: boolean }>("select rolbypassrls, rolsuper from pg_roles where rolname = 'authenticated'");
    assert(r, "role authenticated does not exist");
    eq(r, { rolbypassrls: false, rolsuper: false }, "authenticated attributes");
  });

  await check("role-timeouts", "storeforge_app has statement / idle-in-transaction timeouts", async () => {
    const [r] = await admin<{ rolconfig: string[] | null }>("select rolconfig from pg_roles where rolname = 'storeforge_app'");
    const cfg = (r?.rolconfig ?? []).join(",");
    assert(/statement_timeout=/.test(cfg) && /idle_in_transaction_session_timeout=/.test(cfg), `rolconfig is ${JSON.stringify(r?.rolconfig)}`);
    return cfg;
  });

  await check("rls-enabled", "row level security is enabled on all application tables", async () => {
    const rows = await admin<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in (${TABLES.map(lit).join(",")}) order by 1`,
    );
    eq(rows.map((r) => r.relname), [...TABLES].sort(), "tables found");
    const off = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
    assert(off.length === 0, `RLS DISABLED on: ${off.join(", ")}`);
  });

  await check("policies", "the policy set is exactly the reviewed one (no extra or missing policies)", async () => {
    const rows = await admin<{ policyname: string }>("select policyname from pg_policies where schemaname = 'public' order by 1");
    eq(rows.map((r) => r.policyname), EXPECTED_POLICIES, "policies");
  });

  await check("table-grants", "anon has no table access; authenticated cannot insert tenants or change identity columns", async () => {
    const [r] = await admin<Record<string, boolean>>(`select
      ${TABLES.map((t) => `has_table_privilege('anon','public.${t}','select,insert,update,delete')`).join(" or ")} as anon_any,
      has_table_privilege('authenticated','public.tenants','insert') as auth_insert_tenants,
      has_column_privilege('authenticated','public.memberships','user_id','update') as auth_upd_user_id,
      has_column_privilege('authenticated','public.memberships','tenant_id','update') as auth_upd_m_tenant,
      has_column_privilege('authenticated','public.stores','tenant_id','update') as auth_upd_s_tenant,
      has_column_privilege('authenticated','public.tenants','created_by','update') as auth_upd_created_by,
      ${TABLES.map((t) => `has_table_privilege('storeforge_app','public.${t}','select')`).join(" or ")} as app_direct_select`);
    eq(r, {
      anon_any: false, auth_insert_tenants: false, auth_upd_user_id: false, auth_upd_m_tenant: false,
      auth_upd_s_tenant: false, auth_upd_created_by: false, app_direct_select: false,
    }, "table privileges");
  });

  await check("function-grants", "function EXECUTE: authenticated yes; anon / PUBLIC / storeforge_app (directly) no", async () => {
    const problems: string[] = [];
    for (const fn of [...FUNCTIONS.authenticatedOnly, ...FUNCTIONS.nobody]) {
      const [r] = await admin<{ anon: boolean; authenticated: boolean; app: boolean; public_exec: boolean }>(`select
        has_function_privilege('anon', ${lit(fn)}, 'execute') as anon,
        has_function_privilege('authenticated', ${lit(fn)}, 'execute') as authenticated,
        has_function_privilege('storeforge_app', ${lit(fn)}, 'execute') as app,
        exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = ${lit(fn)}::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_exec`);
      const wantAuth = FUNCTIONS.authenticatedOnly.includes(fn);
      if (r.anon) problems.push(`${fn}: anon can execute`);
      if (r.public_exec) problems.push(`${fn}: PUBLIC can execute`);
      if (r.app) problems.push(`${fn}: storeforge_app can execute directly`);
      if (r.authenticated !== wantAuth) problems.push(`${fn}: authenticated=${r.authenticated}, expected ${wantAuth}`);
    }
    assert(problems.length === 0, problems.join("; "));
  });

  await check("definer-search-path", "every SECURITY DEFINER function pins search_path", async () => {
    const rows = await admin<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef and not coalesce(proconfig::text, '') like '%search_path%'",
    );
    assert(rows.length === 0, `unpinned: ${rows.map((r) => r.proname).join(", ")}`);
  });

  await check("onboarding-signature", "create_tenant_with_store() takes no user-id argument", async () => {
    const [r] = await admin<{ args: string }>("select pg_get_function_arguments('public.create_tenant_with_store(text,text,text,text)'::regprocedure) as args");
    assert(!/uuid|user/i.test(r.args), `arguments: ${r.args}`);
  });

  await check("triggers", "updated_at triggers and the auth.users profile trigger exist", async () => {
    const rows = await admin<{ tgname: string }>(
      "select tgname from pg_trigger where not tgisinternal and tgname in ('profiles_set_updated_at','tenants_set_updated_at','stores_set_updated_at','on_auth_user_created') order by 1",
    );
    eq(rows.map((r) => r.tgname), ["on_auth_user_created", "profiles_set_updated_at", "stores_set_updated_at", "tenants_set_updated_at"], "triggers");
  });

  await check("migrations-applied", "all Drizzle migrations are recorded as applied", async () => {
    const [r] = await admin<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations");
    eq(r.n, deps.journalEntries, "applied migrations");
  });

  // =========================================================================
  // 2. The production connection (storeforge_app via getDatabase())
  // =========================================================================
  await check("app-identity", "the application connection logs in as storeforge_app", async () => {
    const [r] = rowsOf<{ cu: string; su: string }>(await app.execute(sql`select current_user as cu, session_user as su`));
    eq(r, { cu: "storeforge_app", su: "storeforge_app" }, "connection identity");
    const [v] = await admin<{ version: string }>("select version()");
    return v.version.split(",")[0];
  });

  await check("no-context-no-data", "without a user context the app connection cannot read tenant tables", async () => {
    for (const t of TABLES) await denied(app.execute(sql.raw(`select * from public.${t} limit 1`)), `reading ${t}`, /permission denied/);
  });

  await check("no-role-escalation", "the app connection cannot SET ROLE to service_role / anon / postgres", async () => {
    for (const role of ["service_role", "anon", "postgres"]) {
      await denied(app.transaction((tx) => tx.execute(sql.raw(`set local role ${role}`))), `SET ROLE ${role}`, /permission denied to set role/);
    }
  });

  // =========================================================================
  // 3. Behaviour with throwaway fixtures (user context, RLS, onboarding, pooling)
  // =========================================================================
  const tag = randomUUID().slice(0, 8);
  const users: string[] = [];
  const tenantIds: string[] = [];

  const writeChecks: Array<[string, string]> = [
    ["fixtures", "throwaway users are created and get profiles from the auth trigger"],
    ["identity-lifecycle", "user identity is set inside the transaction and cleared after it"],
    ["onboarding", "onboarding is atomic, idempotent and conflict-safe"],
    ["onboarding-identity", "onboarding rejects missing, unknown and unprivileged identities"],
    ["rls-isolation", "merchant A cannot read, modify, delete or write into merchant B"],
    ["rollback", "a failed transaction leaves no partial rows"],
    ["pool-sequential", "sequential requests as different users never share an identity"],
    ["pool-concurrent", "parallel requests through the pooler stay isolated"],
    ["control", "negative control: a privileged connection sees both tenants, user contexts see only their own"],
  ];

  if (deps.readOnly) {
    for (const [id, title] of writeChecks) skip(id, title, "--read-only");
    return checks;
  }

  let a = "";
  let b = "";
  try {
    await check("fixtures", writeChecks[0][1], async () => {
      for (const label of ["a", "b"]) {
        const id = randomUUID();
        users.push(id);
        await admin(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
          values ('00000000-0000-0000-0000-000000000000', ${lit(id)}, 'authenticated', 'authenticated', ${lit(`dbverify-${tag}-${label}@example.invalid`)},
            '', now(), '{"provider":"email","providers":["email"]}'::jsonb, ${lit(JSON.stringify({ full_name: `DB Verify ${label}` }))}::jsonb, now(), now(), '', '', '', '')`);
      }
      [a, b] = users;
      const profiles = await admin<{ id: string }>(`select id from public.profiles where id in (${users.map(lit).join(",")})`);
      eq(profiles.length, 2, "profiles created by trigger");
    });
    if (users.length !== 2) throw new Error("fixtures unavailable");

    const onboard = (uid: string, slug: string) =>
      withUserContext(app, uid, async (tx) =>
        rowsOf<{ r: { tenant_id: string; created: boolean } }>(
          await tx.execute(sql`select public.create_tenant_with_store(${"DB Verify Co"}, ${"DB Verify Store"}, ${slug}, ${null}) as r`),
        )[0].r,
      );
    const slugA = `dbverify-${tag}-a`;
    const slugB = `dbverify-${tag}-b`;

    await check("onboarding", writeChecks[2][1], async () => {
      const first = await onboard(a, slugA);
      assert(first.created === true, "first call must create");
      assert(UUID.test(first.tenant_id), "tenant id is a uuid");
      tenantIds.push(first.tenant_id);
      const again = await onboard(a, slugA);
      eq([again.created, again.tenant_id], [false, first.tenant_id], "repeat call");
      const msg = await denied(onboard(b, slugA), "taking another merchant's slug", /slug_taken/);
      assert(/slug_taken/.test(msg), `expected slug_taken, got: ${msg}`);
      const second = await onboard(b, slugB);
      tenantIds.push(second.tenant_id);
      const rows = await admin<{ n: number }>(`select count(*)::int as n from public.tenants where created_by in (${users.map(lit).join(",")})`);
      eq(rows[0].n, 2, "tenants created (no duplicates)");
      const owners = await admin<{ role: string; n: number }>(
        `select role, count(*)::int as n from public.memberships where user_id in (${users.map(lit).join(",")}) group by role`,
      );
      eq(owners, [{ role: "owner", n: 2 }], "owner memberships");
    });
    const [tenantA, tenantB] = tenantIds;

    await check("onboarding-identity", writeChecks[3][1], async () => {
      const ghost = randomUUID();
      const m1 = await denied(onboard(ghost, `dbverify-${tag}-ghost`), "a user id that is not in auth.users", /not_authenticated/);
      assert(/not_authenticated/.test(m1), `ghost user: expected not_authenticated, got: ${m1}`);
      const m2 = await denied(
        app.transaction((tx) => tx.execute(sql`select public.create_tenant_with_store('X Co','X Store',${`dbverify-${tag}-noctx`},null)`)),
        "calling the function with no user context",
        /not_authenticated|permission denied/,
      );
      const m3 = await denied(
        app.transaction(async (tx) => {
          await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: "" })}, true)`);
          await tx.execute(sql.raw("set local role authenticated"));
          await tx.execute(sql`select public.create_tenant_with_store('X Co','X Store',${`dbverify-${tag}-empty`},null)`);
        }),
        "calling the function with an empty identity",
        /not_authenticated|invalid input syntax/,
      );
      assert(/not_authenticated|invalid input syntax|permission denied/.test(m2 + m3), `unexpected errors: ${m2} / ${m3}`);
      const rows = await admin<{ n: number }>(`select count(*)::int as n from public.stores where slug like ${lit(`dbverify-${tag}-%`)} and slug not in (${lit(slugA)}, ${lit(slugB)})`);
      eq(rows[0].n, 0, "rows created by rejected calls");
    });

    await check("identity-lifecycle", writeChecks[1][1], async () => {
      const inside = await withUserContext(app, a, async (tx) =>
        rowsOf<{ uid: string; who: string }>(await tx.execute(sql`select auth.uid()::text as uid, current_user as who`))[0],
      );
      eq(inside, { uid: a, who: "authenticated" }, "identity inside the transaction");
      const after = rowsOf<{ claims: string; sub: string; who: string }>(
        await app.execute(sql`select coalesce(current_setting('request.jwt.claims', true), '') as claims, coalesce(current_setting('request.jwt.claim.sub', true), '') as sub, current_user as who`),
      )[0];
      eq(after, { claims: "", sub: "", who: "storeforge_app" }, "state after commit");
      await denied(withUserContext(app, b, async () => { throw new Error("forced"); }), "forced failure", /forced/);
      const afterFail = rowsOf<{ claims: string; who: string }>(
        await app.execute(sql`select coalesce(current_setting('request.jwt.claims', true), '') as claims, current_user as who`),
      )[0];
      eq(afterFail, { claims: "", who: "storeforge_app" }, "state after rollback");
    });

    await check("rls-isolation", writeChecks[4][1], async () => {
      const seenByA = await withUserContext(app, a, async (tx) =>
        rowsOf<{ id: string }>(await tx.execute(sql`select id from public.tenants where id in (${sql.raw(lit(tenantA))}, ${sql.raw(lit(tenantB))})`)).map((r) => r.id),
      );
      eq(seenByA, [tenantA], "tenants visible to A");
      const [storeB] = await admin<{ id: string }>(`select id from public.stores where tenant_id = ${lit(tenantB)}`);
      await withUserContext(app, a, async (tx) => {
        const upd = rowsOf(await tx.execute(sql`update public.stores set name = 'pwned' where id = ${storeB.id} returning id`));
        const del = rowsOf(await tx.execute(sql`delete from public.stores where id = ${storeB.id} returning id`));
        const tdel = rowsOf(await tx.execute(sql`delete from public.tenants where id = ${tenantB} returning id`));
        eq([upd.length, del.length, tdel.length], [0, 0, 0], "rows affected in B");
      });
      const ins = await denied(
        withUserContext(app, a, (tx) => tx.execute(sql`insert into public.stores (tenant_id, name, slug) values (${tenantB}, 'Evil', ${`dbverify-${tag}-evil`})`)),
        "inserting a store into B's tenant",
        /row-level security/,
      );
      assert(/row-level security/.test(ins), `expected an RLS violation, got: ${ins}`);
      for (const role of ["owner", "admin", "staff"]) {
        await denied(
          withUserContext(app, a, (tx) => tx.execute(sql`insert into public.memberships (tenant_id, user_id, role) values (${tenantB}, ${a}, ${role})`)),
          `joining B's tenant as ${role}`,
          /row-level security/,
        );
      }
      await denied(
        withUserContext(app, a, (tx) => tx.execute(sql`insert into public.tenants (name, slug, created_by) values ('Direct Co', ${`dbverify-${tag}-direct`}, ${a})`)),
        "creating a tenant outside the onboarding function",
        /permission denied/,
      );
      const [intact] = await admin<{ name: string }>(`select name from public.stores where id = ${lit(storeB.id)}`);
      assert(intact && intact.name !== "pwned", "B's store was modified");
    });

    await check("rollback", writeChecks[5][1], async () => {
      await denied(
        withUserContext(app, a, async (tx) => {
          await tx.execute(sql`insert into public.stores (tenant_id, name, slug) values (${tenantA}, 'Temp Store', ${`dbverify-${tag}-rollback`})`);
          throw new Error("forced failure after insert");
        }),
        "forced failure",
        /forced failure after insert/,
      );
      const rows = await admin<{ n: number }>(`select count(*)::int as n from public.stores where slug = ${lit(`dbverify-${tag}-rollback`)}`);
      eq(rows[0].n, 0, "rows left behind");
    });

    const visible = (uid: string) =>
      withUserContext(app, uid, async (tx) => {
        const ids = rowsOf<{ id: string }>(await tx.execute(sql`select id from public.tenants where id in (${sql.raw(lit(tenantA))}, ${sql.raw(lit(tenantB))}) order by id`)).map((r) => r.id);
        const [who] = rowsOf<{ uid: string }>(await tx.execute(sql`select auth.uid()::text as uid`));
        return { uid: who.uid, ids };
      });

    await check("pool-sequential", writeChecks[6][1], async () => {
      for (let i = 0; i < 12; i++) {
        const uid = i % 2 === 0 ? a : b;
        const got = await visible(uid);
        eq(got, { uid, ids: [uid === a ? tenantA : tenantB] }, `request ${i}`);
      }
    });

    await check("pool-concurrent", writeChecks[7][1], async () => {
      const n = Math.max(1, deps.concurrency);
      const uids = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));
      const results = await Promise.all(uids.map(visible));
      results.forEach((got, i) => eq(got, { uid: uids[i], ids: [uids[i] === a ? tenantA : tenantB] }, `parallel request ${i}`));
      return `${n} parallel transactions`;
    });

    await check("control", writeChecks[8][1], async () => {
      const [r] = await admin<{ n: number }>(`select count(*)::int as n from public.tenants where id in (${lit(tenantA)}, ${lit(tenantB)})`);
      eq(r.n, 2, "tenants visible to the privileged connection");
      const got = await visible(a);
      eq(got.ids.length, 1, "tenants visible in A's user context");
    });
  } catch (e) {
    checks.push({ id: "fixtures-abort", title: "fixture setup", status: "fail", detail: chain(e) });
    for (const [id, title] of writeChecks) {
      if (!checks.some((c) => c.id === id)) skip(id, title, "fixtures unavailable");
    }
  } finally {
    // Always remove everything this run created, even after failures.
    await check("cleanup", "throwaway users, tenants and stores are removed", async () => {
      const found = tenantIds.length
        ? await admin<{ id: string }>(`select id from public.tenants where created_by in (${users.map(lit).join(",")}) or id in (${tenantIds.map(lit).join(",")})`)
        : users.length
          ? await admin<{ id: string }>(`select id from public.tenants where created_by in (${users.map(lit).join(",")})`)
          : [];
      const ids = found.map((r) => r.id).filter((id) => UUID.test(id));
      if (ids.length) await admin(`delete from public.tenants where id in (${ids.map(lit).join(",")})`);
      if (users.length) await admin(`delete from auth.users where id in (${users.map(lit).join(",")})`);
      if (users.length) {
        const left = await admin<{ n: number }>(`select (select count(*) from auth.users where id in (${users.map(lit).join(",")}))::int
          + (select count(*) from public.profiles where id in (${users.map(lit).join(",")}))::int as n`);
        eq(left[0].n, 0, "rows left after cleanup");
      }
      return `${users.length} users, ${ids.length} tenants`;
    });
  }
  return checks;
}

export function summarize(checks: Check[]) {
  const failed = checks.filter((c) => c.status === "fail");
  const skipped = checks.filter((c) => c.status === "skip");
  return { failed, skipped, passed: checks.length - failed.length - skipped.length, ok: failed.length === 0 && skipped.length === 0 };
}
