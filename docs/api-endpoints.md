# API Endpoints

Which service function calls which StoreForge API endpoint. The base path is `/api/v1`. Swagger (`/api/docs`) is the contract of record; this page is only the routing map.

**Org** means the call sends `X-Organization-Id`, the verified active organization. The API re-checks membership.

## Store admin

| Module | Service function | Method and path | Org | Notes |
|---|---|---|---|---|
| Categories | `listCategories`, `getCategory` | `GET /categories`, `/categories/:id` | Yes | 404 becomes `null` |
| | `createCategory`, `updateCategory`, `deleteCategory` | `POST`, `PATCH`, `DELETE /categories[/:id]` | Yes | |
| Collections | `listCollections`, `getCollection`, `listProductOptions` | `GET /collections`, `/:id`, `/product-options` | Yes | Detail has ordered `productIds` |
| | create, update, delete | `POST`, `PATCH`, `DELETE /collections[/:id]` | Yes | Image paths are verified by the API. `PATCH` replaces the product set |
| Products | `listProducts` | `GET /products?page&limit&search&status&category&stock&sortBy&sortOrder` | Yes | Page size 20 |
| | `getProduct` | `GET /products/:id` | Yes | Options, variants, images, `collectionIds` |
| | `createProduct`, `updateProduct`, `deleteProducts` | `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`, `POST /products/bulk-delete` | Yes | Client-generated `id` is kept. Prices are decimal text |
| | `setProductsStatus`, `duplicateProduct` | `POST /products/bulk-status`, `/products/:id/duplicate` | Yes | |
| Uploads | `requestUploadsAction` | `POST /uploads/signed-urls` | Yes | The browser uploads the file straight to Storage |
| Inventory | `listInventory`, `listAdjustments`, `adjustStock` | `GET /inventory`, `GET`/`POST /inventory/adjustments` | Yes | A ledger row is written in the same transaction |
| Customers | list, get, create, update, delete | `/customers[/:id]` | Yes | Order history (last 50) is inside `GET /customers/:id` |
| Analytics | `getAnalytics` | `GET /analytics?range=7\|30\|90` | Yes | Also feeds the dashboard. The API uses the store's timezone and currency |
| Store | `updateStoreSettings`, `getPrimaryStore`, `isCurrencyLocked` | `GET`/`PATCH /store` | Yes | |
| Profile | `getOwnProfile`, `updateOwnName` | `GET`/`PATCH /users/me` | No | The session is rotated through `/auth/refresh` after a rename |
| Team | `listTeam`, create, update, set status, remove, reset password | `/team/members[/:userId][/status\|/password]` | Yes | Owner only |
| Workspace | `loadWorkspaceData` | `GET /organizations`, `GET /organizations/current` | No / Yes | One `/organizations/current` call per membership on a store host |

## Platform Admin

No organization header. The API returns 403 to non-admins.

| Operation | Method and path | Notes |
|---|---|---|
| Admin check | `GET /platform/me` | 403 means not an admin |
| Overview | `GET /platform/overview` | |
| List organizations | `GET /platform/organizations` | Query: `search`, `status`, `sortBy`, `sortOrder`, `page`, `limit` |
| Organization detail | `GET /platform/organizations/:id` | Returns `{ company, store, team }` |
| Create organization and Owner | `POST /platform/organizations` | The API creates the account and rolls it back on failure |
| Update, delete, status, store | `PATCH /:id`, `DELETE /:id`, `PATCH /:id/status`, `PATCH /:id/store` | Delete also removes orphaned sign-ins and files |
| Members | `POST /:id/members`, `PATCH /:id/members/:userId/status`, `DELETE /:id/members/:userId` | |
| Ownership | `POST /:id/ownership/transfer`, `/recover` | |
| Admins | `GET`/`POST /platform/admins`, `PATCH`/`DELETE /platform/admins/:userId` | Super admin for writes |
| Settings | `GET`/`PATCH /platform/settings` | |
| Audit logs | `GET /platform/audit-logs`, `/platform/audit-logs/admins` | Filters: `action`, `admin`, `org`, `search`, `from`, `to`, `page`, `limit` |
| Usage | `GET /platform/organizations/:id/usage`, `/platform/usage[...]` | Counts and bytes only |

The API applies the admin rate limit and writes audit entries inside its own mutations.

## Public

| Operation | Method and path | Notes |
|---|---|---|
| Public branding | `GET /public/branding` | Anonymous. Cached 5 minutes, with default text on failure |
| Public storefront | `GET /public/storefronts/:slug` | Anonymous. 404 means no store. Memoized per request |

## Authentication

| Operation | Method and path |
|---|---|
| Login, logout, refresh, session, change password | `/auth/*` |

See [Authentication](./authentication.md).
