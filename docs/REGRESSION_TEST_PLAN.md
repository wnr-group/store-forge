# Regression Test Plan

## Automated (run before and after enabling a module)

| Suite | Command | Baseline 2026-11-10 |
|---|---|---|
| Frontend unit | `npx vitest run` | 2477 passed, 6 failed, 22 skipped; 10 files fail |
| API unit + integration | `cd ../store-forge-api && npm test` / `npm run test:e2e` | 105 + 155 (+ coverage run 184) pass |
| API route coverage | `npm run coverage:routes` | 78/78 |
| Types / lint | `npm run typecheck`, `npm run lint` | typecheck: only pre-existing errors |

**Pre-existing frontend failures (identical without this work; not caused by it):** missing `scripts/qa/*` and `tests/e2e/support/evidence` modules (evidence-phase2, evidence-tooling, engine-benchmark), `@playwright/test` not installed (type errors, admin-workflows e2e), template-settings / templates-migration / provisioning / security-audit DB tests, `engine-cutover-static`, and a stale allow-list entry in `timing-config` (`tests/integration/storefront-roundtrip`).

## Live checklist per module (needs real Supabase; staging only, never production data)

For each of Platform Admin, Owner, Manager (view-only), Manager (manage), Staff:
1. Sign in, reload (session restore), wait past token expiry (refresh), sign out.
2. Open every page of the module with `API_MODULES=<module>`; compare against the same page with it unset (same data, same empty/loading/error states).
3. Create, edit, delete; submit invalid data and compare field error messages with the old path.
4. A user without permission gets the same message and no data.
5. Organization switching and the store subdomain host still select the right workspace.
6. **Cross-tenant**: send another organization's id (tamper cookie / header) -> 403 / no data; other tenant's record ids -> 404.
7. Platform Admin sees no tenant business data; tenant users get 403 on `/platform/*`.
8. Template customization pages unaffected.

## Per-module extras
Products: image upload + replace + delete removes file; bulk actions; currency lock. Inventory: concurrent adjustments never go negative; ledger row per change. Team: Owner-only, cannot edit self/owner. Platform: last super admin protected; audit rows written.
