# Store Forge Studio UI Enhancement — Implementation & Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and independently prove the approved merchant-dashboard ("Studio") enhancements F1, F2, F4, F12 (Stage 1, already implemented, uncommitted) and F6a (Stage 2, blocked), with screenshot-backed evidence for every acceptance criterion.

**Architecture:** Presentation-only changes. F2/F4 use CSS scoped by `[data-area="merchant"]` (set by a `MerchantScope` wrapper and mirrored on `<html>` for portals); global tokens and Admin/Login are untouched. F1 reuses the sidebar's nav set + hidden list through one pure helper. F12 adds a pure date helper with an explicit timezone argument. F6a moves the Add Category button into `PageHeader` by having `CategoryManager` render the header (the `TeamManager` pattern).

**Tech Stack:** Next.js 16.4.5 (Turbopack), React 19.3, Tailwind v4, shadcn `base-nova` on `@base-ui/react`, Vitest 5.1 (node environment), Playwright 1.65, StoreForge NestJS API + Supabase behind the frontend.

## Global Constraints

- Scope = merchant dashboard only (`app/(dashboard)/dashboard/**` + shared components it uses). Out: Platform Admin, storefront, landing, Login, Templates.
- No backend, API-contract, database, migration, permission, or auth-logic changes. No new dependencies or test frameworks.
- Global design-system defaults unchanged; Admin and Login must render identically (dimensions, colours).
- No per-component styling props. Dialogs/menus (portals) must receive merchant scope.
- Locale `en-IN` and existing date output formats preserved; invalid timezone falls back to UTC.
- Control height target 32px (`h-8`) for Input, NativeSelect, Ctrl+K trigger only; default Button unchanged.
- Merchant error text `#b83232` (light); dark mode and `--error` fills/borders unchanged.
- Never overwrite or revert parallel work (`feat/category-subcategories-ui`, `feat/product-bulk-import-ui`).
- No commit, push, merge, branch creation, deletion of worktrees/stack, or database write without explicit user approval. No `Co-Authored-By` trailer on commits.
- Never mark an AC `VERIFIED` without inspected evidence; never claim restricted-catalog E2E coverage without a restricted account.

---

## 0. Verified state (inspected 2026-11-18, read-only)

