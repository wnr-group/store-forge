# Studio acceptance criteria evidence report

Tested commit (frontend): `9cf1440bc4810c128d6800cb932d42171a72df95`

| Status | Count |
|---|---:|
| PASSED_WITH_EVIDENCE | 39 |
| FAILED | 0 |
| BLOCKED | 0 |
| IN_PROGRESS | 1 |
| NOT_STARTED | 0 |
| Total original criteria | 40 |

## AC-BASE-1 — PASSED_WITH_EVIDENCE

**Criterion:** PR #9 integrated and verified on the API integration branch; PR #7 then PR #10 on the frontend integration branch; PR #8 preserved.

- Source: TICKET_CONFIRMED (Pull all Santu changes) / D-12
- Implementation: integration branches (committed merges)
- Tests (manual): git: merge commits 292b5aa (API), fc9f546+796e234 (FE)
- Result: PR #9 on API branch; PR #7 then PR #10 on FE branch; PR #8 ancestor preserved; original PR heads unchanged

- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/baseline/baseline-shas.txt, artifacts/studio/baseline/preflight.txt, artifacts/studio/baseline/pr8-preserved.txt
- Defects: -

## AC-BASE-2 — PASSED_WITH_EVIDENCE

**Criterion:** Overlaps in `globals.css` and `category-manager.tsx` resolved and regression-tested; migration history consistent; Razorpay excluded.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: trial merges, migration journal
- Tests (manual): git merge-tree trial merges; journal check
- Result: 0 shared files PR7/PR10, trial merges clean, migration journal 36/36 consistent, Razorpay files absent

- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/baseline/preflight.txt, artifacts/studio/baseline/api-migration-journal.txt
- Defects: -

## AC-BASE-3 — PASSED_WITH_EVIDENCE

**Criterion:** FE/API typecheck, lint, build pass; existing tests pass or pre-existing failures documented with evidence; Bulk Import passes FE→API E2E; both integration commit SHAs recorded; original PR branches untouched.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (unit, api, integration, e2e): typecheck; lint; build; unit; api-e2e; api-integration; playwright import suites; PR #8 regression suites
- Result: Typecheck, lint and build pass in both repos; FE unit 2679/2679; API unit 289, e2e 312, integration 13; all 27 Bulk Import browser/API specs pass (with a read-only member and a second tenant); PR #8 regression suites reviewed: 3 tests do not pass for the causes in the note; original PR branches untouched
- Note: Not passing in the PR #8 regression run (not explained away): studio-evidence F12-8 compares analytics axis dates with dates captured on another day; studio-filters needs a product "Adjustable Dumbbell Set" that the local data no longer has; studio-evidence F4 (dark mode input border) fails by a sub-pixel colour difference of a transition in 2 of 3 runs. The staff palette expectation was updated to the accepted Studio change.
- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final2/fe-unit.txt, artifacts/studio/final2/fe-tsc.txt, artifacts/studio/final2/fe-lint.txt, artifacts/studio/final2/fe-build.txt, artifacts/studio/final2/api-unit.txt, artifacts/studio/final2/api-e2e.txt, artifacts/studio/final2/api-int.txt, artifacts/studio/final2/api-tsc.txt, artifacts/studio/final2/api-build.txt, artifacts/studio/final2/api-lint.txt, artifacts/studio/import-run/product-import-api.txt, artifacts/studio/import-run/product-import-csv.txt, artifacts/studio/import-run/product-import-xlsx.txt, artifacts/studio/import-run/product-import-db.txt, artifacts/studio/import-run/product-import-limits.txt, artifacts/studio/import-run/product-import-validation.txt, artifacts/studio/import-run/product-import-permissions.txt, artifacts/studio/baseline/baseline-shas.txt, artifacts/studio/baseline/pr8-preserved.txt
- Defects: -

## AC-NAV-1 — PASSED_WITH_EVIDENCE

**Criterion:** Studio group visible with the five items; Import reachable from Products; Pages and Navigation remain under Online Store.

- Source: ACCEPTED_ENGINEERING_DECISION D-10
- Implementation: components/dashboard/nav-config.ts
- Tests (unit, e2e): unit:nav-visibility (12); e2e:studio-nav-group
- Result: Studio group shows Themes, Customize, Products, Categories, Collections; Pages/Navigation stay under Online Store; Import reachable from Products

- Screenshots: artifacts/qa/screenshots/AC-NAV-1/owner-sidebar.png, artifacts/qa/screenshots/AC-NAV-1/import-from-products.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-nav-group.txt
- Defects: -

## AC-NAV-2 — PASSED_WITH_EVIDENCE

