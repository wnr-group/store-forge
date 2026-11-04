# StoreForge

## 1. Overview

StoreForge is a multi-tenant e-commerce SaaS foundation. A merchant signs up, creates a workspace with a store, and manages their catalog from a dashboard. Every workspace's data is isolated from every other workspace by PostgreSQL Row Level Security (RLS), so one merchant can never see another's data.

**What is built:** authentication, merchant onboarding, tenant isolation, role-based access and the merchant dashboard.

**What is not built yet:** checkout, order creation, payments and public storefronts. Orders are read-only in the dashboard, so analytics and customer totals stay empty until a checkout service writes orders.

## 2. Features

| Area | What it does |
|---|---|
| Auth | Register, email confirmation, login, forgot/reset password, sign out |
| Onboarding | Creates a workspace and its first store in one database transaction |
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
- **Auth:** Supabase Auth (`@supabase/ssr`)
- **Database:** Supabase PostgreSQL with Drizzle ORM and `postgres-js`
- **File storage:** Supabase Storage
- **Testing:** Vitest, with PGlite for database tests (no Docker needed)

## 4. Architecture

- **Supabase Auth** manages users, passwords and sessions.
- **Drizzle ORM** handles all application data. The app connects through the Supabase transaction pooler as a limited role, `storeforge_app`.
- **RLS is the real security boundary.** For each request the app opens a transaction, sets the user's identity and switches to the `authenticated` role, so RLS policies apply. Everything resets when the transaction ends.
- `storeforge_app` cannot bypass RLS or switch to `postgres`, `anon` or `service_role`. The app refuses to start if `DATABASE_URL` uses `postgres`.
- App-level checks (`requireTenantAccess`, `requireTenantRole`) deliberately duplicate RLS.
- Workspaces are created only through the `create_tenant_with_store()` database function.
- The Supabase service-role key is never used.

```
app/          Routes: (auth), (dashboard)/dashboard/*, auth/callback
components/   UI (ui/ = shadcn), dashboard/ shell, one folder per feature
config/       Environment validation and constants
lib/          db/ (schema, RLS-aware client), auth/, tenant/, storage/, validations/, money
services/     One service per area (product, category, collection, inventory, customer, analytics, store, profile)
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

Open http://localhost:3000, register an account, confirm your email, and complete onboarding.

## 6. Environment Setup

**Step 1. Create a Supabase project** and copy the Project URL and anon key from Project Settings → API.

**Step 2. Configure Auth** in Supabase under Authentication:

- Enable the Email provider.
- Set Site URL to `http://localhost:3000`.
- Add `http://localhost:3000/auth/callback` to Redirect URLs.
- For anything beyond testing, configure custom SMTP. The built-in mailer is heavily rate-limited, and confirmation emails may be delayed or blocked.

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
| `NEXT_PUBLIC_APP_URL` | Email links | `http://localhost:3000` |
| `DIRECT_URL` | Migrations, seed, verify only | `postgres` user. Direct connection `db.<ref>.supabase.co:5432`, or the **session pooler** (port 5432) if your network has no IPv6 |
| `DATABASE_URL` | The running app | **Transaction pooler** (port 6543), user `storeforge_app.<project-ref>` |

Find the connection strings in Supabase → Connect. Notes:

- Percent-encode special characters in passwords (for example `@` becomes `%40`).
- Never prefix database variables with `NEXT_PUBLIC_`; they must stay server-only.
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

**Step 4 (optional). Seed demo data.** For development projects only. It creates demo users with a publicly known password, so never run it against production.

```bash
npm run db:seed -- --confirm-dev
```

**Troubleshooting**

| Problem | Fix |
|---|---|
| App refuses to start | `DATABASE_URL` is using `postgres`. Use `storeforge_app.<project-ref>` on port 6543 |
| `db:migrate` can't connect | Your network may lack IPv6. Use the session pooler (port 5432) in `DIRECT_URL` |
| Authentication or password errors | Check that special characters in the password are percent-encoded |
| Confirmation email never arrives | Check spam, wait for the rate limit to reset, or configure custom SMTP |
| Redirect or callback error after confirming email | Add `http://localhost:3000/auth/callback` to Redirect URLs in Supabase |

## 8. Roles

| Role | Can |
|---|---|
| owner | Everything: workspace, stores, members and deletes |
| admin | Edit workspace and stores, add/remove staff, delete catalog data |
| staff | View the dashboard; create and edit catalog data, stock and customers |

Owner, admin and staff can all create and edit catalog data, stock and customers. Only owner and admin can delete them or change store settings. The person who completes onboarding becomes the owner.

Rules are defined in two places that must be kept in sync: `lib/auth/permissions.ts` (app) and `drizzle/0002_rls_policies.sql` (database).

Team invitations, ownership transfer and a member-management UI do not exist yet, although the RLS policies for them are already in place.

## 9. Commands

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
