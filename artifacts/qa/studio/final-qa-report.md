# Store Forge Studio — final QA report (2026-11-22)

**Recommendation: `PARTIALLY COMPLETE` for Release 1 foundations; overall `BLOCKED — NO-GO` for any rollout.** Releases 2–4 are not implemented. QA-D-001 (saving a display rule) is fixed and retested in the real application; publishing display rules with Studio on is still blocked by missing readiness UI and shipped-theme alt-text blockers.

## Executive summary
- Release 1: foundations exist and are backend-verified (permissions, migrations, rollout flag, legal gate, attestation, media validation, readiness engine and publish gate). The merchant flow is broken by QA-D-001 and several UIs are missing. Countdown and trust badges are legal-blocked.
- Release 2, 3, 4: NOT IMPLEMENTED (no reviews, recommendations, slots, web vitals, reusable sections, review workflow, ledger/discard, SEO or landing pages).
- Deployment readiness: NO-GO (see `docs/qa/studio-deployment-rollout-rollback.md`).
- This pass was limited: no independent security review, no accessibility scan, no performance measurement, no E2E of badges/countdown.

## Acceptance criteria summary (129 criteria from spec section 11)
| Status | Count | % of 129 |
|---|---:|---:|
| PASS | 26 | 20.2% |
| FAIL | 0 | 0.0% |
| NOT IMPLEMENTED | 69 | 53.5% |
| BLOCKED | 14 | 10.9% |
| NOT VERIFIED | 20 | 15.5% |
| DEFERRED BY SPECIFICATION | 0 (deferred features, spec Appendix B, are not counted as criteria) | – |
| TOTAL | 129 | |

| Release | Pass | Fail | Blocked | Not verified | Not implemented |
|---|---:|---:|---:|---:|---:|
| 1 | 26 | 0 | 14 | 20 | 11 |
| 2 | 0 | 0 | 0 | 0 | 32 |
| 3 | 0 | 0 | 0 | 0 | 24 |
| 4 | 0 | 0 | 0 | 0 | 2 |

Register: `docs/qa/studio-acceptance-criteria-register.md` (copy in this folder). Index: `evidence-index.md`. Every PASS is backend, migration or pure-logic behaviour backed by test output or real-DB output, except AC-DSP-06, which is a real-browser result (hero hidden at 390 wide, visible at 1280).

## Execution report
- Commands: `vitest run` (FE), `tsc --noEmit`, `vitest run` (API unit), `vitest --config vitest.config.e2e.ts` with `CORS_ORIGINS=http://localhost:3000`, integration config, Playwright specs `studio-qa-r1`, `studio-qa-schema2`.
- Results: FE unit 147 files / 2936 tests pass; typecheck exit 0; API unit 321; API e2e 390 (26 files); integration 13. Playwright: 3 tests, 3 passed (they assert state; the defect is recorded as evidence, not as a test failure).
- Environment: Windows, local Supabase stack, API :4000 (throttle raised to 5000/min), `next dev` :3100, Chromium desktop 1280×800. Frontend branch `integrate/pr7-santu-templates-on-main` @ 9cf1440 and API `integrate/pr9-santu-themes-on-main` @ 703341d, both with large uncommitted changes. Migrations 0036/0037 applied to the existing local DB.
- Screenshots: 4 genuine browser screenshots mapped to criteria, plus 1 kept mis-click file named NOT-EVIDENCE. 0 mobile screenshots, 0 videos, 0 traces saved in this folder (Playwright output went to the temp directory). Missing: every Release 1 component workflow, permission-denied screens, readiness panel (does not exist).
- Not exercised in the browser: palette, copy/paste, countdown, badges, reviews, recommendations, publishing workflow, per-role editor experience, SEO.

## Security report
Verified by tests: design level matrix at API and DB, independent attest/discard, append-only enforcement for owner and app roles, two-tenant isolation on new tables and routes, media path/mime restrictions, rollout and wording tables unreachable by tenants. **Not done:** independent security review, secret-exposure scan of bundles/logs, concurrency/failure injection, CSS-injection and protected-content tests in a browser. Risks open: legal gate not enforced on media upload/attestation (implementer-reported), UI may still offer Publish to write-level members.

## Defects
QA-D-001 was High: FIXED and retested (see register). Open: QA-D-002 (Medium, implementer-reported, unreproduced), QA-D-003 (Medium, missing UIs), QA-D-004 (Low, uncommitted work). No critical defects.

## Rollout and rollback
Flag default-off, platform-admin enable/disable and audit verified locally; rollback blueprint written; simulation partial; production thresholds are proposed only. See the deployment document.

## Performance and accessibility
No measurement or scan was run. Status for LCP/CLS/INP: **Insufficient data** (not pass, not fail). WCAG: NOT VERIFIED.

## Final recommendation
`PARTIALLY COMPLETE` (Release 1 foundations only); do not roll out. Next: fix QA-D-001, build the readiness panel and flag admin UI, then rerun this QA pass; Releases 2–4 need implementation first.

## QA-D-001 retest addendum (2026-11-22)
- Commands: `vitest run` (API unit, 25 files / 341 tests), `vitest --config vitest.config.e2e.ts` with `CORS_ORIGINS=http://localhost:3000` (27 files / 404 tests), integration (13), `tsc --noEmit` and `oxlint` clean; Playwright `studio-qa-d001.spec.ts` (1 test, passed, ~1 min). Logs: `test-results/qa-d-001-api-unit.txt`, `qa-d-001-api-e2e.txt`, `qa-d-001-api-int.txt`, `QA-D-001-retest.json`.
- Environment: local Supabase, rebuilt API on :4000 (throttle 5000/min), `next dev` :3100, Chromium 1280×800 and 390×800. Frontend branch `integrate/pr7-santu-templates-on-main` @ 9cf1440 and API `integrate/pr9-santu-themes-on-main` @ 703341d, both with uncommitted changes (nothing committed).
- Screenshots (6 genuine): `screenshots/qa-d-001/01-display-rule-panel-before.png`, `02-display-rule-saved-no-error.png`, `03-display-rule-restored-after-refresh.png` (preview iframe still loading when captured), `04-publish-succeeded.png`, `05-storefront-desktop-hero-visible.png`, `06-storefront-mobile-hero-hidden.png`.
- Frontend suites were not re-run for this fix (no frontend code changed; only a new Playwright spec was added).
- NOT VERIFIED: schedule rules in a browser; publish with Studio on; accessibility; performance.
