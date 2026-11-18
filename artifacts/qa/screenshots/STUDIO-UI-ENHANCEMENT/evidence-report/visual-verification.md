# Visual verification — what was compared and what was found

Method: the same pages were captured on origin/main ("before", port 3101) and on the branch ("after", port 3100), against the
same local database, server clock UTC, browser America/Los_Angeles, 1280x800 (plus 768x1024 and 390x844 observational
captures). Computed styles were measured in the browser and compared with values measured on origin/main
(`baseline-measurements.json`); screenshots were then opened and looked at. Only files listed as inspected in
`closeout-report.md` section D count as visual proof.

## Differences found (all intended)

| Area | Before (origin/main) | After (branch) |
|---|---|---|
| Merchant search trigger / selects | 36px (search input 32px) | 32px, level with the search input |
| Merchant dialog (portal) native select | 36px | 32px |
| Merchant light error text | #dc5353 (3.5–3.9:1 on its surfaces) | #b83232 (>= 4.5:1 on the rendered surfaces) |
| Merchant error border / fill | `oklab(... / 0.3)` border, `oklab(... / 0.05)` fill | identical strings |
| Merchant dark error text | #e05252 | #e05252 (unchanged) |
| Palette (owner) | 12 entries, no Team | the same 12 plus "Team members" before Settings |
| Palette (staff) | 12 entries | the same 12 (equals the sidebar) |
| Overview/Analytics/Inventory/Customers/Products dates | server (UTC) or browser (LA) time | store time (Asia/Kolkata), e.g. #1046 "3:58 am" -> "9:28 am"; #1044 "13 Nov, 8:37 pm" -> "14 Nov, 2:07 am" |
| Analytics chart x-axis ticks | `20 Oct … 18 Nov` | identical |

## Unchanged (checked)

- Platform Admin (Organizations list, New organization form): status select 36px, search 32px, error text rgb(220, 83, 83) light / rgb(224, 82, 82) dark; measurements equal origin/main exactly; light and dark pages inspected.
- Login: input 36px (its own `h-9`), same error colour; same page in both versions. Login uses a fixed light palette, so its "dark" capture equals light.
- Default Button ("Add product") height unchanged.

## Observations that are NOT regressions and NOT changed by this ticket

- The unchanged dark-mode error text measures 4.41:1 on the Add category dialog surface (origin/main behaviour). F2-4 forbids changing dark mode; flagged for a product decision.
- Narrow viewports (768 / 390): captured before and after for Products, the category dialog, Admin Organizations and Login in light and dark, observational only (F7/F11 are excluded). Only three of the 32 images were opened (earlier capture, same state); no regression was claimed from the rest.

## Capture caveats

- The Next.js development overlay is hidden in captures (dev tooling, not product UI).
- Full-page captures draw the sticky header partway down the page; content is complete and readable.
- "View store" is not rendered in this environment (no root domain configured), so it was not part of the comparison.