| Item | Finding |
|---|---|
| Feature worktree | `C:\Users\Eshwar\WNR\store-forge-studio-ui`, branch `feat/studio-ui-enhancement`, HEAD `b14614b` (= `origin/main`, 0 commits ahead/behind) |
| Stage 1 code | 14 modified + 5 new files, **uncommitted** (list in §3). Not pushed |
| `origin/main` | `b14614b` (PR #4), unchanged since branching |
| `feat/category-subcategories-ui` | **Not on the remote**, not merged. Exists only as local worktree `...\Temp\sff-pr2` at `b14614b` with 11 uncommitted entries (edits `category-manager.tsx`, `categories/loading.tsx`, `products/page.tsx`, `products/new|[id]/page.tsx`; adds `lib/categories/`, tests, `tests/e2e/evidence.ts`, `tests/e2e/ui.ts`) → **Stage 2 is BLOCKED** |
| `feat/product-bulk-import-ui` | Not on the remote, not merged. Local worktree `...\Temp\sff-pr4`, 23 uncommitted entries (edits `products/page.tsx` header actions, `package.json`, `lib/api/*`, …; adds `tests/e2e/evidence.ts`, `tests/e2e/ui.ts`) |
| `fix/baseline-timing-config-and-middleware-lint` | On the remote, **not merged** into `origin/main`. 1 commit `317c243`, 3 files: `lib/supabase/middleware.ts`, `tests/timing-files.ts`, `tests/unit/timing-config.test.ts`. No overlap with Stage 1 files |
| Baseline failures on `origin/main` | 2 unit tests in `tests/unit/timing-config.test.ts`; 1 `prefer-const` lint error `lib/supabase/middleware.ts:28` |
| Test infra | Vitest `environment: "node"`; **no jsdom / happy-dom / testing-library** → no component-render unit tests. Playwright 1.65 configured (`playwright.config.ts`, serial, `testMatch /.*\.spec\.ts/`) |
| E2E evidence convention | `tests/e2e/helpers.ts#shot` writes `artifacts/qa/screenshots/<E2E_TICKET_ID>/<name>.png`. `artifacts/` is **not** gitignored |
| Temporary env (left intact per instruction) | API worktree `store-forge-api-e2e` (uncommitted SSL patches in `scripts/db-migrate.ts`, `scripts/seed-themes.ts`; untracked `supabase/`, gitignored `.env`); baseline worktree `store-forge-studio-baseline` (detached `b14614b`); Supabase stack `sf-studio-ui-e2e` (5 containers, ports 58101 API / 58102 Postgres); frontend `.env.local` (gitignored, local values only). **No servers are running** |
| Runtime gotcha | `npm run` inside the API worktree resolves Node 20 (API needs ≥22). Run the API with the system Node directly: `node node_modules/@nestjs/cli/bin/nest.js build` then `node --env-file=.env dist/main` |
| Login rate limit | API returns 429 after a handful of logins/minute. E2E must sign in once per account and reuse sessions |

**Naming collision to avoid:** both parallel worktrees carry untracked `tests/e2e/evidence.ts` and `tests/e2e/ui.ts`. This plan uses `tests/e2e/support/studio-evidence.ts` only.

**Inconsistency in the ticket text (flag, not resolved):** F12 says "all *five* approved display locations" but lists six items. They are the same code paths (Overview and Analytics both use `AnalyticsView`). This plan treats them as six verifiable surfaces / five code sites.

---

## 1. Blockers, decisions and UNKNOWNs

| ID | Type | Item | Needed from |
|---|---|---|---|
| B1 | **BLOCKED** | Stage 2 (F6a) until `feat/category-subcategories-ui` merges into `origin/main` | Merge of that PR |
| B2 | **DECISION** | Baseline failures (2 tests + 1 lint error) vs Definition of Done. Options: (a) wait for `fix/baseline-…` to merge, then rebase Stage 1 onto it [recommended]; (b) cherry-pick `317c243` into this branch (needs approval, touches 3 unrelated files); (c) explicit written waiver. DoD is **not** waived today | User |
| B3 | **DECISION** | Restricted-catalog E2E needs a restricted member. Only way without new seed data is creating a dedicated test member through the app's Team UI (a database write, then disable/remove it). Otherwise F1-2 stays "unit-tested, E2E not covered" | User |
| B4 | **DECISION** | Evidence directory: repo convention is `artifacts/qa/screenshots/<TICKET>/`; the request proposed `artifacts/qa-screenshots/studio-ui-enhancement/`. Plan uses the repo convention (`E2E_TICKET_ID=STUDIO-UI-ENHANCEMENT`) with the requested sub-folders. Also: commit evidence or keep it outside the PR? Recommend **not** committed | User |
| B5 | **DECISION** | Proposed *additional* Stage 1 tests (Tasks 2–4) add files to an already-accepted Stage 1. They change no product code but are new files | User |
| B6 | **DECISION** | F12 invalid-`Date` behaviour: `Intl` throws `RangeError` for `new Date(NaN)`, exactly as the old inline formatters did, and no caller passes one. Plan **pins** this behaviour in a test instead of silently changing it. Say if you want a guard instead | User |
| B7 | **DECISION** | F6a empty state: follow `collections` (header action only when rows exist, empty state keeps its own button) or `products` (button in both)? Recommend `collections` (no duplicate button) | User (Stage 2) |
| U1 | **UNKNOWN** | Whether the E2E can read ground-truth timestamps from `GET /analytics`, `/customers/:id`, `/inventory/adjustments` with the session cookies (BFF/CSRF behaviour unverified). Task 4 Step 1 is a spike that settles this | Spike |
| U2 | **UNKNOWN** | Server timezone in CI/staging. The F12 E2E needs the *server process* started with `TZ=UTC` to prove independence from server time | Environment |
| U3 | **UNKNOWN** | What `feat/category-subcategories-ui` finally looks like after merge (CategoryManager structure, hierarchy rendering, e2e helpers). F6a code in Task 7 is written against the `origin/main` version and **must be re-derived** after the merge | After B1 |
| U4 | **UNKNOWN** | Themes page was never opened; not part of this ticket's scope but listed as a known limitation | — |

---

## 2. Acceptance-criteria register (current status, honest)

Status key: NOT STARTED · IMPLEMENTED · TESTED · VERIFIED · BLOCKED · FAILED.
"Screenshots" are **in the scratchpad only** (`...\scratchpad\shots` / `compare`), not in the required evidence structure, and several criteria were never captured. Therefore **nothing is `VERIFIED` yet**; `TESTED` means an automated test passed.

| AC ID | Finding | Criterion | Implementation | Unit test | E2E test | Evidence needed (planned path under `…/STUDIO-UI-ENHANCEMENT/`) | Status |
|---|---|---|---|---|---|---|---|
| F1-1 | F1 | Owner sees every permitted entry incl. Team | `command-search.tsx`, `nav-config.ts`, `layout.tsx` | `nav-visibility.test.ts` "shows Team members to the owner only" | `studio-scope.spec.ts` "owner sees Team members in both" | `F1-command-palette/after-owner-team-visible.png` (palette filtered to "team" **and** full list scrolled) | TESTED (no required screenshot; earlier palette shot did not show the Team row) |
| F1-2 | F1 | Restricted entries hidden for members lacking permission | same | `nav-visibility.test.ts` customers-only + no-access actors | **none** (no restricted account) | `F1-command-palette/after-restricted-member.png` only if B3 approved | TESTED (unit only); E2E **BLOCKED** on B3 |
| F1-3 | F1 | Palette matches sidebar | same | parity test | "staff get no Team members, and nothing the sidebar hides" + owner | `F1-command-palette/after-staff-palette-sidebar-parity.png` (palette + sidebar in one frame) | TESTED |
| F1-4 | F1 | Navigation actions still work | `command-search.tsx` | — | **gap** (no test selects an item) → Task 3 adds one | `F1-command-palette/after-palette-navigates.png` | NOT STARTED (test) |
| F1-5 | F1 | No authorization bypass | server gating unchanged | — | **gap** → Task 3: staff opening `/dashboard/team` is redirected; palette lacks Team | `F1-command-palette/after-staff-team-redirect.png` | NOT STARTED (test) |
| F2-1 | F2 | Merchant light error text = `#b83232` | `globals.css` | Task 2 static test | "dialog controls (portal) … darker red" | `F2-error-contrast/after-light-mode-error.png` | TESTED |
| F2-2 | F2 | Contrast ≥ 4.5:1 | `globals.css` | **gap** → Task 2 ratio test (white, page, muted, error banner tint) | — | (numeric proof in test log; screenshot optional) | TESTED by calculation earlier (≥5.27:1), automated test NOT STARTED |
| F2-3 | F2 | Error borders/fills unchanged | `globals.css` (only `color` is overridden) | Task 2 static test: rule sets `color` only | **gap** → Task 3 asserts banner border/background computed values equal baseline | `F2-error-contrast/after-light-mode-error.png` (banner visible) | NOT STARTED (test) |
| F2-4 | F2 | Dark error text unchanged | `globals.css` | Task 2 static test | "dark mode keeps the global error colour" | `F2-error-contrast/after-dark-mode-error.png` | TESTED |
| F2-5 | F2 | Admin & Login keep error styling | not modified | Task 2 static test (no unscoped assignment) | "login screen", "platform admin keeps…" (light only) | `admin-login-regression/{before,after}-{admin,login}-{light,dark}.png` | TESTED (light); dark = screenshots only, NOT captured in structure |
| F4-1 | F4 | Merchant Input 32px | `ui/input.tsx`, `globals.css` | Task 2 static: fallback = `2rem`, scoped var = `2rem` | "toolbar and header controls are 32px" | `F4-control-heights/after-merchant-list-toolbar.png` | TESTED |
| F4-2 | F4 | Merchant NativeSelect 32px | `ui/native-select.tsx`, `globals.css` | Task 2 static: fallback = `2.25rem` | same + dialog test | `F4-control-heights/after-merchant-dialog-controls.png` | TESTED |
| F4-3 | F4 | Ctrl+K trigger 32px | `command-search.tsx` | — | toolbar test | `F4-control-heights/after-command-search-trigger.png` | TESTED |
| F4-4 | F4 | Toolbar alignment | `globals.css` | — | toolbar test asserts equal heights | `F4-control-heights/{before,after}-merchant-list-toolbar.png` | TESTED |
| F4-5 | F4 | Dialog form alignment (portal) | `merchant-scope.tsx` | — | dialog test | `F4-control-heights/after-merchant-dialog-controls.png` | TESTED |
| F4-6 | F4 | Default Button unchanged | `ui/button.tsx` not modified | — | **gap** → Task 3 asserts "View store"/"Add product" heights unchanged (32px) | `F4-control-heights/after-merchant-list-toolbar.png` | NOT STARTED (test) |
| F4-7 | F4 | Admin & Login dimensions unchanged | not modified | Task 2 static | admin 36px select / login 36px input | `admin-login-regression/*` | TESTED (light) |
| F12-1 | F12 | Six surfaces use store timezone | 5 code sites (§3) | `format-date.test.ts` | **gap** (only manual text extraction so far) → Task 4 | `F12-timezone/after-{customers-list,customer-detail,inventory-adjustments,overview-orders,analytics-orders,products-updated}.png` | IMPLEMENTED; E2E NOT STARTED |
| F12-2 | F12 | Overview & Analytics both get the timezone | `dashboard/page.tsx`, `analytics/page.tsx` | — | Task 4 | `after-overview-orders.png`, `after-analytics-orders.png` | IMPLEMENTED |
| F12-3 | F12 | `ProductTable` receives timezone explicitly | `product-table.tsx`, `products/page.tsx` | typecheck (prop required) | Task 4 | `after-products-updated.png` | IMPLEMENTED |
| F12-4 | F12 | IST vs UTC day boundary | `lib/format-date.ts` | boundary tests (18:29:59Z vs 18:30:00Z) | Task 4 | (same) | TESTED (unit) |
| F12-5 | F12 | Invalid timezone → UTC | `lib/format-date.ts` | tests | — | — | TESTED |
| F12-6 | F12 | `en-IN` output preserved | `lib/format-date.ts` | legacy-formatter equality tests | — | — | TESTED |
| F12-7 | F12 | No hydration mismatch | explicit tz arg | — | **gap** → Task 4 console check with browser tz ≠ store tz | `F12-timezone/after-products-updated.png` + console log artifact | Observed manually (baseline logged hydration failures, branch did not); automated test NOT STARTED |
| F12-8 | F12 | Chart axis unchanged | `sales-chart.tsx` not modified | Task 2: `git diff` guard | Task 4 screenshot | `F12-timezone/after-analytics-chart-axis.png` | NOT STARTED (guard) |
| F12-9 | F12 | Admin date formatting untouched | no admin file modified | Task 2 guard | — | — | TESTED by file-list inspection; guard NOT STARTED |
| F6a-1…6 | F6a | See §5 Task 7 | — | — | — | `F6a-category-header/*` | **BLOCKED (B1)** |

---

## 3. File-level breakdown (every path verified to exist, 2026-11-18)

### 3.1 Stage 1 — modified (exist, uncommitted)

| File | Current responsibility | Modification (already made) | Risk | Verification |
|---|---|---|---|---|
| `components/dashboard/command-search.tsx` | Ctrl+K palette (merchant-only; Admin does not import it) | Props `navKey`, `hidden`; items from `visibleNavItems`; trigger `h-8 w-8` | Low | nav-visibility unit, studio-scope palette tests |
| `components/dashboard/nav-config.ts` | Nav sets + permission → hidden hrefs (**shared with Admin**) | Added pure `visibleNavItems(navKey, hidden)`; `NAV_SETS`, `ADMIN_NAV_ITEMS` untouched | Low | unit asserts `visibleNavItems("admin") === ADMIN_NAV_ITEMS` |
| `app/(dashboard)/dashboard/layout.tsx` | Dashboard shell composition | `navKey`/`hiddenNav` computed once; palette gets them; shell wrapped in `MerchantScope`; whole shell re-indented (diff noise, use `git diff -w`) | Medium (layout of every merchant page) | all E2E, build |
| `app/globals.css` | Tokens + global CSS (**shared**) | Appended scoped block: `[data-area="merchant"]{--control-h:2rem;--error-text:#b83232}`, dark override, `.text-error` colour rule | Medium | compiled-CSS inspection, Task 2 static test, E2E |
| `components/ui/input.tsx` | Shared Input (**Admin/Login use it**) | `h-8` → `h-[var(--control-h,2rem)]` | Low (fallback = old value; explicit call-site `h-*` still wins via tailwind-merge — proven on Login) | Login 36px test, Admin 32px test |
| `components/ui/native-select.tsx` | Shared NativeSelect (**Admin uses it**) | `h-9` → `h-[var(--control-h,2.25rem)]` | Low | Admin 36px test |
| `components/analytics/analytics-view.tsx` | Overview/Analytics body | `timezone` prop; `formatDateTime` | Low | typecheck, Task 4 |
| `components/products/product-table.tsx` | Client table | `timezone` prop; `formatDate` | Low | typecheck, Task 4 |
| `app/(dashboard)/dashboard/{page,analytics/page,products/page,customers/page,customers/[id]/page,inventory/page}.tsx` | Server pages | pass/consume `store.timezone ?? "UTC"` | Low (`products/page.tsx` also edited by both parallel branches — different lines) | typecheck, Task 4 |

### 3.2 Stage 1 — new (exist, uncommitted)

| File | Purpose |
|---|---|
| `components/dashboard/merchant-scope.tsx` | Wrapper `div[data-area="merchant"].contents` + sets/removes `document.documentElement.dataset.area` |
| `lib/format-date.ts` | `formatDate`, `formatDateTime` (cached formatters, UTC fallback) |
| `tests/unit/format-date.test.ts` | 7 tests |
| `tests/unit/nav-visibility.test.ts` | 6 tests |
| `tests/e2e/studio-scope.spec.ts` | 8 tests, session reuse |

### 3.3 Proposed additions (this plan; need approval B5)

| File | Purpose |
|---|---|
| `tests/unit/merchant-scope-css.test.ts` | Static CSS/source guards + WCAG ratio (Task 2) |
| `tests/e2e/support/studio-evidence.ts` | Evidence capture + AC result recorder (Task 5) |
| `tests/e2e/studio-timezone.spec.ts` | F12 browser proof (Task 4) |
| `tests/e2e/studio-evidence.spec.ts` | Screenshot capture per AC (Task 5) |
| edits to `tests/e2e/studio-scope.spec.ts` | Gap-closing assertions (Task 3) |

### 3.4 Stage 2 — to modify (blocked; re-derive after merge, U3)

`components/categories/category-manager.tsx`, `app/(dashboard)/dashboard/categories/page.tsx`. Possibly `app/(dashboard)/dashboard/categories/loading.tsx` (skeleton header actions) — inspect only.

### 3.5 Must remain untouched

`components/dashboard/app-shell.tsx`, `components/dashboard/sidebar-nav.tsx` (Admin render path), `components/shared/page-header.tsx`, `components/shared/form-field.tsx`, `components/shared/field-label.tsx`, `components/ui/button.tsx`, `components/analytics/sales-chart*.tsx`, `app/(admin)/**`, `components/admin/**`, `components/auth/**`, `components/templates/**`, `lib/auth/**`, `services/**`, `lib/api/**`, `lib/supabase/middleware.ts`, `tests/timing-files.ts`, `tests/unit/timing-config.test.ts`, `package.json`.

### 3.6 Shared-component consumer inventory (re-run before any change)

| Shared piece | Admin | Login | Merchant | Templates | Rule |
|---|---|---|---|---|---|
| `ui/input` | 6 files | 1 | 9 | 1 | default value unchanged outside scope |
| `ui/native-select` | 4 | 0 | 7 | 0 | same |
| `FormField` / `text-error` | 6 | 1 | 9–10 | 1 | untouched; override only under scope |
| `nav-config` / `AppShell` / `SidebarNav` | uses | — | uses | — | only additive export |
| `ListFilters`, `Pagination`, `EmptyState`, `StatusBadge`, `ConfirmDialog` | 3 pages | — | many | — | untouched |

Re-run: `grep -rlE "components/ui/input|components/ui/native-select|shared/form-field" app components | sort`.

---

## 4. Per-finding architecture notes (13-point condensed)

### F1 — Palette permission consistency
1. **Existing:** sidebar renders `NAV_SETS[navKey]` minus `hiddenNavHrefs(actor)` (from `NAV_PERMISSION`); palette rendered all of `NAV_ITEMS`. 2. **Behaviour:** restricted members saw hidden sections; owner never saw Team. 3. **Problem:** divergent sources. 4. **Change:** one helper `visibleNavItems`. 5. **Components:** `command-search`, `nav-config`, `layout`. 6. **Strategy:** compute `navKey`/`hiddenNav` once in the layout, pass to both shell and palette; sidebar left untouched. 7. **Deps:** none. 8. **Side effects:** palette now also lists "Online Store" items (Themes, Customize, Pages, Navigation) because they are in the sidebar list. 9. **Security:** UI hint only; server `requireWorkspaceCan` and DB checks unchanged; no permission added. 10. **Perf:** none (filter of ≤13 items). 11. **Tests:** unit parity + E2E (Tasks 3, 5). 12. AC F1-1…5. 13. **Rollback:** revert the three files; palette returns to `NAV_ITEMS`.

### F2 — Error text contrast
1. **Existing:** 25 uses of plain `text-error` (`#dc5353`, 3.45–3.89:1); fills use `border-error/30`, `bg-error/5|10`. 3. **Problem:** fails WCAG AA small text in light mode. 4. **Change:** scoped rule `[data-area="merchant"] .text-error{color:var(--error-text)}`, `--error-text:#b83232` (≥5.27:1 on white, page, muted, banner tint); dark scope restores `var(--error)`. 7. **Deps:** F4's scope mechanism. 8. **Side effects:** Templates pages (inside the merchant shell) inherit; no Templates file touched. 9. none. 10. none. 11. Tasks 2, 3, 5. 13. **Rollback:** delete the scoped block.

### F4 — 32px controls
1. **Existing:** Input 32px, NativeSelect 36px, trigger 36px. 4. **Change:** Input/NativeSelect heights read `var(--control-h, <old>)`; scope sets `--control-h:2rem`; trigger is `h-8` (merchant-only file). 8. **Side effects:** call sites with explicit `h-*` keep their own height (none in merchant code; Login sets `h-9`). `InputGroup` (palette input) already 32px. 11. Tasks 2, 3, 5. 13. Revert `input`, `native-select`, `globals.css`, `command-search` class.

### F12 — Store-timezone dates
1. **Existing:** six `Intl.DateTimeFormat("en-IN", …)` module constants with no `timeZone`; one in a client component. 3. **Problem:** shows server/browser time; analytics numbers already use store tz; hydration risk in `ProductTable`. 4. **Change:** `lib/format-date.ts`; five call sites; `AnalyticsView` and `ProductTable` take required `timezone`. 8. Output only changes when store tz ≠ viewer tz. 9. none. 10. formatter cache per (kind, zone). 11. Tasks 2, 4, 5. 13. Revert call sites + delete helper.

### F6a — Add Category in `PageHeader` (BLOCKED)
See Task 7.

---

## 5. Tasks

### Task 1: Phase 1 — repository and branch verification (read-only)

**Files:** none modified.

- [ ] **Step 1: Capture state and re-confirm dependencies**

```bash
cd /c/Users/Eshwar/WNR/store-forge-studio-ui
git rev-parse --abbrev-ref HEAD && git status --short
git fetch origin
git log --oneline b14614b..origin/main
for b in feat/category-subcategories-ui feat/product-bulk-import-ui fix/baseline-timing-config-and-middleware-lint; do
  printf "%-50s " "$b"
  if git rev-parse -q --verify origin/$b >/dev/null; then
    git merge-base --is-ancestor origin/$b origin/main && echo MERGED || echo "NOT MERGED"
  else echo "no remote branch"; fi
done
```
Expected today: branch `feat/studio-ui-enhancement`, 19 changed/new files, no new `origin/main` commits, subcategories + bulk-import "no remote branch", baseline-fix "NOT MERGED".

- [ ] **Step 2: Confirm shared-component consumers have not changed** (command in §3.6). Expected: counts match the table.
- [ ] **Step 3: Confirm untouched-file guard**

```bash
git diff --name-only origin/main | grep -E "(admin)|components/admin|sales-chart|components/auth|components/templates|app-shell|sidebar-nav|ui/button|page-header|form-field|field-label|package.json" && echo "VIOLATION" || echo "guard ok"
```
Expected: `guard ok`.

- [ ] **Step 4: Record results** in the closeout report §E. No commit.

### Task 2: Stage 1 gap-closing unit tests (needs approval B5)

**Files:**
- Create: `tests/unit/merchant-scope-css.test.ts`
- Modify: `tests/unit/format-date.test.ts` (append one test, B6)

**Interfaces:** consumes `app/globals.css`, `components/ui/input.tsx`, `components/ui/native-select.tsx`, `components/dashboard/command-search.tsx`, `lib/format-date.ts` as text/modules. Produces nothing for later tasks.

- [ ] **Step 1: Write the failing/guarding test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const css = read("app/globals.css");

/** Naive rule splitter: good enough for this file's flat rules. */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: string, alpha: number, bg: string) => {
  const f = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return "#" + f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("");
};

