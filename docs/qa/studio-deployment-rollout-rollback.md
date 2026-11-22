# Studio deployment, rollout and rollback

Status of this document: a blueprint. Items marked **Verified** were executed in the isolated local environment on 2026-11-22; everything else is **proposed**. No production deployment or rollback was run, and no production telemetry exists, so thresholds below are proposed operational gates, not measured metrics.

## A. Deployment sequence (the implementation supports steps 1–5 and 7)
1. **Database migrations 0036, 0037** — additive; **Verified** on the existing local DB: members migrated (admin → design publish + attest, settings-read staff → design read), 0 legal wordings/approvals, 0 rollout rows (`test-results/migration-0036-existing-db-members.txt`, `migration-0037-defaults.txt`). Hazard: migration 0036 changes template write policies — the API and DB must go together; an old API with the new DB denies members whose settings level does not map.
2. **API** — deploy before the frontend (new routes, `acknowledgedWarnings`, design permissions). **Verified** locally: rebuild + restart, health 200.
3. **Manifest bundle** — the API ships a copy; the drift tests must pass in CI (both repos). **Verified** (tests).
4. **Frontend/editor** — deploy after the API. Hazard: with Studio on, publish is refused while the store has images without alt text and the editor has no readiness panel to resolve it.
5. **Storefront renderer compatibility** — schema 1 renders unchanged (golden tests pass). Schema 2 renders per unit tests only.
6. **Legal approvals** — a platform admin records them; none exist, none were created. Gated components stay unavailable.
7. **Per-store flag** — platform admin only; default off. **Verified** below.
8–11. Internal store → friendly stores → batches → general availability: **proposed**; entry/exit gates in section C.

## B. Feature flag (Verified locally)
- Existing store default: `GET /store/studio/status` → `enabled:false` (`R1-flag-and-display-run.json`).
- Platform admin enable/disable with a required reason: both 200; events and audit are written (API e2e).
- Flag off: no "When to show" panel (`screenshots/deployment/R1-flag-off-editor-no-display-panel.png`); storefront and public layout return 200 after disabling.
- Flag on: panel appears (`screenshots/release-1/R1-display-rules-panel-visible-flag-on.png`).
- Verified after the QA-D-001 fix: the first schema-2 save keeps the previous document as a migration version (when the saver can publish), and schema-2 content stays readable and publishable with the flag off. Not verified: point of no return (no writer), draft/published data unchanged across disable→re-enable (comparison not run).

## C. Go/No-Go gates (current evaluation)
| Area | Go condition | Now |
|---|---|---|
| Acceptance criteria | All stage-required criteria PASS | NO: 26/129 pass |
| Critical defects | 0 | 0 found |
| High defects | 0 release blockers | QA-D-001 fixed and retested; none open at High (QA-D-002/003 are Medium) |
| API schema 1+2 | verified | Yes for save/read/publish with Studio off (API e2e + real browser); publish with Studio on blocked by readiness gaps |
| Permissions | all pass | Backend yes; UI publish gating unverified |
| Database | existing-DB migration verified | Yes (local) |
| Security | no critical/high open | Independent review not performed |
| Publishing | fingerprint + revision checks | NO: fingerprint not built |
| Legal | approvals for each activated feature | None activated; none exist |
| Feature flags | enable/disable verified | Partly |
| Storefront | existing rendering works | Yes (200, goldens) |
| E2E | mandatory workflows pass | NO |
| Screenshots | evidence indexed | Partial |
| Performance | measured vs targets | Insufficient data (no measurement collected) |
| Accessibility | WCAG checks done | NO |
| Rollback | documented and tested | Documented; partially simulated |

**Decision: NO-GO.** CONDITIONAL GO is not available while a publishing-integrity gap (QA-D-001, no fingerprint) is open.

## D. Rollback procedure
1. **Detect (proposed triggers):** publish/save error rate rising for enabled stores; any cross-tenant read; storefront 5xx on enabled stores; permission-migration discrepancy. Severity: Sev1 tenant leak or storefront down; Sev2 publish failing; Sev3 cosmetic. Owner: release engineer on call, platform admin for the flag.
2. **Stop rollout:** halt further flag enablement.
3. **Disable Studio for affected stores:** `PUT platform/organizations/:id/studio-rollout {enabled:false, reason}`. This hides new functionality only; it does **not** reverse migrations or unpublish content.
4. **Confirm storefront:** load home, product, collection, cart; confirm HTTP 200 and expected content.
5. **Roll back deployments** only if safe: frontend first, then API. Do not roll back the API below migration 0036 while the DB is at 0036 (policies would reject writes for some members).
6. **Schema compatibility:** v1 readers are unchanged. A store that saved v2 content cannot be returned to v1 automatically; fix forward or run a supervised recovery that preserves published behaviour.
7. **Database:** migrations are additive; prefer forward-fix. Never drop the new tables or `capabilities` without measuring data loss; the permission migration is recorded in `design_permission_migration_log`.
8. **Preserve** published content, drafts, audit rows and attestations (append-only tables; do not truncate).
9. **Verify recovery:** health, login, editor opens, publish of a trivial change works for a non-Studio store, storefront renders.
10. **Re-enable gradually:** one internal store, then friendly stores, after the root cause is fixed and QA-D-001-class checks pass.

## E. Rollback simulation (partial, local)
Done: enable → open editor (panel visible) → attempted draft (rejected, QA-D-001) → disable → storefront 200, public layout 200. Not done: publish representative content while enabled, compare data before/after, re-enable. A full simulation needs QA-D-001 fixed first.
