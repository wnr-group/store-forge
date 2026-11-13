# StoreForge

StoreForge is a multi-tenant e-commerce platform. This repository is the **Next.js frontend**: the merchant dashboard, the Platform Admin area and the public storefront for each store.

There is no public sign-up. A Platform Admin creates each company with its first store and Owner account. The Owner then adds Manager and Staff accounts. Every company's data is isolated from the others.

**Not built yet:** checkout, payments and template customization. Orders are read-only in the dashboard.

## How it fits together

```
Browser  ->  this Next.js app  ->  StoreForge API (NestJS)  ->  Supabase (Postgres, Auth, Storage)
```

- This app has **no database access**. Everything goes through the API (`store-forge-api` repository), which owns business logic, permissions and tenant isolation.
- The sign-in session is kept in HttpOnly cookies set by the API; this app only relays them.
- Product images are uploaded from the browser straight to Supabase Storage using signed URLs from the API.
- Database schema and migrations live in the `store-forge-api` repository.

## Project structure

```
app/          Routes: (auth)/login, (admin)/admin (Platform Admin), (dashboard)/dashboard (company), s/[slug] (public store)
components/   UI components, one folder per feature (ui/ is shadcn)
config/       Environment validation and constants
lib/          API client, auth and permissions, domain types, validation, helpers
services/     One service per area (products, categories, inventory, customers, team, ...)
tests/        Unit and e2e tests
proxy.ts      Session refresh, route protection and store subdomain routing
docs/         Detailed documentation
```

## Getting started

**You need:** Node.js 22.12 or newer, npm, and a running [StoreForge API](https://github.com/wnr-group/store-forge-api) connected to a Supabase project.

1. Install dependencies:

   ```bash
   git clone https://github.com/wnr-group/store-forge.git
   cd store-forge
   npm install
   ```

2. Set up the API first: run its migrations, create the first Platform Admin (`npm run admin:create`) and start it. See the API repository's README.

3. Create your env file:

   ```bash
   cp .env.example .env.local          # macOS / Linux / Git Bash
   Copy-Item .env.example .env.local   # Windows PowerShell
   ```

4. Fill in `.env.local`:

   | Variable | What to put |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (Project Settings → API) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (same page) |
   | `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
   | `NEXT_PUBLIC_ROOT_DOMAIN` | `lvh.me:3000` locally, `store-forge.com` in production. Empty turns off store subdomains |
   | `API_BASE_URL` | Server only. API address, `http://localhost:4000/api/v1` locally |
   | `AUTH_BFF_SECRET` | Server only. 32+ characters, the **same value** as in the API. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

   Never prefix `API_BASE_URL` or `AUTH_BFF_SECRET` with `NEXT_PUBLIC_`.

5. In Supabase, turn off **Authentication → Sign In / Providers → Allow new users to sign up**. The app has no sign-up page, but this switch closes the public endpoint.

6. Start the app and sign in at http://localhost:3000/login with the Platform Admin account:

   ```bash
   npm run dev
   ```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Type-check |
| `npm run lint` | Lint |
| `npm test` | Run all unit tests (no database or API needed) |
| `npm run test:e2e` | Run Playwright end-to-end tests |

## Roles

| Role | Scope | Can do |
|---|---|---|
| Platform Admin | Whole platform | Use `/admin`: create, suspend and reactivate companies, reset an Owner's password. No access to company data |
| Owner | One company | Everything in the company, including team and store settings |
| Manager | One company | Edit store settings, delete catalog data and customers, create and edit the rest. Cannot manage the team |
| Staff | One company | View the dashboard, create and edit products, stock and customers. Cannot delete or change settings |

Manager is stored as `admin` in the database, but shown as Manager in the UI. Permission rules live in `lib/auth/permissions.ts` and must match the API's rules. More in [docs/roles-and-permissions.md](docs/roles-and-permissions.md).

## Store subdomains

Each company's first store is public at `<store-address>.<root domain>`, for example `http://urban.lvh.me:3000` locally (`lvh.me` resolves to 127.0.0.1, so no hosts-file edits). Each store host has its own sign-in and dashboard, while `/admin` works only on the root domain.

For production, add a wildcard DNS record `*.store-forge.com` and add both `store-forge.com` and `*.store-forge.com` to your Vercel project.

## Deploying (Vercel)

Deploy and migrate the API first. Then set the six environment variables above in Vercel for Production, with `NEXT_PUBLIC_APP_URL` set to your production URL.

## Troubleshooting

| Problem | Fix |
|---|---|
| Login shows "Something went wrong" | Check that `API_BASE_URL` is reachable and `AUTH_BFF_SECRET` is identical in this app and the API (a mismatch returns 403 `CSRF_ORIGIN_REQUIRED`) |
| "The StoreForge API is not configured" | Set `API_BASE_URL` and `AUTH_BFF_SECRET` in `.env.local`, then restart |
| "No workspace available" after sign-in | The user's membership is deactivated or their company is suspended. Reactivate it as Platform Admin or Owner |
| Forgotten password | There is no email recovery. The Owner resets a member's password; a Platform Admin resets an Owner's |

## More documentation

See [docs/README.md](docs/README.md) for architecture, authentication, data model, security and testing.
