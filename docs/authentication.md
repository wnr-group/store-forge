# Authentication

Sign-in, sign-out, session refresh, password change and session checks all go through the StoreForge API (`store-forge-api`), which talks to Supabase Auth itself. There is no direct-to-Supabase sign-in in this app.

For the API side (design, security measures, verification), see `COOKIE_SESSION_AUTH.md` in the `store-forge-api` repository.

## Configuration

| Variable (server-only) | Meaning |
|---|---|
| `API_BASE_URL` | API base URL, for example `http://localhost:4000/api/v1` |
| `AUTH_BFF_SECRET` | 32+ characters, the same value as `AUTH_BFF_SECRET` in the API. Proves the call comes from this server, so the API can use the visitor's real address for login rate limiting. Never prefix with `NEXT_PUBLIC_` |

Both are required. Missing `API_BASE_URL` fails with a clear error. Setting `API_BASE_URL` without a valid `AUTH_BFF_SECRET` is also an error, so the app never runs half-configured.

## How it works

```
Browser --(HttpOnly cookies, this app's host)--> Next.js server actions / proxy
Next.js --(server-to-server)--> POST /auth/login | /auth/logout | /auth/refresh, GET /auth/session
```

- The browser never calls the API for authentication and never sees a token.
- The API sets the session cookie (`sb-<ref>-auth-token`, optionally chunked). This app relays it and reads it with a small local decoder (`lib/auth/nest-api.ts`).
- Cookies are `HttpOnly`, `SameSite=Lax` and host-only: one set per store host.
- Login rate limiting is applied by the API.

## Where the code lives

| Concern | File |
|---|---|
| API client and `Set-Cookie` relay | `lib/auth/nest-api.ts` |
| `getCurrentUser()` (the API verifies the access token) | `lib/auth/session.ts` |
| Proxy: refresh through the API, optimistic gating with no network call while the token is valid | `lib/supabase/middleware.ts`, `proxy.ts` |
| Login, logout, change password | `services/auth.service.ts` |
| Signed-in marker for static pages (`sf_signed_in`) | `lib/auth/use-signed-in.ts` |
| Landing page after sign-in | `lib/auth/home.ts` |

## Behaviour notes

- **Signed-in marker.** Static store pages cannot read the HttpOnly cookies. They read the token-free `sf_signed_in` marker through `useSignedIn`.
- **Landing page.** With no `next` path, login asks the API for the profile and sends Platform Admins to `/admin` and everyone else to `/dashboard`. An explicit `next` path skips that lookup.

## Tests

`tests/unit/auth-api-mode.test.ts` runs the real fetch and cookie code against a local HTTP server standing in for the API. It covers cookie decoding (UTF-8, chunks, plain JSON, corrupt cookie).