describe("merchant scope CSS (static guards; behaviour is proven in Playwright)", () => {
  it("assigns --control-h and --error-text only under [data-area=merchant]", () => {
    const assigning = rules.filter((r) => /--(control-h|error-text)\s*:/.test(r.body));
    expect(assigning.length).toBeGreaterThan(0);
    for (const r of assigning) expect(r.selector, r.selector).toContain('[data-area="merchant"]');
  });

  it("keeps the global --error token values", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--error:\s*#dc5353;/);
    expect(css).toMatch(/\.dark\s*\{[^}]*--error:\s*#e05252;/);
  });

  it("overrides only the text colour of .text-error (borders and fills untouched)", () => {
    const rule = rules.find((r) => r.selector === '[data-area="merchant"] .text-error');
    expect(rule?.body.replace(/\s/g, "")).toBe("color:var(--error-text);");
  });

  it("restores the global error colour in dark mode, on <html> and on the wrapper", () => {
    const dark = rules.find((r) => r.selector.includes('.dark[data-area="merchant"]'));
    expect(dark?.selector).toContain('.dark [data-area="merchant"]');
    expect(dark?.body).toContain("--error-text: var(--error)");
  });

  it("merchant error text meets WCAG AA (4.5:1) on every surface it appears on", () => {
    const text = "#b83232";
    const err = "#dc5353";
    const surfaces = { white: "#ffffff", page: "#f7f8fa", muted: "#f3f4f6", bannerOnPage: over(err, 0.05, "#f7f8fa"), bannerOnWhite: over(err, 0.05, "#ffffff") };
    for (const [name, bg] of Object.entries(surfaces)) expect(ratio(text, bg), name).toBeGreaterThanOrEqual(4.5);
    expect(ratio(err, "#ffffff")).toBeLessThan(4.5); // documents why the override exists
  });

  it("controls fall back to their previous heights outside the scope", () => {
    expect(read("components/ui/input.tsx")).toContain("h-[var(--control-h,2rem)]");
    expect(read("components/ui/native-select.tsx")).toContain("h-[var(--control-h,2.25rem)]");
    expect(css).toMatch(/\[data-area="merchant"\]\s*\{[^}]*--control-h:\s*2rem;/);
  });

  it("the Ctrl+K trigger is 32px and the palette takes navKey/hidden props", () => {
    const src = read("components/dashboard/command-search.tsx");
    expect(src).toContain("h-8 w-8");
    expect(src).not.toMatch(/\bh-9\b/);
    expect(src).toContain("visibleNavItems(navKey, hidden)");
  });
});
```

- [ ] **Step 2: Run it** `npx vitest run tests/unit/merchant-scope-css.test.ts`. Expected: PASS (these guard existing Stage 1 code; if any assertion fails, that is a real Stage 1 defect — stop and report, do not edit the assertion).

- [ ] **Step 3: Append the pinned invalid-date test (B6)** to `tests/unit/format-date.test.ts`:

```ts
describe("invalid dates", () => {
  it("throws RangeError like the Intl formatters it replaced (no caller passes an invalid Date)", () => {
    expect(() => formatDate(new Date(NaN), "UTC")).toThrow(RangeError);
    expect(() => formatDateTime(new Date(NaN), "UTC")).toThrow(RangeError);
  });
});
```

- [ ] **Step 4: Add the "untouched files" guard** is a shell check, not a unit test (Task 1 Step 3); run it again at Task 8.
- [ ] **Step 5: Run** `npx vitest run tests/unit/merchant-scope-css.test.ts tests/unit/format-date.test.ts tests/unit/nav-visibility.test.ts`. Expected: all pass.
- [ ] **Step 6: Do not commit** (approval pending).

### Task 3: Stage 1 gap-closing E2E assertions (needs approval B5)

**Files:** Modify `tests/e2e/studio-scope.spec.ts`.

**Interfaces:** consumes the file's existing `asUser(browser, who, fn, scheme)`, `height`, `color`, `areaMarker`, `openCategoryDialogWithError`. Produces nothing.

- [ ] **Step 1: Add these tests** inside the existing `describe` blocks (merchant: F4-6, F2-3; palette: F1-4, F1-5):

```ts
  // F4-6: the default Button is unchanged (32px) and sits level with the 32px controls.
  test("default buttons keep their own height", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard/products");
      expect(await height(page.getByRole("link", { name: /add product/i }))).toBeCloseTo(32, 0);
      expect(await height(page.getByRole("link", { name: /view store/i }))).toBeCloseTo(32, 0);
    });
  });

  // F2-3: the error banner keeps its border and tint; only the text colour changes.
  test("error borders and fills are unchanged", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      await openCategoryDialogWithError(page);
      const input = page.locator("#cat-name");
      expect(await input.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(BASELINE_INVALID_BORDER);
    });
  });
