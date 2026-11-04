# StoreForge

Multi-tenant e-commerce SaaS foundation: sign-up/login, merchant onboarding, tenant isolation with PostgreSQL Row Level Security (RLS), and role-based access.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase Auth · Drizzle ORM · Supabase PostgreSQL

> **Scope:** auth, multi-tenancy and the merchant dashboard (products, variants, categories, collections, inventory, customers, analytics, settings). Checkout, orders creation, payments and public storefronts are not built yet.
>
> **Status:** RLS and role isolation pass `npm run db:verify` (28 checks) against the real Supabase project. Re-run it after any migration, policy or grant change (see [Setup](#setup), step 5).

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

## Merchant dashboard

| Area | What it does |
|---|---|
| Overview / Analytics | Sales, orders, customers, average order value, sales chart, best sellers, recent orders, low stock. Computed from real orders; shows an empty state until the store has orders. |
| Products | Server-side search, filters, sorting and pagination; bulk publish/draft/delete; editor with images, pricing, inventory, variants and organization. |
| Variants | Options (for example Size, Color) generate combinations. Each has its own SKU, price, image and stock. |
| Categories / Collections | Categories form a hierarchy. Collections are hand-picked groups with an image and a draft/active status. |
| Inventory | One row per sellable unit, low/out-of-stock states, locked adjustments and a ledger. Stock never goes negative. |
| Customers | Search, pagination, detail with order history, add/edit/delete. |
| Settings | Store profile, contact, currency and timezone (owner/admin only) and your own account. |

**Roles:** owner, admin and staff can create and edit catalog data, stock and customers. Only owner and admin can delete them or change store settings.

**Orders are read-only.** There is no checkout yet, so the dashboard cannot create orders and `authenticated` has no INSERT privilege on `orders`. Analytics and customer totals read that table and stay empty until a checkout service writes to it.

**Money** is stored as integer minor units in the store currency, so the currency is locked once products or orders exist.

### Product images (Supabase Storage)

- Migration `0006` creates the public-read `products` bucket (5 MB, JPEG/PNG/WebP) and its policies. Locally and in tests, where there is no Storage schema, that step is skipped.
- Paths are `{tenant_id}/{product_id}/{file}`, `{tenant_id}/collections/{id}/{file}` and `{tenant_id}/store/{file}`. Policies require tenant membership from the first path segment. The `store/` folder needs owner or admin.
- The browser uploads straight to Storage through one-time signed URLs that the server issues after checking your role. Before saving, the server confirms each file exists and takes its type and size from Storage, not from the browser. The database also constrains `storage_path` to the product's own folder.
- Image rows and files change together: files are deleted only after the transaction that unlinks them commits. A file uploaded but never saved can stay behind if the browser closes first.
- The service-role key is never used.

## Project structure

```
app/          Routes: (auth), (dashboard)/dashboard/*, auth/callback
components/   UI (ui/ = shadcn), dashboard/ shell, one folder per feature
config/       Env validation and constants
lib/          db/ (schema, RLS-aware client), auth/, tenant/, storage/, validations/, money
services/     One service per area (product, category, collection, inventory, customer, analytics, store, profile)
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

- `tests/db`: real migrations on PGlite, covering RLS, roles, grants, onboarding, the catalog tables and the services (products, variants, stock, customers, analytics, settings).
- `tests/integration`: the production path (postgres-js as `storeforge_app`) and `db:verify` itself.
- `tests/unit`: RBAC, validation, route protection and auth actions.

**Not covered by automated tests:** real Supabase Auth emails, Supabase Storage (checked by `db:verify` for bucket and policies, and by hand for uploads), and browser end-to-end flows. Test those manually: register → confirm email → onboarding → dashboard → sign out/in → password reset, plus a second account to confirm tenants can't see each other's data.

## Deploying to Vercel

1. Import the repo.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` and `DATABASE_URL`. **Don't** add `DIRECT_URL` or any `postgres` credentials.
3. Add the production `/auth/callback` URL to Supabase Redirect URLs.
4. Run `db:migrate` and `db:verify` against production before the first deploy.

## Known limitations

- No team invitations, ownership transfer or member-management UI yet (the RLS policies already exist).
- No checkout, so orders cannot be created yet (see above).
- Duplicating a product copies its details and variants but not its images.
- Storefront subdomains (`<slug>.storeforge.app`) are shown but not served.
- Users can read only their own profile row.
