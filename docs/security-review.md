# Platform Admin Security Review

What was reviewed, what was found, what was fixed and what is left. It covers the database functions and tables behind the Platform Admin area, how they can be reached, rate limiting, logging and the tests that keep them safe.

## How it was reviewed

- **Catalog audit.** `tests/db/security-audit.test.ts` reads the real schema and checks every function and table it finds. A new function or table is covered without anyone adding it to a list.
- **Live checks.** The public REST API of the Supabase project was probed with the public (anon) key, and the database roles and sessions were inspected.
- **Workflow tests.** `tests/e2e/admin-workflows.test.ts` drives the real server actions end to end, including refusals.
- **Verification script.** `npm run db:verify` repeats the main checks on the real database.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | **Admin functions could be called directly over the public REST API.** The project exposes the `public` schema, so any signed-in token can call any function granted to `authenticated`. A Platform Admin's own token passes each function's admin check, so it could change data **without the app's audit entry, rate limit or validation**. | **Fixed** |
| 2 | Medium | **Failed-request logs could contain sensitive values.** Unexpected errors were printed raw, and a failed database query message includes the bound parameter values. | **Fixed** |
| 3 | Medium | **No rate limiting.** Sensitive admin actions and sign-in attempts were limited only by Supabase's own sign-in limits. | **Fixed** |
| 4 | Low | **Two functions could be run by anonymous visitors**: `set_updated_at()` (a trigger function) and `is_valid_member_permissions()` (a pure check). The default "public" access was never revoked. Neither exposes data. | **Fixed** |
| 5 | Info | The REST API is still on, and it is not used by this app (it only uses the Auth and Storage APIs). Every function that remains reachable over REST checks its caller, and the tests prove it. | Recommendation |
| 6 | Info | Two Platform Admin accounts exist in the database. One looks like a demo account (`platform@demo.test`). | Needs your action |

### 1. REST bypass

**Evidence.** A call to `/rest/v1/rpc/platform_list_tenants_page` with the anon key returned `permission denied for function`. That means the function is in the API's schema, so it is exposed. `pg_stat_activity` showed live sessions for the login role `authenticator`, which is what the REST service uses. The app uses `storeforge_app`.

**Fix** (`0016_admin_rest_gate_and_rate_limits`). Every admin function begins with `is_platform_admin()` or `is_super_admin()`. Both now also require `session_user <> 'authenticator'`. `session_user` is not changed by `SET ROLE`, so a caller cannot fake it. One change closes the REST route for all admin functions, including the admin Storage policies, and organization owners and members are unaffected.

**Verified by** `admin-hardening.test.ts` (a real super admin is refused on the REST path and accepted on the application's connection) and `security-audit.test.ts` (every admin function is refused for owners, anonymous visitors and REST).

### 2. Logging

All error logging now goes through `lib/observability/log.ts`. It writes one JSON line per event and removes bound SQL parameters, connection strings, tokens, e-mail addresses and long hex strings. Values under keys such as `password`, `token` and `cookie` are replaced. Request headers, bodies and query strings are never logged. `instrumentation.ts` logs uncaught server errors the same way.

### 3. Rate limits

Counters live in the database (`rate_limits`), so every server instance shares them.

| Operation | Limit |
|---|---|
| Create organization | 10 per 10 minutes, per admin |
| Delete organization | 5 per 10 minutes, per admin |
| Edit organization, store, status | 60 per 10 minutes, per admin |
| Team member actions | 30 per 10 minutes, per admin |
| Ownership transfer or recovery | 5 per 10 minutes, per admin |
| Manage platform admins | 10 per 10 minutes, per admin |
| Edit platform settings | 20 per 10 minutes, per admin |
| Sign-in, per address and e-mail | 8 per 15 minutes |
| Sign-in, per address | 40 per 15 minutes |

The subject of an admin limit is always the signed-in admin, taken from the session by the database. Sign-in counters store only keyed hashes, never an address or e-mail. Deletion is limited by a check in its action only; how deletion works is unchanged.

## What was checked and found sound

- Every `SECURITY DEFINER` function fixes its `search_path`.
- No function is executable by anonymous visitors or granted to everyone.
- Every table has row level security on, and anonymous visitors have no table rights.
- Tables with no policies (admin list, audit log, settings, rate limits) give no rights to `authenticated` or `storeforge_app`.
- All `platform_*` functions are `SECURITY DEFINER` and refuse organization owners, anonymous visitors and the REST path.
- The audit log is append-only (a trigger blocks edits and deletes), is written with the administrator taken from the session, and strips credentials.
- The service-role key is read in one module only and is never used for data access (`tests/unit/service-role-isolation.test.ts`).

## Limits and recommendations

1. **Turn off the Data API.** The app never uses it. In the Supabase dashboard, remove `public` from the exposed schemas (or disable the Data API). That removes the whole REST surface, which is a stronger protection than any function check.
2. **Set `RATE_LIMIT_SECRET`** in production. It falls back to the service-role key, then to a fixed development value.
3. **Remove the demo admin** (`platform@demo.test`) from the Platform Team page if it still has the demo seed's password.
4. **Fixed windows** allow a short burst around a window boundary (up to twice the limit). That is acceptable for these limits.
5. **The limiter fails open.** If the counters cannot be reached, the action is allowed and the problem is logged (`rate_limit_unavailable`), so a fault cannot lock admins or users out. Authorisation is always enforced separately.
6. **Deletion is not audited**, as the existing deletion flow was left unchanged by request.
7. **Direct database access** is the root of trust. Anyone with the database password can bypass every check. Keep `DIRECT_URL`, `DATABASE_URL` and the service-role key secret.

## Running the checks

```
npm run db:verify                       # the real database
npx vitest run tests/db/security-audit.test.ts tests/db/admin-hardening.test.ts
npx vitest run tests/e2e
```
