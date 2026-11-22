import json
p = 'artifacts/studio/ac-evidence.json'
items = json.load(open(p, encoding='utf-8'))
by = {i['id']: i for i in items}
F = 'final2/'


def S(ac, f, url, action, visible):
    return {"file": f"{ac}/{f}", "url": url, "action": action, "visible": visible}


def upd(ac, status, result, tests, types, shots=None, api=None, log=None, note=None, defects=None, needs=None):
    e = by[ac]
    e['status'] = status
    e['result'] = result
    e['tests'] = tests
    e['testTypes'] = types
    if shots is not None:
        e['screenshots'] = shots
    if api is not None:
        e['api'] = api
    if log is not None:
        e['log'] = log
    e['note'] = note
    e['defects'] = defects or []
    if needs is not None:
        e['needs'] = needs


IMPORT_LOGS = ['import-run/product-import-api.txt', 'import-run/product-import-csv.txt', 'import-run/product-import-xlsx.txt',
               'import-run/product-import-db.txt', 'import-run/product-import-limits.txt', 'import-run/product-import-validation.txt',
               'import-run/product-import-permissions.txt']

upd('AC-BASE-3', 'PASSED_WITH_EVIDENCE',
    'Typecheck, lint and build pass in both repos; FE unit 2679/2679; API unit 289, e2e 312, integration 13; all 27 Bulk Import browser/API specs pass (with a read-only member and a second tenant); PR #8 regression suites reviewed: 3 tests do not pass for the causes in the note; original PR branches untouched',
    ['typecheck', 'lint', 'build', 'unit', 'api-e2e', 'api-integration', 'playwright import suites', 'PR #8 regression suites'],
    ['unit', 'api', 'integration', 'e2e'],
    log=[F + x for x in ['fe-unit.txt', 'fe-tsc.txt', 'fe-lint.txt', 'fe-build.txt', 'api-unit.txt', 'api-e2e.txt', 'api-int.txt', 'api-tsc.txt', 'api-build.txt', 'api-lint.txt']] + IMPORT_LOGS + ['baseline/baseline-shas.txt', 'baseline/pr8-preserved.txt'],
    note='Not passing in the PR #8 regression run (not explained away): studio-evidence F12-8 compares analytics axis dates with dates captured on another day; studio-filters needs a product "Adjustable Dumbbell Set" that the local data no longer has; studio-evidence F4 (dark mode input border) fails by a sub-pixel colour difference of a transition in 2 of 3 runs. The staff palette expectation was updated to the accepted Studio change.')

upd('AC-NAV-2', 'PASSED_WITH_EVIDENCE',
    'Owner and manager see Themes and Customize; read-only and catalogue-only members do not; their direct routes open Themes and the editor read-only (no Apply theme, no Publish, Undo disabled)',
    ['studio-restricted-members.spec.ts'], ['e2e'],
    shots=[S('AC-NAV-2', 'owner-sidebar.png', '/dashboard', 'Signed in as the owner', 'Studio group with Themes and Customize'),
           S('AC-NAV-2', 'admin-sidebar.png', '/dashboard', 'Signed in as the manager (all write)', 'Themes and Customize present, no Team members'),
           S('AC-NAV-2', 'readOnly-sidebar.png', '/dashboard', 'Signed in as the read-only member', 'Catalogue items present, no Themes or Customize'),
           S('AC-NAV-2', 'catalogOnly-themes-read-only.png', '/dashboard/templates', 'Catalogue-only member opens the Themes route directly', 'Themes list with previews only, no Apply theme'),
           S('AC-NAV-2', 'catalogOnly-editor-read-only.png', '/dashboard/templates/editor', 'Catalogue-only member opens the editor directly', 'Editor with no Publish and disabled Undo'),
           S('AC-NAV-2', 'readOnly-editor-read-only.png', '/dashboard/templates/editor', 'Read-only member opens the editor directly', 'Editor read-only')],
    log=['permissions/browser-nav.json', F + 'studio/studio-restricted-members.txt'], needs=['screenshot', 'log'])

