# Studio deployment, feature-flag and rollback report

Status: **NO-GO** (updated after the second pass). Verified in the **local environment only**. No staging, controlled-tenant or production access was available; nothing was deployed.

## Feature flags
Inspected: no feature-flag mechanism exists in either repo (searched env validation, `.env.example`, code). Engineering decision (not stakeholder approval): **no flag is added**. Reasons: every change is additive and independently revertable; a frontend-only flag for the collection delete warning would be unsafe, because the API now answers `409 COLLECTION_IN_USE` for a used collection and the UI would then have no way to confirm; the error boundary is a Next file convention and cannot be toggled; the nav and category dialog are cosmetic. A flag would only help for the nav group (`NAV_ITEMS` grouping) and the category text, and would add configuration with no safety gain. Enabled/disabled states were therefore not tested. If a rollout flag is wanted, the smallest option is a server-read environment variable consumed by `nav-config.ts`; the backend authorization must stay independent of it.

## Rollout stages (proposal; none executed)
1 Local integration (done for the items marked passed). 2 Dedicated QA/staging: apply migrations 0032-0035, deploy API first, then frontend; smoke: `GET /api/v1/health`, login, open editor, publish, storefront, delete an unused collection, collection-usage warning, import. 3 Internal tenant. 4 Limited production. 5 Broad. Rollback trigger at each stage: failing health check, publish/save errors, 5xx from `/collections/*/usage`, any cross-tenant read.
Deployment order constraint: **API before frontend** (the frontend sends `?usage=`; the older API rejects unknown query parameters).

## Go/No-Go gates and current result
| Gate | Result |
|---|---|
| All mandatory ACs pass with evidence | **No**: 39/40 passed with validated evidence; AC-PP-1 in progress (D-010) |
| No release-blocking defect | D-001, D-002, D-003, D-008, D-009 fixed; **D-010 open** (Stride and Marketplace ignore gallery layout, media position and focal point) |
| FE and API builds, typecheck, lint | Yes (local, final code) |
| Unit, API and integration suites | Yes: FE 2679; API 289 + 312 + 13 |
| PR #8 regression suites | Partly: 3 tests fail for recorded causes (calendar-dependent axis, missing local data, a colour transition) |
| Migrations ordered and validated | Local only: journal consistent, applied cleanly |
| Authorization and tenant isolation | Yes (API and browser, five member profiles) |
| Rollback procedure tested | UI rollback tested locally (History restore; the live storefront followed); production rollback not drilled |
| Performance regression | None in API/import (earlier medians); frontend not separately baselined |
| Operational health checks | `/api/v1/health` only |

## Monitoring (inspected)
API logs one line per HTTP request; `/health` endpoint exists. No monitoring/alerting library in either repo. Gaps: no storefront render-failure signal, no publish-failure alert, no import failure counters. Smallest addition: forward the API request log and add an alert on 5xx rate and on `COLLECTION_IN_USE`/publish failures.

## Rollback procedures
**A Feature rollback:** no flag exists (see above).
**B Application code:** revert in order frontend then API with the repository's normal safe process: frontend commits `55e2cec..778ffcb` (Studio changes on top of baseline `796e234`), API commits `6df1ea5..1aed62e` (on top of `292b5aa`). Rebuild (`npm run build`; `nest build`), redeploy, then smoke (health, login, dashboard, storefront, import). Reverting the frontend alone is safe (the extra API route and query are optional); reverting the API alone breaks the collection delete flow.
**C Migrations:** 0032 `product_presentations` (new table, 4 alters, triggers, RLS), 0033 public functions (`create or replace`), 0034 store subdomain, 0035 subdomain column. None drops anything; Drizzle has no down migrations, so they are **forward-only**. They are additive and compatible with the previous application version (old code ignores new tables/columns). Recovery for a bad migration: a corrective forward migration; never delete migration history. Studio itself adds no migration.
**D Storefront content:** version history sheet in the editor (or `POST /store/templates/:id/rollback {versionId}`, permission `store:manage`) restores a previous immutable version and invalidates the cache tag; verified at API level (existing suite, `studio-permissions` rollback call); the UI rollback is now driven in a browser (History > Restore; the live storefront followed at once). A rollback or publish called directly on the API changes the data, but the Next storefront cache is refreshed only by the editor action, so the storefront follows when the cache expires (D-011): use the editor, or revalidate the store cache tag after an API-only change. Per-product presentations have no version history (reset only; verified from the schema: draft and published columns only).
**E Post-rollback verification:** API health, login/dashboard, storefront render, products/categories pages, a collection delete on an unused collection, no partial imports (count products for the import test prefix), cross-tenant calls return 404.

## Unverified operational gaps
Production configuration (no deployment config such as `vercel.json` is tracked; `scripts/bundle-vercel.mjs` exists in the API), staging, cache behaviour when revalidation fails (V-2 not investigated), per-product cache invalidation, rollback drill.
