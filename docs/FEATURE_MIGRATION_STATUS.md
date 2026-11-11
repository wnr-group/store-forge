# Feature Migration Status

Tracks each feature's move from direct database access to the StoreForge API (NestJS).
For blockers and missing endpoints see [INTEGRATION_PROGRESS.md](./INTEGRATION_PROGRESS.md) and [MISSING_BACKEND_APIS.md](./MISSING_BACKEND_APIS.md).

## Summary

| Status | Meaning | Count |
|---|---|---|
| Done | Migrated and verified | 2 |
| Done, live check pending | Migrated; not yet checked against the live API | 11 |
| Blocked | Waiting on a missing API endpoint | 1 |
| Not started | Planned, not begun | 1 |
| N/A | Not in the product or intentionally excluded | 3 |

## Phase 1: Foundation

| Feature | API | Frontend | Status |
|---|---|---|---|
| Authentication (login, logout, refresh, session, change password) | Yes | Yes (`API_BASE_URL`) | Done (pre-existing) |
| API client, config, error mapping, tests | - | `lib/api/*` | Done |

## Phase 2: Catalog and workspace

| Feature | API | Frontend | Status |
|---|---|---|---|
| Categories | Yes | `category.service` → `category-api` | Done (pilot), live check pending |
| Collections | Yes | `collection.service` → `collection-api` | Done, live check pending |
| Products, variants, images | Yes | `product.service` → `product-api` | Done, live check pending |
| Organization / workspace resolution | Yes | `lib/tenant/api-workspace.ts` | Done, live check pending |
| Uploads (signed URLs, discard) | Signed URLs only | Stays direct | **Blocked**: no discard endpoint |

## Phase 3: Customers and inventory

| Feature | API | Frontend | Status |
|---|---|---|---|
| Customers (with order history) | Yes | `customer.service` → `customer-api` | Done, live check pending |
| Inventory and stock ledger | Yes | `inventory.service` → `inventory-api` | Done, live check pending |

## Phase 4: Team and settings

| Feature | API | Frontend | Status |
|---|---|---|---|
| Team (Owner) | Yes | `team.service` → `team-api` | Done, live check pending |
| Store settings and profile | Yes | `store-settings`, `profile` services | Done, live check pending |
| Audit logs (platform) | Yes | `admin-audit.service` | Done, live check pending |

## Phase 5: Analytics and platform admin

| Feature | API | Frontend | Status |
|---|---|---|---|
| Dashboard / analytics | Yes | `analytics.service` → `analytics-api` | Done, live check pending |
| Platform admin: organizations, admins, settings, usage | Yes | `platform*.service` | Done, live check pending |

## Phase 6: Cleanup

| Feature | API | Frontend | Status |
|---|---|---|---|
| Remove obsolete direct DB code | - | - | Not started (after staging) |

## Not migrated

| Feature | Reason |
|---|---|
| Orders (list, create, update, cancel) | N/A: not in the product |
| Invitations, billing, integrations, sign-up | N/A: not in the product |
| Template customization | N/A: excluded, stays as is |