upd('AC-NAV-3', 'PASSED_WITH_EVIDENCE',
    'Design-only member sees only design items (plus Pages, Navigation, Settings); catalogue-only only catalogue items; no-access sees Overview, Pages, Navigation, Settings; catalogue routes fall back to the overview without an error page (D-008 fixed). Sidebar suites pass (studio-sidebar 11, nav-visibility unit 12); the staff palette expectation was updated to the accepted change',
    ['studio-restricted-members.spec.ts', 'studio-sidebar.spec.ts', 'nav-visibility.test.ts'], ['e2e', 'unit'],
    shots=[S('AC-NAV-3', 'designOnly-sidebar.png', '/dashboard', 'Signed in as the design-only member', 'Studio: Themes and Customize; Online Store; Settings; no catalogue items'),
           S('AC-NAV-3', 'catalogOnly-sidebar.png', '/dashboard', 'Signed in as the catalogue-only member', 'Products, Categories, Collections, Inventory; no Themes or Customize'),
           S('AC-NAV-3', 'noAccess-sidebar.png', '/dashboard', 'Signed in as the no-access member', 'Overview, Pages, Navigation, Settings only')],
    log=['permissions/browser-nav.json', F + 'studio/studio-restricted-members.txt', F + 'pr8/studio-sidebar.txt'], defects=['D-008'], needs=['screenshot', 'log'])

e = by['AC-PERM-1']
e['result'] = 'Design-only, catalogue-only, read-only, no-access and owner/manager members tested at API and in the browser; design never implies catalogue and vice versa; the design-only member can publish and is sent to the overview from catalogue routes without an error; D-004 classified as intended'
e['screenshots'] = [S('AC-PERM-1', 'designOnly-editor-can-publish.png', '/dashboard/templates/editor', 'Design-only member opens the editor', 'Publish enabled'),
                             S('AC-PERM-1', 'readOnly-products-no-add-import.png', '/dashboard/products', 'Read-only member opens Products', 'List without Add or Import; the import route redirects'),
                    ]
e['needs'] = sorted(set(e.get('needs', []) + ['screenshot']))
e['note'] = 'D-004 closed as not a defect (see defect register).'
e['defects'] = ['D-004', 'D-008']
e['log'] = (e.get('log') or []) + [F + 'studio/studio-restricted-members.txt']

upd('AC-CFG-1', 'PASSED_WITH_EVIDENCE',
    '255 element/look rows (18 sections and the real section/block pairs on each of 4 looks) persist, validate and render; each carries the style hook in the markup and display:none in the generated stylesheet when hidden; the known-gaps fixture is empty. Two accepted-but-never-drawn cases are named and tested (D-005, D-006), not skipped',
    ['studio-registry-coverage.test.ts (5 tests)'], ['unit'],
    log=['inventory/registry-coverage.json', F + 'fe-unit.txt'],
    note='Findings D-005 (slider hero headline mapping) and D-006 (group block accepted by nothing; column children never drawn) remain open and are pinned by tests.',
    defects=['D-003', 'D-005', 'D-006'], needs=['log'])

e = by['AC-CFG-2']
e['result'] = 'All 9 themes (4 looks) pass open, select, change text, change style, change visibility, publish and live storefront in one run; Haven and Stride change the headline on the first Hero slide (slider data). The earlier run was invalid (it re-tested Atelier) and has been replaced'
e['log'] = ['inventory/smoke-matrix.json', F + 'studio/studio-theme-matrix.txt']
e['note'] = 'D-007: the previous evidence for this AC was invalid; replaced by this run. The run needed the local API throttle raised (D-014).'
e['defects'] = ['D-005', 'D-007', 'D-014']
e['needs'] = ['screenshot', 'log']

upd('AC-CFG-3', 'PASSED_WITH_EVIDENCE',
    'Style (base/tablet/mobile, hidden), text and disable overrides round-trip through draft, publish and the public layout (API); in a browser the text override shows on the live storefront at desktop width and the mobile-hidden override hides the announcement bar at phone width; header and menu-link hiding verified live on 4 looks',
    ['studio-overrides.e2e-spec.ts', 'studio-config-persistence.spec.ts', 'studio-visibility-live.spec.ts'], ['api', 'e2e'],
    shots=[S('AC-CFG-3', 'live-desktop-text-override.png', '/s/urban-nest-demo', 'Published a text override on the announcement bar, opened the storefront at 1280', 'The replaced words are shown'),
           S('AC-CFG-3', 'live-mobile-announcement-hidden.png', '/s/urban-nest-demo', 'Same publish, storefront at 390', 'The announcement bar is hidden')],
    api=[F + 'api-e2e.txt'],
    log=['inventory/config-persistence-text.json', 'inventory/visibility-live.json', F + 'studio/studio-config-persistence.txt', F + 'studio/studio-visibility-live.txt'],
    needs=['screenshot', 'api', 'log'])

