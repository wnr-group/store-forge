# Customer accounts, checkout and order tracking

How a shopper buys from a store and follows the delivery. The rules (who may see which order, prices, stock, tenant isolation) live in the StoreForge API; this app only shows them. API side: `docs/CUSTOMER_ACCOUNTS.md` in `store-forge-api`.

## The journey

1. A visitor opens a store (`<store>.<root domain>`) and browses, searches, opens products and fills the bag. **No account is needed.** The bag lives in the browser (`localStorage`, one bag per store).
2. **Checkout** (`/checkout`) is where an account is asked for. A visitor without a session is redirected to `/account/login?next=/checkout` (server side, before the page renders). After signing in or creating an account they return to checkout with the bag as they left it.
3. Checkout starts with the shopper's name, email, phone and default address filled in, and offers their saved addresses. The server prices and validates the order again; nothing computed in the browser is trusted.
4. Placing the order sends the shopper's session to the API. The order is tied to their account. The shopper lands on the order page (`/orders/<n>?placed=1`), which also handles Razorpay payment, and links to the account.
5. **My account** (`/account`): details and password, **orders** (`/account/orders`), **one order with its tracking timeline** (`/account/orders/<n>`), **saved addresses** (`/account/addresses`).
6. When the store owner changes the order in the dashboard (status, courier, tracking number) the shopper sees it on the next load of the order page (it also looks again every minute and when the tab is shown again).

## Separate from owners, staff and platform admins

| | Owner / staff / admin | Shopper |
|---|---|---|
| Where | `/login`, `/dashboard`, `/admin` | `/account/...` |
| Credential | Supabase Auth session (`sb-…` cookies) | opaque token issued by the API, cookie `sf_cust_<store>` (HttpOnly, SameSite=Lax, Secure in production) |
| Accepted by | dashboard/admin API routes | only `/public/stores/:slug/account/*` and placing an order |
| Scope | an organization | one store |

The two never mix: a shopper token sent as a bearer token is a 401 on every dashboard route, and an owner token is not a shopper session. The cookie is host-scoped, so each store address has its own. The dashboard and admin code never read `sf_cust_*`.

The header of a themed storefront shows an **Account** icon (shoppers) next to the small **store owner login** icon (owners), which is unchanged.

## Where the code lives

| What | Where |
|---|---|
| Session cookie helpers, `safeNext` | `lib/customer/session.ts` |
| API calls | `lib/api/endpoints/customer-account-api.ts` |
| Server actions (sign in/up/out, profile, addresses, orders) | `app/s/[slug]/account/actions.ts` |
| Pages (`/account`, `/login`, `/register`, `/orders`, `/orders/[n]`, `/addresses`) | `app/s/[slug]/account/**`, `components/storefront/account/render-account-page.tsx` |
| The account screens | `components/storefront/account/*` (one `account` section told which `view` to show) |
| Tracking timeline (pure) | `lib/customer/order-timeline.ts` |
| Checkout gate | `app/s/[slug]/checkout/page.tsx` (redirect), `checkout/actions.ts` (`placeOrderAction` sends the cookie's token) |
| Owner: courier and tracking number | `components/orders/order-actions.tsx`, `manual-shipment-actions.tsx`, `app/(dashboard)/dashboard/orders/actions.ts` |

## Order statuses shown to a shopper

Order placed → Confirmed → Processing → Packed → Shipped → Out for delivery → Delivered, or ended by Cancelled / Returned (an online order whose payment failed shows "Payment failed"). The API's statuses are `pending_payment`, `confirmed`, `processing`, `ready_to_ship`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned`, `failed`; the mapping is in `lib/customer/order-timeline.ts`. Every step shows the time it was reached.

## Limits and decisions

- **No password reset.** Not built, by design. A shopper who forgets their password cannot recover the account.
- **No email/SMS/push.** Updates are read in the account.
- **Guest orders.** Placing an order needs an account. Orders placed before this change (guest orders) keep working through their order link in the browser that placed them (`/orders/<n>`), but are not part of any account's history.
- **Paying later from another device.** The payment link works with the order token kept in the browser that placed the order. An unpaid online order opened from another device shows what to do.
- **The same email in two stores** is two separate accounts.
- **Email is not verified** (no email infrastructure), which is why an account only ever sees orders placed while signed in to it.

## Tests

`tests/unit/customer-account.test.ts` (cookie, redirect allow-list, sign-in actions, checkout needs a session), `tests/unit/order-timeline.test.ts`. The isolation rules are tested against the real API and a real PostgreSQL in `store-forge-api/test/customer-accounts.e2e-spec.ts`.
