# Platform administration screens

The admin area (`/admin`) now covers the commercial side of StoreForge: plans, subscriptions, entitlements and limits, billing and
invoices, monitoring, and a role-aware menu. Everything is served by the StoreForge API (`D:\store-forge-api`, see its
`docs/PLATFORM_*.md`); this app holds no billing data and makes no money decisions.

## Roles

The menu, the pages and the buttons follow the signed-in person's platform role, read from `GET /platform/me` (`level` and `permissions`).
The role is **never** guessed from a name or stored in the browser. Hiding something is a courtesy: every page checks the permission again
on the server, every action checks it before calling the API, and the API and the database check it a third time.

| Role | Sees | Can change |
|---|---|---|
| Super Admin | everything | everything |
| Platform Admin | tenants, plans, entitlements, limits, billing (read), audit log, monitoring, administrators (read) | tenants, plans, subscriptions, exceptions |
| Billing Admin | tenants, plans, usage, billing, settings | invoices, payments, refunds, billing settings |
| Support Admin | tenants (read-only), their subscription and usage, settings | nothing |

## Screens

| Menu entry | Route | What it does | Needs |
|---|---|---|---|
| Overview | `/admin` | Tenants, users, subscriptions by state, growth charts, revenue and payments, recent activity, health | `tenants:read` (billing and activity parts need `billing:read` / `audit:read`) |
| Tenants | `/admin/organizations` | Search by name, owner e-mail, id or store address; create, suspend, edit. The tenant page adds **Plan, features and limits**: change plan, exceptions, usage against limits, invoices | `tenants:read`, `tenants:manage`, `subscriptions:manage`, `entitlements:manage`, `billing:manage` |
| Subscription Plans | `/admin/plans`, `/new`, `/[id]` | Create and edit plans, prices, trial, features, limits; activate or deactivate | `plans:read`, `plans:manage` |
| Feature Entitlements | `/admin/entitlements` | What every plan includes, features and limits side by side | `plans:read` |
| Usage & Limits | `/admin/limits` | Tenants close to or at a limit, with usage bars | `usage:read` |
| Billing & Invoices | `/admin/billing`, `/invoices`, `/invoices/[id]`, `/payments`, `/settings` | Revenue, overdue invoices, invoice detail and PDF, offline payments, voiding, refunds, billing settings, run billing | `billing:read`, `billing:manage` |
| Platform Administrators | `/admin/team` | Add platform staff, change their role, remove | `admins:read`, super admin to change |
| Audit Logs | `/admin/activity` | Filter by action, kind, administrator, tenant, date; shows where each action came from | `audit:read` |
| System Monitoring | `/admin/monitoring` | Alerts, services, server errors, scheduled jobs, what is not measured. Refreshes itself every 30 seconds | `monitoring:read` |

## How the code is organised

* `lib/platform/roles.ts`: role and permission names, labels and which menu entry needs which permission. No server-only imports.
* `lib/auth/platform.ts`: the server-side gate (`getPlatformAccess`, `requirePlatformPagePermission`, `requirePlatformPermission`).
* `lib/api/endpoints/platform-business-api.ts`: typed calls to the new API endpoints. `services/platform-commercial.service.ts` wraps each in a permission check.
* `app/(admin)/admin/commercial-actions.ts`: the server actions. Each validates with the schema the form used (`lib/validations/admin-commercial.ts`), then calls a service.
* `components/admin/*`: stat cards, usage bars, forms and dialogs. The invoice PDF is streamed by a route handler so the API token never reaches the browser.

Money is shown from integer minor units with `formatMoney`; a missing figure is shown as a dash, never as zero.

## Not built yet

* **The store owner's side.** A tenant Owner cannot yet see their plan, usage notices or invoices in the merchant dashboard, pay an invoice
  with Razorpay Checkout, or have screens hidden for features their plan lacks. The API is ready for all of it (`GET /entitlements`,
  `/billing/*`, `POST /billing/invoices/:id/pay`, `POST /billing/payments/verify`). It needs the Razorpay Checkout script on the Owner's
  billing page, which the static guards in `tests/unit/payments-guard-and-scope.test.ts` currently forbid outside the storefront checkout:
  that rule needs a deliberate, reviewed exception.
* Browser tests (Playwright) for the new screens. They need a running API and Supabase; the logic they sit on is unit tested
  (`tests/unit/platform-roles.test.ts`, `tests/unit/admin-commercial.test.ts`).
* Visual review in a browser: the screens follow the existing admin patterns and components, but have only been compiled and tested for logic.