upd('AC-CFG-4', 'PASSED_WITH_EVIDENCE',
    'All adapter gaps resolved (D-003) with unit coverage of every pair and browser proof on all four looks: the header is hidden on a phone and a menu link on a desktop, saved as a draft, published and correct on the live storefront',
    ['studio-registry-coverage.test.ts', 'studio-visibility-live.spec.ts'], ['unit', 'e2e'],
    shots=[S('AC-CFG-4', f'{l}_{k}.png', '/s/urban-nest-demo', a, v)
           for l in ['standard', 'boutique', 'sport', 'market']
           for k, a, v in [('editor-hide-controls', 'Editor: Hide on this device switched on for the selected menu link', 'Style tab with the visibility switch'),
                           ('live-mobile-header-hidden', 'Live storefront at 390 after publishing the header hidden on mobile', 'No header'),
                           ('live-desktop-link-hidden', 'Live storefront at 1280 after publishing one menu link hidden', 'Header present, that link absent')]],
    log=['inventory/registry-coverage.json', 'inventory/visibility-live.json', F + 'studio/studio-visibility-live.txt'],
    defects=['D-003'], needs=['screenshot', 'log'])

upd('AC-CFG-5', 'PASSED_WITH_EVIDENCE',
    'Draft, publish, rollback and 409 covered by the API suites (312 pass); in the editor History restores an older published version and the live storefront follows; an out-of-date tab is refused ("Someone else changed this design") and does not overwrite the newer draft',
    ['themes.e2e-spec.ts', 'studio-config-persistence.spec.ts'], ['api', 'e2e'],
    shots=[S('AC-CFG-5', 'history-before-restore.png', '/dashboard/templates/editor', 'Opened Version history', 'Numbered versions with Restore'),
           S('AC-CFG-5', 'live-after-restore-shows-A.png', '/s/urban-nest-demo', 'Restored the older version', 'Storefront shows the restored content'),
           S('AC-CFG-5', 'stale-tab-refused.png', '/dashboard/templates/editor', 'Saved from a tab opened before the draft changed', 'Conflict banner, newer draft kept')],
    api=[F + 'api-e2e.txt'], log=['inventory/config-persistence.json', F + 'studio/studio-config-persistence.txt'], needs=['screenshot', 'api', 'log'])

upd('AC-VP-1', 'PASSED_WITH_EVIDENCE',
    'All eight virtual pages (products, collections, search, cart, wishlist, content, about, contact) edit, publish and show the edit live; D-002 fixed without touching the shared colour rule',
    ['studio-virtual-pages.spec.ts', 'studio-virtual-pages.test.ts'], ['e2e', 'unit'],
    shots=[S('AC-VP-1', f'{k}.png', '/s/urban-nest-demo/' + k, 'Edited the page in the editor and published', 'The edited text on the live page')
           for k in ['products', 'collections', 'search', 'cart', 'wishlist', 'about', 'contact', 'content']],
    log=['virtual-pages/flows.json', F + 'pr8b/studio-virtual-pages.txt'],
    note='Screenshots of the defect from the earlier pass are archived in defect-evidence/D-002-before-fix.', defects=['D-002', 'D-002b'], needs=['screenshot', 'log'])

upd('AC-VP-2', 'PASSED_WITH_EVIDENCE',
    'Reset restores only that page (cart) to its default; the wishlist keeps its edit (asserted in the same run)',
    ['studio-virtual-pages.spec.ts'], ['e2e'],
    shots=[S('AC-VP-2', 'cart-back-to-its-default.png', '/s/urban-nest-demo/cart', 'Reset the cart page and published', 'The cart shows its default heading, not the edited one')],
    log=['virtual-pages/flows.json', F + 'pr8b/studio-virtual-pages.txt'], defects=['D-002'], needs=['screenshot', 'log'])

upd('AC-VP-3', 'PASSED_WITH_EVIDENCE',
    "After the headings of search, cart and wishlist are edited and published: the shopper's search term still drives the results, an added product is listed in the edited cart, and a saved product is listed on the edited wishlist",
    ['studio-virtual-state.spec.ts'], ['e2e'],
    shots=[S('AC-VP-3', 'search-edited-term-and-results.png', '/s/urban-nest-demo/search?q=zzvp', 'Searched for the test product', 'Edited heading and the matching product'),
           S('AC-VP-3', 'cart-edited-with-item.png', '/s/urban-nest-demo/cart', 'Added the product to the bag', 'Edited cart heading and the item'),
           S('AC-VP-3', 'wishlist-edited-with-item.png', '/s/urban-nest-demo/wishlist', 'Saved the product', 'Edited wishlist heading and the product')],
    log=['virtual-pages/state-flows.json', F + 'studio/studio-virtual-state.txt'], needs=['screenshot', 'log'])

