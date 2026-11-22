# Test execution summary (fresh pass)

| Command (cwd, sha, window IST, exit) | Result |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` (., 9cf1440, start=14:34:25 end=14:34:32, exit=0) | ok |
| `node node_modules/eslint/bin/eslint.js lib components services app tests` (., 9cf1440, start=14:34:32 end=14:35:18, exit=0) | ok |
| `node node_modules/vitest/vitest.mjs run` (., 9cf1440, start=14:35:18 end=14:36:18, exit=0) |  Test Files  147 passed (147);      Tests  2936 passed (2936); |
| `node node_modules/typescript/bin/tsc --noEmit` (../store-forge-api-integ, 703341d, start=14:36:18 end=14:36:31, exit=0) | ok |
| `node node_modules/oxlint/bin/oxlint --type-aware src/ test/` (../store-forge-api-integ, 703341d, start=14:36:32 end=14:36:34, exit=0) | ok |
| `node node_modules/vitest/vitest.mjs run` (../store-forge-api-integ, 703341d, start=14:36:35 end=14:36:54, exit=0) |  Test Files  25 passed (25);      Tests  341 passed (341); |
| `node node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts` (../store-forge-api-integ, 703341d, start=14:36:54 end=14:41:14, exit=0) |  Test Files  27 passed (27);      Tests  404 passed (404); |
| `node node_modules/vitest/vitest.mjs run --config vitest.config.integration.ts` (../store-forge-api-integ, 703341d, start=14:41:15 end=14:41:25, exit=0) |  Test Files  1 passed (1);      Tests  13 passed (13); |
| `npx playwright test -c artifacts/studio-e2e/qa/playwright.qa.config.ts` (., 9cf1440, start=14:45:58 end=14:48:05, exit=0) | ok |

Repo Playwright specs (fresh): studio-nav-group 1/1; studio-restricted-members 9 pass, 1 fail (catalogue-only expectation is stale vs design:none, reproducible; the page correctly refuses a design:none member); studio-collection-picker fails 2 of 2 — both runs happened while another process (`scripts/qa/record-all-videos.cjs`, flag reason "Studio Feature Demo Recording") had switched Studio on for the shared store, so the publish step was refused by the readiness gate; result is INVALID for this pass, not attributed to the product; studio-storefront-errors 4/4 fail with ECONNREFUSED 127.0.0.1:4100 because its fault proxy was not running (environment).
QA journey (`artifacts/studio-e2e/qa/journey.qa.ts`): 2/2 pass on the final run; two earlier runs of the same journey were invalid (trace and video were not capturing the journey; a tracing collision) and were discarded, leaving the store restored each time.
Counts: FE 147 files / 2936 tests; API unit 25 / 341; API e2e 27 / 404; integration 1 / 13; skipped 0 reported. FE lint 0 errors.
NOT re-run in this pass: `next build` and `nest build` (the shared dev server and API are in use by the concurrent recording process, so they were not stopped). Last successful builds: earlier on 2026-11-22 at the same commits and tree (`artifacts/studio-e2e/logs/fe-build.raw`, `api-build.raw` from the previous pass, exit 0) — cited as earlier evidence, not fresh. Not run: migration test on a production-data copy, hosted database tests, INP measurement, screen-reader testing.
