import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";

/**
 * Minimal stand-in for the parts of Supabase the migrations depend on:
 * the `auth` schema, auth.uid() and the anon/authenticated roles.
 * Everything else (tables, triggers, RLS, functions, roles) is the REAL Drizzle migration set.
 */
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  -- Same definition as Supabase's auth.uid(): supports both claim styles and empty settings.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

/** Extra auth columns/tables the dev seed touches (mirrors real Supabase). */
const FULL_AUTH_STUB = `
  alter table auth.users
    add column instance_id uuid, add column aud text, add column role text,
    add column encrypted_password text, add column email_confirmed_at timestamptz,
    add column raw_app_meta_data jsonb, add column created_at timestamptz, add column updated_at timestamptz,
    add column confirmation_token text, add column recovery_token text,
    add column email_change text, add column email_change_token_new text;
  create table auth.identities (
    id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text not null, provider text not null, identity_data jsonb not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
    unique (provider_id, provider)
  );
  create schema extensions;
`;

export async function createDb(opts: { fullAuth?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  if (opts.fullAuth) await db.exec(FULL_AUTH_STUB);
  // The real Drizzle migrator over the real ./drizzle folder (same mechanism as `drizzle-kit migrate`).
  await migrate(drizzle(db), { migrationsFolder: join(process.cwd(), "drizzle") });
  return db;
}

export async function createUser(db: PGlite, email: string, fullName?: string): Promise<string> {
  const meta = JSON.stringify(fullName ? { full_name: fullName } : {});
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [email, meta],
  );
  return res.rows[0].id;
}

/** Run `fn` as an authenticated end user (RLS enforced), or as anon when userId is null. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  const claims = userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "{}";
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

/** Inserts a Platform Admin the way `npm run admin:create` does: privileged write, never through the API. */
export async function createPlatformAdmin(db: PGlite, email = "platform.admin@example.test"): Promise<string> {
  const existing = await db.query<{ id: string }>("select id from auth.users where email = $1", [email]);
  const id = existing.rows[0]?.id ?? (await createUser(db, email, "Platform Admin"));
  await db.query("insert into platform_admins (user_id) values ($1) on conflict do nothing", [id]);
  return id;
}

export type Provisioned = { tenant_id: string; store_id: string; store_slug: string; created: boolean };

/** Provision `ownerId`'s company as the Platform Admin (the only way tenants are created). */
export async function provision(
  db: PGlite,
  adminId: string,
  ownerId: string,
  storeSlug: string,
  names: { tenant?: string; store?: string } = {},
) {
  return asUser(db, adminId, async () => {
    const res = await db.query<{ r: Provisioned }>(
      "select public.platform_provision_tenant($1, $2, $3, $4) as r",
      [ownerId, names.tenant ?? `${storeSlug} Inc`, names.store ?? `${storeSlug} Store`, storeSlug],
    );
    return res.rows[0].r;
  });
}

/** Shorthand used by most suites: creates a company owned by `userId` (via a harness-created Platform Admin). */
export async function onboard(
  db: PGlite,
  userId: string,
  storeSlug: string,
  names: { tenant?: string; store?: string } = {},
) {
  return provision(db, await createPlatformAdmin(db), userId, storeSlug, names);
}

/**
 * Run `fn` on a session authenticated as the application login role
 * (`storeforge_app`), the way the real pooled connection logs in.
 * PGlite's RESET SESSION AUTHORIZATION doesn't return to the superuser, so the
 * original user is restored explicitly.
 */
export async function asAppConnection<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec("set session authorization storeforge_app");
  try {
    return await fn();
  } finally {
    await db.exec("rollback").catch(() => {});
    await db.exec("set session authorization postgres");
  }
}
