# Frontend Direct Database Access Audit

Target architecture: **Next.js -> NestJS API -> Drizzle ORM -> Supabase PostgreSQL**.

Scope: `app/`, `components/`, `lib/`, `services/` (server actions and route handlers live under `app/`). `scripts/` and `tests/` are listed separately.
Search patterns: `withTenantDb`, `withAuthenticatedDb`, `withPublicContext`, `getDatabase()`, imports of `drizzle-orm` / `@/lib/db*`,
`tx.`/`db.` `select|insert|update|delete|execute`, `` sql` ``, Supabase `.from("...")` / `.rpc(...)`, `API_MODULES`.
Not verified against a live Supabase project; everything below is from static search and unit tests.

## Totals

| | Occurrences |
|---|---|
| Before migration (HEAD `7890cd5`, app + components + lib + services, excluding `lib/db/schema`) | **318** across 30 files |
| Removed | **258** |
| Remaining | **60** across 12 files, all documented below |
| Remaining in migrated business modules | **0** |

Nothing under `app/` or `components/` touches the database. The `API_MODULES` switch and every database fallback are gone from migrated services.
Both are enforced by `tests/unit/no-direct-db-static.test.ts`, which fails if any migrated file regains a database import, SQL, or fallback,
or if any file outside the allow-list below gains direct access.

Type-only imports of row types from `@/lib/db/schema` and constants from `@/lib/db/schema/enums` remain. They run no query.

## 1. Business data migrated (class 1, done)

All use the centralized API client in `lib/api`. API errors are surfaced as `AppError`; there is no database fallback.

| Module | File | Status |
|---|---|---|
| Categories | `services/category.service.ts` | Migrated, 0 occurrences |
| Collections | `services/collection.service.ts` | Migrated |
| Products | `services/product.service.ts` | Migrated (upload signing/Storage unchanged, see class 3) |
| Inventory | `services/inventory.service.ts` | Migrated |
| Customers | `services/customer.service.ts` | Migrated |
| Analytics / dashboard | `services/analytics.service.ts` | Migrated |
| Team | `services/team.service.ts` | Migrated |
| Store settings | `services/store-settings.service.ts` | Migrated |
| Profile | `services/profile.service.ts` | Migrated |
| Store | `services/store.service.ts` | Migrated |
| Tenant / memberships | `services/tenant.service.ts`, `lib/tenant/api-workspace.ts` | Migrated |
| Public storefront data | `services/storefront.service.ts` | Migrated |
| Platform admin (companies, overview, ownership) | `services/platform.service.ts`, `lib/auth/platform.ts` | Migrated |
| Platform settings / team / usage | `services/platform-settings.service.ts`, `platform-team.service.ts`, `platform-usage.service.ts` | Migrated |
| Admin audit log | `services/admin-audit.service.ts`, `lib/admin/audit.ts` | Migrated |
| Removed as dead code | `lib/auth/provisioning.ts`, `lib/supabase/admin.ts` | Deleted |

## 2. Remaining occurrences

| # | File | Function(s) | Module | Operation | API endpoint exists? | API-integrated? | Class | Action | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `services/template-settings.service.ts` (8) | `getTemplateSettings`, `saveTemplateSettings` | Template customization | `select` stores, `select`/upsert `store_template_settings` via `withTenantDb` | No | No | **4** Template customization (approved exception) | Keep unchanged | Retained |
| 2 | `lib/db/template-settings-upsert.ts` (3) | `upsertTemplateSettings` | Template customization | upsert `store_template_settings` | No | No | **4** | Keep (helper of #1) | Retained |
| 3 | `services/storefront-template.service.ts` (12) | `loadStorefrontPage`, `loadStorefrontPageIfEnabled` | Template engine / public storefront render | `select public.get_public_template_layout / get_public_storefront / get_public_product / get_public_collection / get_public_collections` via `withPublicContext` | No (the API's public storefront endpoints return catalog data, not template layouts) | No | **4** Template customization (rendering side) | Keep unchanged | Retained |
| 4 | `services/engine-cutover.service.ts` (4) | `isEngineReadEnabled` | Template engine | `select public.template_engine_cutover_complete()` | No | No | **4** | Keep unchanged | Retained |
| 5 | `services/storage-references.service.ts` (9) | `lockStoragePaths`, `findReferencedPaths`, `verifyObjectsUnderLock`, `removeUnreferencedObjects` | Image upload / discard | `pg_advisory_xact_lock`, reference scan over `store_template_settings`, products, etc. | **No** upload-discard / reference-check endpoint | No | **3** Supabase Storage workflow (approved: "complete upload workflow") and **6** | Keep; needs backend endpoint to migrate | Retained, **blocked** |
| 6 | `lib/tenant/context.ts` (4) | `withTenantDb` | Tenant context helper | Opens an authenticated transaction (`withAuthenticatedDb`) | n/a (workspace resolution itself already uses `api-workspace.ts`) | Workspace: yes. Helper: used only by #1 and #5 | **4** / **3** (infrastructure for the retained callers) | Delete when #1 and #5 go | Retained |
| 7 | `lib/security/rate-limit.ts` (6) | `enforceLoginRateLimit` | Authentication | `select public.rate_limit_login(...)` via `withPublicContext` | Yes: the API applies the same limiter when `AUTH_API_URL` is set | Yes in API sign-in mode; direct code runs only in direct Supabase sign-in mode | **2** Authentication/session | Keep; remove with direct sign-in mode | Retained |
| 8 | `lib/supabase/server.ts` (2) | doc comment and `withAuthenticatedDb` note | Auth/session | Comment text only, no query | n/a | n/a | **2** | None | Retained |
| 9 | `lib/storage/server.ts` (removed) | Storage | Signed upload URLs now come from `POST /uploads/signed-urls` via `lib/api/endpoints/upload-api.ts`; the browser still PUTs the file to Supabase Storage | Yes | Yes | **3** | Migrated; the unused `verifyObjects`/`removeObjects` were deleted (the API verifies and removes objects when a record is saved) | Done, runtime check pending |
| 10 | `lib/db/index.ts` (2), `tenant-db.ts` (2), `user-context.ts` (7), `relations.ts` (1), `lib/db/errors.ts`, `lib/db/schema/*` | Drizzle client, transaction/RLS helpers, schema | Shared DB infrastructure | Connection and helpers, no business query | n/a | n/a | **5** Needed by #1, #3, #4, #5, #7 and by `scripts/` and tests | Remove once those are gone | Retained |

Counts in parentheses are from the final search and sum to the 60 remaining (excluding `lib/db/schema`, `lib/storage/server.ts` and `lib/db/errors.ts`,
which match no search pattern but are listed for completeness).

## 3. Outside the app (not part of the frontend request path)

| Location | Use | Class |
|---|---|---|
| `scripts/seed.ts`, `seed-demo-data.ts`, `lib/demo-seed.ts`, `lib/demo-data.ts` | Dev seeding via the privileged `DIRECT_URL` | 5 (tooling) |
| `scripts/verify-db.ts`, `scripts/lib/verify.ts` | RLS/DB verification | 5 (tooling) |
| `scripts/create-platform-admin.ts`, `resync-legacy-templates.ts` | One-off ops scripts | 5 (tooling) |
| `tests/db/*` | Tests against a real database | 5 (tests) |

## 4. Blocked operations (need backend work or an approved exception)

No endpoint contract has been invented and the backend was not modified.

| Operation | Frontend impact | Needed from the backend |
|---|---|---|
| Template settings read/save (`GET/PUT` store template settings) | `/dashboard/templates` | A templates module, or keep as an approved exception (current choice) |
| Public template layout and engine cutover gate | Public storefront rendering at `/s/[slug]` | Public template-layout endpoint and cutover flag endpoint, or keep as exception |
| Storage reference check and unreferenced-object removal (upload discard) | `app/(dashboard)/dashboard/uploads/discard.ts`, template save | Upload-discard / reference-check endpoint |
| Product-image signed upload URLs | Image upload | Done: `requestUploadsAction` calls `POST /uploads/signed-urls`. Still needs a live check against Supabase |

## 5. Modules

- **Fully migrated (no direct DB access):** categories, collections, products, inventory, customers, analytics, team, store settings, profile, store, tenant/workspace, public storefront data, platform admin, platform settings/team/usage, admin audit.
- **Requiring backend endpoints or approval:** template customization, template rendering and cutover gate, storage reference check.
- **Retained by approval:** Supabase Auth and session handling, Supabase Storage upload workflow, template customization.

## 6. Verification (2026-11-10)

| Check | Result |
|---|---|
| Repository-wide search | 318 -> 60, remaining files all listed above |
| Unit tests (`vitest run tests/unit`) | 2038 passed, 2 failed, plus 2 files failing to load. All four are unrelated to this work: `evidence-tooling` and `evidence-phase2` import `scripts/qa/*` and `tests/e2e/support/evidence`, which do not exist in the repo; `engine-cutover-static` expects at least 3 pages under `app/s/[slug]` (HEAD has 1); `timing-config` lists `tests/integration/storefront-roundtrip*`, which does not exist. The earlier status doc recorded the same failures before this work. |
| `tsc --noEmit` | Errors only in `tests/e2e/*`, `playwright.config.ts` (`@playwright/test` not installed) and the evidence tests above. None in `app/`, `components/`, `lib/`, `services/`. |
| `npm run lint` | 0 errors, 1 unrelated warning (`.claude/skills/unslop/scripts/story.mjs`) |
| `npm run build` | Compiles, then fails the type check on the same test files listed above. Not caused by this change. |
| Live Supabase / live API | **Not performed.** Service tests use mocked API responses. |

## 7. Update: uploads (2026-11-10)

- `app/(dashboard)/dashboard/uploads/actions.ts` now asks the API for signed URLs (role check kept; the API derives the folder from the verified organization).
- The browser still sends the file to Supabase Storage with the returned `signedUrl` and needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public values) for the `apikey` header, image URLs (`publicImageUrl`) and `next.config.ts`.
- `lib/storage/server.ts` and `lib/supabase/server.ts` are removed; nothing imports them. `@supabase/ssr` stays (session cookie parsing in `lib/auth/nest-api.ts`) and `@supabase/supabase-js` stays as its peer dependency.
- Only tested with mocked API responses (`tests/unit/uploads-api.test.ts`). Not tested against a live API or Supabase.

## 8. Update: Supabase SDKs removed from the frontend (2026-11-10)

- `lib/auth/nest-api.ts` no longer imports `@supabase/ssr`. It reads the session cookie the API sets (`sb-<ref>-auth-token`, optionally chunked `.0`, `.1`, value `base64-<base64url JSON>`) with a small local decoder (Web APIs only, so it also works in the proxy). The API still writes the cookie, so the format, the `HttpOnly`/`SameSite=Lax`/host-only attributes and the refresh flow in `proxy.ts` are unchanged; no backend change was needed.
- `@supabase/ssr` and `@supabase/supabase-js` are removed from `package.json` and the lockfile. No code imports either.
- Still required and kept: `NEXT_PUBLIC_SUPABASE_URL` (browser upload target, `publicImageUrl`, `next.config.ts` image host) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`apikey` header on the direct browser upload).
- Covered by `tests/unit/auth-api-mode.test.ts` (cookie decoding: UTF-8, chunks, plain JSON, corrupt cookie). Not tested against a live API or Supabase.
