# Frontend / Backend Integration Audit

Audited 2026-11-10. Frontend `D:\store-forge` (branch `fix/api-endpoints`, clean, no stashes). Backend `D:\store-forge-api` (branch `feature/nestjs-api-migration`, clean, no stashes, 78 routes).

## Key findings

1. **The frontend does not use Supabase `.from()/.rpc()` for business data.** It uses **Drizzle directly** (`lib/db`, `withTenantDb` in `lib/tenant/context.ts`) from `services/*.service.ts`, acting as the signed-in user so Postgres RLS applies. A search for `.from(`, `.rpc(` against Supabase finds only Storage and Auth usage. The migration seam is therefore the **service layer**, not the pages.
2. **The backend is already feature-complete for the existing product.** 78 routes, all implemented, tested and in Swagger (`API_READINESS_REPORT.md` in the API repo). Re-verified today: 184 database-backed API tests pass and `npm run coverage:routes` reports 78/78 routes succeeded.
3. **Authentication is already migrated** (Next.js server -> `/auth/login|logout|refresh|session`, HttpOnly cookies, CSRF/BFF secret). It is untouched by this work.
4. **Several brief items do not exist in the product** and are not invented (see `MISSING_BACKEND_APIS.md`): order create/update/delete/list, invitations, sign-up, billing, integrations, tenant-side ownership transfer (per the API repo's `EXCLUDED_FEATURES.md`, which audited the original app; re-confirm against the UI when each module is migrated).
5. **Template customization stays in Next.js** (`services/storefront-template.service.ts`, `template-settings.service.ts`, `engine-cutover.service.ts`, `lib/templates/**`). The API only reads template tables to protect Storage files.

## Frontend data access inventory

| Service | Exports (all Drizzle via `withTenantDb`/`withAuthenticatedDb`) | Used by |
|---|---|---|
| `category.service` | list, get, create, update, delete | categories page + actions, product pages |
| `collection.service` | list, get, listProductOptions, create, update, delete | collections |
| `product.service` | list, get, create, update, deleteProducts, setProductsStatus, duplicate | products |
| `inventory.service` | listInventory, listAdjustments, adjustStock | inventory |
| `customer.service` | list, get, create, update, delete | customers |
| `analytics.service` | getAnalytics | dashboard, analytics |
| `team.service` | listTeamRows, listTeam, createMember, updateMember, setMemberStatus, removeMember, resetMemberPassword | team (Owner) |
| `store-settings.service`, `store.service` | updateStoreSettings, isCurrencyLocked; stores lookup | settings, workspace resolution |
| `tenant.service`, `lib/tenant/context.ts` | memberships, active tenant | **every** page (workspace resolution) |
| `profile.service` | getOwnProfile, updateOwnName | settings |
| `storefront.service` | getPublicStorefront | public store pages |
| `platform*.service` | companies, overview, members, ownership, settings, admins, usage | `/admin` area |
| `admin-audit.service` | recordAudit, listAuditLogs, listAuditAdmins | `/admin` audit |
| `storage-references.service` | lock/verify/find/remove storage objects | called inside product/collection/store saves |
| `auth.service` | login/logout/change password | already API-backed |
| template services | **excluded** | templates |

## Intentional direct integrations (stay)

| What | Where | Why |
|---|---|---|
| Template customization/rendering | `services/*template*`, `lib/templates/**`, `components/storefront/**` | Explicitly out of scope; no backend API exists or is wanted |
| Supabase Auth Admin API (provision users) | `lib/auth/provisioning.ts` | Moves with team/platform modules (API already does it); until then unchanged |
| Storage public URL building | `lib/storage/paths.ts` | Pure string building from `NEXT_PUBLIC_SUPABASE_URL`; no data access |
| Browser image upload | `components/products/image-uploader.tsx` | Uses signed upload URLs; Phase 2 swaps the signing call to `POST /uploads/signed-urls`, the upload itself stays browser-to-Storage by design |
| Workspace resolution (`lib/tenant/context.ts`) | every request | Migrates last (see Architecture): it is on the critical path of every module |

## Backend audit summary

NestJS 12 (ESM), Drizzle (19 tables ported, no drift against the migrated DB), JWKS token verification, roles read from Postgres each request, `DatabaseService.withUser` runs each request in a transaction as the user (RLS kept on; a superuser connection is refused), ~35 SQL functions called not re-implemented, global envelope/filter/interceptor, Swagger at `/api/docs`, throttling, login rate limit. Tests: 105 unit + 155 integration (PGlite with the real migrations).

## Schema ownership decision

Unchanged and documented: the **Next.js repo owns migrations** (`drizzle/0000-0024`); the API creates none and its e2e suites apply the Next.js migrations. No schema change is needed by this integration. (Open team decision D-004 in the API repo.)

## Risks found

| Risk | Detail | Mitigation |
|---|---|---|
| Contract drift | API returns ISO strings where services return `Date`; `PATCH` is partial where server actions sent whole forms | Per-module adapters keep the service return types identical; tests assert shapes |
| Latency | API = 2 transactions/request plus a hop; frontend workspace resolution already costs ~15 round trips/page | Migrate workspace resolution last; measure before and after |
| Behaviour differences | Wrong `X-Organization-Id` is 403 (frontend silently fell back); lists capped at 100 | Frontend always sends its DB-verified tenant id; documented |
| Real-Supabase gap | API's Storage/Admin/JWKS paths verified against fakes only | Staging smoke checklist in API readiness report |
| Pre-existing frontend test failures | 6 failing tests/10 files (missing `scripts/qa/*`, template DB tests, stale timing allow-list) | Identical with and without this work; listed in `REGRESSION_TEST_PLAN.md` |