upd('AC-PP-1', 'IN_PROGRESS',
    'Verified: the draft persists and is never public, the shared product template is unchanged, and publishing hides the chosen block on that product only (Stride in a browser; all four looks by unit test; D-009 fixed). Not verified as working: gallery layout, media position and focal point are ignored by the Stride and Marketplace galleries (D-010)',
    ['studio-product-presentation.spec.ts', 'studio-presentation-looks.test.ts', 'product-presentations.e2e-spec.ts'], ['e2e', 'unit', 'api'],
    shots=[S('AC-PP-1', 'customizer-open.png', '/dashboard/templates/editor', 'Opened the per-product customizer', 'Gallery layout, media position and block switches'),
           S('AC-PP-1', 'draft-saved-sku-hidden.png', '/dashboard/templates/editor', 'Hid Description for the product', 'Draft saved, not published'),
           S('AC-PP-1', 'storefront-A-sku-hidden.png', '/s/urban-nest-demo/products/a', 'Published this product', 'Description gone on that product'),
           S('AC-PP-1', 'storefront-B-unchanged.png', '/s/urban-nest-demo/products/b', 'Opened another product', 'Description still shown')],
    log=['presentations/browser-flow.json', F + 'studio/studio-product-presentation.txt'],
    note='Exact blocker: D-010 needs a design decision for a stacked variant of each look gallery. Not marked passed.', defects=['D-009', 'D-010'], needs=['screenshot', 'log'])

upd('AC-PP-2', 'PASSED_WITH_EVIDENCE',
    'Reset restores the store design for that product only (browser); a product with no override renders the default (API and unit)',
    ['studio-product-presentation.spec.ts', 'product-presentations.e2e-spec.ts'], ['e2e', 'api'],
    shots=[S('AC-PP-2', 'storefront-A-reset-to-store-design.png', '/s/urban-nest-demo/products/a', 'Clicked Reset to the store design', 'The product shows the store design again')],
    log=['presentations/browser-flow.json'], api=[F + 'api-e2e.txt'], needs=['screenshot', 'api', 'log'])

upd('AC-PP-3', 'PASSED_WITH_EVIDENCE',
    'A second tab opened before another change is refused ("Someone else changed the settings of ... Your unsaved changes were not saved") and keeps the newer draft; "Load the latest settings" recovers',
    ['studio-product-presentation.spec.ts', 'product-presentations.e2e-spec.ts'], ['e2e', 'api'],
    shots=[S('AC-PP-3', 'stale-tab-refused.png', '/dashboard/templates/editor', 'Changed the gallery layout from a stale tab', 'Conflict banner with Load the latest settings')],
    log=['presentations/browser-flow.json'], api=[F + 'api-e2e.txt'], needs=['screenshot', 'api', 'log'])

upd('AC-PP-4', 'PASSED_WITH_EVIDENCE',
    'Tenant isolation on writes and public reads passes in the API suites; cache invalidation observed: a publish and a reset appear on the live product page in about 2 s without waiting for expiry',
    ['product-presentations-isolation.e2e-spec.ts', 'studio-product-presentation.spec.ts'], ['api', 'e2e'],
    api=[F + 'api-e2e.txt'], log=['presentations/browser-flow.json', F + 'studio/studio-product-presentation.txt'],
    note='The cache is refreshed by the editor action; an API-only publish is not reflected until the cache expires (D-011).', defects=['D-011'], needs=['api', 'log'])

upd('AC-PICK-2', 'PASSED_WITH_EVIDENCE',
    'A Featured collection saved with the collection slug shows as that collection in the picker and the storefront still renders its list',
    ['studio-collection-legacy-slug.spec.ts', 'collection-ref.test.ts'], ['e2e', 'unit'],
    shots=[S('AC-PICK-2', 'legacy-slug-shown-as-selected.png', '/dashboard/templates/editor', 'Draft with a slug-valued collection, opened Featured collection', 'The collection is selected, no "Removed collection" notice'),
           S('AC-PICK-2', 'storefront-still-renders-list.png', '/s/urban-nest-demo', 'Published and opened the home page', 'The collection products are listed')],
    log=[F + 'studio/studio-collection-legacy-slug.txt'], needs=['screenshot', 'log'])