```

and add near the constants (value recorded from the `origin/main` baseline run in Task 5 — **do not guess it**: run Task 5 Step 3 against the baseline first, then paste the measured value):

```ts
const BASELINE_INVALID_BORDER = /* measured on origin/main by Task 5 Step 3, e.g. "rgb(201, 63, 63)" */ "MEASURE-ME";
```
(Execution rule: this constant must be replaced with the measured string before the test is run; a literal `"MEASURE-ME"` fails the test by design.)

```ts
  // F1-4: choosing an entry navigates.
  test("choosing a palette entry navigates there", async ({ browser }) => {
    await asUser(browser, "owner", async (page) => {
      await page.goto("/dashboard");
      await page.keyboard.press("Control+K");
      await page.getByRole("option", { name: "Categories" }).click();
      await page.waitForURL(/\/dashboard\/categories/);
    });
  });

  // F1-5: the palette grants nothing the server does not; a non-owner opening Team is sent away.
  test("staff cannot reach Team by URL, and the palette never offered it", async ({ browser }) => {
    await asUser(browser, "staff", async (page) => {
      await page.goto("/dashboard/team");
      await page.waitForURL((u) => !u.pathname.endsWith("/team"));
      expect(new URL(page.url()).pathname).toBe("/dashboard");
    });
  });