**Criterion:** Members with `store:manage` see Themes and Customize; others do not; direct routes still open read-only.

- Source: ACCEPTED_ENGINEERING_DECISION D-11
- Implementation: nav-config.ts NAV_PERMISSION
- Tests (e2e): studio-restricted-members.spec.ts
- Result: Owner and manager see Themes and Customize; read-only and catalogue-only members do not; their direct routes open Themes and the editor read-only (no Apply theme, no Publish, Undo disabled)

- Screenshots: artifacts/qa/screenshots/AC-NAV-2/owner-sidebar.png, artifacts/qa/screenshots/AC-NAV-2/admin-sidebar.png, artifacts/qa/screenshots/AC-NAV-2/readOnly-sidebar.png, artifacts/qa/screenshots/AC-NAV-2/catalogOnly-themes-read-only.png, artifacts/qa/screenshots/AC-NAV-2/catalogOnly-editor-read-only.png, artifacts/qa/screenshots/AC-NAV-2/readOnly-editor-read-only.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/permissions/browser-nav.json, artifacts/studio/final2/studio/studio-restricted-members.txt
- Defects: -

## AC-NAV-3 — PASSED_WITH_EVIDENCE

**Criterion:** Products-only member sees only catalogue items; settings-only member sees only design items (read-floor behaviour respected); existing navigation and permission regression tests pass and sidebar tests are updated.

- Source: ACCEPTED_ENGINEERING_DECISION D-11
- Implementation: nav-config.ts
- Tests (e2e, unit): studio-restricted-members.spec.ts; studio-sidebar.spec.ts; nav-visibility.test.ts
- Result: Design-only member sees only design items (plus Pages, Navigation, Settings); catalogue-only only catalogue items; no-access sees Overview, Pages, Navigation, Settings; catalogue routes fall back to the overview without an error page (D-008 fixed). Sidebar suites pass (studio-sidebar 11, nav-visibility unit 12); the staff palette expectation was updated to the accepted change

- Screenshots: artifacts/qa/screenshots/AC-NAV-3/designOnly-sidebar.png, artifacts/qa/screenshots/AC-NAV-3/catalogOnly-sidebar.png, artifacts/qa/screenshots/AC-NAV-3/noAccess-sidebar.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/permissions/browser-nav.json, artifacts/studio/final2/studio/studio-restricted-members.txt, artifacts/studio/final2/pr8/studio-sidebar.txt
- Defects: D-008

## AC-PERM-1 — PASSED_WITH_EVIDENCE

**Criterion:** Read-only, write and no-access behaviour verified for `settings` and `products`; design permission never grants catalogue permission, and vice versa.

- Source: ACCEPTED_ENGINEERING_DECISION D-7
- Implementation: existing permissions.ts unchanged
- Tests (api, db): api-e2e:studio-permissions (7)
- Result: Design-only, catalogue-only, read-only, no-access and owner/manager members tested at API and in the browser; design never implies catalogue and vice versa; the design-only member can publish and is sent to the overview from catalogue routes without an error; D-004 classified as intended
- Note: D-004 closed as not a defect (see defect register).
- Screenshots: artifacts/qa/screenshots/AC-PERM-1/designOnly-editor-can-publish.png, artifacts/qa/screenshots/AC-PERM-1/readOnly-products-no-add-import.png
- API evidence: artifacts/studio/permissions/api-matrix.txt
- DB evidence: artifacts/studio/presentations/api-e2e.txt
- Log/other evidence: artifacts/studio/final2/studio/studio-restricted-members.txt, artifacts/studio/final2/studio/studio-restricted-members.txt
- Defects: D-004, D-008

## AC-PERM-2 — PASSED_WITH_EVIDENCE

**Criterion:** Direct API calls without permission rejected (save, publish, rollback, apply theme, catalogue writes, import); RLS blocks cross-tenant and unauthorized writes; Owner access intact.

- Source: ACCEPTED_ENGINEERING_DECISION D-7
- Implementation: -
- Tests (api, db): api-e2e:studio-permissions; api-e2e: full suite 305/305 incl. auth-tenancy, product-presentations
- Result: Direct API calls without permission are 403; cross-tenant calls 404; RLS suites pass on a real pglite database

- Screenshots: -
- API evidence: artifacts/studio/permissions/api-matrix.txt
- DB evidence: artifacts/studio/final/vitest-api-e2e.json
- Log/other evidence: -
- Defects: -

## AC-CFG-1 — PASSED_WITH_EVIDENCE

**Criterion:** Every registered section and block type has applicable functional coverage; every confirmed configurable element is in the inventory with a verification case.

