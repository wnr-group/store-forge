# StoreForge

Multi-tenant e-commerce SaaS foundation: sign-up/login, merchant onboarding, tenant isolation with PostgreSQL Row Level Security (RLS), and role-based access.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase Auth · Drizzle ORM · Supabase PostgreSQL

> **Scope:** foundation only. Products, orders, payments and public storefronts are not built yet.
>
> **Status:** RLS is tested on in-process PostgreSQL (PGlite), **not yet verified on Supabase**. It counts as verified only when `npm run db:verify` ends with `ALL CHECKS PASSED` (see [Setup](#setup), step 5).

## How it works

- **Supabase Auth** handles users, passwords and sessions.
- **Drizzle ORM** handles all application data. The app connects through the Supabase transaction pooler as a limited role, `storeforge_app`.
- **RLS** in the database is the real security boundary. For each request, the app opens a transaction, sets the user's identity, and switches to the `authenticated` role, so RLS policies apply. Everything resets when the transaction ends.
- `storeforge_app` cannot bypass RLS or switch to `postgres`, `anon` or `service_role`. The app refuses to start if `DATABASE_URL` uses `postgres`.
- App-level checks (`requireTenantAccess`, `requireTenantRole`) duplicate RLS on purpose.
- Workspaces are created only through the `create_tenant_with_store()` database function, in a single transaction.

### Roles

| Role  | Can |
|---|---|
| owner | Everything: workspace, stores, members, deletes |
| admin | Edit workspace and stores, add/remove staff |
| staff | View dashboard and store data |

Rules live in `lib/auth/permissions.ts` (app) and `drizzle/0002_rls_policies.sql` (database). Keep them in sync.

## Project structure

```
app/          Routes: (auth), (dashboard), auth/callback
components/   UI components
config/       Env validation and constants
lib/          db/ (schema, RLS-aware client), auth/, tenant/, supabase/
services/     Auth, tenant and store logic
drizzle/      SQL migrations (source of truth for the database)
scripts/      db:verify and db:seed
tests/        db/, integration/, unit/
proxy.ts      Session refresh and route protection
```

## Setup

Requires Node ≥ 20.9 and a hosted Supabase project.

**1. Create the project.** In Supabase, create a project and copy the Project URL and anon key from Settings → API.

**2. Configure Auth.** Under Authentication:
- Enable the Email provider.
- Set Site URL to `http://localhost:3000`.
- Add `http://localhost:3000/auth/callback` (and your production URL) to Redirect URLs.
- Configure custom SMTP before going live; the built-in mailer is heavily rate-limited.

**3. Set environment variables.**
```bash
cp .env.example .env.local     # PowerShell: Copy-Item .env.example .env.local
```

| Variable | Used for | Connection |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` | Auth and email links | n/a |
| `DIRECT_URL` | Migrations, seed, verify | `postgres` user. Direct (`db.<ref>.supabase.co:5432`), or the **session pooler** (port 5432) if you have no IPv6 |
| `DATABASE_URL` | The running app | **Transaction pooler** (port 6543), user `storeforge_app.<project-ref>` |

Percent-encode special characters in passwords (for example `@` becomes `%40`). Database variables are server-only, so never prefix them with `NEXT_PUBLIC_`.

**4. Migrate and create the app role.**
```bash
npm install
npm run db:migrate
```
The migration creates `storeforge_app` without a password. Set one in the Supabase SQL Editor, then put it in `DATABASE_URL`:
```sql
ALTER ROLE storeforge_app WITH PASSWORD '<long random password>';
```
If the migration fails on `GRANT authenticated TO storeforge_app`, run that statement in the SQL Editor as the project owner, then re-run the migration.

**5. Verify RLS on Supabase.**
```bash
npm run db:verify                 # full check; temporary test users are cleaned up
npm run db:verify -- --read-only  # connection and catalog checks only
```
Only `ALL CHECKS PASSED` means verified.

**6. Run.**
```bash
npm run dev     # http://localhost:3000
```

Optional, dev projects only: `npm run db:seed -- --confirm-dev` creates demo users with a publicly known password.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | Type check / ESLint |
| `npm test` | Vitest (no Docker or external services needed) |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations (uses `DIRECT_URL`) |
| `npm run db:check` | Check migration history |
| `npm run db:verify` | Verify roles, RLS and isolation on the real database |
| `npm run db:seed` | Seed dev data |

## Migrations

- The Drizzle schema defines tables, columns and indexes. Policies, functions, triggers, grants and roles go in **custom SQL migrations** (`npx drizzle-kit generate --custom --name=<name>`). Don't use `pgPolicy`.
- Separate statements in custom SQL with `--> statement-breakpoint`.
- Never edit an applied migration; add a new one.
- In production, migrate and run `db:verify` **before** deploying code that needs the change.

History: `0000_baseline` → `0001_triggers_and_functions` → `0002_rls_policies` → `0003_onboarding_function` → `0004_app_role`

## Tests

- `tests/db`: real migrations on PGlite, covering RLS, roles, grants and onboarding.
- `tests/integration`: the production path (postgres-js as `storeforge_app`) and `db:verify` itself.
- `tests/unit`: RBAC, validation, route protection and auth actions.

**Not covered:** real Supabase Auth emails, the Supabase pooler, and browser end-to-end flows. Test those manually: register → confirm email → onboarding → dashboard → sign out/in → password reset, plus a second account to confirm tenants can't see each other's data.

## Deploying to Vercel

1. Import the repo.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` and `DATABASE_URL`. **Don't** add `DIRECT_URL` or any `postgres` credentials.
3. Add the production `/auth/callback` URL to Supabase Redirect URLs.
4. Run `db:migrate` and `db:verify` against production before the first deploy.

## Known limitations

- No team invitations, ownership transfer or member-management UI yet (the RLS policies already exist).
- Storefront subdomains (`<slug>.storeforge.app`) are shown but not served.
- Users can read only their own profile row.