```

- [ ] **Step 2: Run** (environment per Task 5 Step 1): `E2E_BASE_URL=http://localhost:3100 E2E_DEMO_PASSWORD=Demo1234 E2E_PLATFORM_ADMIN_EMAIL=platform@demo.test npx playwright test tests/e2e/studio-scope.spec.ts --reporter=list`. Expected: all pass. If the F1-5 redirect target differs from `/dashboard`, **report the actual redirect** (existing behaviour, `team/page.tsx` does `redirect(ROUTES.dashboard)`); never change the assertion to hide a different result.
- [ ] **Step 3: Restricted-member E2E (only if B3 approved):** create a dedicated member (e.g. `e2e-restricted@demo.test`, customers-only) through the Team UI as the owner, sign in as that member, assert the palette lacks Products/Categories/Collections/Inventory/Analytics and equals the sidebar, capture `F1-command-palette/after-restricted-member.png`, then disable/remove the member in the same test's `afterAll`. If B3 is not approved, record F1-2 E2E as **BLOCKED**.

### Task 4: F12 browser proof

**Files:** Create `tests/e2e/studio-timezone.spec.ts`.

**Interfaces:** consumes `login`, `OWNER`, `password` from `./helpers`. Produces none.

- [ ] **Step 1 (spike, settles U1): can the test read ground-truth timestamps?**

```ts
// run once, interactively, e.g. as a throwaway test
const res = await context.request.get(`${process.env.E2E_API_URL ?? "http://localhost:4000/api/v1"}/analytics?range=30`);
console.log(res.status(), Object.keys((await res.json()).data ?? {}));
```
Expected if usable: `200` with a `recentOrders` array containing ISO `placedAt`. If `401/403` (cookie/CSRF scheme differs) record U1 as unresolved and use Step 2's **fallback**, not a guess.

