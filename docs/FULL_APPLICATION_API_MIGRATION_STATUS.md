# Full Application API Migration - Status

Updated 2026-11-10. Branch `fix/api-endpoints` (frontend), all changes uncommitted. The API repo (`D:\store-forge-api`) was **not modified**. No real credentials, no production modules, no migrations.

## Honest summary

* **Every business operation that has a backend endpoint can now be served by the NestJS API.** Verified only with unit tests that run the real client against a local HTTP server or mock the endpoint layer. **Nothing has been verified against a live Supabase project or the running API.**
* **The final acceptance criterion is NOT met yet**, for three reasons: (1) the old direct-database code paths are still in the repo as the rollback while nothing has been verified live; (2) template customization and upload discard have no API endpoints (blocked, need approval); (3) `API_MODULES` still decides which path runs.
* Because of (1) and (3), **do not describe the migration as complete.**

## Module flags (`API_MODULES`, server env, needs `AUTH_API_URL`)

`categories, collections, products, inventory, customers, analytics, team, store, profile, storefront, organizations, platform` - or `*`. Unset = previous behaviour. Unknown names throw at startup of the first request.

| Flag | Covers |
|---|---|
| categories, collections, products, inventory, customers, analytics | the tenant catalog, stock, customers and dashboard |
| store | store settings (+ currency lock) |
| profile | own name |
| team | Owner's team management |
| organizations | workspace resolution (memberships, active tenant, primary store) |
| storefront | public storefront |
| platform | the whole Platform Admin area, the admin check, public branding, admin rate limiting |

## Migration status by module

| Area | Status |
|---|---|
| Authentication | Done before this work (untouched) |
| Categories, collections, products, inventory, customers, analytics | **Migrated**, flag-switched, unit-tested, live check pending |
| Store settings, profile, team | **Migrated**, same |
| Workspace resolution | **Migrated** (flag `organizations`), unit-tested, live check pending. Limitation: on a store host one `GET /organizations/current` per membership and only the primary store matches (the old query matched any store of the tenant); a suspended organization/revoked membership simply does not match |
| Public storefront, public branding | **Migrated**, same |
| Platform Admin (all) | **Migrated**, same |
| Orders, tenant audit logs, tenant usage, invitations | N/A - do not exist in the product |
| Template customization | **Blocked** - no API endpoints; needs approval to add a backend module |
| Upload signing + discard | **Blocked** - no discard endpoint; whole flow stays direct until decided |
| Remove legacy direct paths and `API_MODULES` | **Not started** - deliberately, until live verification |

## Application-wide direct database audit (Next.js repo)

Searched for Drizzle imports, `withTenantDb`/`withAuthenticatedDb`/`withPublicContext`, `getDatabase`, `tx.execute`, Supabase `.from()/.rpc()` across `app`, `lib`, `services`, `components`, `proxy.ts`, `instrumentation.ts`.

* **`app/`, `components/`, `proxy.ts`, `instrumentation.ts`: zero direct database access.** There are no Next.js API routes that touch the database.
* Supabase `.from()` / `.rpc()`: **none** anywhere (the frontend always used Drizzle for business data).

Classification of what remains:

| # | Class | Files | Notes |
|---|---|---|---|
| 1 | **Business data, API path exists, legacy path still present (rollback)** | `services/{category,collection,product,inventory,customer,analytics,team,store-settings,profile,platform,platform-settings,platform-team,platform-usage,admin-audit,storefront}.service.ts`, `services/tenant.service.ts` + `services/store.service.ts` (used by `lib/tenant/context.ts`), `lib/auth/platform.ts`, `lib/security/rate-limit.ts` (admin limiter) | Must be deleted once live verification passes; then the flag disappears |
| 2 | **Business data, blocked (no endpoint)** | `services/{template-settings,storefront-template,engine-cutover}.service.ts`, `lib/db/template-settings-upsert.ts`, `services/storage-references.service.ts` | See "Not migrated" in the mapping doc |
| 3 | Authentication/session (retained by design) | `lib/auth/{session,nest-api,provisioning,use-signed-in}.ts`, `lib/supabase/*`, `services/auth.service.ts`, direct-mode login limiter in `lib/security/rate-limit.ts` | Auth only; none returns business data. `provisioning.ts` (Auth Admin API) is used only by legacy paths |
| 4 | Supabase Storage (retained, no DB) | `lib/storage/{server,paths}.ts`, `components/products/image-uploader.tsx`, `app/(dashboard)/dashboard/uploads/*` | Signed upload with the user's own session; blocked together with discard |
| 5 | Infrastructure for class 1/2 | `lib/db/{index,tenant-db,user-context,relations,errors}.ts`, `lib/db/schema/*` | Removed with the legacy paths (schema stays as the migration source: the Next.js repo owns migrations `drizzle/0000-0024`) |