- Source: ACCEPTED_ENGINEERING_DECISION D-13
- Implementation: tests/unit/studio-registry-coverage.test.ts
- Tests (unit): studio-registry-coverage.test.ts (5 tests)
- Result: 255 element/look rows (18 sections and the real section/block pairs on each of 4 looks) persist, validate and render; each carries the style hook in the markup and display:none in the generated stylesheet when hidden; the known-gaps fixture is empty. Two accepted-but-never-drawn cases are named and tested (D-005, D-006), not skipped
- Note: Findings D-005 (slider hero headline mapping) and D-006 (group block accepted by nothing; column children never drawn) remain open and are pinned by tests.
- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/inventory/registry-coverage.json, artifacts/studio/final2/fe-unit.txt
- Defects: D-003, D-005, D-006

## AC-CFG-2 — PASSED_WITH_EVIDENCE

**Criterion:** All 9 themes and 4 looks pass the 7-step smoke test (open, select, change text, change style, change visibility, save and publish, verify storefront).

- Source: ACCEPTED_ENGINEERING_DECISION D-13
- Implementation: tests/e2e/studio-theme-matrix.spec.ts
- Tests (e2e): e2e:studio-theme-matrix (9 themes x 7 steps)
- Result: All 9 themes (4 looks) pass open, select, change text, change style, change visibility, publish and live storefront in one run; Haven and Stride change the headline on the first Hero slide (slider data). The earlier run was invalid (it re-tested Atelier) and has been replaced
- Note: D-007: the previous evidence for this AC was invalid; replaced by this run. The run needed the local API throttle raised (D-014).
- Screenshots: artifacts/qa/screenshots/AC-CFG-2/atelier.png, artifacts/qa/screenshots/AC-CFG-2/freshly.png, artifacts/qa/screenshots/AC-CFG-2/haven.png, artifacts/qa/screenshots/AC-CFG-2/lumire.png, artifacts/qa/screenshots/AC-CFG-2/maison.png, artifacts/qa/screenshots/AC-CFG-2/marketplace.png, artifacts/qa/screenshots/AC-CFG-2/plain.png, artifacts/qa/screenshots/AC-CFG-2/stride.png, artifacts/qa/screenshots/AC-CFG-2/voltage.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/inventory/smoke-matrix.json, artifacts/studio/final2/studio/studio-theme-matrix.txt
- Defects: D-005, D-007, D-014

## AC-CFG-3 — PASSED_WITH_EVIDENCE

**Criterion:** Text, style, visibility and base/tablet/mobile overrides persist and render after publish.

- Source: ACCEPTED_ENGINEERING_DECISION D-13
- Implementation: -
- Tests (api, e2e): studio-overrides.e2e-spec.ts; studio-config-persistence.spec.ts; studio-visibility-live.spec.ts
- Result: Style (base/tablet/mobile, hidden), text and disable overrides round-trip through draft, publish and the public layout (API); in a browser the text override shows on the live storefront at desktop width and the mobile-hidden override hides the announcement bar at phone width; header and menu-link hiding verified live on 4 looks

- Screenshots: artifacts/qa/screenshots/AC-CFG-3/live-desktop-text-override.png, artifacts/qa/screenshots/AC-CFG-3/live-mobile-announcement-hidden.png
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/inventory/config-persistence-text.json, artifacts/studio/inventory/visibility-live.json, artifacts/studio/final2/studio/studio-config-persistence.txt, artifacts/studio/final2/studio/studio-visibility-live.txt
- Defects: -

## AC-CFG-4 — PASSED_WITH_EVIDENCE

**Criterion:** Adapter gaps are reported as defects and resolved before L1 is claimed complete; none silently accepted.

- Source: ACCEPTED_ENGINEERING_DECISION D-13
- Implementation: -
- Tests (unit, e2e): studio-registry-coverage.test.ts; studio-visibility-live.spec.ts
- Result: All adapter gaps resolved (D-003) with unit coverage of every pair and browser proof on all four looks: the header is hidden on a phone and a menu link on a desktop, saved as a draft, published and correct on the live storefront

