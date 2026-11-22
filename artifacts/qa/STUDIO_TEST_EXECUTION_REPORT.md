# Studio test execution report (second pass, 2026-11-21)

Environment: Windows 11, system Node 24 (npx resolved Node 20 for some tools, so commands run the tool scripts with system Node). Local Supabase stack `sf-studio-ui-e2e`, API on :4000, frontend `next dev` on :3100 with `TZ=UTC`, Chromium (Playwright 1.65). Playwright output is written outside the repository (Tailwind scanned in-repo error files and broke the dev stylesheet, D-012). Final commits: frontend branch `integrate/pr7-santu-templates-on-main`, API `703341d` on `integrate/pr9-santu-themes-on-main`. Nothing pushed.

## Unit, API, integration, static checks (final code)
| Suite | Result |
|---|---|
| FE unit (`vitest run`) | 134 files, **2679/2679** pass |
| FE typecheck, eslint, `next build` | exit 0, 0 lint problems |
| API unit | 24 files, **289/289** |
| API e2e (pglite, real migrations; `CORS_ORIGINS=http://localhost:3000`) | 23 files, **312/312** (7 new Studio tests) |
| API integration | **13/13** |
| API typecheck, oxlint, `nest build` | exit 0 |

Logs: `artifacts/studio/final2/*.txt`.

## Playwright (real browser, real app, API and database)
| Spec | Result |
|---|---|
| studio-nav-group | 1/1 |
| studio-restricted-members (6 sidebars, design-only editor, read-only routes, catalogue routes) | 10/10 |
| studio-collection-picker, studio-collection-legacy-slug | 1/1 each |
| studio-collection-delete (incl. concurrent change), studio-category-delete | 4/4, 1/1 |
| studio-product-presentation (draft, publish, stale tab, reset) | 1/1 |
| studio-virtual-pages (8 pages, reset), studio-virtual-state (search, bag, wishlist) | 1/1 each |
| studio-config-persistence (text override, mobile hidden, history restore, stale tab) | 2/2 |
| studio-visibility-live (4 looks) | 4/4 |
| studio-theme-matrix (9 themes, one run) | 1/1, 9 rows all steps true |
| studio-storefront-errors (fault proxy; D-001 verified) | 4/4 |
| Bulk Import (csv 2, xlsx 1, db 4, limits 4, validation 4, permissions 2, api 10) | **27/27, none skipped** (the read-only member and a second tenant now exist) |

## PR #8 and PR #10 regression suites (final code)
Passing: a11y 20, f6a 5, modules 30, restricted 1, scope 8, sidebar 11, submit-focus 1, submit-dialogs 2 (1 skipped: team-member spec gated by env), viewports 4, timezone 8 (with `E2E_SERVER_TZ=UTC`), func 4 (8 skipped: loading-state tests gated by env), product-regression 6, evidence 8 of 10.

Not passing, with the actual causes (none converted to a skip):
| Test | Cause |
|---|---|
| studio-evidence F12-8 analytics axis ticks | The baseline holds dates captured on another day; the chart axis follows the calendar |
| studio-evidence F4/F2 dark-mode merchant controls | A transition colour differs in the fourth decimal (`oklab(0.7246..)` vs `(0.7315..)`); failed in 2 of 3 runs and passed once; not related to a change in this work |
| studio-filters | Needs a product "Adjustable Dumbbell Set" that the local data no longer has |

Changed to match an accepted requirement (not weakened): the staff palette expectation in studio-evidence (Themes and Customize are hidden without `store:manage`); the exact-equality assertion remains.

## Failures found and fixed during this pass (failing first)
D-001, D-002, D-003, D-008, D-009 (see the defect register). Also: 3 existing adapter tests encoded the old limits and were updated to the corrected contract; the earlier 9-theme matrix had been testing one theme (D-007); a cleanup helper counted rows before they rendered; session reuse crashed on a redirect loop (it now falls back to a fresh login).

## Environment notes (recorded, not excused)
- The API's global throttle (120 requests a minute) is exceeded by a long editor run; the frontend then loops between /login and /dashboard (D-014). The 9-theme run used a local API started with `THROTTLE_LIMIT=5000`.
- Specs that publish through the API directly do not refresh the storefront cache (D-011); they publish through the editor.
- Never run two Playwright batches at once: they share one signed-in session and one store.
