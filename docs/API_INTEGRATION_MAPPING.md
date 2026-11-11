# API Integration Mapping

Service function -> StoreForge API endpoint. Base `/api/v1`. "Org" = sends `X-Organization-Id`. Swagger (`/api/docs`) is the contract of record; this table is only the routing map.

| Module | Frontend function | Endpoint | Org | Notes / adapter work |
|---|---|---|---|---|
| categories | listCategories / getCategory | GET `/categories`, `/categories/:id` | yes | **Done.** Dates -> `Date`; `tenantId` filled from active tenant |
| | createCategory / updateCategory / deleteCategory | POST / PATCH / DELETE | yes | **Done.** Service still checks the permission first (same error) |
| collections | listCollections / getCollection / listProductOptions | GET `/collections`, `/:id`, `/product-options` | yes | `productIds` ordered |
| | create / update / delete | POST / PATCH / DELETE `/collections[/:id]` | yes | Image paths verified server-side; PATCH replaces product set |
| products | listProducts | GET `/products?page&limit&search&status&category&stock&sortBy&sortOrder` | yes | Frontend page size 20 = API default |
| | getProduct | GET `/products/:id` | yes | options+variants+images+collectionIds |
| | createProduct / updateProduct / deleteProducts | POST / PATCH `/products[/:id]`; DELETE `/:id` or POST `/bulk-delete` | yes | Client-generated `id` kept; money as decimal text |
| | setProductsStatus / duplicateProduct | POST `/products/bulk-status`, `/:id/duplicate` | yes | |
| uploads | image-uploader signing call | POST `/uploads/signed-urls` | yes | Upload itself stays browser -> Storage |
| inventory | listInventory / listAdjustments / adjustStock | GET `/inventory`, GET/POST `/inventory/adjustments` | yes | Ledger row in the same transaction |
| customers | list / get / create / update / delete | `/customers[/:id]` | yes | order history inside GET `/:id` |
| analytics | getAnalytics | GET `/analytics?range=7\|30\|90` | yes | Also dashboard overview |
| store | updateStoreSettings / getPrimaryStore / isCurrencyLocked | PATCH/GET `/store` | yes | |
| profile | getOwnProfile / updateOwnName | GET/PATCH `/users/me` | no | |
| organizations | listMembershipsForUser, active tenant | GET `/organizations`, `/organizations/current`, `/auth/me` | no / yes | **Workspace resolution - migrate last** |
| team | listTeam(Rows) / create / update / status / remove / reset password | `/team/members[/:userId][/status\|/password]` | yes | Owner only |
| storefront (public) | getPublicStorefront | GET `/public/storefronts/:slug` | no | Public, unauthenticated |
| branding | getPublicBranding | GET `/public/branding` | no | |
| platform | companies, overview, members, ownership | `/platform/overview`, `/platform/organizations[...]` | no | Platform Admin only; rate-limited by `rate_limit_admin` |
| platform settings/admins | get/update settings, admins CRUD | `/platform/settings`, `/platform/admins[/:userId]` | no | super_admin for writes |
| audit | listAuditLogs / listAuditAdmins | GET `/platform/audit-logs`, `/audit-logs/admins` | no | `recordAudit` stays inside the API's own mutations |
| usage | usage, summary, inactive, new orgs | `/platform/usage[...]`, `/platform/organizations/:id/usage` | no | |
| auth | login / logout / refresh / session / change password | `/auth/*` | no | **Already migrated; unchanged** |
| orders | - | none | - | No order list/CRUD exists in the product (see MISSING_BACKEND_APIS.md) |
| templates | - | none | - | Excluded by design |

## How a service is switched

```ts
if (apiServes("categories")) { /* typed call in lib/api/endpoints/*, adapt to the existing return type */ }
// ...existing Drizzle code unchanged below
```

`API_MODULES=categories,...` (server env, needs `AUTH_API_URL`) selects modules; unset = old behaviour. Client: `lib/api/client.ts`.