- Screenshots: artifacts/qa/screenshots/AC-CFG-4/standard_editor-hide-controls.png, artifacts/qa/screenshots/AC-CFG-4/standard_live-mobile-header-hidden.png, artifacts/qa/screenshots/AC-CFG-4/standard_live-desktop-link-hidden.png, artifacts/qa/screenshots/AC-CFG-4/boutique_editor-hide-controls.png, artifacts/qa/screenshots/AC-CFG-4/boutique_live-mobile-header-hidden.png, artifacts/qa/screenshots/AC-CFG-4/boutique_live-desktop-link-hidden.png, artifacts/qa/screenshots/AC-CFG-4/sport_editor-hide-controls.png, artifacts/qa/screenshots/AC-CFG-4/sport_live-mobile-header-hidden.png, artifacts/qa/screenshots/AC-CFG-4/sport_live-desktop-link-hidden.png, artifacts/qa/screenshots/AC-CFG-4/market_editor-hide-controls.png, artifacts/qa/screenshots/AC-CFG-4/market_live-mobile-header-hidden.png, artifacts/qa/screenshots/AC-CFG-4/market_live-desktop-link-hidden.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/inventory/registry-coverage.json, artifacts/studio/inventory/visibility-live.json, artifacts/studio/final2/studio/studio-visibility-live.txt
- Defects: D-003

## AC-CFG-5 — PASSED_WITH_EVIDENCE

**Criterion:** Draft goes to the right document; publish creates the expected version; rollback restores the previous configuration; stale or concurrent saves rejected; evidence recorded per inventory entry.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (api, e2e): themes.e2e-spec.ts; studio-config-persistence.spec.ts
- Result: Draft, publish, rollback and 409 covered by the API suites (312 pass); in the editor History restores an older published version and the live storefront follows; an out-of-date tab is refused ("Someone else changed this design") and does not overwrite the newer draft

- Screenshots: artifacts/qa/screenshots/AC-CFG-5/history-before-restore.png, artifacts/qa/screenshots/AC-CFG-5/live-after-restore-shows-A.png, artifacts/qa/screenshots/AC-CFG-5/stale-tab-refused.png
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/inventory/config-persistence.json, artifacts/studio/final2/studio/studio-config-persistence.txt
- Defects: -

## AC-VP-1 — PASSED_WITH_EVIDENCE

**Criterion:** All eight virtual pages inventoried; applicable settings, text, style, visibility, responsive verified; one edit+publish flow per theme (9).

- Source: ACCEPTED_ENGINEERING_DECISION D-14
- Implementation: lib/storefront/documents.ts (default pages)
- Tests (e2e, unit): studio-virtual-pages.spec.ts; studio-virtual-pages.test.ts
- Result: All eight virtual pages (products, collections, search, cart, wishlist, content, about, contact) edit, publish and show the edit live; D-002 fixed without touching the shared colour rule
- Note: Screenshots of the defect from the earlier pass are archived in defect-evidence/D-002-before-fix.
- Screenshots: artifacts/qa/screenshots/AC-VP-1/products.png, artifacts/qa/screenshots/AC-VP-1/collections.png, artifacts/qa/screenshots/AC-VP-1/search.png, artifacts/qa/screenshots/AC-VP-1/cart.png, artifacts/qa/screenshots/AC-VP-1/wishlist.png, artifacts/qa/screenshots/AC-VP-1/about.png, artifacts/qa/screenshots/AC-VP-1/contact.png, artifacts/qa/screenshots/AC-VP-1/content.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/virtual-pages/flows.json, artifacts/studio/final2/pr8b/studio-virtual-pages.txt
- Defects: D-002, D-002b

## AC-VP-2 — PASSED_WITH_EVIDENCE

**Criterion:** Reset restores that page's default and leaves other pages untouched.

- Source: ACCEPTED_ENGINEERING_DECISION D-14
- Implementation: -
- Tests (e2e): studio-virtual-pages.spec.ts
- Result: Reset restores only that page (cart) to its default; the wishlist keeps its edit (asserted in the same run)

- Screenshots: artifacts/qa/screenshots/AC-VP-2/cart-back-to-its-default.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/virtual-pages/flows.json, artifacts/studio/final2/pr8b/studio-virtual-pages.txt
- Defects: D-002

## AC-VP-3 — PASSED_WITH_EVIDENCE

**Criterion:** Search dynamic term, cart and wishlist state keep working after text edits.

- Source: ACCEPTED_ENGINEERING_DECISION D-14
- Implementation: -
- Tests (e2e): studio-virtual-state.spec.ts
- Result: After the headings of search, cart and wishlist are edited and published: the shopper's search term still drives the results, an added product is listed in the edited cart, and a saved product is listed on the edited wishlist

- Screenshots: artifacts/qa/screenshots/AC-VP-3/search-edited-term-and-results.png, artifacts/qa/screenshots/AC-VP-3/cart-edited-with-item.png, artifacts/qa/screenshots/AC-VP-3/wishlist-edited-with-item.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/virtual-pages/state-flows.json, artifacts/studio/final2/studio/studio-virtual-state.txt
- Defects: -

## AC-PP-1 — IN_PROGRESS

