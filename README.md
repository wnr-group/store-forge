# StoreForge

## 1. Overview

StoreForge is a multi-tenant e-commerce SaaS foundation. It is **admin-controlled**: there is no public sign-up. A StoreForge **Platform Admin** creates each company (tenant), its first store and its Owner account. The Owner then creates Manager and Staff accounts for their own company. Every company's data is isolated from every other company's by PostgreSQL Row Level Security (RLS), so one company can never see another's data.

**What is built:** provisioned accounts and sign-in, the Platform Admin area, company provisioning, team management, tenant isolation, role-based access and the merchant dashboard.

**What is not built yet:** checkout, order creation, payments and public storefronts. Orders are read-only in the dashboard, so analytics and customer totals stay empty until a checkout service writes orders.

## 2. Features

| Area | What it does |
|---|---|
| Auth | Email and password sign-in for provisioned accounts, sign out, self-service password change. No public registration, no email verification |
| Platform Admin | Separate `/admin` area: list companies, create a company with its store and Owner, suspend or reactivate it, reset an Owner's password |
| Team members | Owners add Managers and Staff, edit name and role, deactivate, remove and reset passwords |
| Company provisioning | Company, store and Owner membership created in one database transaction; the Auth account is rolled back if that fails |
| Overview / Analytics | Sales, orders, customers, average order value, sales chart, best sellers, recent orders, low stock (empty until orders exist) |
| Products | Server-side search, filters, sorting and pagination; bulk publish, draft and delete; editor with images, pricing, inventory, variants and organization |
| Variants | Options such as Size or Color generate combinations, each with its own SKU, price, image and stock |
| Categories / Collections | Hierarchical categories; hand-picked collections with an image and draft/active status |
| Inventory | One row per sellable unit, low and out-of-stock states, locked adjustments and a ledger. Stock never goes negative |
| Customers | Search, pagination, detail view with order history, add/edit/delete |
| Settings | Store profile, contact, currency and timezone (owner/admin only) and your own account |
| Themes | Light, dark and system themes |
| Product images | Uploaded straight to Supabase Storage through one-time signed URLs (JPEG/PNG/WebP, max 5 MB) |

Money is stored as integer minor units in the store currency, so the currency is locked once products or orders exist.

## 3. Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui, Base UI, Recharts, Lucide icons
- **Forms and validation:** React Hook Form, Zod
- **Auth:** Supabase Auth (`@supabase/ssr`) for sign-in; the Admin Auth API (server-side only) to provision accounts
- **Database:** Supabase PostgreSQL with Drizzle ORM and `postgres-js`
- **File storage:** Supabase Storage
- **Testing:** Vitest, with PGlite for database tests (no Docker needed)

## 4. Architecture

- **Supabase Auth** manages users, passwords and sessions.
- **Drizzle ORM** handles all application data. The app connects through the Supabase transaction pooler as a limited role, `storeforge_app`.
- **RLS is the real security boundary.** For each request the app opens a transaction, sets the user's identity and switches to the `authenticated` role, so RLS policies apply. Everything resets when the transaction ends.
- `storeforge_app` cannot bypass RLS or switch to `postgres`, `anon` or `service_role`. The app refuses to start if `DATABASE_URL` uses `postgres`.
- App-level checks (`requireTenantAccess`, `requireTenantRole`) deliberately duplicate RLS.
- Companies are created only by the `platform_provision_tenant()` database function, which requires the caller to be in the private `platform_admins` table. The old self-service `create_tenant_with_store()` no longer exists.
- **Platform Admin is not a tenant role.** It is a separate table that the API cannot read or write. A Platform Admin can never also be a tenant member (database trigger), and a tenant Owner is never a Platform Admin.
- The Supabase service-role key is read in exactly one module (`lib/supabase/admin.ts`) and used only for Admin Auth calls (create a confirmed user, set a password, delete a user). It is never used for database queries or Storage, and a test fails if that changes.
- A suspended company or a deactivated membership loses all access at the database level, because every RLS policy goes through `is_tenant_member()` / `has_tenant_role()`, which now require both to be active.

```
app/          Routes: (auth)/login, (admin)/admin/* (Platform Admin), (dashboard)/dashboard/* (company workspace)
components/   UI (ui/ = shadcn), dashboard/ shell, one folder per feature
config/       Environment validation and constants
lib/          db/ (schema, RLS-aware client), auth/, tenant/, storage/, validations/, money
services/     One service per area (product, category, collection, inventory, customer, analytics, store, profile, platform, team)
drizzle/      SQL migrations (source of truth for the database)
scripts/      db:verify and db:seed
tests/        db/, integration/, unit/
proxy.ts      Session refresh and route protection
```