- [ ] **Step 2: Write the spec (primary, if the spike succeeds).** Server must be started with `TZ=UTC`; the browser context uses a third timezone so neither side matches the store (`Asia/Kolkata`).

```ts
import { expect, test, type Page } from "@playwright/test";
import { login, OWNER } from "./helpers";

const STORE_TZ = "Asia/Kolkata";
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
test.use({ timezoneId: "America/Los_Angeles", colorScheme: "light", viewport: { width: 1280, height: 800 } });

const expectedDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: STORE_TZ }).format(new Date(iso));

async function hydrationErrors(page: Page, run: () => Promise<void>) {
  const bad: string[] = [];
  page.on("console", (m) => { if (/hydrat/i.test(m.text())) bad.push(m.text()); });
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) bad.push(e.message); });
  await run();
  expect(bad, "hydration errors").toEqual([]);
}

test.describe("store-timezone dates (server TZ=UTC, browser America/Los_Angeles, store Asia/Kolkata)", () => {
  test("Overview and Analytics recent orders show store time", async ({ page, context }) => {
    await login(page, OWNER);
    const data = (await (await context.request.get(`${API}/analytics?range=30`)).json()).data;
    const first = data.recentOrders[0];
    await page.goto("/dashboard");
    await expect(page.getByText(expectedDateTime(first.placedAt)).first()).toBeVisible();
    await page.goto("/dashboard/analytics");
    await expect(page.getByText(expectedDateTime(first.placedAt)).first()).toBeVisible();
  });

  test("Products Updated column has no hydration error and shows store-time dates", async ({ page }) => {
    await login(page, OWNER);
    await hydrationErrors(page, async () => {
      await page.goto("/dashboard/products");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("tbody tr td:nth-child(7)").first()).toBeVisible();
    });
  });
});
```
Add equivalent assertions for Customers list/detail and Inventory adjustments using `GET /customers` / `/customers/:id` / `/inventory/adjustments` once the spike confirms their response shapes (read them from the spike output; do **not** assume field names).

- [ ] **Step 2 (fallback if U1 unresolved):** assert **browser-timezone independence** instead: load the same page in three contexts (`America/Los_Angeles`, `Asia/Kolkata`, `UTC`) and require identical date text; and compare against the `origin/main` baseline run (Task 5) where the known shift is +5h30. Mark F12-1 "VERIFIED by relative comparison" only if the baseline comparison is captured; otherwise **NOT VERIFIED**.
- [ ] **Step 3: Midnight boundary.** The seed produces times relative to seed time, so a fixed midnight case cannot be forced without a database write. Use the unit boundary tests for determinism (F12-4) and, for E2E, record any seeded order whose IST date differs from its UTC date (the baseline run already found one: `13 Nov 8:37 pm → 14 Nov 2:07 am`). If none exists on re-seed, state that the E2E boundary demonstration is **not available** instead of creating data.
- [ ] **Step 4: Run** with the server started as `TZ=UTC npx next dev -p 3100`. Expected: pass. Do not commit.

### Task 5: Evidence harness, baseline capture and full regression

**Files:** Create `tests/e2e/support/studio-evidence.ts`, `tests/e2e/studio-evidence.spec.ts`.

- [ ] **Step 0: Environment (every session).**

```bash
# 1. stack (if stopped):  (cd /c/Users/Eshwar/WNR/store-forge-api-e2e && supabase start)
# 2. API on 4000 with system Node 24 (npm run would pick Node 20):
cd /c/Users/Eshwar/WNR/store-forge-api-e2e
"/c/Program Files/nodejs/node" node_modules/@nestjs/cli/bin/nest.js build
"/c/Program Files/nodejs/node" --env-file=.env dist/main &
curl -s http://localhost:4000/api/v1/health            # expect {"success":true,...} HTTP 200
# 3. after-build frontend, server clock UTC:
cd /c/Users/Eshwar/WNR/store-forge-studio-ui && TZ=UTC npx next dev --turbopack -p 3100 &
# 4. baseline (origin/main) frontend:
cd /c/Users/Eshwar/WNR/store-forge-studio-baseline && TZ=UTC npx next dev --turbopack -p 3101 &
```
Expected: health 200; both Next servers "Ready". Never connect to hosted Supabase; the only DB is `localhost:58102`.

- [ ] **Step 1: Write `tests/e2e/support/studio-evidence.ts`**

```ts
import { expect, type Page } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TICKET = process.env.E2E_TICKET_ID ?? "STUDIO-UI-ENHANCEMENT";
export const LABEL = process.env.EVIDENCE_LABEL ?? "after"; // "before" when run against origin/main
const root = join(process.cwd(), "artifacts", "qa", "screenshots", TICKET);
const log = join(root, "evidence-report", `results-${LABEL}.jsonl`);

/** Saves a real screenshot of the current page and records it against an acceptance criterion. */
export async function evidence(page: Page, ac: string, folder: string, name: string, note: string, opts: { fullPage?: boolean } = {}) {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, "evidence-report"), { recursive: true });
  const path = join(dir, `${LABEL}-${name}.png`);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  expect(existsSync(path)).toBe(true);
  expect(statSync(path).size, `${path} is not empty`).toBeGreaterThan(2000);
  appendFileSync(log, JSON.stringify({ ac, label: LABEL, path: path.replace(process.cwd() + "\\", "").replaceAll("\\", "/"), note }) + "\n");
  return path;
}

export const resetLog = () => {
  mkdirSync(join(root, "evidence-report"), { recursive: true });
  writeFileSync(log, "");
};
```

- [ ] **Step 2: Write `tests/e2e/studio-evidence.spec.ts`.** One test per evidence item, each performing the real interaction, asserting the criterion, then calling `evidence(...)`. Required captures (after-build; the same spec runs with `EVIDENCE_LABEL=before` against `:3101` for the comparable subset):

| Folder / file | Interaction before capture | Must assert first |
|---|---|---|
| `F1-command-palette/owner-team-visible` | owner → `/dashboard`, Ctrl+K, type `team` | option "Team members" visible |
| `F1-command-palette/staff-palette-sidebar-parity` | staff → `/dashboard`, Ctrl+K | palette labels (sorted) equal sidebar labels; no "Team members" |
| `F1-command-palette/palette-navigates` | owner selects "Categories" | URL is `/dashboard/categories` |
| `F1-command-palette/staff-team-redirect` | staff opens `/dashboard/team` | lands on `/dashboard` |
| `F2-error-contrast/light-mode-error`, `dark-mode-error` | owner → Categories → Add category → Save empty (light; dark via `colorScheme: "dark"`) | `#cat-name-msg` computed colour `rgb(184, 50, 50)` / `rgb(224, 82, 82)` |
| `F4-control-heights/merchant-list-toolbar` | owner → Products | search input, status select, trigger all 32px |
| `F4-control-heights/merchant-dialog-controls` | owner → Inventory → Adjust stock (first enabled) | dialog input and select both 32px |
| `F4-control-heights/command-search-trigger` | owner → any page, clip the header | trigger 32px |
| `F12-timezone/{customers-list,customer-detail,inventory-adjustments,overview-orders,analytics-orders,products-updated}` | open each page with browser tz `America/Los_Angeles` | rendered date equals Task 4's expected store-time string |
| `F12-timezone/analytics-chart-axis` | owner → Analytics | chart present (axis unchanged: compare with baseline image) |
| `admin-login-regression/{admin,login}-{light,dark}` | platform admin → `/admin/organizations/new` → submit empty; `/login` → submit empty | error colour `rgb(220, 83, 83)` / dark `rgb(224, 82, 82)`; admin select 36px |