**Criterion:** Per-product draft persists, shared product template unchanged; publish exposes the right presentation on the right product only; drafts never public.

- Source: ACCEPTED_ENGINEERING_DECISION D-15
- Implementation: existing product presentation API
- Tests (e2e, unit, api): studio-product-presentation.spec.ts; studio-presentation-looks.test.ts; product-presentations.e2e-spec.ts
- Result: Verified: the draft persists and is never public, the shared product template is unchanged, and publishing hides the chosen block on that product only (Stride in a browser; all four looks by unit test; D-009 fixed). Not verified as working: gallery layout, media position and focal point are ignored by the Stride and Marketplace galleries (D-010)
- Note: Exact blocker: D-010 needs a design decision for a stacked variant of each look gallery. Not marked passed.
- Screenshots: artifacts/qa/screenshots/AC-PP-1/customizer-open.png, artifacts/qa/screenshots/AC-PP-1/draft-saved-sku-hidden.png, artifacts/qa/screenshots/AC-PP-1/storefront-A-sku-hidden.png, artifacts/qa/screenshots/AC-PP-1/storefront-B-unchanged.png
- API evidence: artifacts/studio/presentations/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/presentations/browser-flow.json, artifacts/studio/final2/studio/studio-product-presentation.txt
- Defects: D-009, D-010

## AC-PP-2 — PASSED_WITH_EVIDENCE

**Criterion:** Reset restores store default for that product only; no override row renders the default without breaking.

- Source: ACCEPTED_ENGINEERING_DECISION D-15
- Implementation: existing product presentation API
- Tests (e2e, api): studio-product-presentation.spec.ts; product-presentations.e2e-spec.ts
- Result: Reset restores the store design for that product only (browser); a product with no override renders the default (API and unit)

- Screenshots: artifacts/qa/screenshots/AC-PP-2/storefront-A-reset-to-store-design.png
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/presentations/browser-flow.json
- Defects: -

## AC-PP-3 — PASSED_WITH_EVIDENCE

**Criterion:** Stale update rejected without overwrite; conflict response and recovery verified.

- Source: ACCEPTED_ENGINEERING_DECISION D-15
- Implementation: existing product presentation API
- Tests (e2e, api): studio-product-presentation.spec.ts; product-presentations.e2e-spec.ts
- Result: A second tab opened before another change is refused ("Someone else changed the settings of ... Your unsaved changes were not saved") and keeps the newer draft; "Load the latest settings" recovers

- Screenshots: artifacts/qa/screenshots/AC-PP-3/stale-tab-refused.png
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/presentations/browser-flow.json
- Defects: -

## AC-PP-4 — PASSED_WITH_EVIDENCE

**Criterion:** Tenant isolation on writes and public reads; storefront cache invalidation applied.

- Source: ACCEPTED_ENGINEERING_DECISION D-15
- Implementation: -
- Tests (api, e2e): product-presentations-isolation.e2e-spec.ts; studio-product-presentation.spec.ts
- Result: Tenant isolation on writes and public reads passes in the API suites; cache invalidation observed: a publish and a reset appear on the live product page in about 2 s without waiting for expiry
- Note: The cache is refreshed by the editor action; an API-only publish is not reflected until the cache expires (D-011).
- Screenshots: -
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/presentations/browser-flow.json, artifacts/studio/final2/studio/studio-product-presentation.txt
- Defects: D-011

## AC-PICK-1 — PASSED_WITH_EVIDENCE

**Criterion:** Picker lists the tenant's collections and stores the collection id; presentation settings unchanged.

- Source: ACCEPTED_ENGINEERING_DECISION D-3
- Implementation: lib/storefront/featured.ts, components/themes/editor/setting-field.tsx
- Tests (unit, e2e): unit:collection-ref (7); e2e:studio-collection-picker
- Result: Picker stores the collection id; survives reload; live layout contains the id; storefront shows the collection products

- Screenshots: artifacts/qa/screenshots/AC-PICK-1/picker-selected.png, artifacts/qa/screenshots/AC-PICK-1/storefront.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-collection-picker.txt
- Defects: -

## AC-PICK-2 — PASSED_WITH_EVIDENCE

**Criterion:** An existing slug value displays as the selected collection and still renders the list.

- Source: ACCEPTED_ENGINEERING_DECISION D-3
- Implementation: collectionSelectValue
- Tests (e2e, unit): studio-collection-legacy-slug.spec.ts; collection-ref.test.ts
- Result: A Featured collection saved with the collection slug shows as that collection in the picker and the storefront still renders its list

