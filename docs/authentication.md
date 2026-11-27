# Authentication

Sign-in, sign-out, session refresh, password change, self-service account creation and session checks all go through the StoreForge API (`store-forge-api`), which talks to Supabase Auth itself. There is no direct-to-Supabase sign-in in this app.

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

## Opening a store owner's dashboard (sign-in handoff)

The main domain (`lvh.me:3000`, `store-forge.com`) is the StoreForge platform. A store owner's dashboard lives on THEIR store host (`<store>-<id>.<root>/dashboard`). Cookies are host-only, so a store host starts with no session; the owner is carried over with a one-time code, and no cookie is ever widened or shared.

```
landing "Dashboard" / login / root /dashboard  ->  GET /auth/open-store   (main site; app/auth/open-store/route.ts)
create store (createStoreAction)                ->  same helper, store known from the API answer
   requireWorkspace()                      the active/default store, from the API membership list
   POST /auth/handoff {audience}           API: only for a store the person is an active member of; signed, single use, 60 s
   303 -> http://<store>-<id>.<root>/auth/handoff?code=...
store host: GET /auth/handoff           (app/auth/handoff/route.ts)
   POST /auth/handoff/exchange             API (trusted server only): new session for THIS host; the root session is untouched
   303 -> /dashboard                        (a refused code -> this host's /login)
```

- **One helper.** `lib/tenant/open-store.ts` (`storeDashboardUrl`) builds the address from the existing `storefrontUrl`; the dashboard layout, the landing button and the create-store action all use it. The layout sends an owner who lands on the root `/dashboard` to `/auth/open-store`.
- **Signing out.** Cookies are host-only, so a store host's sign-out button sends the browser through `GET /auth/sign-out?to=<store label>` on the main site, which clears the main site's own session (and the marker the landing page reads), then returns to that store's sign-in page. `to` must be a real store host under the root domain.
- **No store, no problem.** No workspace -> `requireWorkspace` sends the person to onboarding (or the admin area for staff). If the code cannot be made, the owner still lands on their store host's sign-in page. With no `NEXT_PUBLIC_ROOT_DOMAIN` there are no store hosts, so the dashboard stays on the current host.
- **Multiple stores.** The store is the one `requireWorkspace` picks (preferred-store cookie if the person is a member, else their first membership).

## Behaviour notes

- **Signed-in marker.** Static store pages cannot read the HttpOnly cookies. They read the token-free `sf_signed_in` marker through `useSignedIn`.
- **Landing page.** With no `next` path, login asks the API for the profile and sends Platform Admins to `/admin` and everyone else to `/dashboard`. An explicit `next` path skips that lookup.

## Self-service sign-up

A visitor can create their own account and their own store, with no Platform Admin involved. (A Platform Admin can still create an organization and its Owner by hand: both ways end in the same database routine, `provision_tenant_internal`.)

```
/#plans  -- "Get started" on a plan card -->  /signup?plan=<code>&interval=monthly|yearly
  POST /auth/register   creates a confirmed account (no e-mail verification) and signs the visitor in; no organization, no role
  /onboarding           asks the API where this person is (GET /signup/status) and shows ONE step:
      choose a plan  ->  pay (POST /signup/checkout, Razorpay Checkout, POST /signup/verify-payment)  ->  name the store (POST /signup/store)
  /dashboard            the new store, with the person as Owner and the paid plan active
```

- **Nothing the browser says is trusted.** The price is worked out by the API from the plan and the tax settings; the form sends only a plan code and a billing period. A payment counts only after the API has checked Razorpay's signature and asked Razorpay itself, or Razorpay's signed webhook said so. The store is created only for a paid purchase.
- **Retry and idempotency.** A failed or abandoned payment is paid again on the same Razorpay order (the button asks the API for it again), so no second account is needed. Verifying the same payment twice, delivering the same webhook twice, or pressing "Create my store" twice changes nothing and creates one store.
- **Where it lives.** Pages: `app/(auth)/signup`, `app/(auth)/onboarding`. Actions: `app/(auth)/actions.ts` (`registerAction`), `app/(auth)/onboarding/actions.ts`. Service: `services/onboarding.service.ts`; API client: `lib/api/endpoints/signup-api.ts`. The plan travels in the address (`lib/onboarding/path.ts`).
- **Routing.** `/onboarding` needs a session; `/signup` is for visitors (a signed-in visitor is sent on to `/onboarding`). A signed-in person with no workspace who is not platform staff lands on `/onboarding` (`defaultHomePath`, `requireWorkspace`); Platform Admins go to `/admin`, and a Platform Admin can never buy a store (a person is staff or a member, never both).
- **The public header** has Home, Features, Pricing, Login and Get Started, and no link into the admin area.
- **No e-mail verification, OTP or password recovery** in this version: anyone can register with any address, and a forgotten password is reset by an administrator.

## Tests

`tests/unit/auth-api-mode.test.ts` runs the real fetch and cookie code against a local HTTP server standing in for the API. It covers cookie decoding (UTF-8, chunks, plain JSON, corrupt cookie).
