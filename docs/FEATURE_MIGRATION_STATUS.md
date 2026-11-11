`analytics.service` -> `analytics-api` | Done, live check pending || Done, live check pending || Done, live check pending || Done, live check pending || Done, live check pending || Phase | Feature | API | Frontend | Status |
|---|---|---|---|---|
| 1 | Authentication (login, logout, refresh, session, change password) | yes | yes (`API_BASE_URL`) | Done (pre-existing) |
| 1 | API client, config, error mapping, tests | - | `lib/api/*` | Done |
| 2 | Categories | yes | `category.service` -> `category-api` | Done (pilot), live check pending |
| 2 | Collections | yes | `collection.service` -> `collection-api` | Done, live check pending |
| 2 | Products + variants + images | yes | `product.service` -> `product-api` | Done, live check pending |
| 2 | Uploads (signed URLs, discard) | signed-urls only | stays direct | Blocked: no discard endpoint; see INTEGRATION_PROGRESS |
| 2 | Organization / workspace resolution | yes | `lib/tenant/api-workspace.ts` | Done, live check pending |
| 3 | Customers (+ order history) | yes | `customer.service` -> `customer-api` | Done, live check pending |
| 3 | Inventory + stock ledger | yes | `inventory.service` -> `inventory-api` | Done, live check pending |
| 3 | Orders (list/create/update/cancel) | none | none | N/A - not in product |
| 4 | Team (Owner) | yes | `team.service` -> `team-api` | Done, live check pending |
| 4 | Store settings, profile | yes | `store-settings`, `profile` services | Done, live check pending |
| 4 | Audit logs (platform) | yes | `admin-audit.service` | Done, live check pending |
| 5 | Dashboard / analytics | yes | `analytics.service` -> `analytics-api` | Done, live check pending |
| 5 | Platform admin: organizations, admins, settings, usage | yes | `platform*.service` | Done, live check pending |
| - | Template customization | none | stays | N/A - excluded |
| - | Invitations, billing, integrations, sign-up | none | none | N/A - not in product |
| 6 | Remove obsolete direct DB code | - | - | Not started (after staging) |
