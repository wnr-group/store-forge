# Screenshot index

All files below were written by Playwright during this pass (14:30-14:52 IST, 2026-11-22); older files were not reused. Environment as in the ledger; commits FE 9cf1440, API 703341d. Video: `videos/*.webm` (5 files); traces: `traces/owner-session-*.zip` (5 files). Roles: owner (merchant), platform admin (flag), anonymous shopper, and the named members. No screenshot exists for: component palette, readiness panel, flag admin screen, review workflow, publishing confirmation of Studio-on publish, shopper features (R2), R3, R4, permission-denied pages beyond the read-only editor — those features or flows do not exist or were not run.

| File | Requirement | Role | Action | Observed | Result |
|---|---|---|---|---|---|
| screenshots/R1\editor-desktop-panel-before.png | AC-DSP-06 | owner | Studio on; opened editor, selected Hero Banner | When to show panel with all devices on | captured |
| screenshots/R1\editor-desktop-rule-restored-after-refresh.png | AC-DSP-06 | owner | Reloaded editor | Mobile off, Hidden on Mobile badge | captured |
| screenshots/R1\editor-desktop-rule-saved.png | AC-DSP-05 | owner | Pressed Space on the Mobile switch | All changes saved, no error | captured |
| screenshots/R1\editor-desktop.png | AC-EDT-05 | owner | Editor at 1280x800 (axe scan target) | Editor loads; 7 serious contrast findings | captured |
| screenshots/R1\editor-mobile.png | visual | owner | Editor at 390x844 | Layout renders; not audited for usability | captured |
| screenshots/R1\editor-tablet.png | visual | owner | Editor at 820x1180 | Layout renders; no tablet audit beyond capture | captured |
| screenshots/R1\storefront-desktop.png | AC-DSP-06 | anonymous shopper | Published (Studio off); opened storefront 1280 | First section visible | captured |
| screenshots/R1\storefront-mobile.png | AC-DSP-06 | anonymous shopper | Storefront 390 | First section not visible | captured |
| screenshots/R1\storefront-tablet.png | AC-DSP-06 | anonymous shopper | Storefront 820 | First section visible (rule hides mobile only) | captured |
| screenshots/R1/permissions\AC-NAV-2_admin-sidebar.png | permissions (AC-PRM-01/02/04/06) | admin | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-2_owner-sidebar.png | permissions (AC-PRM-01/02/04/06) | owner | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-2_readOnly-editor-read-only.png | permissions (AC-PRM-01/02/04/06) | readOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-2_readOnly-sidebar.png | permissions (AC-PRM-01/02/04/06) | readOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-2_readOnly-themes-read-only.png | permissions (AC-PRM-01/02/04/06) | readOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-3_catalogOnly-sidebar.png | permissions (AC-PRM-01/02/04/06) | catalogOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-3_designOnly-sidebar.png | permissions (AC-PRM-01/02/04/06) | designOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-NAV-3_noAccess-sidebar.png | permissions (AC-PRM-01/02/04/06) | noAccess | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-PERM-1_designOnly-editor-can-publish.png | permissions (AC-PRM-01/02/04/06) | designOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
| screenshots/R1/permissions\AC-PERM-1_readOnly-products-no-add-import.png | permissions (AC-PRM-01/02/04/06) | readOnly | Opened the dashboard/editor as this member | Menu items / editor state for this permission level | captured |
