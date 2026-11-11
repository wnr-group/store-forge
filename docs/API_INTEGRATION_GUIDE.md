# API Integration Guide

How to migrate one module (repeat per row of `API_INTEGRATION_MAPPING.md`).

1. **Read the contract** in Swagger (`http://localhost:4000/api/docs`) and the API's DTO (`store-forge-api/src/modules/<m>/*.dto.ts`).
2. **Add typed endpoints** in `lib/api/endpoints/<module>-api.ts` using `apiRequest` (see `category-api.ts`). Wire types are JSON: dates are ISO strings.
3. **Delegate in the service** behind `apiServes("<module>")`. Keep the exported signature and return type. Convert dates, fill fields the API omits (`tenantId`), map 404 to the previous `null`/`NOT_FOUND` behaviour. Check the permission first with `requireActiveTenant(permission)` so users get the same error as before.
4. **Test**: a service test that mocks the endpoints (see `tests/unit/category-service-api.test.ts`) and asserts shapes, permission-before-call, and that the database path is not used.
5. **Verify live** (needs a Supabase project): run both apps with `API_MODULES=<module>`, exercise each page and action as Platform Admin, Owner, Manager (read-only and with write), Staff; try another organization's id.
6. **Only then** remove the old code path (a later cleanup, after staging).

## Running locally

```
# API (D:\store-forge-api): copy .env.example -> .env, fill DATABASE_URL, SUPABASE_*, AUTH_BFF_SECRET
npm run start:dev                       # http://localhost:4000/api/v1, Swagger /api/docs
# Frontend (D:\store-forge): .env.local
AUTH_API_URL=http://localhost:4000/api/v1
AUTH_BFF_SECRET=<same 32+ chars as the API>
API_MODULES=categories                  # or leave unset for the previous behaviour
npm run dev
```

## Error mapping

| API | `AppError.code` |
|---|---|
| 400/422 | VALIDATION (field errors from `error.details` when it is `{field: message}`) |
| 401 | UNAUTHENTICATED |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | CONFLICT |
| 429 | RATE_LIMITED |
| 5xx / network / timeout | UNKNOWN, generic message, logged |

## Rules

* Never call the API from client components; go through server actions/services.
* Never send an organization id that was not resolved from the user's verified memberships.
* Do not duplicate calculations (money, stock, totals) in the frontend adapters.
