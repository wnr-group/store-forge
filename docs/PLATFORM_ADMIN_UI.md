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

## The store owner's side

The Owner of a store sees **Plan & billing** (`/dashboard/billing`) in the Workspace menu. Nobody else does; the page, the service, the API and the database each check Owner access again.

| Route | What it does |
|---|---|
| `/dashboard/billing` | Plan, status, renewal date, usage against each limit, included features, unpaid invoices with a Pay button, recent invoices |
| `/dashboard/billing/invoices` | All invoices, filterable by status |
| `/dashboard/billing/invoices/[id]` | One invoice, its payments, Pay and Download PDF |

* **Paying.** The server action asks the API to create a Razorpay order for the amount stored on the invoice (never an amount from the browser). The page opens Razorpay Checkout with the order and the public key id, then sends Razorpay's three success values back. The API checks the signature and asks Razorpay itself before it marks the invoice paid; the browser's "success" is never trusted. Card details are typed into Razorpay's window and never reach StoreForge. The Checkout script loader is the storefront's (`loadRazorpay`), so there is still one Razorpay host reference in the app.
* **Notices.** A notice above every dashboard page appears when the subscription is not active or a limit is close or reached (`GET /entitlements`, any member). Only the Owner is linked to the billing page.
* **Menu follows the plan.** Discounts, Campaigns, Abandoned carts and Analytics are hidden when the plan lacks the matching feature. This is display only: the API refuses those calls anyway. If the plan cannot be read, nothing is hidden.
* **Plan changes** are made by StoreForge, not bought here. There is no recurring (auto-debit) billing; each cycle is an invoice the Owner pays.

## Not built yet

* Browser tests (Playwright) for the new screens. They need a running API, Supabase and Razorpay test keys; the logic they sit on is unit tested (`tests/unit/platform-roles.test.ts`, `admin-commercial.test.ts`, `owner-billing.test.ts`).
* Visual review in a browser: the screens follow the existing patterns and components, but have only been compiled and tested for logic. The Razorpay Checkout flow has not been run against Razorpay.