- Screenshots: artifacts/qa/screenshots/AC-PICK-2/legacy-slug-shown-as-selected.png, artifacts/qa/screenshots/AC-PICK-2/storefront-still-renders-list.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final2/studio/studio-collection-legacy-slug.txt
- Defects: -

## AC-CDEL-1 — PASSED_WITH_EVIDENCE

**Criterion:** Collection referenced by a draft or by the published document shows a usage warning with section count and template/page locations; id and slug references detected; URLs in other text and historical versions not counted.

- Source: ACCEPTED_ENGINEERING_DECISION D-8/D-9
- Implementation: collection-usage.ts, collections.service.ts, collection-form.tsx
- Tests (api, e2e): api-e2e:collection-usage (10); e2e:studio-collection-delete
- Result: Draft and live references (id and slug) produce a warning naming section count, page and state; URLs/free text are not counted

- Screenshots: artifacts/qa/screenshots/AC-CDEL-1/warning-draft.png, artifacts/qa/screenshots/AC-CDEL-1/warning-live.png
- API evidence: artifacts/studio/cdel/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-collection-delete.txt
- Defects: -

## AC-CDEL-2 — PASSED_WITH_EVIDENCE

**Criterion:** Unused collection deletes via the existing flow; cancel changes nothing; confirm uses existing deletion.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (api, e2e): api-e2e:collection-usage; e2e:studio-collection-delete
- Result: Unused collection deletes through the existing flow; cancel changes nothing

- Screenshots: artifacts/qa/screenshots/AC-CDEL-2/unused-delete-dialog.png
- API evidence: artifacts/studio/cdel/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-collection-delete.txt
- Defects: -

## AC-CDEL-3 — PASSED_WITH_EVIDENCE

**Criterion:** If references changed since the warning, the warning refreshes and confirmation is required again.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (api, e2e): api-e2e:collection-usage (stale hash 409); e2e:concurrent change
- Result: A reference removed from a second tab after the warning gives a refreshed warning and requires a second confirmation; nothing deleted on the first confirm

- Screenshots: artifacts/qa/screenshots/AC-CDEL-3/refreshed-warning.png
- API evidence: artifacts/studio/cdel/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-collection-delete.txt
- Defects: -

## AC-CDEL-4 — PASSED_WITH_EVIDENCE

**Criterion:** Lookup and deletion are tenant-scoped and need `catalog:manage`; failure leaves no partial deletion.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (api, db): api-e2e:collection-usage (tenant, permission, refused delete keeps collection and products)
- Result: Tenant-scoped (404 for another org), requires products write, refused delete leaves collection and product links intact
- Note: DB evidence is the pglite e2e assertions on stored rows (collection exists, productCount unchanged).
- Screenshots: -
- API evidence: artifacts/studio/cdel/api-e2e.txt
- DB evidence: artifacts/studio/cdel/api-e2e.txt
- Log/other evidence: -
- Defects: -

## AC-CDEL-5 — PASSED_WITH_EVIDENCE

**Criterion:** Storefront hides the section for a deleted/empty collection; editor shows a hint; empty collections are not auto-deleted.

- Source: ACCEPTED_ENGINEERING_DECISION
- Implementation: -
- Tests (e2e): e2e:studio-collection-delete (after deletion)
- Result: After deletion the editor shows Removed collection and the storefront renders without the section or an error

- Screenshots: artifacts/qa/screenshots/AC-CDEL-5/editor-removed-collection.png, artifacts/qa/screenshots/AC-CDEL-5/storefront.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-collection-delete.txt
- Defects: -

## AC-CAT-1 — PASSED_WITH_EVIDENCE

**Criterion:** Category delete preserves products (uncategorised) and promotes subcategories; dialog shows product count, subcategory count and names; cancel changes nothing.

- Source: ACCEPTED_ENGINEERING_DECISION D-18
- Implementation: lib/categories/hierarchy.ts, category-manager.tsx
- Tests (unit, e2e): unit:category-deletion (7); e2e:studio-category-delete
- Result: Dialog shows product count, subcategory count and names; cancel keeps all; confirm promotes subcategories to top level

- Screenshots: artifacts/qa/screenshots/AC-CAT-1/delete-dialog.png, artifacts/qa/screenshots/AC-CAT-1/after-delete.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final/e2e/studio-category-delete.txt
- Defects: -

## AC-CAT-2 — PASSED_WITH_EVIDENCE

**Criterion:** Product deletion removes collection memberships; deleted and draft products absent from lists; order preserved.

- Source: ACCEPTED_ENGINEERING_DECISION D-18
- Implementation: -
- Tests (api): collection-membership.e2e-spec.ts
- Result: Deleting a product removes its collection membership (row check); the others keep their saved order; draft products never reach a public list and appear when published

