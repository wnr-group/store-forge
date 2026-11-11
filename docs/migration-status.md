# Migration Status

State of the move from direct database access to the StoreForge API (NestJS). The target architecture is **Next.js → NestJS API → Supabase PostgreSQL** (see [Architecture](./architecture.md)).

## Summary

- Every business operation in this app now goes through the API. The local database layer (Drizzle schema, migrations, Supabase clients, DB scripts) has been removed.
- The `API_MODULES` per-module switch and the direct sign-in mode no longer exist. `API_BASE_URL` and `AUTH_BFF_SECRET` are required.
- **Not yet verified live.** Everything has been checked with unit tests that run the real client against a local HTTP server or mock the endpoint layer. Nothing has been run against a live Supabase project and the running API. See [Testing](./testing.md).

## Feature status

| Feature | Frontend | Status |
|---|---|---|
| Authentication (login, logout, refresh, session, change password) | `services/auth.service.ts`, `lib/auth/*` | Done |
| API client, config, error mapping | `lib/api/*` | Done |
| Categories | `category.service` → `category-api` | Migrated, live check pending |
| Collections | `collection.service` → `collection-api` | Migrated, live check pending |
| Products, variants, images | `product.service` → `product-api` | Migrated, live check pending |
| Uploads (signed URLs) | `uploads/actions.ts` → `upload-api` | Migrated, live check pending |
| Workspace resolution | `lib/tenant/api-workspace.ts` | Migrated, live check pending |
| Customers (with order history) | `customer.service` → `customer-api` | Migrated, live check pending |
| Inventory and stock ledger | `inventory.service` → `inventory-api` | Migrated, live check pending |
| Dashboard and analytics | `analytics.service` → `analytics-api` | Migrated, live check pending |
| Team (Owner) | `team.service` → `team-api` | Migrated, live check pending |
| Store settings and profile | `store-settings`, `profile` services | Migrated, live check pending |
| Platform Admin: organizations, admins, settings, usage, audit logs | `platform*.service`, `admin-audit.service` | Migrated, live check pending |
| Public storefront and branding | `storefront.service`, `platform-settings.service` | Migrated, live check pending |
| Remove obsolete direct database code | | Done on this branch |
| Template customization | `/dashboard/templates` | Removed: shows "Coming soon" |

## Not in the product

These were in the original integration brief but do not exist in the app, so no API was built for them.

| Item | Note |
|---|---|
| Order list, details, create, update, cancel | Orders appear only in customer history and analytics. Needs a product decision before any API |
| Discounts and taxes on orders | No such model |
| Invitations, billing, integrations, sign-up | Accounts are created by an Owner or Platform Admin |
| Tenant-side ownership transfer | Platform Admin only |
| Organization creation by tenants | Platform Admin only. Users cannot self-onboard |
| Tenant audit logs and usage | Platform Admin only |

## Open items

1. **Live verification** against staging with the running API, following the checklist in [Testing](./testing.md).
2. **Template customization.** `/dashboard/templates` shows "Coming soon", and `/s/[slug]` renders from `getPublicStorefront` with the template settings the API returns. Bringing editing back needs a templates module in the API, and a decision on settings, versions and publishing.
3. **Workspace latency.** Workspace resolution costs two API calls per request plus the API's own transactions. Measure before relying on it under load.
4. **Host-based store sign-in.** On a store host, workspace resolution makes one `GET /organizations/current` call per membership and matches only the primary store. An endpoint that resolves a store address for a member would avoid this.
5. **Unused template files.** `components/templates/template-picker.tsx` and `components/storefront/engine/*` are no longer imported and can be deleted.
6. **End-to-end tests.** Playwright (`npm run test:e2e`) has not been run against this branch.
7. **Removed QA tests.** `tests/unit/engine-benchmark.test.ts`, `evidence-phase2.test.ts` and `evidence-tooling.test.ts` were removed because they imported `scripts/qa/*` modules that were never committed.
