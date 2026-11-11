# StoreForge

## 1. Overview

StoreForge is a multi-tenant e-commerce SaaS foundation. It is **admin-controlled**: there is no public sign-up. A StoreForge **Platform Admin** creates each company (tenant), its first store and its Owner account. The Owner then creates Manager and Staff accounts for their own company. Every company's data is isolated from every other company's by PostgreSQL Row Level Security (RLS), so one company can never see another's data.

**What is built:** provisioned accounts and sign-in, the Platform Admin area, company provisioning, team management, tenant isolation, role-based access, the merchant dashboard and a public storefront page for each store.

**What is not built yet:** checkout, order creation, payments and template customization (`/dashboard/templates` shows "Coming soon"). The public storefront is a single page per store. Orders are read-only in the dashboard, so analytics and customer totals stay empty until a checkout service writes orders.

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
- **API:** the StoreForge API (NestJS, repository `store-forge-api`) owns business logic, authorization, tenant isolation and all database access (Drizzle ORM and Supabase PostgreSQL live there)
- **Auth:** Supabase Auth, reached through the StoreForge API; this app only relays its HttpOnly session cookies
- **File storage:** Supabase Storage (signed uploads from the API)
- **Testing:** Vitest

## 4. Architecture

- **Next.js -> StoreForge API -> Supabase PostgreSQL.** This app has no database client, no SQL, no Drizzle and no migrations. Every business operation goes through the API client in `lib/api`, using the signed-in user's access token and the active organization.
- **Authentication** goes through the API (`/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/session`, `/auth/change-password`). The session lives in HttpOnly cookies set by the API and relayed by `services/auth.service.ts` and `proxy.ts`. State-changing calls carry the shared `AUTH_BFF_SECRET`, so the API accepts them from this server without a browser `Origin`.
- **RLS and tenant isolation are enforced by the API and the database.** The app-level checks (`requireTenantAccess`, `requireTenantRole`) are the friendly early refusal, not the only protection.
- **Storage.** The browser uploads images straight to Supabase Storage using one-time signed URLs from the API (`POST /uploads/signed-urls`). The API derives the tenant folder from the verified organization. See `docs/architecture.md`.
- Companies are created only by the `platform_provision_tenant()` database function, which requires the caller to be in the private `platform_admins` table. The old self-service `create_tenant_with_store()` no longer exists.
- **Platform Admin is not a tenant role.** It is a separate table that the API cannot read or write. A Platform Admin can never also be a tenant member (database trigger), and a tenant Owner is never a Platform Admin.
- This app creates and deletes no Auth accounts and holds no service-role key: the StoreForge API does that. It also runs no database queries.
- A suspended company or a deactivated membership loses all access at the database level, because every RLS policy goes through `is_tenant_member()` / `has_tenant_role()`, which now require both to be active.

- **Products and collections are tenant-wide.** They belong to a company, not to a single store, so a company's stores share one catalog.

```
app/          Routes: (auth)/login, (admin)/admin/* (Platform Admin), (dashboard)/dashboard/* (company workspace)
components/   UI (ui/ = shadcn), dashboard/ shell, one folder per feature
config/       Environment validation and constants
lib/          api/ (API client), auth/, domain/ (row types, enums), tenant/, storage/, validations/, money
services/     One service per area (product, category, collection, inventory, customer, analytics, store, profile, platform, team)
tests/        unit/ (and e2e/)
proxy.ts      Session refresh and route protection
```

**Database schema and migrations** live in the `store-forge-api` repository (`src/database/migrations`, `npm run db:migrate`). They are not part of this app.

**Storage:** images live in the public-read `products` bucket, created by the database setup in `store-forge-api`. Paths are `{tenant_id}/{product_id}/{file}`, `{tenant_id}/collections/{id}/{file}` and `{tenant_id}/store/{file}` (the store logo), and policies check tenant membership from the first path segment.

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
| `API_BASE_URL` | **Server only.** Base URL of the StoreForge API (required) | `http://localhost:4000/api/v1` locally |
| `AUTH_BFF_SECRET` | **Server only.** Shared secret, 32+ characters, the same value as `AUTH_BFF_SECRET` in the API | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Notes:

- Never prefix `API_BASE_URL` or `AUTH_BFF_SECRET` with `NEXT_PUBLIC_`; they must stay server-only. The browser never calls the API.
- This app holds no database credentials and no service-role key.

## 7. Database Setup

The database is set up from the **`store-forge-api`** repository, not from this app: apply the migrations (`npm run db:migrate`), verify the schema (`npm run db:verify-schema`), create the first Platform Admin (`npm run admin:create`) and, for development projects only, seed demo data (`npm run db:seed:demo`). See that repository's README. Then start the API and point `API_BASE_URL` / `AUTH_BFF_SECRET` here at it.

**Troubleshooting**

| Problem | Fix |
|---|---|
| Login shows "Something went wrong" | The API answered an unexpected status. Check that `API_BASE_URL` is reachable and that `AUTH_BFF_SECRET` is the same value in this app and in the API (a mismatch gives `CSRF_ORIGIN_REQUIRED`, 403) |
| "The StoreForge API is not configured" | Set `API_BASE_URL` and `AUTH_BFF_SECRET` in `.env.local` and restart |
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

Rules are defined in two places that must be kept in sync: `lib/auth/permissions.ts` (app) and the RLS migrations in the `store-forge-api` repository (database). Roles are never taken from the browser: a member's role comes from their membership row, and the Owner role can only be created by company provisioning.

## 9. Accounts and Workflows

**Public registration is disabled.** There is no sign-up, email verification or "forgot password" page, and those routes and actions are removed (not just hidden). Unauthenticated visitors can only see the landing page and `/login`. A user who nevertheless obtained an Auth account has no workspace and no way to create one.

**1. Platform Admin account.** Created once with `npm run admin:create` in the `store-forge-api` repository (section 7). Sign in at `/login`.

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
- The public storefront page (`app/s/[slug]`) reads anonymous, read-only data from the API (`GET /public/storefronts/:slug`). Unknown, reserved, inactive and suspended stores return 404, and responses never include costs, stock quantities, customers or draft content. Template customization is not available yet (`/dashboard/templates` shows "Coming soon").
- **Each store host has its own sign-in and dashboard.** `http://mart-com.lvh.me:3000/login` signs in on that host and `/dashboard` there is that store's dashboard. The proxy sets an internal `x-sf-store` header from the Host (it deletes any client-supplied copy first), and the workspace is then the company that owns that store: a user who is not a member of it gets "No workspace available", not their own company. Cookies are per host, so signing in on one store never signs you in on another or on the root domain. The storefront header has a **Store login** link.
- `/admin` (Platform Admin) and the unauthenticated landing page exist **only on the root domain**; on a store host `/admin` is a 404.
- Reserved names (`www`, `app`, `api`, `admin`, ...) are never treated as stores. The Platform Admin's company page shows each store's URL.
- Production DNS: add a wildcard record `*.store-forge.com` pointing at Vercel and add both `store-forge.com` and `*.store-forge.com` to the Vercel project (a wildcard domain needs Vercel nameservers or a DNS challenge).

**Deployment (Vercel).** Set these as Environment Variables for Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (the production origin), `NEXT_PUBLIC_ROOT_DOMAIN` (`store-forge.com`), `API_BASE_URL` and `AUTH_BFF_SECRET` (server only, never `NEXT_PUBLIC_`). Deploy and migrate the StoreForge API first, turn off public sign-ups in Supabase, and create the Platform Admin from the API repository.

## 10. Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run all tests with Vitest (no database, Docker or API needed) |