- Screenshots: -
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: -
- Defects: -

## AC-IMP-1 — PASSED_WITH_EVIDENCE

**Criterion:** Valid CSV/XLSX creates expected products; invalid rows yield row/column/message/value errors and nothing is created.

- Source: ACCEPTED_ENGINEERING_DECISION D-5
- Implementation: PR #9 API, PR #10 UI
- Tests (e2e): product-import-csv.spec.ts; product-import-xlsx.spec.ts; product-import-validation.spec.ts; product-import-db.spec.ts
- Result: Valid CSV and XLSX create the expected products; invalid files create nothing and report row, column, message and value
- Note: The screenshots come from the import specs of this final run and were copied into the AC folder.
- Screenshots: artifacts/qa/screenshots/AC-IMP-1/csv-success.png, artifacts/qa/screenshots/AC-IMP-1/xlsx-success.png, artifacts/qa/screenshots/AC-IMP-1/invalid-rows-row-column-message-value.png, artifacts/qa/screenshots/AC-IMP-1/nothing-created-after-invalid-file.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/import-run/product-import-csv.txt, artifacts/studio/import-run/product-import-xlsx.txt, artifacts/studio/import-run/product-import-validation.txt, artifacts/studio/import-run/product-import-db.txt
- Defects: -

## AC-IMP-2 — PASSED_WITH_EVIDENCE

**Criterion:** Duplicate SKU/slug rejected; missing category fails without creating one; >500 rows rejected server-side.

- Source: ACCEPTED_ENGINEERING_DECISION D-5
- Implementation: -
- Tests (e2e, api): product-import-validation.spec.ts; product-import-limits.spec.ts; product-import-api.spec.ts; product-import.e2e-spec.ts
- Result: Duplicate SKU/slug rejected; unknown categories are row errors and nothing is created (API); more than 500 rows rejected server-side and in the file check

- Screenshots: artifacts/qa/screenshots/AC-IMP-2/more-than-500-rows-rejected.png, artifacts/qa/screenshots/AC-IMP-2/501-rows-rejected.png
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/import-run/product-import-limits.txt, artifacts/studio/import-run/product-import-api.txt
- Defects: -

## AC-IMP-3 — PASSED_WITH_EVIDENCE

**Criterion:** Unauthorized users cannot import; cross-tenant products inaccessible; persistence failure leaves no partial products.

- Source: ACCEPTED_ENGINEERING_DECISION D-5
- Implementation: -
- Tests (api, db): api-e2e:product-import; api-e2e:studio-permissions
- Result: read-only 403, unauthenticated 401, tenant isolation, atomic rollback on failure

- Screenshots: -
- API evidence: artifacts/studio/import/api-e2e.txt, artifacts/studio/permissions/api-matrix.txt
- DB evidence: artifacts/studio/import/api-e2e.txt
- Log/other evidence: -
- Defects: -

## AC-IMP-4 — PASSED_WITH_EVIDENCE

**Criterion:** Full Studio FE→API E2E passes.

- Source: ACCEPTED_ENGINEERING_DECISION D-5
- Implementation: -
- Tests (e2e): product-import-*.spec.ts (7 files)
- Result: Full FE-to-API import E2E passes on the final build: 27 specs including permissions with a read-only member (403, nothing written) and tenant isolation with a second tenant
- Note: Needs the restricted seed (tests/qa/seed-restricted-members.sql) and E2E_VIEWER_EMAIL=read-only@demo.test.
- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/import-run/product-import-api.txt, artifacts/studio/import-run/product-import-csv.txt, artifacts/studio/import-run/product-import-xlsx.txt, artifacts/studio/import-run/product-import-db.txt, artifacts/studio/import-run/product-import-limits.txt, artifacts/studio/import-run/product-import-validation.txt, artifacts/studio/import-run/product-import-permissions.txt
- Defects: -

## AC-ERR-1 — PASSED_WITH_EVIDENCE

**Criterion:** API failure shows the shopper error state; Retry re-fetches from the server.

- Source: ACCEPTED_ENGINEERING_DECISION D-16
- Implementation: app/s/[slug]/error.tsx, components/storefront/error-state.tsx
- Tests (unit, e2e): unit:storefront-error-state; e2e:studio-storefront-errors (fault proxy)
- Result: API down shows the neutral state, same URL, Retry causes a real server request (proxy counter) and recovers; no internals or dashboard link

- Screenshots: artifacts/qa/screenshots/AC-ERR-1/api-down.png, artifacts/qa/screenshots/AC-ERR-1/recovered.png
- API evidence: artifacts/studio/err/err-e2e.txt
- DB evidence: -
- Log/other evidence: -
- Defects: -

