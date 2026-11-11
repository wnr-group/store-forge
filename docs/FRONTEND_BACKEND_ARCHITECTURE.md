# Frontend / Backend Architecture

```
Browser --(HttpOnly cookies, this app's host)--> Next.js (pages, server actions, proxy)
Next.js server --(Authorization: Bearer <access token from the cookie>, X-Organization-Id)--> NestJS /api/v1
NestJS --(Drizzle, transaction acting as the user, RLS on)--> Supabase PostgreSQL
NestJS --> Supabase Auth (JWKS verification, Admin API) / Storage (signed URLs)
```

## Decision: the API is called from the Next.js **server**, not from browser code

The brief suggests `NEXT_PUBLIC_API_URL`. We deviate on purpose: the session is an HttpOnly cookie on the store's own host, which browser code cannot read and which the API's host never receives. Calling from the server keeps tokens out of JavaScript, avoids CORS and cross-site cookies, keeps cookies host-scoped per store, and matches the authentication design already shipped (`docs/AUTH_VIA_API.md`). So there is **no `NEXT_PUBLIC_API_URL`**; the single base URL is the existing server-only `AUTH_API_URL`. Browser components keep calling server actions as today, so UI code does not change.

## Layers

| Layer | File(s) | Role |
|---|---|---|
| Config + module switch | `lib/api/config.ts` | `API_MODULES`, `apiServes(module)`, base URL |
| Client | `lib/api/client.ts` | token from cookie, `X-Organization-Id`, query serialization, 15 s timeout, envelope parsing, error mapping to `AppError` (so existing `run()`/`toFailure` and messages work unchanged), 5xx hidden behind the generic message |
| Endpoints | `lib/api/endpoints/<module>-api.ts` | typed functions, one file per module |
| Services | `services/*.service.ts` | keep their signatures/return types; delegate to endpoints when the module is enabled, else the old Drizzle path (rollback = remove from `API_MODULES`) |

## Security model

* Frontend authorization stays (permission checked before the call, same messages); the API enforces it again - authentication is never treated as authorization.
* The organization id sent is the DB-verified active tenant; the API re-checks membership (403 on mismatch) and RLS applies in the database.
* Platform Admin routes need no organization and return no tenant data; tenant users get 403 there.
* No service-role key and no tokens in browser code or storage. RLS is untouched.

## Token expiry

The proxy refreshes expired sessions through `/auth/refresh` before pages render (existing behaviour). A 401 inside a request surfaces as `UNAUTHENTICATED` (same as today's expired session handling).

## Cache keys

Nothing is cached. If caching is added later, keys must include the organization id.

## Migration order (dependency-driven)

1. Foundation (this change): client, config, tests. 2. categories (pilot) -> collections -> products (+uploads) -> inventory. 3. customers, analytics. 4. store settings, profile, team. 5. platform admin (organizations, settings, admins, audit, usage). 6. **workspace resolution** (affects everything, do last), then remove dead direct code per module after it has run in staging.
