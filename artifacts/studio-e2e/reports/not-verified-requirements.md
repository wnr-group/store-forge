# Not verified requirements

Rows describing absent features mean no code exists, so no behaviour could be executed. Releases 2, 3 and 4 are absent entirely (specification schedules them; they are not DEFERRED).

| Requirement ID | Release | Criterion | Detail | Evidence |
|---|---|---|---|---|
| AC-REG-03 | R1 | Undeclared data permission refused by the server data resolver | Feature absent from both repositories (No server data resolver exists yet) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REG-04 | R1 | All 18 sections / 22 blocks have manifests; stored docs render identically (golden) | Golden render fixtures pass; no browser comparison | test-results/fe-unit.txt |
| AC-DSP-01 | R1 | Schedule-inactive section absent from response HTML | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-02 | R1 | Section appears inside schedule and disappears after end with no publish | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-03 | R1 | Boundary honoured inside the 300 s data-cache window | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-04 | R1 | Stored instant unchanged when store timezone changes | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-08 | R1 | v1 document opened but not saved stays v1 | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-09 | R1 | Preview clock honoured in editor, ignored on public requests | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-10 | R1 | Same result on Boutique/Market/Sport looks | Unit/static-markup tests exist and pass; not covered by the QA-D-001 browser retest (it covers only the device rule on one section at 1280 and 390 wide) | - |
| AC-DSP-11 | R1 | All-devices-off raises display.device.none (WARNING) | Rule unit-tested; now reachable through the real save path (QA-D-001 fixed) but not retested end to end | test-results/api-unit.txt |
| AC-CMP-01 | R1 | Existing banners follow display rules with no per-component code | Depends on QA-D-001 for any persisted rule | - |
| AC-BDG-04 | R1 | Publishing an uploaded mark without attestation is blocked | Feature absent from both repositories (badge.attestation.missing rule not implemented) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-BDG-07 | R1 | Excluded claims blocked by the server | Feature absent from both repositories (Server rule is an empty stub; only an FE helper exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RDY-03 | R1 | INFORMATION never affects publishing | No rule emits INFORMATION yet | - |
| AC-RDY-10 | R1 | Hard limits block, estimates only warn | Feature absent from both repositories (Document-limit rule exists; media.image.oversized and perf.estimate.* do not) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RDY-11 | R1 | Readiness chip shows counts and last-checked time | Feature absent from both repositories (No readiness UI) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-A11-02 | R1 | Manual WCAG 2.2 AA audit recorded | No manual audit performed | - |
| AC-I18-01 | R1 | No hard-coded user-visible English in first-party components | Feature absent from both repositories (Catalogue exists; the literal-scan test does not) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-I18-02 | R1 | Disclosure stored with language tag; readiness checks presence | Feature absent from both repositories (Belongs to reviews (R2)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-ROL-03 | R1 | Point of no return recorded; automatic return refused | Feature absent from both repositories (Columns exist; nothing writes them) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-ROL-04 | R1 | Dry-run harness on a production-data copy: zero differences | Feature absent from both repositories (Harness not built) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-MET-01 | R1 | Adoption/time-to-publish/readiness/rollback metrics without personal data | Feature absent from both repositories (Not built) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-01 | R2 | Merchant-reviews criterion 1 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-02 | R2 | Merchant-reviews criterion 2 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-03 | R2 | Merchant-reviews criterion 3 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-04 | R2 | Merchant-reviews criterion 4 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-05 | R2 | Merchant-reviews criterion 5 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-06 | R2 | Merchant-reviews criterion 6 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-07 | R2 | Merchant-reviews criterion 7 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-08 | R2 | Merchant-reviews criterion 8 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-09 | R2 | Merchant-reviews criterion 9 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-10 | R2 | Merchant-reviews criterion 10 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-11 | R2 | Merchant-reviews criterion 11 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-12 | R2 | Merchant-reviews criterion 12 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REV-13 | R2 | Merchant-reviews criterion 13 | Feature absent from both repositories (No reviews table, API or UI exists) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-01 | R2 | Recommendations criterion 1 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-02 | R2 | Recommendations criterion 2 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-03 | R2 | Recommendations criterion 3 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-04 | R2 | Recommendations criterion 4 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-05 | R2 | Recommendations criterion 5 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-06 | R2 | Recommendations criterion 6 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-REC-07 | R2 | Recommendations criterion 7 | Feature absent from both repositories (No sources, table or component exist) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SLT-01 | R2 | Slot criterion 1 | Feature absent from both repositories (No group_cart_drawer kind or slot registry) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SLT-02 | R2 | Slot criterion 2 | Feature absent from both repositories (No group_cart_drawer kind or slot registry) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SLT-03 | R2 | Slot criterion 3 | Feature absent from both repositories (No group_cart_drawer kind or slot registry) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SLT-04 | R2 | Slot criterion 4 | Feature absent from both repositories (No group_cart_drawer kind or slot registry) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SLT-05 | R2 | Slot criterion 5 | Feature absent from both repositories (No group_cart_drawer kind or slot registry) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-PRF-01 | R2 | Web-vitals criterion 1 | Feature absent from both repositories (No collection or speed indicator) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-PRF-02 | R2 | Web-vitals criterion 2 | Feature absent from both repositories (No collection or speed indicator) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-PRF-03 | R2 | Web-vitals criterion 3 | Feature absent from both repositories (No collection or speed indicator) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-PRF-04 | R2 | Web-vitals criterion 4 | Feature absent from both repositories (No collection or speed indicator) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-EDT-02 | R2 | Searchable palette with previews, recents, favourites | Feature absent from both repositories (Not built) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-EDT-03 | R2 | Copy/paste of nodes across pages | Feature absent from both repositories (Not built) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-EDT-04 | R2 | Style paste between compatible components | Feature absent from both repositories (Not built) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-WFL-01 | R3 | Deterministic fingerprint | Feature absent from both repositories (Not built (fingerprint column exists; nothing writes it)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-WFL-02 | R3 | Ready for review cleared by any edit | Feature absent from both repositories (Not built (fingerprint column exists; nothing writes it)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-WFL-03 | R3 | Stale fingerprint rejected at publish | Feature absent from both repositories (Not built (fingerprint column exists; nothing writes it)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-WFL-04 | R3 | Presentations in review set | Feature absent from both repositories (Not built (fingerprint column exists; nothing writes it)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-WFL-05 | R3 | Unreviewed content cannot publish | Feature absent from both repositories (Not built (fingerprint column exists; nothing writes it)) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-01 | R3 | Ledger/discard criterion 1 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-02 | R3 | Ledger/discard criterion 2 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-03 | R3 | Ledger/discard criterion 3 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-04 | R3 | Ledger/discard criterion 4 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-05 | R3 | Ledger/discard criterion 5 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-06 | R3 | Ledger/discard criterion 6 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-07 | R3 | Ledger/discard criterion 7 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LDG-08 | R3 | Ledger/discard criterion 8 | Feature absent from both repositories (No ledger or discard path) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-01 | R3 | Reusable-section criterion 1 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-02 | R3 | Reusable-section criterion 2 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-03 | R3 | Reusable-section criterion 3 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-04 | R3 | Reusable-section criterion 4 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-05 | R3 | Reusable-section criterion 5 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-06 | R3 | Reusable-section criterion 6 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-07 | R3 | Reusable-section criterion 7 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-08 | R3 | Reusable-section criterion 8 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-09 | R3 | Reusable-section criterion 9 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-RSE-10 | R3 | Reusable-section criterion 10 | Feature absent from both repositories (No reusable sections) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-PRM-09 | R3 | New Staff default design:write after Release 3 | Feature absent from both repositories (Depends on the workflow; deliberately not enabled) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-SEO-01 | R4 | Fallback metadata, validation, canonical URL and sitemap | Feature absent from both repositories (No SEO fields or sitemap work) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
| AC-LND-01 | R4 | Landing page kind, unique slug, lifecycle | Feature absent from both repositories (No page template kind) | logs/absence-check.txt (re-run in this pass: see environment.txt feature grep) |
