# API Integration Guide

How to add or change an API-backed feature. For the endpoint list, see [API Endpoints](./api-endpoints.md). For the design, see [Architecture](./architecture.md).

## Adding or changing a module

1. **Read the contract** in Swagger (`http://localhost:4000/api/docs`) and the API's DTOs (`store-forge-api/src/modules/<module>/*.dto.ts`).
2. **Add typed endpoints** in `lib/api/endpoints/<module>-api.ts` using `apiRequest` (see `category-api.ts`). Wire types are JSON, so dates are ISO strings.
3. **Call them from the service** in `services/<module>.service.ts`.
   - Check the permission first with `requireActiveTenant(permission)`, so users get the same error as before.
   - Convert dates and fill fields the API omits (for example `tenantId`).
   - Map 404 to `null` or `NOT_FOUND`, as the caller expects.
4. **Test** with a service test that mocks the endpoints (see `tests/unit/category-service-api.test.ts`). Assert the data shapes, that the permission is checked before the call, and that no database code is used.
5. **Verify live** against a staging Supabase project. See [Testing](./testing.md).

## Running locally

```bash
# API (store-forge-api): copy .env.example to .env, then fill in DATABASE_URL, SUPABASE_* and AUTH_BFF_SECRET
npm run start:dev          # http://localhost:4000/api/v1, Swagger at /api/docs

# Frontend (this repo): .env.local
API_BASE_URL=http://localhost:4000/api/v1
AUTH_BFF_SECRET=<same 32+ characters as the API>
npm run dev
```

## Error mapping

The client turns the API's error envelope `{ success: false, message, error: { code, details } }` into an `AppError`, so `run()`, `toFailure` and the existing messages keep working.

| API response | `AppError.code` |
|---|---|
| 400, 422 | `VALIDATION` (field errors from `error.details` when it is `{ field: message }`) |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 429 | `RATE_LIMITED` |
| 5xx, network error, timeout | `UNKNOWN` with a generic message; the detail is logged |

A failed API call never falls back to another data source.

## Rules

- Never call the API from client components. Go through server actions and services.
- Never send an organization id that was not resolved from the user's verified memberships.
- Do not duplicate calculations (money, stock, totals) in the frontend. The API computes them.
- Money amounts are decimal text in requests and minor units in responses.
- Keep a service's exported signature and return type stable, so pages and actions do not change.
- `tests/unit/no-direct-db-static.test.ts` fails if direct database access is added outside the API client.