upd('AC-CAT-2', 'PASSED_WITH_EVIDENCE',
    'Deleting a product removes its collection membership (row check); the others keep their saved order; draft products never reach a public list and appear when published',
    ['collection-membership.e2e-spec.ts'], ['api'], api=[F + 'api-e2e.txt'], needs=['api'])

upd('AC-IMP-1', 'PASSED_WITH_EVIDENCE',
    'Valid CSV and XLSX create the expected products; invalid files create nothing and report row, column, message and value',
    ['product-import-csv.spec.ts', 'product-import-xlsx.spec.ts', 'product-import-validation.spec.ts', 'product-import-db.spec.ts'], ['e2e'],
    shots=[S('AC-IMP-1', 'csv-success.png', '/dashboard/products/import', 'Imported a valid CSV', '2 products imported'),
           S('AC-IMP-1', 'xlsx-success.png', '/dashboard/products/import', 'Imported a valid XLSX', 'Products imported'),
           S('AC-IMP-1', 'invalid-rows-row-column-message-value.png', '/dashboard/products/import', 'Imported an invalid CSV', 'No products imported; table of row, column, message, value'),
           S('AC-IMP-1', 'nothing-created-after-invalid-file.png', '/dashboard/products', 'Searched for the invalid file rows', 'No rows')],
    log=['import-run/product-import-csv.txt', 'import-run/product-import-xlsx.txt', 'import-run/product-import-validation.txt', 'import-run/product-import-db.txt'],
    note='The screenshots come from the import specs of this final run and were copied into the AC folder.', needs=['screenshot', 'log'])

upd('AC-IMP-2', 'PASSED_WITH_EVIDENCE',
    'Duplicate SKU/slug rejected; unknown categories are row errors and nothing is created (API); more than 500 rows rejected server-side and in the file check',
    ['product-import-validation.spec.ts', 'product-import-limits.spec.ts', 'product-import-api.spec.ts', 'product-import.e2e-spec.ts'], ['e2e', 'api'],
    shots=[S('AC-IMP-2', 'more-than-500-rows-rejected.png', '/dashboard/products/import', 'Chose a file with too many rows', 'Actionable rejection'),
           S('AC-IMP-2', '501-rows-rejected.png', '/dashboard/products/import', 'Imported 501 rows', 'Rejected')],
    api=[F + 'api-e2e.txt'], log=['import-run/product-import-limits.txt', 'import-run/product-import-api.txt'], needs=['screenshot', 'api', 'log'])

upd('AC-IMP-4', 'PASSED_WITH_EVIDENCE',
    'Full FE-to-API import E2E passes on the final build: 27 specs including permissions with a read-only member (403, nothing written) and tenant isolation with a second tenant',
    ['product-import-*.spec.ts (7 files)'], ['e2e'], log=IMPORT_LOGS,
    note='Needs the restricted seed (tests/qa/seed-restricted-members.sql) and E2E_VIEWER_EMAIL=read-only@demo.test.', needs=['log'])

upd('AC-NFR-1', 'PASSED_WITH_EVIDENCE',
    'Existing limits still hold: 25 sections per page, 500 products per collection, 500 import rows, request body limits, login/password/account rate limits and the global throttle; the collection delete rejects a malformed usage hash',
    ['studio-limits.e2e-spec.ts', 'body-limits.e2e-spec.ts', 'product-import.e2e-spec.ts', 'auth-tenancy.e2e-spec.ts'], ['api', 'unit'],
    api=[F + 'api-e2e.txt'], log=[F + 'fe-unit.txt'],
    note='D-014: past the global throttle (120/min) the frontend treats the 429 session check as signed-out and loops between /login and /dashboard. Existing behaviour, not changed.',
    defects=['D-014'], needs=['api', 'log'])

e = by['AC-ERR-2']
e['result'] = 'A throwing section is caught by the boundary; an invalid or non-document published design now also shows the neutral state with Retry and no technical detail (D-001 fixed, verified through the fault proxy)'
e['defects'] = ['D-001']
e['note'] = None
e['log'] = (e.get('log') or []) + [F + 'errors/studio-storefront-errors.txt']

json.dump(items, open(p, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print({k: sum(1 for i in items if i['status'] == k) for k in set(i['status'] for i in items)})