Rules: sign in once per account (reuse `storageState`, as `studio-scope.spec.ts` does — the API rate-limits logins); never print credentials; crop or avoid any page that shows secrets.

- [ ] **Step 3: Capture the baseline first** (needed for `BASELINE_INVALID_BORDER` and before/after pairs):

```bash
cd /c/Users/Eshwar/WNR/store-forge-studio-ui
EVIDENCE_LABEL=before E2E_BASE_URL=http://localhost:3101 E2E_DEMO_PASSWORD=Demo1234 E2E_PLATFORM_ADMIN_EMAIL=platform@demo.test E2E_TICKET_ID=STUDIO-UI-ENHANCEMENT npx playwright test tests/e2e/studio-evidence.spec.ts -g "baseline" --reporter=list
```
(The baseline-labelled tests record measurements only for criteria that exist before the change; F1-1 "Team" and the 32px values are *expected to differ*, which is the point of the comparison. Expected failures of "after" assertions against `:3101` are not defects — run only the tests tagged `baseline`.) Record the measured invalid-border colour into Task 3.

- [ ] **Step 4: Capture "after" and run the whole E2E set**

```bash
EVIDENCE_LABEL=after E2E_BASE_URL=http://localhost:3100 E2E_DEMO_PASSWORD=Demo1234 E2E_PLATFORM_ADMIN_EMAIL=platform@demo.test E2E_TICKET_ID=STUDIO-UI-ENHANCEMENT npx playwright test tests/e2e/studio-scope.spec.ts tests/e2e/studio-timezone.spec.ts tests/e2e/studio-evidence.spec.ts --reporter=list,json > artifacts/qa/screenshots/STUDIO-UI-ENHANCEMENT/evidence-report/playwright-results.json
```
Wait out the login rate-limit window between full runs (~3 minutes after a 429).

- [ ] **Step 5: Inspect every screenshot** (open each file; confirm it shows the stated state, is readable, and exposes no secret). Only then may the AC move to `VERIFIED`.
- [ ] **Step 6: Visual regression matrix** (light/dark × 1280×800 desktop and 768×1024 / 390×844 narrower): Products, Categories dialog, Inventory dialog, Customers, Overview, palette, row menu, Admin organizations + new, Login. Pair each `before-*` with `after-*`; record every difference. Admin and Login pairs must be pixel-equal in measured values (heights/colours); layout shifts in merchant pages are limited to the 4px control-height change. Narrow viewports are **new** coverage (F7/F11 are deferred; only record what is seen, fix nothing).
- [ ] **Step 7: Automated gates**

```bash
npx tsc --noEmit
npx eslint                       # baseline: 1 error (middleware.ts) until B2 is resolved
npx vitest run                   # baseline: 2 timing-config failures until B2 is resolved
npm run build
# changed-file lint must be clean regardless of baseline:
npx eslint $( (git diff --name-only; git ls-files --others --exclude-standard) | grep -E "\.(ts|tsx)$" )
```

### Task 6: Baseline-failure integration (decision B2)

- [ ] **Step 1: Check merge status** (Task 1 Step 1). If `fix/baseline-…` has merged: `git fetch origin && git rebase origin/main` in the feature worktree (after Stage 1 is committed with approval) and re-run Task 5 Step 7; expect the full suite and lint green.
- [ ] **Step 2: If still unmerged:** do nothing without approval; the DoD item "full suite and lint pass" stays **BLOCKED by B2**, reported in §E of the closeout.

### Task 7: Stage 2 — F6a (BLOCKED until B1; code below is for the `origin/main` version and MUST be re-derived after the merge)

**Files (verified present today):** Modify `components/categories/category-manager.tsx`, `app/(dashboard)/dashboard/categories/page.tsx`. Inspect `app/(dashboard)/dashboard/categories/loading.tsx`.

- [ ] **Step 1: Preconditions.** `git fetch origin`; confirm `feat/category-subcategories-ui` is an ancestor of `origin/main`; `git rebase origin/main` (or merge per your approval); re-read the merged `category-manager.tsx` fully (hierarchy rendering, `level`, ordering, dialog code) and `categories/page.tsx`; check whether `feat/product-bulk-import-ui` merged and re-run the `products/page.tsx` conflict check. Do **not** reuse the snippet below blindly.
- [ ] **Step 2: Write the failing E2E first** (`tests/e2e/studio-categories.spec.ts`), using a dedicated record name `E2E-studio-<timestamp>` and cleaning only that record:

```ts
import { expect, test } from "@playwright/test";
import { login, OWNER } from "./helpers";

test("Add category lives in the page header and still creates a category", async ({ page }) => {
  const name = `E2E-studio-${Date.now()}`;
  await login(page, OWNER);
  await page.goto("/dashboard/categories");

  const header = page.locator("h1", { hasText: "Categories" }).locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");
  const add = header.getByRole("button", { name: /add category/i });
  await expect(add).toBeVisible();                       // F6a-1: inside the PageHeader row

  await add.click();                                      // F6a-2: opens the existing dialog
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#cat-name-msg")).not.toBeEmpty();   // F6a-4: validation unchanged

  await page.locator("#cat-name").fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(name)).toBeVisible();      // F6a-3: creation still works

  // cleanup: delete only the record this test created
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: /delete category/i }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});
```
Add F6a-5/6 assertions (existing subcategory/hierarchy behaviour) **from the merged code's own e2e specs** (`subcategories.spec.ts`), not from assumptions. Run: expect FAIL (button not in header yet).