**Migrations:** the Drizzle schema defines tables, columns and indexes. Policies, functions, triggers, grants and roles live in custom SQL migrations. Never edit an applied migration; add a new one. Create one with `npx drizzle-kit generate --custom --name=<name>` and separate statements with `--> statement-breakpoint`.

**Storage:** migration `0006` creates the public-read `products` bucket. Paths are `{tenant_id}/{product_id}/{file}`, `{tenant_id}/collections/{id}/{file}` and `{tenant_id}/store/{file}`, and policies check tenant membership from the first path segment.

## 5. Installation

**Requirements**

- Node.js 20.9 or newer
- npm
- Git
- A free [Supabase](https://supabase.com) account. A hosted Supabase project is required; there is no local database mode.

**Steps**

```bash
git clone https://github.com/wnr-group/store-forge.git
cd store-forge
npm install
```

Then continue with sections 6 and 7. Once those are done, start the app:

```bash
npm run dev
```

Open http://localhost:3000/login. There is no registration page: create the first Platform Admin as described in section 7, step 4, and sign in with it.

## 6. Environment Setup

**Step 1. Create a Supabase project** and copy the Project URL and anon key from Project Settings → API.

**Step 2. Configure Auth** in Supabase under Authentication:

- Keep the Email provider enabled (email and password sign-in).
- **Disable public sign-ups**: Authentication → Sign In / Providers → turn **off** "Allow new users to sign up". The app has no sign-up page, but the Supabase sign-up endpoint is reachable with the public anon key, so this switch is what closes it. (Even if it were left on, a self-created account has no workspace and no way to create one, but turn it off.)
- You do **not** need to configure SMTP or redirect URLs. Provisioned accounts are created already confirmed through the Admin Auth API, so no email is sent and no verification is required. Leaving "Confirm email" on is fine; it only affects sign-ups, which are disabled.

**Step 3. Create your env file.**

```bash
cp .env.example .env.local          # macOS / Linux / Git Bash
Copy-Item .env.example .env.local   # Windows PowerShell
```

**Step 4. Fill in the variables.**

| Variable | Purpose | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth and image URLs | Project URL from step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth | Anon key from step 1 |
| `NEXT_PUBLIC_APP_URL` | Public origin of the app | `http://localhost:3000` (your production URL when deployed) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Tenant subdomains (`<store>.<root>`) | `lvh.me:3000` locally; `store-forge.com` in production. Empty disables subdomain routing |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Admin Auth API for provisioning accounts (never database queries) | `service_role` key from Project Settings → API |
| `DIRECT_URL` | Migrations, seed, verify only | `postgres` user. Direct connection `db.<ref>.supabase.co:5432`, or the **session pooler** (port 5432) if your network has no IPv6 |
| `DATABASE_URL` | The running app | **Transaction pooler** (port 6543), user `storeforge_app.<project-ref>` |

Find the connection strings in Supabase → Connect. Notes:

- Percent-encode special characters in passwords (for example `@` becomes `%40`).
- Never prefix database variables or the service-role key with `NEXT_PUBLIC_`; they must stay server-only.
- The service-role key bypasses RLS. Keep it out of git, chat and logs, rotate it if it leaks, and only set it where the server runs (for example as a Vercel server-side Environment Variable).
- Don't fill in the `storeforge_app` password in `DATABASE_URL` yet. You set it in the next section.

## 7. Database Setup

**Step 1. Apply migrations.** This creates the tables, RLS policies, functions, storage bucket and the `storeforge_app` role.

```bash
npm run db:migrate
```

If it fails on `GRANT authenticated TO storeforge_app`, run that one statement in the Supabase SQL Editor as the project owner, then run `npm run db:migrate` again.

**Step 2. Set the app role's password.** The migration creates `storeforge_app` without a password. In the Supabase SQL Editor run:

```sql
ALTER ROLE storeforge_app WITH PASSWORD '<long random password>';
```

Put that password into `DATABASE_URL` in `.env.local`.

**Step 3. Verify isolation.**

```bash
npm run db:verify                  # full check; temporary test users are cleaned up
npm run db:verify -- --read-only   # connection and catalog checks only
```

Only the message `ALL CHECKS PASSED` means the setup is correct. Re-run it after any migration, policy or grant change.

**Step 4. Create the first Platform Admin.** This is the only way to create one; there is no web flow, API or policy that can promote a user, so nobody can make themselves an admin. Run it from a trusted machine. The password is read from the environment, not from the command line, so it does not end up in shell history:

```bash
PLATFORM_ADMIN_PASSWORD='<at least 12 characters>' npm run admin:create -- --email you@yourcompany.com --name "Your Name"
# PowerShell: $env:PLATFORM_ADMIN_PASSWORD='<password>'; npm run admin:create -- --email you@yourcompany.com --name "Your Name"
```

It uses `SUPABASE_SERVICE_ROLE_KEY` to create a confirmed Auth user and `DIRECT_URL` to add it to `platform_admins`. If the email already has an Auth account it is promoted instead (unless that account is already a company member: use a separate account). Sign in at `/login`; Platform Admins land on `/admin`. Change the password afterwards under **Change password** in the account menu.

**Step 5 (optional). Seed demo data.** For development projects only. It creates demo users with a publicly known password, so never run it against production.

```bash
npm run db:seed -- --confirm-dev
```

**Step 6 (optional). Seed a demo store.** `npm run db:seed:demo` creates one dedicated demo store, **Urban Nest** (slug `urban-nest-demo`), with 26 products (57 variants), 8 categories, 6 collections, 28 customers, 46 orders over the last 90 days and an inventory ledger, plus four dummy logins (a company Owner, Manager and Staff, and a Platform Admin). **Local/dev projects only: the passwords are public, so never run it against a real project.** It refuses to run when `NODE_ENV` or `VERCEL_ENV` is `production`, needs `SEED_DEMO_DATA=true`, and is safe to re-run (existing rows are skipped).

```bash
SEED_DEMO_DATA=true npm run db:seed:demo
# PowerShell: $env:SEED_DEMO_DATA='true'; npm run db:seed:demo
```

| Role | URL | Email | Password |
|---|---|---|---|
| Owner (runs the demo store) | http://localhost:3000/login | owner@demo.test | Demo1234 |
| Manager (`admin` role) | http://localhost:3000/login | admin@demo.test | Demo1234 |
| Staff | http://localhost:3000/login | staff@demo.test | Demo1234 |
| Platform Admin (lands on `/admin`) | http://localhost:3000/login | platform@demo.test | Demo1234 |

To make an existing confirmed user the owner instead, set `SEED_DEMO_USER_EMAIL=you@example.com`; the dummy logins are then not created.

**Troubleshooting**

| Problem | Fix |
|---|---|
| App refuses to start | `DATABASE_URL` is using `postgres`. Use `storeforge_app.<project-ref>` on port 6543 |
| `db:migrate` can't connect | Your network may lack IPv6. Use the session pooler (port 5432) in `DIRECT_URL` |
| Authentication or password errors | Check that special characters in the password are percent-encoded |
| `Missing or invalid environment variable: SUPABASE_SERVICE_ROLE_KEY` when creating a company | Add the server-side key to `.env.local` (or the host's environment) and restart |
| A user signs in and sees "No workspace available" | Their membership is deactivated or their company is suspended. A Platform Admin or the Owner can reactivate it |
| A user forgot their password | There is no email recovery. The Owner resets a member's password (Team members → Reset password); a Platform Admin resets an Owner's (company page) |

## 8. Roles

| Role | Scope | Can |
|---|---|---|
| Platform Admin | Whole platform | Sign in to `/admin`; list companies; create a company with its store and Owner; suspend or reactivate a company; reset an Owner's password. **No access to any company's catalog, customers or orders** |
| Owner | One company | Everything in the company, including Team members (add, edit, deactivate, remove, reset passwords), store settings and deletes |
| Manager (`admin` in the database) | One company | Edit store settings, delete catalog data and customers; create and edit everything else. Cannot manage the team |
| Staff | One company | View the dashboard; create and edit catalog data, stock and customers. Cannot delete or change store settings |

The middle role is stored as `admin` because the RLS policies reference it, and it is shown as **Manager** everywhere in the UI so it is never confused with the StoreForge Platform Admin.

Rules are defined in two places that must be kept in sync: `lib/auth/permissions.ts` (app) and the RLS migrations in `drizzle/` (database). Roles are never taken from the browser: a member's role comes from their membership row, and the Owner role can only be created by company provisioning.

## 9. Accounts and Workflows

**Public registration is disabled.** There is no sign-up, email verification or "forgot password" page, and those routes and actions are removed (not just hidden). Unauthenticated visitors can only see the landing page and `/login`. A user who nevertheless obtained an Auth account has no workspace and no way to create one.

**1. Platform Admin account.** Created once with `npm run admin:create` (section 7, step 4). Sign in at `/login`.

**2. Creating a company** (Platform Admin → Companies → Create company). Enter the company name, store name and store address, optional contact number, address and description, and the Owner's name, email and **initial password**. On submit the server:

1. verifies the caller is a Platform Admin (database check, not a cookie or form field) and validates the input;
2. checks the store address is free (no account is created for an obviously bad request);
3. creates the Owner's Auth account through the Admin Auth API, **already confirmed** (the profile row comes from a database trigger);
4. calls `platform_provision_tenant()`, which creates the company, store and Owner membership in one transaction;
5. if step 4 fails, deletes the Auth account again (an ambiguous failure is retried once first, because the function is idempotent), so no orphaned account or half-created company remains. Duplicate emails and store addresses are reported as field errors.

**3. Owner.** Signs in at `/login` with the email and initial password and lands on the company dashboard. They should change the password immediately under **Settings → Change password**.

**4. Team members** (Owner → Team members). The Owner enters name, email, initial password and role (Manager or Staff). The server checks the caller is the Owner of their active company, creates a confirmed Auth account, and inserts the membership as the Owner, so RLS independently refuses another company, the `owner` role or self-assignment. The company is never taken from the request. The Owner can edit a member's name and role, deactivate or reactivate them (instantly cuts access, reversible), remove them (also deletes their sign-in), and reset their password. Owners cannot touch the Owner row or any Platform Admin.

**5. Members sign in** at `/login` with the email and password the Owner gave them and only see what their role allows.

**6. Suspending a company** (Platform Admin → company page). All of the company's users lose access immediately; nothing is deleted. Reactivate to restore access.

**Handling initial passwords.** Passwords are never displayed or retrievable after creation (Supabase stores only a hash). The person who creates an account chooses the initial password, passes it on through a secure channel (a password manager share or in person, not plain chat or email), and the user changes it at first sign-in. A forgotten password is replaced by an admin-assisted reset: the Owner for members, the Platform Admin for Owners. Password rules (8-72 characters, a letter and a number) apply to every flow. This documentation, `.env.example` and the repository contain no real passwords or keys.

**7. Store subdomains.** Each company's first store is served publicly at `<store-address>.<root domain>`: `http://urban.lvh.me:3000` locally (`lvh.me` and every subdomain of it resolve to 127.0.0.1, so no hosts-file edits) and `https://urban.store-forge.com` in production. Set `NEXT_PUBLIC_ROOT_DOMAIN` (`lvh.me:3000` locally, `store-forge.com` in production, no scheme) and restart the dev server.

- The proxy (`proxy.ts`) rewrites a request for `<slug>.<root>` to the public page `app/s/[slug]`. It reads only the Host header, so the slug is a hint, not an identity.
- The page shows the store name, logo, description and **active** products, read through one database function, `get_public_storefront()`. Anonymous visitors still have no table access; the function returns `null` (a 404) for unknown, reserved, inactive and suspended stores, and never returns costs, SKUs, stock, customers or orders.
- **Each store host has its own sign-in and dashboard.** `http://mart-com.lvh.me:3000/login` signs in on that host and `/dashboard` there is that store's dashboard. The proxy sets an internal `x-sf-store` header from the Host (it deletes any client-supplied copy first), and the workspace is then the company that owns that store: a user who is not a member of it gets "No workspace available", not their own company. Cookies are per host, so signing in on one store never signs you in on another or on the root domain. The storefront header has a **Store login** link.
- `/admin` (Platform Admin) and the unauthenticated landing page exist **only on the root domain**; on a store host `/admin` is a 404.
- Reserved names (`www`, `app`, `api`, `admin`, ...) are never treated as stores. The Platform Admin's company page shows each store's URL.
- Production DNS: add a wildcard record `*.store-forge.com` pointing at Vercel and add both `store-forge.com` and `*.store-forge.com` to the Vercel project (a wildcard domain needs Vercel nameservers or a DNS challenge). Requires migration 0009.

**Deployment (Vercel).** Set these as Environment Variables for Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (the production origin), `NEXT_PUBLIC_ROOT_DOMAIN` (`store-forge.com`), `DATABASE_URL` (transaction pooler, `storeforge_app`) and `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`). `DIRECT_URL` is only for running migrations and `admin:create` from a trusted machine or CI and is not needed at runtime. Run `npm run db:migrate` and `npm run db:verify` before the first deploy, turn off public sign-ups in Supabase, and create the Platform Admin.

## 10. Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run all tests with Vitest (no Docker or external services needed) |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations (uses `DIRECT_URL`) |
| `npm run db:check` | Check migration history |
| `npm run db:verify` | Verify roles, RLS and isolation on the real database |
| `npm run db:seed` | Seed development data (`-- --confirm-dev` required) |
| `npm run db:seed:demo` | Seed the Urban Nest demo store and Owner/Manager/Staff/Platform Admin logins (see Database Setup) |
| `npm run admin:create` | Create (or promote) a Platform Admin: `-- --email you@example.com`, password from `PLATFORM_ADMIN_PASSWORD` |
