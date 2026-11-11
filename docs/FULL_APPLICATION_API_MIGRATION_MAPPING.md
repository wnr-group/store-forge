# Full Application API Migration - Mapping

Every business operation of the frontend, the existing NestJS endpoint it uses, and how the request and response are adapted. Base `/api/v1`. **No backend endpoint was created or modified**; every endpoint below already existed (reused). Swagger (`/api/docs`) is the contract of record.

Conventions: **Org** = `X-Organization-Id` is sent (the DB-verified active tenant; the API re-checks membership). Dates arrive as ISO strings and are converted to `Date`. Money fields `*Minor` are minor units, computed by the API. Errors: the API envelope `{success:false, message, error:{code, details}}` becomes `AppError` (400/422 VALIDATION, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 429 RATE_LIMITED, 5xx/network generic). Module = the `API_MODULES` name that switches it.

## Tenant / store admin

| Module | Frontend operation (service function) | Method + endpoint | Org | Request (frontend -> API) | Response -> frontend shape | Status |
|---|---|---|---|---|---|---|
| categories | listCategories | GET `/categories` | yes | - | `CategoryApi[]` -> `CategoryRow[]` (+tenantId, Dates) | Migrated |
| | getCategory | GET `/categories/:id` | yes | - | 404 -> `null` | Migrated |
| | create / update / delete | POST / PATCH / DELETE `/categories[/:id]` | yes | `{name, slug?, description, parentId}` as-is | `{id}` / void | Migrated |
| collections | listCollections / getCollection / listProductOptions | GET `/collections`, `/:id`, `/product-options` | yes | - | rows with `productCount`; detail with ordered `productIds` | Migrated |
| | create / update / delete | POST (with client `id`) / PATCH / DELETE | yes | `{id?, name, slug?, description, status, imagePath, productIds}` | `{id}` / void | Migrated |
| products | listProducts | GET `/products` | yes | `q,status,category,stock,sort,dir,page` -> `search,status,category,stock,sortBy,sortOrder,page,limit=20` | list item -> `ProductRow` | Migrated |
| | getProduct | GET `/products/:id` | yes | - | flat detail -> `{product, options, variants, images, collectionIds}` (child rows get the product's dates) | Migrated |
| | createProduct / updateProduct | POST / PATCH `/products[/:id]` | yes | `ProductValues` unchanged (prices are decimal text parsed with the store currency; update omits `id`) | `{id}` | Migrated |
| | deleteProducts / setProductsStatus | POST `/products/bulk-delete`, `/bulk-status` | yes | `{ids}` / `{ids,status}` | `{count}` -> number | Migrated |
| | duplicateProduct | POST `/products/:id/duplicate` | yes | - | `{id}` | Migrated |
| inventory | listInventory | GET `/inventory` | yes | `q,stock,page` -> `search,stock,page,limit` | `InventoryRow` page | Migrated |
| | listAdjustments | GET `/inventory/adjustments?limit` | yes | - | rows (+tenantId, Date) | Migrated |
| | adjustStock | POST `/inventory/adjustments` | yes | `{productId, variantId, mode, value, reason, note}` | `{quantity}` | Migrated |
| customers | listCustomers | GET `/customers` | yes | `q,sort,dir,page` -> `search,sortBy(created->createdAt),sortOrder,page,limit` | `CustomerRow` page | Migrated |
| | getCustomer | GET `/customers/:id` | yes | - | customer + last 50 orders (orders rebuilt with tenantId/customerId) | Migrated |
| | create / update / delete | POST / PATCH / DELETE `/customers[/:id]` | yes | `{fullName,email,phone,notes}` | `{id}` / void; duplicate e-mail 409 | Migrated |
| analytics | getAnalytics | GET `/analytics?range` | yes | `range` (timezone arg unused: the API reads the store's) | `Analytics` (recent orders -> Dates) | Migrated |
| store | updateStoreSettings / isCurrencyLocked | PATCH / GET `/store` | yes | whole form `{name,slug,description,contactEmail,contactPhone,currency,timezone,logoPath}` | `currencyLocked` | Migrated |
| profile | getOwnProfile / updateOwnName | GET / PATCH `/users/me` | no | `{fullName}` | `{fullName}`; session rotated through `/auth/refresh` afterwards | Migrated |
| team | listTeam | GET `/team/members` | yes | - | `TeamMemberRow[]` | Migrated |
| | createMember / updateMember / setMemberStatus / removeMember / resetMemberPassword | POST / PATCH `/:userId` / PATCH `/:userId/status` / DELETE / POST `/:userId/password` | yes | as the forms | `{userId,email}` / void | Migrated |
| workspace | memberships + active tenant + primary store (`loadWorkspaceData`) | GET `/organizations`, GET `/organizations/current` | no / yes | cookie or host only *selects among* the API's memberships | `TenantMembership[]`, `Store` | Migrated (host mode: one `/organizations/current` per membership, primary store only - see STATUS) |
| tenant audit logs / usage | - | - | - | - | - | N/A: do not exist in the product (platform only) |
| orders | - | - | - | - | - | N/A: no order list/CRUD in the product, none in the API (orders appear in customer history and analytics only) |

## Platform Admin (no organization header; API returns 403 to non-admins)

| Module | Operation | Method + endpoint | Notes | Status |
|---|---|---|---|---|
| platform | admin check (`isPlatformAdmin`, `getPlatformAdminLevel`, `requireSuperAdmin`) | GET `/platform/me` | 403 = not an admin | Migrated |
| | overview | GET `/platform/overview` | recent -> Dates | Migrated |
| | list organizations | GET `/platform/organizations` | `q,status,sort,dir,page,pageSize` -> `search,status,sortBy,sortOrder,page,limit`; the API clamps a page past the end | Migrated |
| | organization detail | GET `/platform/organizations/:id` | `{company, store, team}`; 404 -> `null` | Migrated |
| | create organization + owner | POST `/platform/organizations` | API checks the address, creates the account, provisions, compensates | Migrated |
| | update / delete / status / store | PATCH `/:id`, DELETE `/:id`, PATCH `/:id/status`, PATCH `/:id/store` | delete also removes orphaned sign-ins and files (API) | Migrated |
| | add / status / remove member | POST `/:id/members`, PATCH `/:id/members/:userId/status`, DELETE `/:id/members/:userId` | | Migrated |
| | transfer / recover ownership | POST `/:id/ownership/transfer`, `/recover` | | Migrated |
| | admins list / add / set level / remove | GET/POST `/platform/admins`, PATCH/DELETE `/platform/admins/:userId` | super admin for writes | Migrated |
| | settings read / update | GET/PATCH `/platform/settings` | diff-only audit in the API | Migrated |
| | audit logs / audit admins | GET `/platform/audit-logs`, `/audit-logs/admins` | filters -> `action,admin,org,search,from,to,page,limit` | Migrated |
| | usage: org, table, summary, inactive, new-orgs series | GET `/platform/organizations/:id/usage`, `/platform/usage[...]` | counts/bytes only | Migrated |
| | admin rate limit (`enforceAdminRateLimit`) | applied by the API on every mutating route | frontend skips it in API mode to avoid double counting | Migrated |
| | write audit entry (`recordAudit`) | done inside the API's own mutations | only used by the legacy DB path | n/a in API mode |

## Public / other

| Module | Operation | Endpoint | Status |
|---|---|---|---|
| platform | public branding (`getPublicBranding`, cached 5 min, falls back to defaults) | GET `/public/branding` (anonymous) | Migrated |
| storefront | public storefront (`getPublicStorefront`) | GET `/public/storefronts/:slug` (anonymous); camelCase mapped back to the `PublicStorefront` shape; 404 = no store | Migrated |
| auth | login / logout / refresh / session / change password | `/auth/*` | Already migrated before this work; untouched |

## Not migrated (blocked; no endpoint, needs approval)

| Operation | Where | Why blocked | What is needed |
|---|---|---|---|
| Template customization: read/save settings, draft/publish/rollback, engine cutover | `services/template-settings.service.ts`, `storefront-template.service.ts`, `engine-cutover.service.ts`, `lib/db/template-settings-upsert.ts`, dashboard `templates/*` | The API deliberately has **no template endpoints** (its Swagger test asserts it). The earlier brief excluded templates; this brief lists "theme and template data" as in scope | **Approval to add a templates module to the API** (and a decision on the design: settings, versions, publish) |
| Upload discard (`uploads/discard.ts`) and `removeUnreferencedObjects` | `services/storage-references.service.ts` | API has `POST /uploads/signed-urls` but no discard endpoint | Endpoint to remove unreferenced objects (or approval to keep it direct as a Storage-plus-reference-check exception) |
| Upload signing (`uploads/actions.ts` -> `lib/storage/server.ts`) | | Not split from discard: one workflow, left whole | Same decision as above, then switch signing to `POST /uploads/signed-urls` |
| Store address -> organization lookup for a signed-in member (host mode) | `lib/tenant/api-workspace.ts` | No such endpoint; implemented with one `GET /organizations/current` per membership (primary store only) | Optional: an endpoint resolving a store address for members |
