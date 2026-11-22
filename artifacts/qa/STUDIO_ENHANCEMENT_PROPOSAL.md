# Studio enhancement proposal (AC-ENH-1)

Discovery deliverable only. No AI provider, SDK, endpoint, UI or credential was added to either repository (verified by search, see the check at the end).

## A. Existing functionality (verified in code, 2026-11-21)
- Visual editor with sections, blocks, text overrides, per-element style (base/tablet/mobile) and visibility; drafts, immutable versions, publish, rollback.
- Eight generated storefront pages editable as virtual pages; per-product presentation (gallery layout, media position, focal point, hideable blocks).
- Collection-based product lists, categories with parent/child, Bulk Import (products only, create-only, 500 rows, all-or-nothing).

## B. Confirmed requirements delivered in this ticket (accepted engineering decisions D-1..D-18; stakeholder-stated items: Bulk Import, Categories, Subcategories, "completely configure the website", AI-assisted discovery)
Studio nav group, collection picker (stores id), collection delete usage warning with confirm-time recheck, category delete detail, shopper-facing storefront error boundary, verification programme.

## C. Proposed enhancements (all P2 unless stated; none approved)
| # | Problem | Proposal | Studio area | Complexity / dependencies | Security, validation, failure handling | Priority |
|---|---|---|---|---|---|---|
| 1 | Generated rich-text virtual pages (products, search, content, about, contact) ship `backgroundColor: "transparent"`, which both validators reject, so edits to them cannot be published (defect D-002) | Accept a documented "transparent" value in the colour rule on both sides, or ship `""`-compatible defaults | Virtual pages | Small; touches FE schema and API validator together | Keep strict hex for user input | **P1 (defect, not an enhancement)** |
| 2 | 73 element/look pairs offer no visibility control (see `artifacts/studio/inventory/open-gaps.json`) | Triage each: add adapter specs or document as not applicable | Editor adapters | Medium, per look | Keep style values clamped | P1 (L1 gap) |
| 3 | A collection linked from buttons/links/navigation is not counted by the delete warning | Extend usage lookup to URL settings | Collections | Medium (URL parsing, false positives) | Tenant-scoped, read-only | P2 |
| 4 | Deleting a used collection hides a section silently | Offer replacing the collection while deleting | Collections | Small after usage lookup | Same permission | P2 |
| 5 | An unusable home design silently falls back to the built-in template (`getPublishedDesign` try/catch) with no merchant signal | Surface the fallback to the merchant; decide fallback vs error state | Storefront | Medium | No internals to shoppers | P2 |
| 6 | A member with design write but no products access cannot save a per-product presentation (404, products hidden by RLS) | Decide whether design write should imply product visibility for presentations | Permissions | Medium (RLS) | Must not widen catalogue write | P2 |
| 7 | No tenant audit log for design and catalogue changes; publish shares `store:manage` with drafting | Audit log; optional publish-only permission | Security | Large (table, RLS) | Append-only | P2 |
| 8 | Categories do not reach the storefront | Category navigation and pages | Categories | Large (routes, public API; reopens L1) | Public read isolation | P2 |
| 9 | Import cannot create categories, update by SKU, or exceed 500 rows; no history | Auto-create categories, SKU upsert, larger files with progress | Import | Large (background jobs) | Keep all-or-nothing option | P2 |
| 10 | No render-failure or publish-failure monitoring | Error reporting and an alert on storefront render failures | Platform | Medium (no monitoring library today) | No PII in reports | P2 |
| 11 | Merchants write product copy and categories by hand | AI-assisted descriptions, category suggestions, import column mapping. Business problem: slow catalogue setup. Input: product name/attributes or file headers. Output: suggested text/mapping. Needs a provider, keys, per-tenant cost control, human approval step, provider-down handling | Content | Large | Human approval mandatory; validate model output with the existing product rules | P2, separate ticket |

## D. Check that no AI runtime exists
Run: `grep -rniE "anthropic|openai|@ai-sdk|gemini" package.json lib app services` (frontend) and `... package.json src` (API). Result recorded in `artifacts/studio/proposal-no-ai-check.txt`.
