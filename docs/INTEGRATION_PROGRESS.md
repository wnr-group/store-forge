# Integration Progress

## 2026-11-10 - Phase 1 (audit + foundation) and categories pilot

**Done**
* Audited both repos (`FRONTEND_BACKEND_INTEGRATION_AUDIT.md`); established that business data access is Drizzle in `services/*`, not Supabase `.from()`.
* Re-ran the API baseline: 184 DB-backed tests pass, 78/78 routes succeeded.
* Added `lib/api/{config,client}.ts`, `lib/api/endpoints/category-api.ts`, per-module switch `API_MODULES` (documented in `.env.example`).
* Categories delegate to the API when enabled; old path untouched.
* Tests added: `tests/unit/api-client.test.ts` (14), `tests/unit/category-service-api.test.ts` (7). Lint clean on all touched files; no type errors in touched files.

**Not done / needs you**
* Live verification against Supabase (needs `.env.local` with real credentials and the API running). Not performed here.
* All other modules (see `FEATURE_MIGRATION_STATUS.md`).

**Decision needing your approval**: API is called server-side with the cookie's token instead of `NEXT_PUBLIC_API_URL` from the browser (rationale in `FRONTEND_BACKEND_ARCHITECTURE.md`).

Nothing committed, pushed or deployed. Changes are uncommitted on `fix/api-endpoints` in the frontend; the API repo was not modified.

## 2026-11-10 (later) - collections and customers

* `lib/api/endpoints/{collection,customer}-api.ts`; `collection.service` and `customer.service` delegate when `API_MODULES` lists `collections` / `customers`.
* Behaviour notes: customer list/detail now check `customers:view` before calling (the API requires it anyway; the page guard already did). Customer order rows are rebuilt with `tenantId`/`customerId` and `createdAt = placedAt` because the API's order DTO omits them (the customer pages only read the fields the API returns).
* Tests: `tests/unit/collection-customer-service-api.test.ts` (8). Total new tests: 29, all passing; lint and types clean for touched files.
* Still pending: live verification; products, inventory, analytics and the rest.

## 2026-11-10 (later still) - products, inventory, analytics, store, profile, team

* New endpoint modules: `product-api`, `inventory-api`, `analytics-api`, `store-api`, `profile-api`, `team-api`. New `API_MODULES` entry: `profile`.
* **Products**: the form values (`ProductValues`) go to the API unchanged - its DTO was ported from the same schema, and prices stay decimal text that the API parses with the store currency. The frontend's `checkVariants` still runs first (same messages). The API's flat detail is rebuilt into `{ product, options, variants, images, collectionIds }`; child rows get the product's `createdAt/updatedAt` because the API omits them. Bulk delete/status return `{ count }`.
* **Analytics**: the API reads the store's own timezone/currency; the `timezone` argument is only used by the database path.
* **Profile**: after the API renames the user the session is rotated through `/auth/refresh` exactly as before so the account menu shows the new name.
* **Team**: the API creates the Auth account and compensates (deletes it) if linking fails; the frontend's `parseInput` validation still runs first.
* **Stays direct (blocker)**: `uploads/actions.ts` (signing via the user's own Supabase session) and `uploads/discard.ts` (`removeUnreferencedObjects`). The API offers `POST /uploads/signed-urls` but **no endpoint to discard unreferenced uploads**; migrating signing alone would split one flow across two systems. Needs a decision: add a discard endpoint to the API, or keep both direct. `products/actions.ts` still reads the store currency through `requireWorkspace()` (workspace resolution, migrated last).
* Tests: 49 new unit tests in 6 files, all passing. Full suite: 2505 passed, the same 6 pre-existing failures, no new ones. Lint clean on all touched files.
* Still not migrated: platform admin area (companies, members, ownership, settings, admins, audit, usage), workspace resolution, public storefront/branding, uploads signing/discard.

## 2026-11-10 - full application pass (see FULL_APPLICATION_API_MIGRATION_*.md)

Platform Admin area, workspace resolution, public storefront and branding now have API paths (flags `platform`, `organizations`, `storefront`). The authoritative mapping, status, direct-database audit and remaining work are in `FULL_APPLICATION_API_MIGRATION_MAPPING.md` and `FULL_APPLICATION_API_MIGRATION_STATUS.md`; this file and `FEATURE_MIGRATION_STATUS.md` are the earlier, per-module history.
