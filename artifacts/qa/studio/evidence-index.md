# Evidence index

Genuine browser screenshots (real app, real API): flag-off editor; panel visible with flag on; the earlier failed save (kept as evidence of QA-D-001 before the fix); and screenshots/qa-d-001/ (six screenshots of the retest after the fix). One extra file is named NOT-EVIDENCE (a test mis-click kept for transparency). All other evidence is test output or API/SQL output.

| AC ID | Status | Screenshot | Supporting evidence |
|---|---|---|---|
| AC-BDG-01 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-BDG-02 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-BDG-03 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-BDG-05 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-BDG-06 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-BDG-08 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-BDG-09 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-BDG-10 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-BDG-11 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-10 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-11 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-12 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-13 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-14 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-15 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-16 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-CMP-17 | BLOCKED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-DSP-05 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt; test-results/qa-d-001-api-e2e.txt |
| AC-DSP-06 | PASS | screenshots/qa-d-001/06-storefront-mobile-hero-hidden.png | test-results/QA-D-001-retest.json; screenshots/qa-d-001/05-storefront-desktop-hero-visible.png; screenshots/qa-d-001/06-storefront-mobile-hero-hidden.png |
| AC-DSP-07 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-DSP-11 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/api-unit.txt |
| AC-EDT-01 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-I18-03 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-LGL-01 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/R1-flag-and-display-run.json |
| AC-LGL-02 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-LGL-03 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-MED-01 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-PRM-01 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt; test-results/api-e2e.txt |
| AC-PRM-02 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-PRM-03 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-PRM-04 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt; test-results/migration-0036-existing-db-members.txt |
| AC-PRM-05 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-PRM-06 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt; test-results/migration-0036-existing-db-members.txt |
| AC-PRM-07 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-PRM-08 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-RDY-01 | NOT IMPLEMENTED | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-RDY-02 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-RDY-04 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-RDY-05 | PASS | Not applicable (backend/unit property) | test-results/api-e2e.txt |
| AC-RDY-06 | NOT VERIFIED | Not applicable (backend/unit property) | test-results/api-unit.txt |
| AC-RDY-07 | PASS | Not applicable (backend/unit property) | test-results/api-unit.txt |
| AC-RDY-08 | PASS | Not applicable (backend/unit property) | test-results/api-unit.txt |
| AC-RDY-09 | PASS | Not applicable (backend/unit property) | test-results/api-unit.txt; test-results/api-e2e.txt |
| AC-REG-01 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt; test-results/api-unit.txt |
| AC-REG-02 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-REG-04 | PASS | Not applicable (backend/unit property) | test-results/fe-unit.txt |
| AC-ROL-01 | PASS | screenshots/deployment/R1-flag-off-editor-no-display-panel.png | test-results/R1-flag-and-display-run.json; screenshots/deployment/R1-flag-off-editor-no-display-panel.png |
| AC-ROL-02 | NOT VERIFIED | screenshots/deployment/R1-flag-off-editor-no-display-panel.png | test-results/R1-storefront-after-disable.txt |

Also: screenshots/release-1/R1-display-rules-panel-visible-flag-on.png and R1-display-rules-panel-controls.png show the panel (supports AC-DSP-* UI existence only; they do not make them PASS).
