# Studio implementation report (second pass)

Final decision: **NO-GO** (39 of 40 original criteria passed with validated evidence; AC-PP-1 is in progress; open findings below).

## Baseline and SHAs
| Repo | Branch | Final SHA | Baseline before Studio |
|---|---|---|---|
| Frontend | `integrate/pr7-santu-templates-on-main` | the last commit on the branch ("test(e2e): distinct cart-default screenshot for AC-VP-2") | `796e234f8e76fbf0a474b922c58f0fcacdb727b9` |
| API | `integrate/pr9-santu-themes-on-main` | `703341db3e4a45ca134f78dcc3bdac0dd290190d` | `292b5aad2d98510c3ce9e2fdb3457956411be6b9` |

Original PR heads untouched; nothing pushed, merged or deployed.

## Implemented in the first pass
Studio nav group with permission-based Themes/Customize; collection picker (stores the id, legacy slugs still shown); collection usage lookup and guarded delete (409 recheck); category delete detail; storefront error boundary with a real Retry; tests, tools, evidence.

## Implemented in this pass
- **D-002** generated pages carry a valid colour and are shown on the theme background; the shared colour rule is unchanged.
- **D-003** every element can be hidden on every look: look-drawn blocks carry the style hook; announcement bars and collection banners draw their blocks; the header can be hidden; blocks a look never draws are not offered. The coverage test walks the real section/block pairs.
- **D-001** the storefront reads the published design strictly; a failed read or an invalid document shows the neutral error state.
- **D-008** the dashboard no longer asks a design-only or no-access member for stock alerts (the refusal broke every page).
- **D-009** per-product hidden blocks apply on the Stride and Marketplace product pages and on every look's related products.
- Restricted members seed (`tests/qa/seed-restricted-members.sql`); restricted-member, visibility, persistence, history, presentation, virtual-state and legacy-slug specs; API tests for overrides, collection membership and limits.

## Migrations
None added by Studio (baseline 0032-0035 only).

## Engineering decisions (not stakeholder approvals)
No feature flag; QA tools under `tests/qa/`; D-004 (design-only per-product 404) closed as intended; blocks a look never draws are left out of the editor's Add-block list rather than drawn.

## Open
- **D-010 / AC-PP-1:** gallery layout, media position and focal point are not applied by the Stride and Marketplace galleries. Needs a design decision.
- D-005 (slider hero headline mapping), D-006 (registered but unplaceable `group`, undrawn `column` children), D-011 (API-only publish does not refresh the storefront cache), D-013 (stale preview product), D-014 (429 on the session check loops to /login).
- Source limitation: no Sibi messages exist for this ticket; Sibi items stay `NOT_CONFIRMED`.
