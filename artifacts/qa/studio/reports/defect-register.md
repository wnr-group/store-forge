# Studio QA defect register (2026-11-22)

## QA-D-001 — API rejected schema 2 and `display`, so display rules could not be saved (was HIGH) — FIXED, retested PASS on 2026-11-22
- **ACs:** AC-DSP-05 (now PASS), AC-DSP-06 (now PASS, device rule in a real browser); AC-DSP-11 now reachable but not retested.
- **Root cause (confirmed):** `src/modules/themes/validation/template-document.ts` had two rejection points: `schemaVersion !== 1` and a node allow-list (`type, settings, blocks, block_order, disabled`) without `display`. Response before the fix: HTTP 400 `Schema version must be 1.` and `Unknown fields: display.` (`test-results/R1-schema2-api-behaviour.json`).
- **Fix (API repo, uncommitted):**
  - the validator accepts schema versions 1 and 2, allows `display` on sections and blocks only in a schema 2 document (also inside pages stored in theme settings), and validates it with the shared `analyzeDisplay` parser (one schedule, one device rule, ISO instants with offset, end after start, known timezone, no unknown fields, at most 2 rules); schema 3 and string versions are rejected; unknown node fields are still rejected;
  - `saveDraft` refuses schema 2 for stores without Studio turned on (clear message), and on the first move from schema 1 to 2 keeps the previous document as a `template_versions` row with source `migration` (no new migration needed; `migration` was already an allowed source);
  - publish still runs the readiness gate and legal gates unchanged.
- **Regression tests:** `src/modules/themes/validation/template-document.spec.ts` (20 new cases incl. the exact original payload) and `test/studio-schema2.e2e-spec.ts` (14 tests: schema 1 save/read, schema 2 refused with Studio off, v1+display refused, schema 2 + display saved on section and nested block and read back identical, migration version written once and equal to the original, 4 invalid variants write nothing, unknown fields, stale revision 409, none/read 403, write allowed, cross-tenant 404, publish needs acknowledgement for an expired schedule and then the rules go live, Studio off keeps v2 readable). One existing unit test asserted that schema 2 is rejected (the defect itself); it now asserts schema 3 and "2" as a string are rejected.
- **Real-application retest** (`tests/e2e/studio-qa-d001.spec.ts`, rebuilt API + dev frontend + real DB): panel opens, Mobile toggled, footer shows "All changes saved" with no error bar; API draft is schemaVersion 2 with `{v:1, rules:[{type:device, desktop:true, tablet:true, mobile:false}]}` (revision 188); after a page refresh the toggle and the "Hidden on Mobile" badge are restored; after publishing, the live storefront hides the hero at 390 wide and shows it at 1280. Evidence: `test-results/QA-D-001-retest.json`, `screenshots/qa-d-001/01..06`. The demo store was restored afterwards (no hide class in live HTML).
- **Limits of this retest (NOT VERIFIED):** one rule type (device) on one section; schedule rules in a real browser; publishing with Studio ON — with Studio on, publish is refused by the readiness gate because the shipped theme has two images without alt text and the editor has no readiness panel to show or acknowledge issues (QA-D-002/003), so the publish in the retest was done with Studio switched off; the previous-draft migration row is written only when the saver holds `design:publish` (a version row needs it under migration 0036), so a write-level saver's v1 draft is not preserved.
- **Status: FIXED / RETEST PASS for the saving defect.** Publishing display rules with Studio on remains blocked by other gaps.

## QA-D-002 — Readiness and legal-gate gaps reported by the implementers (MEDIUM, not independently reproduced)
- Gate not enforced on media upload-requests/attestations; atelier catalogue theme has two images without alt text, so a Studio-enabled store applying it is blocked; `PURCHASE_FLOW_LIVE` is a constant; `badge.excluded-claim` and `media.image.oversized` rules absent; `point_of_no_return` has no writer.
- Source: implementer reports plus code inspection of the rule list. Reproduce before triage.

## QA-D-003 — No merchant or admin UI for several delivered backends (MEDIUM)
- No readiness panel, no rollout-flag admin screen, no legal wording/approval screens, no attestation dialog verified in a browser. Related ACs are NOT IMPLEMENTED or BLOCKED.

## QA-D-004 — Working tree uncommitted (LOW, process)
- All Studio work in both repos is uncommitted (by instruction). It can be lost or mixed with unrelated changes.

No critical-severity defect was found. A security review by an independent agent was NOT performed in this pass.
