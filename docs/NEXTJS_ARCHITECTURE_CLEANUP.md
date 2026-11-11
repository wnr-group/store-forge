# Next.js Architecture Cleanup

Target: **Next.js -> NestJS API -> Supabase PostgreSQL**. Companion to `FRONTEND_DIRECT_DATABASE_ACCESS_AUDIT.md` (per-function list of remaining direct access).
Date: 2026-11-10. Nothing committed. The NestJS repo (`D:\store-forge-api`) was only read, apart from the `.env.example` line you asked for earlier.

## Summary

Business data already goes through the API (see the audit). The database stack **cannot be removed yet**, because four features
that must keep working still query PostgreSQL and have no API endpoint. Only genuinely dead code was removed; everything else is classified below.

Classes: **1** safe to remove, **2** must be preserved, **3** replace with an existing API, **4** blocked (no endpoint), **5** needs a decision/verification.

## Findings

| # | Item | Used by | Class | Action |
|---|---|---|---|---|
| 1 | `getServiceRoleKey()` in `config/env.ts` | Nothing (pointed at the deleted `lib/supabase/admin.ts`) | 1 | **Removed** |
| 2 | `lib/supabase/client.ts` (browser Supabase client) | Nothing imports it | 1 | **Removed** |
| 3 | Stale comments naming `lib/supabase/admin.ts` / "application queries" in `.env.example`, README | docs | 1 | **Fixed** |
| 4 | `API_MODULES`, `NEXT_PUBLIC_API_URL` | No code reference | 1 | Already gone; not in `.env.example` |
| 5 | `pg` package | Not a dependency (the driver is `postgres`) | - | Nothing to remove |
| 6 | `drizzle-orm`, `postgres`, `lib/db/*`, `lib/db/schema/*`, `DATABASE_URL`, `DIRECT_URL` | Template customization, public template engine, upload reference check, direct-mode rate limiter, plus `tests/db`, `scripts/` | 4 / 2 | **Kept** (see "Blocked") |
| 7 | `services/template-settings`, `storefront-template`, `engine-cutover`, `storage-references` | Template customization and the upload workflow (approved exceptions) | 4 | **Kept** |
| 8 | Supabase Storage (`lib/storage/*`, `components/products/image-uploader.tsx`, `NEXT_PUBLIC_SUPABASE_*`) | Upload workflow | 2 | **Kept**, untouched |
| 9 | Authentication through the API: `lib/auth/nest-api.ts`, `session.ts`, `services/auth.service.ts`, `proxy.ts`, `AUTH_API_URL`, `AUTH_BFF_SECRET` | Login, logout, refresh, password change, cookies | 2 | **Kept**, untouched |
| 10 | Direct (Supabase) sign-in mode: `signInDirect/signOutDirect/changePasswordDirect`, direct branch of `getCurrentUser`, `lib/supabase/middleware.ts` refresh, `enforceLoginRateLimit`, `rate_limits` schema, `RATE_LIMIT_SECRET` | Only when `AUTH_API_URL` is unset | 5 | **Kept.** It is an auth-path fallback; you asked for the auth flow to stay unchanged. Removing it makes `AUTH_API_URL` mandatory and deletes one of the DB users. Needs your decision. |
| 11 | `@supabase/ssr`, `@supabase/supabase-js` | `lib/supabase/server.ts` (Storage with the user's session, direct-mode auth), `middleware.ts` | 2 | **Kept** (Storage needs them) |
| 12 | `drizzle/` migrations (0000-0024), `drizzle.config.ts`, `drizzle-kit`, `db:generate/migrate/check` | Schema migrations, `lib/db/schema` is its source | 5 | **Kept.** The API repo now has its own copy of all 25 migrations (identical except `0004_app_role.sql`) and its own `db:migrate`, so **two repos can migrate the same database with separate journals**. One must be declared the owner. Removing the frontend copy also breaks `tests/db/harness.ts` and `tests/integration/verify-db.test.ts`, which read `drizzle/`, i.e. the tests of the template code that stays. |
| 13 | `scripts/seed*.ts`, `verify-db.ts`, `create-platform-admin.ts`, `resync-legacy-templates.ts` | Dev tooling, RLS verification, template resync | 5 | **Kept.** The API has equivalents for admin creation, seeding and schema verification, but not template resync. Remove with #12 once ownership is decided. |
| 14 | Orphan UI files: `components/analytics/sales-chart.tsx`, `storefront/store-auth-actions.tsx`, `ui/scroll-area.tsx`, `ui/separator.tsx`, `ui/tabs.tsx` | Nothing imports them | 5 | **Kept**: not database-related, outside this task's scope |

## Blocked (no existing API endpoint; no endpoint was invented)

| Operation | Why it blocks removing Drizzle |
|---|---|
| Template settings read/save (`/dashboard/templates`) | No templates module in the API |
| Public template layout and engine cutover gate (`/s/[slug]`) | No public template-layout endpoint (the API has `public` catalog endpoints only) |
| Upload discard / storage reference check | The API has only `POST /uploads/signed-urls`. It has `storage-references.service.ts` internally but exposes no endpoint for it |

Once the API exposes those three, the frontend can drop `drizzle-orm`, `postgres`, `lib/db`, `DATABASE_URL`, and the direct-mode code.

## Environment variables

| Variable | Status |
|---|---|
| `AUTH_API_URL`, `AUTH_BFF_SECRET` | Kept (required) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` | Kept (Storage, proxy, subdomains) |
| `DATABASE_URL` | Kept, comment now says it is only for the endpoint-less features |
| `DIRECT_URL` | Kept (migrations/scripts only; never used by the running app) |
| `SUPABASE_SERVICE_ROLE_KEY` | Kept, comment corrected: only `admin:create` and the direct-mode rate-limit fallback read it. Not needed on Vercel otherwise. |
| `RATE_LIMIT_SECRET` | Kept (direct mode only) |
| `API_MODULES`, `NEXT_PUBLIC_API_URL` | Not present anywhere |

Real `.env*` files were not read for values or changed.

## Decisions needed from you

1. **Migration owner.** Make the API repo the only schema owner and retire frontend `drizzle/`, `db:migrate`, `db:generate`, `db:check` (and move or drop `tests/db` that depends on them), or keep both with a documented rule. Running both against the shared database is the main risk found here.
2. **Direct sign-in fallback.** Remove it (require `AUTH_API_URL`) or keep it.
3. **API endpoints** for templates, public template layout and upload discard, so Drizzle can be removed from the frontend.

## Verification (2026-11-10)

| Check | Result |
|---|---|
| `tsc --noEmit` | No errors in `app/ components/ lib/ services/ config/`. Errors remain only in `tests/e2e`, `playwright.config.ts` (`@playwright/test` not installed) and evidence tests (missing `scripts/qa/*`), all unchanged from before. |
| `eslint` | 0 errors, 1 unrelated warning |
| Unit tests | 2038 pass; 2 failed + 2 files fail to load, same four as before this change and unrelated to it |
| `next build` | Last run before these edits: compiles, fails type-check on the same test files. **Not re-run after these edits.** |
| Search for direct DB access | Unchanged: 60 occurrences in the files listed in the audit, none in business modules |
| Not tested | Login/logout/refresh/password change, uploads, template pages and tenant isolation in a browser or against a live API/Supabase. None of that was exercised; only static checks and unit tests ran. |

## Update: template engine removed from Next.js

- `/dashboard/templates` shows "Coming soon". `/s/[slug]` no longer uses the template engine or the cutover gate: it renders from the API (`getPublicStorefront`) with the store's saved template settings, which the API returns.
- Deleted: `services/{storefront-template,engine-cutover,template-settings}.service.ts`, `lib/db/template-settings-upsert.ts`, `lib/templates/legacy-resync.ts`, `scripts/resync-legacy-templates.ts`, the templates `actions.ts` and `templates-workspace.tsx`, and the tests that only covered them (`tests/db/{engine-cutover-gate,legacy-resync,template-settings,template-settings-service,template-image-references}`, `tests/integration/storage-reference-locks.pg`, `tests/unit/{storefront-template-service,engine-cutover-static}`, `tests/e2e/{cutover-gate,templates}.spec.ts`).
- Still using the database, so Drizzle stays: `services/storage-references.service.ts` (product image upload calls `discardUploadsAction`; no API endpoint for it) and `lib/security/rate-limit.ts` (direct sign-in mode only), with `lib/tenant/context.ts#withTenantDb` and `lib/db/*`.
- Drizzle can now be removed once the API offers an upload-discard endpoint and the direct sign-in fallback is dropped.
- Left in place, now unused: `components/templates/template-{picker,preview}.tsx`, `components/storefront/engine/*`, template tables and migrations.
- Checks: tsc clean in app code; unit tests 2024 pass, failures only the 3 files that were already failing (evidence tests need missing `scripts/qa/*`, stale `timing-config` allow-list); lint 0 errors; build compiles then fails type-check only on the same e2e/evidence test files. Not tested in a browser or against a live API.
