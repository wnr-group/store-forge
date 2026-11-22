# Studio acceptance criteria register

Criteria come from spec section 11; verified 2026-11-22 on the local integration worktrees (frontend 9cf1440 + uncommitted work, API 703341d + uncommitted work; nothing committed). A unit test alone never makes a user-facing criterion PASS.

| AC ID | Rel | Feature | Criterion | Status | Verification | Evidence (relative to artifacts/qa/studio) | Notes |
|---|---|---|---|---|---|---|---|
| AC-A11-01 | 1 | Accessibility | Keyboard/focus/name/motion checks and automated scan | **NOT VERIFIED** | - | - | No automated scan run in this pass |
| AC-A11-02 | 1 | Accessibility | Manual WCAG 2.2 AA audit recorded | **NOT VERIFIED** | - | - | No manual audit performed |
| AC-BDG-01 | 1 | Trust badges | Preset badge label from catalogue + owner-statement label | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-BDG-02 | 1 | Trust badges | Text+icon badge length-limited, closed icon library | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-BDG-03 | 1 | Trust badges | Attestation requires the attest capability (API and DB) | **PASS** | API/DB e2e | test-results/api-e2e.txt | Writer and publisher denied at API and by RLS |
| AC-BDG-04 | 1 | Trust badges | Publishing an uploaded mark without attestation is blocked | **NOT IMPLEMENTED** | - | - | badge.attestation.missing rule not implemented |
| AC-BDG-05 | 1 | Trust badges | Only JPEG/PNG/WebP within limits; SVG, traversal, other-tenant paths rejected | **PASS** | API/DB e2e | test-results/api-e2e.txt |  |
| AC-BDG-06 | 1 | Trust badges | Uploaded mark cannot be saved without alt text | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-BDG-07 | 1 | Trust badges | Excluded claims blocked by the server | **NOT IMPLEMENTED** | - | - | Server rule is an empty stub; only an FE helper exists |
| AC-BDG-08 | 1 | Trust badges | requires_purchase_flow badges hidden/refused | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-BDG-09 | 1 | Trust badges | Badge links limited to internal paths and HTTPS | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-BDG-10 | 1 | Trust badges | Attestation stores user, type, exact wording version, time; immutable | **PASS** | API/DB e2e | test-results/api-e2e.txt | Append-only for owner and app role |
| AC-BDG-11 | 1 | Trust badges | Badge data reusable across pages and themes | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-01 | 1 | Promo banner | Existing banners follow display rules with no per-component code | **NOT VERIFIED** | - | - | Depends on QA-D-001 for any persisted rule |
| AC-CMP-10 | 1 | Countdown | Countdown criterion 10 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-11 | 1 | Countdown | Countdown criterion 11 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-12 | 1 | Countdown | Countdown criterion 12 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-13 | 1 | Countdown | Countdown criterion 13 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-14 | 1 | Countdown | Countdown criterion 14 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-15 | 1 | Countdown | Countdown criterion 15 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-16 | 1 | Countdown | Countdown criterion 16 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-CMP-17 | 1 | Countdown | Countdown criterion 17 | **BLOCKED** | unit | test-results/fe-unit.txt | BLOCKED: no legal approval record exists (never fabricated); component is unavailable by design; only unit-level checks exist |
| AC-DSP-01 | 1 | Display rules | Schedule-inactive section absent from response HTML | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-02 | 1 | Display rules | Section appears inside schedule and disappears after end with no publish | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-03 | 1 | Display rules | Boundary honoured inside the 300 s data-cache window | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-04 | 1 | Display rules | Stored instant unchanged when store timezone changes | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-05 | 1 | Display rules | End <= start rejected on save/publish | **PASS** | API e2e | test-results/api-e2e.txt; test-results/qa-d-001-api-e2e.txt | studio-schema2 e2e: end-before-start returns 400 and writes nothing; validator unit tests cover each malformed variant. Save is rejected by the validator (field error on display); the display.schedule.order readiness rule still covers documents that reach publish. Fixed QA-D-001 |
| AC-DSP-06 | 1 | Display rules | Device rule: node in HTML, hidden by CSS only | **PASS** | real browser + API | test-results/QA-D-001-retest.json; screenshots/qa-d-001/05-storefront-desktop-hero-visible.png; screenshots/qa-d-001/06-storefront-mobile-hero-hidden.png | Hero hidden at 390 wide and visible at 1280 on the live storefront after a real editor save and publish; the page HTML carries the hide class. Verified on one section (Hero Banner), with Studio switched off at publish time |
| AC-DSP-07 | 1 | Display rules | 27 _style.hidden combinations keep effective visibility after migration | **PASS** | unit | test-results/fe-unit.txt | Pure transformation |
| AC-DSP-08 | 1 | Display rules | v1 document opened but not saved stays v1 | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-09 | 1 | Display rules | Preview clock honoured in editor, ignored on public requests | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-10 | 1 | Display rules | Same result on Boutique/Market/Sport looks | **NOT VERIFIED** | unit only | - | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) |
| AC-DSP-11 | 1 | Display rules | All-devices-off raises display.device.none (WARNING) | **NOT VERIFIED** | API e2e | test-results/api-unit.txt | Rule unit-tested; now reachable through the real save path (QA-D-001 fixed) but not retested end to end |
| AC-EDT-01 | 1 | Editor | Shell split keeps behaviour (existing suites unchanged) | **NOT VERIFIED** | unit | test-results/fe-unit.txt | 1,539 to ~400 lines; characterisation tests pass; existing Playwright editor suites not re-run after the split |
| AC-EDT-05 | 1 | Editor | Editor controls keyboard-reachable; automated scan clean | **NOT VERIFIED** | - | - | Not tested |
| AC-I18-01 | 1 | Language | No hard-coded user-visible English in first-party components | **NOT IMPLEMENTED** | - | - | Catalogue exists; the literal-scan test does not |
| AC-I18-02 | 1 | Language | Disclosure stored with language tag; readiness checks presence | **NOT IMPLEMENTED** | - | - | Belongs to reviews (R2) |
| AC-I18-03 | 1 | Language | Dates and currency locale-formatted in store timezone | **PASS** | unit | test-results/fe-unit.txt | Pure formatter tests |
| AC-LGL-01 | 1 | Legal gate | Gated component unavailable in editor, API, DB, storefront without approval | **NOT VERIFIED** | API e2e + real status | test-results/R1-flag-and-display-run.json | Real status: badge_upload/review_import unavailable (0 approvals). Implementer reports the gate is not enforced on media upload-requests or attestations (not reproduced here); editor/storefront not browser-verified |
| AC-LGL-02 | 1 | Legal gate | Recorded approval makes component available without a deploy | **PASS** | API e2e | test-results/api-e2e.txt | Approval inserted in a test DB only; none exists on any real database |
| AC-LGL-03 | 1 | Legal gate | Earlier attestations keep the wording version they accepted | **PASS** | API e2e | test-results/api-e2e.txt |  |
| AC-MED-01 | 1 | Media | Asset records owner, type, size, dimensions, alt, stable attestation reference | **PASS** | API/DB e2e | test-results/api-e2e.txt |  |
| AC-MET-01 | 1 | Measurement | Adoption/time-to-publish/readiness/rollback metrics without personal data | **NOT IMPLEMENTED** | - | - | Not built |
| AC-PRM-01 | 1 | Permissions | Level capability matrix identical in FE, API and DB | **PASS** | unit+API+DB | test-results/fe-unit.txt; test-results/api-e2e.txt | 33 design-permissions e2e tests + FE matrix tests |
| AC-PRM-02 | 1 | Permissions | design:write cannot publish/restore in UI, API or DB | **NOT VERIFIED** | API/DB e2e | test-results/api-e2e.txt | API and DB refuse (tested). The editor gets only a canManage flag, so Publish is likely still offered to write-level members; not browser-verified |
| AC-PRM-03 | 1 | Permissions | publish without attest cannot attest; attest alone cannot edit | **PASS** | API/DB e2e | test-results/api-e2e.txt |  |
| AC-PRM-04 | 1 | Permissions | Pre-R3 Staff-preset member has no edit access | **PASS** | API e2e + real DB | test-results/api-e2e.txt; test-results/migration-0036-existing-db-members.txt | Real migrated DB: staff@demo.test design=read (open item O10 resolved as read, not none) |
| AC-PRM-05 | 1 | Permissions | Permission migration idempotent | **PASS** | API e2e | test-results/api-e2e.txt | Also applied once to the real local DB |
| AC-PRM-06 | 1 | Permissions | No Owner/Manager loses publish; no Staff gains it | **PASS** | API e2e + real DB | test-results/api-e2e.txt; test-results/migration-0036-existing-db-members.txt | Real DB: admin=publish+attest, staff=read |
| AC-PRM-07 | 1 | Permissions | Existing modules behave identically | **PASS** | API e2e regression | test-results/api-e2e.txt | Implementer updated three fixture helpers to the new mapping |
| AC-PRM-08 | 1 | Permissions | product_presentations gated at DB for non-design:write | **PASS** | DB e2e | test-results/api-e2e.txt |  |
| AC-RDY-01 | 1 | Readiness | Blocker disables Publish in UI and API rejects it, no override | **NOT IMPLEMENTED** | API e2e | test-results/api-e2e.txt | API half passes; the readiness panel UI does not exist |
| AC-RDY-02 | 1 | Readiness | Warnings need acknowledgement; stored on the publish event | **PASS** | API e2e | test-results/api-e2e.txt |  |
| AC-RDY-03 | 1 | Readiness | INFORMATION never affects publishing | **NOT VERIFIED** | - | - | No rule emits INFORMATION yet |
| AC-RDY-04 | 1 | Readiness | Issue carries severity, message, item, fix action, navigable control path | **NOT VERIFIED** | API e2e | test-results/api-e2e.txt | Contract passes; no editor navigation exists |
| AC-RDY-05 | 1 | Readiness | Server reruns mandatory rules inside the publish transaction before any write | **PASS** | API e2e | test-results/api-e2e.txt | No rows written after a blocked publish |
| AC-RDY-06 | 1 | Readiness | Every catalogue rule has pass+fail test and decided severity | **NOT VERIFIED** | unit | test-results/api-unit.txt | badge.excluded-claim stub and media.image.oversized missing |
| AC-RDY-07 | 1 | Readiness | Contrast 2.9/3.0/4.4/4.5 give blocker/none/warning/none | **PASS** | unit | test-results/api-unit.txt |  |
| AC-RDY-08 | 1 | Readiness | Uncomputable background gives manual-review warning, never a pass | **PASS** | unit | test-results/api-unit.txt |  |
| AC-RDY-09 | 1 | Readiness | Informative image without alt blocks; decorative passes | **PASS** | unit/API | test-results/api-unit.txt; test-results/api-e2e.txt |  |
| AC-RDY-10 | 1 | Readiness | Hard limits block, estimates only warn | **NOT IMPLEMENTED** | - | - | Document-limit rule exists; media.image.oversized and perf.estimate.* do not |
| AC-RDY-11 | 1 | Readiness | Readiness chip shows counts and last-checked time | **NOT IMPLEMENTED** | - | - | No readiness UI |
| AC-REG-01 | 1 | Registry | Generated manifest bundle equals FE source; drift test fails on difference | **PASS** | unit (both repos) | test-results/fe-unit.txt; test-results/api-unit.txt | FE and API drift tests pass. The API document validator still keeps its own type lists (QA-D-001), so only readiness derives from the bundle |
| AC-REG-02 | 1 | Registry | Manifest missing a required field fails with field names, not values | **PASS** | unit | test-results/fe-unit.txt |  |
| AC-REG-03 | 1 | Registry | Undeclared data permission refused by the server data resolver | **NOT IMPLEMENTED** | - | - | No server data resolver exists yet |
| AC-REG-04 | 1 | Registry | All 18 sections / 22 blocks have manifests; stored docs render identically (golden) | **PASS** | unit | test-results/fe-unit.txt | Golden render fixtures pass; no browser comparison |
| AC-REG-05 | 1 | Registry | Unavailable component refused by editor, API and database | **NOT VERIFIED** | unit/API | - | No database-level refusal exists; API refuses only at publish with the flag on; not verified end to end |
| AC-ROL-01 | 1 | Rollout | Existing store flag off; merchant cannot enable; platform-admin changes audited | **PASS** | real API + browser + e2e | test-results/R1-flag-and-display-run.json; screenshots/deployment/R1-flag-off-editor-no-display-panel.png | Real run: enabled=false before; platform admin enabled/disabled with reasons (200). No admin screen exists for the flag (API only) |
| AC-ROL-02 | 1 | Rollout | Flag off: new functionality inaccessible, no data modified | **NOT VERIFIED** | real run | test-results/R1-storefront-after-disable.txt | Panel absent when off (screenshot); storefront 200 after disabling; no before/after data comparison performed |
| AC-ROL-03 | 1 | Rollout | Point of no return recorded; automatic return refused | **NOT IMPLEMENTED** | - | - | Columns exist; nothing writes them |
| AC-ROL-04 | 1 | Rollout | Dry-run harness on a production-data copy: zero differences | **NOT IMPLEMENTED** | - | - | Harness not built |
| AC-EDT-02 | 2 | Editor | Searchable palette with previews, recents, favourites | **NOT IMPLEMENTED** | - | - | Not built |
| AC-EDT-03 | 2 | Editor | Copy/paste of nodes across pages | **NOT IMPLEMENTED** | - | - | Not built |
| AC-EDT-04 | 2 | Editor | Style paste between compatible components | **NOT IMPLEMENTED** | - | - | Not built |
| AC-PRF-01 | 2 | Web vitals | Web-vitals criterion 1 | **NOT IMPLEMENTED** | - | - | No collection or speed indicator |
| AC-PRF-02 | 2 | Web vitals | Web-vitals criterion 2 | **NOT IMPLEMENTED** | - | - | No collection or speed indicator |
| AC-PRF-03 | 2 | Web vitals | Web-vitals criterion 3 | **NOT IMPLEMENTED** | - | - | No collection or speed indicator |
| AC-PRF-04 | 2 | Web vitals | Web-vitals criterion 4 | **NOT IMPLEMENTED** | - | - | No collection or speed indicator |
| AC-REC-01 | 2 | Recommendations | Recommendations criterion 1 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-02 | 2 | Recommendations | Recommendations criterion 2 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-03 | 2 | Recommendations | Recommendations criterion 3 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-04 | 2 | Recommendations | Recommendations criterion 4 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-05 | 2 | Recommendations | Recommendations criterion 5 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-06 | 2 | Recommendations | Recommendations criterion 6 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REC-07 | 2 | Recommendations | Recommendations criterion 7 | **NOT IMPLEMENTED** | - | - | No sources, table or component exist |
| AC-REV-01 | 2 | Reviews | Merchant-reviews criterion 1 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-02 | 2 | Reviews | Merchant-reviews criterion 2 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-03 | 2 | Reviews | Merchant-reviews criterion 3 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-04 | 2 | Reviews | Merchant-reviews criterion 4 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-05 | 2 | Reviews | Merchant-reviews criterion 5 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-06 | 2 | Reviews | Merchant-reviews criterion 6 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-07 | 2 | Reviews | Merchant-reviews criterion 7 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-08 | 2 | Reviews | Merchant-reviews criterion 8 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-09 | 2 | Reviews | Merchant-reviews criterion 9 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-10 | 2 | Reviews | Merchant-reviews criterion 10 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-11 | 2 | Reviews | Merchant-reviews criterion 11 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-12 | 2 | Reviews | Merchant-reviews criterion 12 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-REV-13 | 2 | Reviews | Merchant-reviews criterion 13 | **NOT IMPLEMENTED** | - | - | No reviews table, API or UI exists |
| AC-SLT-01 | 2 | Slots/cart drawer | Slot criterion 1 | **NOT IMPLEMENTED** | - | - | No group_cart_drawer kind or slot registry |
| AC-SLT-02 | 2 | Slots/cart drawer | Slot criterion 2 | **NOT IMPLEMENTED** | - | - | No group_cart_drawer kind or slot registry |
| AC-SLT-03 | 2 | Slots/cart drawer | Slot criterion 3 | **NOT IMPLEMENTED** | - | - | No group_cart_drawer kind or slot registry |
| AC-SLT-04 | 2 | Slots/cart drawer | Slot criterion 4 | **NOT IMPLEMENTED** | - | - | No group_cart_drawer kind or slot registry |
| AC-SLT-05 | 2 | Slots/cart drawer | Slot criterion 5 | **NOT IMPLEMENTED** | - | - | No group_cart_drawer kind or slot registry |
| AC-LDG-01 | 3 | Ledger/discard | Ledger/discard criterion 1 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-02 | 3 | Ledger/discard | Ledger/discard criterion 2 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-03 | 3 | Ledger/discard | Ledger/discard criterion 3 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-04 | 3 | Ledger/discard | Ledger/discard criterion 4 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-05 | 3 | Ledger/discard | Ledger/discard criterion 5 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-06 | 3 | Ledger/discard | Ledger/discard criterion 6 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-07 | 3 | Ledger/discard | Ledger/discard criterion 7 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-LDG-08 | 3 | Ledger/discard | Ledger/discard criterion 8 | **NOT IMPLEMENTED** | - | - | No ledger or discard path |
| AC-PRM-09 | 3 | Permissions | New Staff default design:write after Release 3 | **NOT IMPLEMENTED** | - | - | Depends on the workflow; deliberately not enabled |
| AC-RSE-01 | 3 | Reusable sections | Reusable-section criterion 1 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-02 | 3 | Reusable sections | Reusable-section criterion 2 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-03 | 3 | Reusable sections | Reusable-section criterion 3 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-04 | 3 | Reusable sections | Reusable-section criterion 4 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-05 | 3 | Reusable sections | Reusable-section criterion 5 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-06 | 3 | Reusable sections | Reusable-section criterion 6 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-07 | 3 | Reusable sections | Reusable-section criterion 7 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-08 | 3 | Reusable sections | Reusable-section criterion 8 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-09 | 3 | Reusable sections | Reusable-section criterion 9 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-RSE-10 | 3 | Reusable sections | Reusable-section criterion 10 | **NOT IMPLEMENTED** | - | - | No reusable sections |
| AC-WFL-01 | 3 | Review workflow | Deterministic fingerprint | **NOT IMPLEMENTED** | - | - | Not built (fingerprint column exists; nothing writes it) |
| AC-WFL-02 | 3 | Review workflow | Ready for review cleared by any edit | **NOT IMPLEMENTED** | - | - | Not built (fingerprint column exists; nothing writes it) |
| AC-WFL-03 | 3 | Review workflow | Stale fingerprint rejected at publish | **NOT IMPLEMENTED** | - | - | Not built (fingerprint column exists; nothing writes it) |
| AC-WFL-04 | 3 | Review workflow | Presentations in review set | **NOT IMPLEMENTED** | - | - | Not built (fingerprint column exists; nothing writes it) |
| AC-WFL-05 | 3 | Review workflow | Unreviewed content cannot publish | **NOT IMPLEMENTED** | - | - | Not built (fingerprint column exists; nothing writes it) |
| AC-LND-01 | 4 | Landing pages | Landing page kind, unique slug, lifecycle | **NOT IMPLEMENTED** | - | - | No page template kind |
| AC-SEO-01 | 4 | SEO | Fallback metadata, validation, canonical URL and sitemap | **NOT IMPLEMENTED** | - | - | No SEO fields or sitemap work |