**No path falls back silently.** In API mode a failed API call raises an `AppError` (generic message for 5xx/network, logged) - it never retries against the database. The only "fallback" is the whole-module switch (`API_MODULES`), which is a deployment choice, not a runtime fallback. Public branding falls back to default text on failure, as it did before (a settings problem must never block sign-in).

## Security and tenant isolation

* Frontend permission checks run first (same messages); the API re-authorizes every call (roles read from Postgres, never from the token or request).
* Organization id sent = the DB-verified active tenant. In API mode the active tenant comes from the API's own membership list; a forged cookie value or store host matches nothing. A wrong id gets 403 (`ORGANIZATION_ACCESS_DENIED`) from the API.
* Platform Admin: decided by `GET /platform/me` (database function behind it); no tenant business data is exposed to platform endpoints; tenant users get 403 there.
* RLS untouched; the API runs each request as the user (RLS-as-user, superuser connections refused).
* No tokens in browser code or storage; the API is called only from the Next.js server using the HttpOnly cookie's token.
* Tested here: permission-before-call for every write, 403/404 mapping, forged preference/host, suspended org, non-admin never reaching platform endpoints. The API repo's own tests (184 DB-backed, RLS in PGlite) cover tenant isolation on the server; **not re-run against Supabase**.

## Test results (2026-11-10)

| Check | Result |
|---|---|
| New unit tests (this work) | 9 files, **71 tests, all passing**: `api-client`, `category-service-api`, `collection-customer-service-api`, `inventory-analytics-service-api`, `product-service-api`, `store-profile-team-service-api`, `platform-service-api`, `workspace-api`, `storefront-service-api` |
| Full frontend suite | 2527 passed, **6 failed, 10 files failed - all pre-existing** (missing `scripts/qa/*` and `tests/e2e/support/evidence`, template/provisioning/security-audit DB tests, `engine-cutover-static`, stale `timing-config` allow-list entry); identical before and after this work |
| ESLint (whole repo) | 0 errors; 1 existing warning in `.claude/skills/unslop/scripts/story.mjs` |
| `tsc --noEmit` | No errors outside the pre-existing baseline (missing `@playwright/test`, missing `scripts/qa`) |
| `next build` | Compiles successfully (Turbopack); **fails at the type-check step on the same pre-existing baseline errors** in files this work did not touch. I did not re-run the build on a clean checkout to prove the failure is identical |
| API repo (`store-forge-api`) | Not changed. Earlier today: 184 DB-backed tests pass, 78/78 routes succeed |
| Frontend E2E (Playwright) | Not run: `@playwright/test` is not installed in this checkout |
| Live Supabase / running API | **Not performed** |

## Required environment (server-only)

`AUTH_API_URL` (e.g. `http://localhost:4000/api/v1`), `AUTH_BFF_SECRET` (32+ chars, same as the API), `API_MODULES`. No `NEXT_PUBLIC_API_URL`: the browser never calls the API (tokens are HttpOnly). Existing Supabase/Storage variables unchanged.

## Remaining work to reach the API-only architecture

1. **Decisions/approvals**: (a) add a templates module to the API (or keep template data direct as an approved exception); (b) add an upload-discard endpoint (or approve Storage + reference check as a direct exception) - then switch upload signing to `POST /uploads/signed-urls`.
2. **Live verification** per module with a staging Supabase project and the running API, following `REGRESSION_TEST_PLAN.md` (all five roles, cross-tenant attempts, host-based store login, image upload/delete, platform actions, session refresh).
3. **Then remove** the class-1 legacy paths, the `API_MODULES` switch (hard-wire the API), `lib/db/*` runtime code that nothing uses, and `provisioning.ts` if unused; re-run the audit expecting only classes 3-4.
4. Latency check: the workspace now costs 2 API calls per request plus the API's own two transactions; measure before enabling `organizations` broadly.
5. Run Playwright E2E once its dependency is installed.
