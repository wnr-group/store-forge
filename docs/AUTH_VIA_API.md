# Authentication through the StoreForge API

Sign-in, sign-out, session refresh, password change and session checks can run through the NestJS API (`store-forge-api`) instead of talking to Supabase Auth directly. The accounts, roles, permissions, login page, validation, messages and redirects are unchanged. Full design, security measures and the verification report: `store-forge-api/docs/COOKIE_SESSION_AUTH.md`.

## Switching

| Variable (server-only) | Meaning |
|---|---|
| `AUTH_API_URL` | e.g. `http://localhost:4000/api/v1`. **Set = authentication goes through the API. Unset = the previous direct-to-Supabase behaviour.** |
| `AUTH_BFF_SECRET` | 32+ characters, the same value as `AUTH_BFF_SECRET` in the API. Proves the call comes from this server. Never `NEXT_PUBLIC_`. |

Setting `AUTH_API_URL` without a valid `AUTH_BFF_SECRET` is an error (it never silently runs half-configured). **Rollback = remove `AUTH_API_URL`.**

## How it works

```
browser --(HttpOnly cookies, this app's own host)--> Next.js server actions / proxy
Next.js --(server-to-server)--> POST /api/v1/auth/login | logout | refresh, GET /auth/session   --> Supabase Auth
```

| Concern | File |
|---|---|
| API client + Set-Cookie relay | `lib/auth/nest-api.ts` |
| `getCurrentUser()` (API verifies the access token) | `lib/auth/session.ts` |
| Proxy: refresh through the API, optimistic gating (no network call while the token is valid) | `lib/supabase/middleware.ts` |
| Login / logout / change password | `services/auth.service.ts` (API and direct paths side by side) |
| Cookie hardening of this app's own Supabase client | `lib/supabase/server.ts` |
| Signed-in marker for static pages (`sf_signed_in`) | `lib/auth/use-signed-in.ts` |

* The browser never talks to the API for authentication and never sees a token. Cookies stay host-only, one set per store host.
* Login rate limiting moves to the API (same `rate_limit_login` function and limits); `enforceLoginRateLimit` here is only used in the direct mode.
* Still unchanged and unrelated to login: provisioning users with the Admin Auth API, Storage calls made with the user's own session, `profiles` updates.

## Tests

* `tests/unit/auth-api-mode.test.ts` (25) runs the real fetch/cookie code against a local HTTP server standing in for the API.
* `tests/unit/auth-flows.test.ts` (20) still covers the direct mode, including "no sign-up / verification / recovery".
* Pre-existing failures elsewhere in the suite (missing `scripts/qa/*` modules, template-settings DB tests) are unrelated and identical with and without this change.
