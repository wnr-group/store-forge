# Architecture

## Overview

```
Browser --(HttpOnly cookies, this app's host)--> Next.js (pages, server actions, proxy)
Next.js server --(Authorization: Bearer <access token>, X-Organization-Id)--> NestJS API /api/v1
NestJS API --(Drizzle, one transaction per request acting as the user, RLS on)--> Supabase PostgreSQL
NestJS API --> Supabase Auth (token verification, admin API) and Storage (signed URLs)
```

This app has no database client, no SQL and no migrations. Every business operation goes through the API.

## Key decision: the API is called from the server

The API is called from the Next.js **server**, never from browser code, so there is no `NEXT_PUBLIC_API_URL`.

- The session is an HttpOnly cookie on the store's own host. Browser code cannot read it, and the API's host never receives it.
- Calling from the server keeps tokens out of JavaScript, avoids CORS and cross-site cookies, and keeps cookies scoped to each store host.
- Browser components call server actions, so UI code does not know the API exists.

The single base URL is the server-only `API_BASE_URL`.

## Layers

| Layer | Location | Role |
|---|---|---|
| Config | `lib/api/config.ts` | Reads `API_BASE_URL` and `AUTH_BFF_SECRET` |
| Client | `lib/api/client.ts` | Adds the token from the cookie and `X-Organization-Id`, serializes queries, applies a 15 s timeout, parses the response envelope, maps errors to `AppError` |
| Endpoints | `lib/api/endpoints/<module>-api.ts` | Typed functions, one file per module |
| Services | `services/*.service.ts` | Check permissions, call the endpoints, adapt wire types (ISO date strings) to the types the UI uses |
| Server actions and pages | `app/**` | Call services; never call the API directly |

## Security model

- **Permissions are checked twice.** The frontend checks the permission before the call, so users get a clear message. The API checks again; authentication is never treated as authorization.
- **Organization id.** The id sent in `X-Organization-Id` comes from the user's verified memberships. The API re-checks membership and returns 403 on a mismatch. Row Level Security applies in the database.
- **Platform Admin routes** need no organization and return no tenant data. Tenant users get 403 there.
- **No secrets in the browser.** No service-role key and no tokens in browser code or storage.

## Tenant resolution

The active organization is chosen from the memberships the API returns (`GET /organizations`), using the preferred-organization cookie or the store host (`<store>.<root domain>`). A forged cookie or host that matches no membership selects nothing. See `lib/tenant/api-workspace.ts`.

## Token expiry

The proxy (`proxy.ts`) refreshes expired sessions through `/auth/refresh` before pages render. A 401 inside a request surfaces as `UNAUTHENTICATED`.

## Caching

Per-request memoization is used for the public storefront (`getPublicStorefront`). Public branding is cached for 5 minutes and falls back to default text on failure, so a settings problem never blocks sign-in. Nothing else is cached. Any new cache key must include the organization id.

## Storage

The browser uploads images straight to Supabase Storage using one-time signed URLs from `POST /uploads/signed-urls`. The API derives the tenant folder from the verified organization. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are still needed for the upload `apikey` header, public image URLs and `next.config.ts`.

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `API_BASE_URL` | Server | StoreForge API base URL, for example `http://localhost:4000/api/v1`. Required |
| `AUTH_BFF_SECRET` | Server | Shared secret (32+ characters), the same value as in the API. Required |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Upload target, public image URLs, image host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `apikey` header on browser uploads |
| `NEXT_PUBLIC_APP_URL` | Public | Origin of this app |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Public | Root domain for store subdomains. Empty disables subdomain routing |

See `.env.example` for descriptions.
