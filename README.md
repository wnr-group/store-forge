# StoreForge

Multi-tenant e-commerce SaaS foundation: authentication, merchant onboarding, tenant isolation enforced by PostgreSQL Row Level Security, RBAC and an active-workspace context.

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · **Supabase Auth** (`@supabase/ssr`) · **Drizzle ORM** + Drizzle Kit · Supabase PostgreSQL.

> **Scope: Task 1 foundation.** Products, inventory, orders, payments, public storefronts and custom domains are intentionally not implemented yet.

> **Verification status.** The database security model is covered by automated tests that run the real migrations against an in-process PostgreSQL (PGlite) and the real `postgres` driver over a wire connection. It has **not** been verified against an actual Supabase project until you run `npm run db:verify` there and it ends with `ALL CHECKS PASSED` (see [Verify RLS on Supabase](#verify-rls-on-supabase)).

## Architecture

```
Browser ──► Next.js (RSC, Server Actions, Route Handlers)
              │
              ├─ Supabase Auth ........ sign up / in / out, sessions, password recovery   (@supabase/ssr, cookies)
              │
              └─ Drizzle ORM .......... ALL application data access
                    └─ postgres-js ──► Supabase transaction pooler (:6543) ──► PostgreSQL
                         role: storeforge_app   (login role, NOBYPASSRLS, member of `authenticated` only)
                         per request:  BEGIN; set_config(claims, userId, local); SET LOCAL ROLE authenticated; … ; COMMIT
```

```
app/                    routes: (auth) login/register/…, (dashboard) dashboard + onboarding, auth/callback
proxy.ts                Next 16 request interception (session refresh + optimistic route gating)
components/             ui/ (shadcn), auth/, onboarding/, dashboard/, shared/
config/                 env validation, app constants
lib/
  db/
    schema/             Drizzle tables (profiles, tenants, memberships, stores) + shared constants
    relations.ts        Drizzle relations
    index.ts            INTERNAL pooled postgres-js client (never queried directly)
    user-context.ts     withUserContext(): per-request identity + RLS guard
    tenant-db.ts        withAuthenticatedDb(): validated session -> user-context transaction
  tenant/context.ts     getUserTenants, getActiveTenant, requireTenantAccess/Role, withTenantDb
  auth/                 getCurrentUser()/requireUser(), permissions.ts (central RBAC)
  supabase/             browser / server / proxy clients — AUTHENTICATION ONLY
services/               auth (Supabase Auth), tenant + store (Drizzle)
types/                  shared types
drizzle/                migrations (generated + custom SQL) — the single source of truth for the database
scripts/                db:verify, db:seed
tests/                  db/ (RLS + roles on real Postgres), integration/ (postgres-js, verifier), unit/
```

### Why Drizzle, and why Supabase Auth stays

- **Drizzle** gives typed, composable queries and real transactions against plain PostgreSQL, with migrations kept as reviewable SQL. It replaces `supabase.from()` for application data; there is exactly one data-access layer.
- **Supabase Auth** still owns identities, passwords, email verification and sessions. We do not store passwords or hash anything ourselves. Drizzle only *references* `auth.users`.
- **Row Level Security stays on**, in the database, as the real security boundary.

### How tenant isolation works (defence in depth)

A direct Postgres connection does **not** carry the Supabase user's identity the way PostgREST does, so the app establishes it explicitly:

1. **Session validation** — `withAuthenticatedDb()` gets the user from `supabase.auth.getUser()` (verified by the Auth server). It accepts **no user-id parameter**; identity cannot be supplied by a caller.
2. **Transaction-local identity** — `withUserContext()` opens a transaction and sets `request.jwt.claims` / `request.jwt.claim.sub` with `set_config(…, true)` and runs `SET LOCAL ROLE authenticated`. Everything is discarded at COMMIT/ROLLBACK, so a pooled connection can never carry one request's identity into the next. The user id is checked to be a UUID and passed as a bind parameter; the role name is a hard-coded constant.
3. **A login role that can't cheat** — the app connects as `storeforge_app`: `NOBYPASSRLS`, `NOSUPERUSER`, `NOINHERIT` (no privileges of its own), member of `authenticated` **only** (it cannot `SET ROLE` to `service_role`, `anon` or `postgres`). `DATABASE_URL` is rejected at startup if it uses the `postgres` owner role.
4. **Runtime RLS guard** — the first request per process asserts the request role is `authenticated` and that neither it nor the login role is a superuser / `BYPASSRLS`; otherwise it throws before any user code runs.
5. **RLS policies** — `profiles`, `tenants`, `memberships`, `stores` (see `drizzle/0002_rls_policies.sql`). Policies call `SECURITY DEFINER` helpers (`is_tenant_member`, `has_tenant_role`) with a pinned `search_path` that inspect only `auth.uid()`, which avoids policy recursion. Column-level grants make `tenant_id`, `user_id`, `created_by` immutable. Tenants and `owner` memberships have **no INSERT policy**: they can only be created by `create_tenant_with_store()`.
6. **Application checks** — `requireTenantAccess` / `requireTenantRole` / `withTenantDb` look membership up in the database. The `sf_active_tenant` cookie is only a *preference*, matched against real memberships and ignored if it doesn't match. These are redundant with RLS by design.

### Onboarding

`create_tenant_with_store(tenant_name, store_name, store_slug, description)` creates tenant → owner membership → store in one transaction. It takes **no user id** (identity is `auth.uid()`, and the user must exist in `auth.users`), a per-user advisory lock serialises double submits, repeating the same request returns the existing tenant, and slug races surface as `slug_taken` with full rollback. It is called through Drizzle inside the user-context transaction.

### Roles

| Role  | Can |
|---|---|
| owner | everything: tenant, stores, members (admin/staff), deletes |
| admin | edit tenant + stores, add/remove **staff** |
| staff | view dashboard / read store data |

App-side rules: `lib/auth/permissions.ts`. Database rules: `drizzle/0002_rls_policies.sql`. Keep them in sync.

## Setup

Requires Node ≥ 20.9 and a hosted Supabase project (no Docker needed).

### 1. Create a Supabase project
Dashboard → **New project**; save the database password.
Project Settings → **API**: copy the **Project URL** and **anon** key. (The `service_role` key is not used by this app.)

### 2. Configure Supabase Auth (dashboard)
- **Authentication → Providers → Email**: enabled. Keep **Confirm email** on for production (the app supports both modes).
- **Authentication → URL Configuration**: *Site URL* `http://localhost:3000` (production: your domain). *Redirect URLs*: add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` (Vercel previews: `https://*-<team>.vercel.app/auth/callback`).
- **Email templates**: defaults work with `/auth/callback` (PKCE `code`). For custom templates link to `/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard` (recovery: `type=recovery&next=/reset-password`).
- **SMTP**: the built-in mailer is heavily rate-limited; configure custom SMTP before going live.

### 3. Connection strings
Dashboard → **Connect** shows exact strings for your region. You need two:

| Variable | Used by | Connection | User |
|---|---|---|---|
| `DATABASE_URL` | the running app | **Transaction pooler**, port **6543** | `storeforge_app.<project-ref>` |
| `DIRECT_URL` | migrations, `db:seed`, `db:verify` | Direct (`db.<ref>.supabase.co:5432`), or **Session pooler** port 5432 if you need IPv4 | `postgres` (direct) / `postgres.<project-ref>` (session pooler) |

The app uses `prepare: false` (required by transaction-mode poolers) and a small pool per instance.

### 4. Environment
```bash
cp .env.example .env.local     # PowerShell: Copy-Item .env.example .env.local
```
Fill in every variable. `.env.local` is git-ignored. Database variables are server-only and must never be prefixed `NEXT_PUBLIC_`. Set `DATABASE_URL` **after** step 5 (the role needs its password first); put only `DIRECT_URL` and the Supabase values in at first.

### 5. Migrate and create the application role
```bash
npm install
npm run db:migrate        # applies drizzle/*.sql using DIRECT_URL (postgres)
```
Migration `0004_app_role.sql` creates the `storeforge_app` login role **without a password** (secrets must not live in git). Set one yourself in the Supabase **SQL Editor**:
```sql
ALTER ROLE storeforge_app WITH PASSWORD '<long random password>';
```
Use a URL-safe password (or percent-encode it) in `DATABASE_URL`:
`postgresql://storeforge_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

If `db:migrate` fails on `GRANT authenticated TO storeforge_app`, your project's `postgres` role lacks admin rights on `authenticated`; run `GRANT authenticated TO storeforge_app;` from the SQL Editor as the project owner and re-run.

### 6. Verify RLS on Supabase
```bash
npm run db:verify                 # full: catalog + behaviour + throwaway fixtures (cleaned up)
npm run db:verify -- --read-only  # catalog and connection checks only (creates nothing)
```
It runs against **your real** `DATABASE_URL` (the production path) and checks: the role's attributes and memberships, RLS enabled on every table, the exact policy set, table/column grants, function `EXECUTE` rights, pinned `search_path`s, triggers, applied migrations; that the app connection has no access without a user context and cannot `SET ROLE` to a privileged role; that identity is set and cleared per transaction; onboarding atomicity, idempotency and identity validation (unknown/missing user ids are rejected); cross-tenant read/update/delete/insert blocking; rollback; and that **20 parallel mixed-user requests through the pooler never share an identity**.

Only `ALL CHECKS PASSED` means verified. Any failure exits non-zero. `--read-only` runs print that the result is incomplete. The script uses clearly-labelled throwaway users (`dbverify-*@example.invalid`) and removes them, even after failures.

### 7. (Optional) Seed development data
Dev projects only — creates demo users with a **publicly known password** (`scripts/seed.sql`):
```bash
npm run db:seed -- --confirm-dev
```

### 8. Run
```bash
npm run dev     # http://localhost:3000
```

## Migrations (Drizzle Kit)

| Command | Purpose |
|---|---|
| `npm run db:generate` | Generate a migration from schema changes in `lib/db/schema` |
| `npx drizzle-kit generate --custom --name=<name>` | Scaffold a hand-written SQL migration (RLS, functions, triggers, grants) |
| `npm run db:migrate` | Apply pending migrations (uses `DIRECT_URL`) |
| `npm run db:check` | Check migration history consistency |

Rules of thumb:
- The Drizzle schema describes tables, columns, constraints and indexes. **Policies, functions, triggers, grants and roles live in custom SQL migrations** — never define policies with `pgPolicy` (two sources of truth).
- Separate each statement in custom SQL with `--> statement-breakpoint` (the migrator runs statements one at a time).
- Never edit an already-applied migration; add a new one.
- After changing the schema, confirm there is no drift: `npx drizzle-kit generate` should print *"No schema changes, nothing to migrate"*.
- Production: run `npm run db:migrate` against the production project **before** deploying code that needs it, then `npm run db:verify`.

Migration history: `0000_baseline` (tables) → `0001_triggers_and_functions` → `0002_rls_policies` → `0003_onboarding_function` → `0004_app_role`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `npm run lint` | `tsc --noEmit` · ESLint |
| `npm test` | Vitest (see below) |
| `npm run db:*` | generate · migrate · check · seed · verify |

## Tests

`npm test` needs no Docker or external services (it caps itself at 3 parallel workers because each DB test file boots an in-process Postgres):

- **`tests/db`** — applies the *real* Drizzle migrations to [PGlite](https://pglite.dev) with a minimal stand-in for Supabase's `auth` schema, `auth.uid()` and roles, then exercises RLS: cross-tenant read/update/delete, role escalation, owner protection, multi-tenant membership, grants, the `storeforge_app` role's privileges, the user-context transaction (identity set/cleared, no leakage between sequential/interleaved requests, rollback, malformed ids), the RLS guard, tenant context, active-tenant switching, forged tenant ids, and onboarding.
- **`tests/integration`** — the *production* path: `getDatabase()` → postgres-js (`prepare:false`) over a real wire connection as `storeforge_app`; plus tests that prove `db:verify` **passes on a correct database and fails on each of ten deliberately unsafe ones** (role bypass, inherited privileges, escalation membership, RLS disabled, extra permissive policy, public function grant, unpinned `search_path`, missing trigger, unapplied migration, unreachable database).
- **`tests/unit`** — RBAC, validation, open-redirect protection, proxy route gating, and auth server actions with Supabase Auth mocked.

**Not covered by automated tests:** real Supabase Auth behaviour (email delivery, verification links, token expiry); the Supabase pooler (Supavisor) and your project's real role privileges (that is what `db:verify` is for); true concurrent transactions (PGlite is a single backend session); browser end-to-end flows.

### Manual end-to-end checklist
1. Register → email link → land in the app → `/onboarding`.
2. Create workspace → `/dashboard` shows you as Owner.
3. Sign out → `/dashboard` redirects to `/login`; sign in again.
4. Register a second merchant in a private window, create a store; confirm neither sees the other's data.
5. Forgot password → email → `/reset-password` → new password works.

## Deploying to Vercel
1. Import the repo (framework: Next.js).
2. **Environment Variables** (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and **`DATABASE_URL`** (transaction pooler, `storeforge_app`). Do **not** add `DIRECT_URL` or any `postgres` credentials to Vercel — migrations run from your machine or CI.
3. Add the production URL and `/auth/callback` to Supabase **Redirect URLs**.
4. Run `npm run db:migrate` and `npm run db:verify` against production before the first deploy.

## Known limitations / next steps
- Team invitations, ownership transfer and member-management UI are out of scope; the RLS policies for them already exist.
- Each tenant-scoped operation opens its own short transaction (membership lookup is cached per request); expect slightly more latency than PostgREST.
- Storefront subdomain routing (`<slug>.storeforge.app`) is displayed but not served yet.
- Profile reads are limited to your own row; add a policy (or a view) when the team UI needs teammates' names.