## AC-ERR-2 — PASSED_WITH_EVIDENCE

**Criterion:** Invalid published document and a throwing section are caught safely with no technical detail.

- Source: ACCEPTED_ENGINEERING_DECISION D-16
- Implementation: -
- Tests (unit, e2e): unit:storefront-bad-document; e2e:studio-storefront-errors
- Result: A throwing section is caught by the boundary; an invalid or non-document published design now also shows the neutral state with Retry and no technical detail (D-001 fixed, verified through the fault proxy)

- Screenshots: artifacts/qa/screenshots/AC-ERR-2/section-throws.png, artifacts/qa/screenshots/AC-ERR-2/invalid-document.png
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/err/err-e2e.txt, artifacts/studio/final2/errors/studio-storefront-errors.txt, artifacts/studio/final2/errors/studio-storefront-errors.txt
- Defects: D-001

## AC-ERR-3 — PASSED_WITH_EVIDENCE

**Criterion:** No dashboard link on the state; dashboard error behaviour unchanged; publish, rollback and cache invalidation unchanged; no unpublished data exposed.

- Source: ACCEPTED_ENGINEERING_DECISION D-16
- Implementation: app/error.tsx untouched
- Tests (manual, e2e): git diff: app/error.tsx unchanged; regression: studio suites
- Result: No dashboard link on the state; dashboard error page file unchanged; PR #8 suites that ran pass except date/data-dependent ones
- Note: Regression failures reviewed: staff palette snapshot (intended nav change), analytics axis dates, products filter data, timezone env.
- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/final/regression2.out, artifacts/studio/final/regression.out
- Defects: -

## AC-NFR-1 — PASSED_WITH_EVIDENCE

**Criterion:** Existing limits and rate limits remain enforced.

- Source: ACCEPTED_ENGINEERING_DECISION D-17
- Implementation: -
- Tests (api, unit): studio-limits.e2e-spec.ts; body-limits.e2e-spec.ts; product-import.e2e-spec.ts; auth-tenancy.e2e-spec.ts
- Result: Existing limits still hold: 25 sections per page, 500 products per collection, 500 import rows, request body limits, login/password/account rate limits and the global throttle; the collection delete rejects a malformed usage hash
- Note: D-014: past the global throttle (120/min) the frontend treats the 429 session check as signed-out and loops between /login and /dashboard. Existing behaviour, not changed.
- Screenshots: -
- API evidence: artifacts/studio/final2/api-e2e.txt
- DB evidence: -
- Log/other evidence: artifacts/studio/final2/fe-unit.txt
- Defects: D-014

## AC-NFR-2 — PASSED_WITH_EVIDENCE

**Criterion:** Import benchmark run; editor and storefront baselines recorded and reproducible by SHA.

- Source: ACCEPTED_ENGINEERING_DECISION D-17
- Implementation: tests/qa/studio-perf.ts
- Tests (manual): perf run baseline and after
- Result: Draft/publish/rollback/storefront fetch/public reads and 500-row import measured on baseline-SHA API (4001) and final API (4000), 7 runs each

- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/perf/baseline.json, artifacts/studio/perf/after.json, artifacts/studio/perf/import-baseline.txt, artifacts/studio/perf/import-after.txt, artifacts/studio/baseline/baseline-shas.txt
- Defects: -

## AC-NFR-3 — PASSED_WITH_EVIDENCE

**Criterion:** No unexplained regression versus baseline.

- Source: ACCEPTED_ENGINEERING_DECISION D-17
- Implementation: -
- Tests (manual): perf comparison
- Result: medians: draft 31/31, publish 33/31, rollback 32/35, storefront fetch 157/135, public product read 15/14, layout 15/14 ms; import 1356/1337 ms; no regression. Same machine and database; the frontend was not separately baselined

- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/perf/baseline.json, artifacts/studio/perf/after.json
- Defects: -

## AC-ENH-1 — PASSED_WITH_EVIDENCE

**Criterion:** Prioritised proposal delivered, with existing / confirmed / proposed separated and AI items kept out of scope.

- Source: ACCEPTED_ENGINEERING_DECISION D-6
- Implementation: artifacts/qa/STUDIO_ENHANCEMENT_PROPOSAL.md
- Tests (manual): proposal + no-AI search
- Result: Prioritised proposal written; no AI SDK/endpoint found in either repo

- Screenshots: -
- API evidence: -
- DB evidence: -
- Log/other evidence: artifacts/studio/proposal-no-ai-check.txt
- Defects: -