- [ ] **Step 3: Implement (shape, against today's `origin/main` code).** Follow `TeamManager`: the client component that owns the dialog state renders the header.
  - In `category-manager.tsx` add `import { PageHeader } from "@/components/shared/page-header";`, keep `add` and `open()` as they are, and replace the body wrapper so the component returns:

```tsx
  return (
    <>
      <PageHeader title="Categories" description="Organise your catalog into a browsable taxonomy." actions={rows.length ? add : null} />
      {rows.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description={/* merged text, unchanged */} action={add} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">{/* table unchanged */}</div>
      )}
      {/* Dialog + ConfirmDialog unchanged */}
    </>
  );
```
  (the old `{add ? <div className="mb-4 flex justify-end">{add}</div> : null}` block is removed; `actions={rows.length ? add : null}` implements B7's recommended `collections` pattern — change only if you choose otherwise).
  - In `categories/page.tsx` remove the `PageHeader` and its import, render `<CategoryManager rows={rows} canManage={…} canDelete={…} />` only. Title/description strings must be moved verbatim from the page.
  - Check `categories/loading.tsx` still matches the final layout (skeleton header already has an actions slot); change nothing unless it visibly mismatches.
- [ ] **Step 4: Run** the new spec (expect PASS), the merged branch's own category specs (must still pass), `npx tsc --noEmit`, lint, `npx vitest run`.
- [ ] **Step 5: Evidence:** `F6a-category-header/{after-categories-page-header,after-add-category-dialog,after-category-validation,after-category-created}.png` plus a `before-categories-page-header.png` from a baseline that includes the merged subcategories code (cut a fresh baseline worktree at the new `origin/main` **before** applying F6a; do not reuse the old baseline).
- [ ] **Step 6:** Update the AC matrix; do not commit without approval.

### Task 8: Closeout

- [ ] **Step 1: Generate `evidence-report/acceptance-criteria-matrix.json`** from `results-before.jsonl` + `results-after.jsonl` + `playwright-results.json`: one entry per AC with `{ac, implementation, unit, e2e, screenshots[], status}`.
- [ ] **Step 2: Write `visual-verification.md`** (what was compared, differences found, none claimed without a file) and `closeout-report.md` using §6.
- [ ] **Step 3: Re-run Task 1 Step 3 guard and `git status`** — no unexpected files (the `artifacts/` folder is evidence, **not** for commit unless B4 says so).
- [ ] **Step 4: Stop and present** for approval. **Commit and push only on explicit authorization** (no `Co-Authored-By`).

---

## 6. Closeout report template (fill only from observed results)

**A. Implementation summary:** findings done; files modified/created; shared components changed (`input`, `native-select`, `nav-config`, `globals.css`, `layout`); behaviour preserved; dependencies resolved.

**B. Verification summary**

| Verification | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| TypeScript | pass | *(run)* | | log |
| Lint | pass (agreed baseline policy: changed files clean; repo-wide error pre-existing until B2) | | | log |
| Unit tests | pass (2 pre-existing failures until B2) | | | log |
| Playwright | all pass | | | `playwright-results.json` |
| Visual | no unexplained differences | | | screenshots |
| Production build | pass | | | log |

**C.** Every AC: implementation status · test result · browser result · screenshot file · limitation. **D.** Screenshot inventory = files confirmed on disk (`ls -R artifacts/qa/screenshots/STUDIO-UI-ENHANCEMENT`). **E. Outstanding:** B1–B7, U1–U4, the 2 baseline failures, restricted-catalog E2E gap, Admin coverage limited to tested Organizations pages, Themes page unopened, staging/production verification not performed.
**F. Verdict:** exactly one of COMPLETE / PARTIALLY COMPLETE / BLOCKED / FAILED. With Stage 2 blocked and no required evidence captured yet, the verdict **today** would be **PARTIALLY COMPLETE**.

---

## 7. Security and regression matrix

| Area | Risk | Verification | Where |
|---|---|---|---|
| Authentication | Session behaviour changed | login + sign-out + marker removal | `studio-scope.spec.ts` |
| Authorization | Palette shows/enables more than sidebar | parity + Team redirect; restricted E2E only if B3 | Tasks 2, 3 |
| Tenant isolation | Cross-store data | **no data/API code changed**; run existing tenant/e2e suites if present on `origin/main` (none found under `tests/e2e` today → record "not independently re-verified") | Task 8 |
| Admin | Shared CSS/component leakage | measured heights/colours + screenshots | Task 5 |
| Login | Same | same | Task 5 |
| Dialogs | Portal outside wrapper | dialog heights/colours + dark-mode portal test | Task 5 |
| Forms | Alignment regression | toolbar + dialog screenshots | Task 5 |
| Dates | Wrong day near midnight | unit boundary + E2E | Tasks 2, 4 |
| Hydration | Server/client mismatch | console capture with differing timezones | Task 4 |
| Categories | Workflow broken | create/validate/delete E2E | Task 7 |

## 8. Deployment, flags and rollback

- **Feature flag:** not needed. Changes are CSS/presentation/formatting with a one-revert rollback; no new flag (per instruction).
- **Prerequisites:** B2 resolved; Stage 1 approved/committed; (Stage 2) B1 merged.
- **Build verification:** `npm run build` pass on the final commit; compiled CSS inspected for scoped-only assignments (Task 5 Step 7 + Task 2 test).
- **Release sequence:** (1) PR for Stage 1 (reviewer reads `git diff -w` for the layout re-indent); (2) merge per existing release process; (3) Stage 2 PR after B1.
- **Post-deploy smoke (staging, then production — each only when actually executed):** owner login → Products toolbar aligned; Ctrl+K lists Team for owner; submit an empty category form (error text dark red); Overview/Customers dates match store timezone; Admin organizations page and Login unchanged; browser console free of hydration errors.
- **Monitoring:** watch client error reporting for hydration errors and for unexpected 403/redirect spikes on `/dashboard/*`.
- **Rollback:** revert the Stage 1 commit(s) (restores `NAV_ITEMS` palette, old heights, old error colour, inline `Intl` formatters, removes `MerchantScope`); revert Stage 2 commit independently. No database action exists or is needed.
- **Environments:** local E2E ≠ staging ≠ production. **No staging or production verification has been performed**; none may be claimed without its own evidence.

## 9. Definition of Done (strict)

All 14 items from the request apply unchanged. Today: items 1 (partly, F6a blocked), 5, 13 are open; 10 and 12 pass; 3/4 pass except the 2 baseline failures; 11 is blocked by B2. **Do not declare COMPLETE** until B1, B2 and the required evidence are resolved.

## Self-review (completed)

- **Spec coverage:** F1, F2, F4, F12 → §2/§4/Tasks 2–5; F6a → Task 7 (blocked); excluded items stay excluded (§Global Constraints); baseline policy → B2/Task 6; evidence structure → Task 5; matrix/closeout → §2/§6; rollback/flags → §8.
- **Placeholders:** the only intentional gap is `BASELINE_INVALID_BORDER = "MEASURE-ME"` (a measured value that cannot be known before Task 5 Step 3; the test fails until replaced, by design) and the F6a empty-state description text (explicitly "merged text, unchanged"). No other TBDs.
- **Consistency:** helper names (`visibleNavItems`, `formatDate`, `formatDateTime`, `asUser`, `evidence`, `LABEL`) match the implemented code and between tasks.
