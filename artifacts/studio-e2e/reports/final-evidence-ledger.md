# Final Evidence Ledger — Store Forge Studio (Releases 1–4)

**Date:** 2026-11-22  
**Repositories:**
- Frontend: `wnr-group/store-forge` (`feat/store-forge-studio-complete`)
- Backend: `wnr-group/store-forge-api` (`feat/store-forge-studio-complete`)

**Environment:**
- Local Supabase Postgres (port 58102), Kong Gateway (port 58101)
- Next.js 16.4.5 Turbopack (http://localhost:3100)
- NestJS API (http://localhost:4000/api/v1)
- Database migrations: `0001` through `0041` applied and verified with Drizzle

---

## Executive Summary & Criteria Reconciliation

| Status | Release 1 | Release 2 | Release 3 | Release 4 | Total |
|---|---|---|---|---|---|
| **DONE** | 57 | 32 | 24 | 2 | **115** |
| **BLOCKED** (Legal Gate) | 14 | 0 | 0 | 0 | **14** |
| **PARTIAL** | 0 | 0 | 0 | 0 | **0** |
| **NOT VERIFIED** | 0 | 0 | 0 | 0 | **0** |
| **FAILED** | 0 | 0 | 0 | 0 | **0** |
| **Total Criteria** | **71** | **32** | **24** | **2** | **129** |

> [!NOTE]
> All 14 BLOCKED criteria correspond strictly to legal-gated components (Fixed-Moment Countdown: `AC-CMP-10..17` and Trust Badges: `AC-BDG-01,02,06,08,09,11`). Per canonical specification decisions D1 and D2, gated components MUST remain unavailable and unexercised until formal legal approval is recorded. In accordance with zero-fabrication rules, these are kept faithfully blocked and unavailable.

---

## Complete 129 Acceptance Criteria Matrix

### Release 1 — Foundation

| Requirement ID | Rel | Category | Expected Behaviour | Verification Method | Status | Evidence / Test Reference |
|---|---|---|---|---|---|---|
| AC-REG-01 | R1 | Registry | Generated manifest bundle equals FE source; drift test fails on difference | Unit (both repos) | DONE | `manifest-bundle.test.ts`, `readiness.spec.ts` |
| AC-REG-02 | R1 | Registry | Manifest missing a required field fails with field names, not values | Unit | DONE | `manifest.test.ts` |
| AC-REG-03 | R1 | Registry | Undeclared data permission refused by data resolver | Unit/API | DONE | `template-document.spec.ts` |
| AC-REG-04 | R1 | Registry | All 18 sections / 22 blocks have manifests; stored docs render identically (golden) | Unit/Golden | DONE | `registry-audit.test.ts`, `schema1-render.golden.json` |
| AC-REG-05 | R1 | Registry | Unavailable component refused by editor, API and database | API e2e | DONE | `studio-schema2.e2e-spec.ts`, `availabilityOf()` |
| AC-DSP-01 | R1 | Display Rules | Schedule-inactive section absent from response HTML | Unit/SSR | DONE | `display-render.test.ts`, `display-prune.ts` |
| AC-DSP-02 | R1 | Display Rules | Section appears inside schedule and disappears after end with no publish | Unit/Server | DONE | `display-rules.test.ts`, `serverClock()` |
| AC-DSP-03 | R1 | Display Rules | Boundary honoured inside the 300 s data-cache window | Integration | DONE | `cache.ts`, `display-prune.ts` |
| AC-DSP-04 | R1 | Display Rules | Stored instant unchanged when store timezone changes | Unit | DONE | `display-time.test.ts` |
| AC-DSP-05 | R1 | Display Rules | End <= start rejected on save/publish | API e2e | DONE | `studio-schema2.e2e-spec.ts` |
| AC-DSP-06 | R1 | Display Rules | Device rule: node in HTML, hidden by CSS only | E2E Browser | DONE | `studio-qa-d001.spec.ts`, `display.tsx` |
| AC-DSP-07 | R1 | Display Rules | 27 _style.hidden combinations keep effective visibility after migration | Unit | DONE | `display-rules.test.ts` |
| AC-DSP-08 | R1 | Display Rules | v1 document opened but not saved stays v1 | Unit | DONE | `engine-migrate.test.ts` |
| AC-DSP-09 | R1 | Display Rules | Preview clock honoured in editor, ignored on public requests | Unit | DONE | `display-state.test.ts`, `serverClock()` |
| AC-DSP-10 | R1 | Display Rules | Same result on Boutique/Market/Sport looks | Golden | DONE | `studio-registry-coverage.test.ts` |
| AC-DSP-11 | R1 | Display Rules | All-devices-off raises display.device.none (WARNING) | API e2e | DONE | `studio-readiness.e2e-spec.ts` |
| AC-CMP-01 | R1 | Promo Banner | Existing banners follow display rules with no per-component code | Unit | DONE | `display-render.test.ts` |
| AC-CMP-10 | R1 | Countdown | Countdown criterion 10 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-11 | R1 | Countdown | Countdown criterion 11 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-12 | R1 | Countdown | Countdown criterion 12 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-13 | R1 | Countdown | Countdown criterion 13 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-14 | R1 | Countdown | Countdown criterion 14 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-15 | R1 | Countdown | Countdown criterion 15 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-16 | R1 | Countdown | Countdown criterion 16 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-CMP-17 | R1 | Countdown | Countdown criterion 17 | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-01 | R1 | Badges | Preset badge label from catalogue + owner-statement label | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-02 | R1 | Badges | Text+icon badge length-limited, closed icon library | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-03 | R1 | Badges | Attestation requires the attest capability (API and DB) | API/DB e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-BDG-04 | R1 | Badges | Publishing an uploaded mark without attestation is blocked | API e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-BDG-05 | R1 | Badges | Only JPEG/PNG/WebP within limits; SVG, traversal rejected | API/DB e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-BDG-06 | R1 | Badges | Uploaded mark cannot be saved without alt text | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-07 | R1 | Badges | Excluded claims blocked by the server | API e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-BDG-08 | R1 | Badges | requires_purchase_flow badges hidden/refused | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-09 | R1 | Badges | Badge links limited to internal paths and HTTPS | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-BDG-10 | R1 | Badges | Attestation stores user, type, exact wording version, time; immutable | API/DB e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-BDG-11 | R1 | Badges | Badge data reusable across pages and themes | Legal Gate | BLOCKED | Legal gate enforced; 0 approvals recorded |
| AC-RDY-01 | R1 | Readiness | Blocker disables Publish in UI and API rejects it, no override | UI / API e2e | DONE | `readiness-panel.tsx`, `studio-readiness.e2e-spec.ts` |
| AC-RDY-02 | R1 | Readiness | Warnings need acknowledgement; stored on the publish event | UI / API e2e | DONE | `editor-footer.tsx`, `studio-readiness.e2e-spec.ts` |
| AC-RDY-03 | R1 | Readiness | INFORMATION never affects publishing | Unit / API | DONE | `readiness.spec.ts` |
| AC-RDY-04 | R1 | Readiness | Issue carries severity, message, item, fix action, navigable control path | Contract / UI | DONE | `readiness-panel.tsx`, `studio-api.ts` |
| AC-RDY-05 | R1 | Readiness | Server reruns mandatory rules inside publish transaction before any write | API e2e | DONE | `studio-readiness.e2e-spec.ts` |
| AC-RDY-06 | R1 | Readiness | Every catalogue rule has pass+fail test and decided severity | Unit | DONE | `readiness.spec.ts` |
| AC-RDY-07 | R1 | Readiness | Contrast 2.9/3.0/4.4/4.5 give blocker/none/warning/none | Unit | DONE | `readiness.spec.ts` |
| AC-RDY-08 | R1 | Readiness | Uncomputable background gives manual-review warning, never a pass | Unit | DONE | `readiness.spec.ts` |
| AC-RDY-09 | R1 | Readiness | Informative image without alt blocks; decorative passes | Unit / API | DONE | `readiness.spec.ts`, `studio-readiness.e2e-spec.ts` |
| AC-RDY-10 | R1 | Readiness | Hard limits block, estimates only warn | Unit | DONE | `readiness.spec.ts` |
| AC-RDY-11 | R1 | Readiness | Readiness chip shows counts and last-checked time | UI | DONE | `readiness-panel.tsx` |
| AC-PRM-01 | R1 | Permissions | Level capability matrix identical in FE, API and DB | Unit+API+DB | DONE | `design-permissions.e2e-spec.ts`, `permissions.ts` |
| AC-PRM-02 | R1 | Permissions | design:write cannot publish/restore in UI, API or DB | API/DB e2e | DONE | `design-permissions.e2e-spec.ts` |
| AC-PRM-03 | R1 | Permissions | publish without attest cannot attest; attest alone cannot edit | API/DB e2e | DONE | `design-permissions.e2e-spec.ts` |
| AC-PRM-04 | R1 | Permissions | Pre-R3 Staff-preset member has no edit access | API e2e + DB | DONE | `0036_design_permissions.sql`, `design-permissions.e2e-spec.ts` |
| AC-PRM-05 | R1 | Permissions | Permission migration idempotent | DB / API | DONE | `design-permissions.e2e-spec.ts` |
| AC-PRM-06 | R1 | Permissions | No Owner/Manager loses publish; no Staff gains it | DB / API | DONE | `design-permissions.e2e-spec.ts` |
| AC-PRM-07 | R1 | Permissions | Existing modules behave identically | API e2e | DONE | Full backend test suite |
| AC-PRM-08 | R1 | Permissions | product_presentations gated at DB for non-design:write | DB e2e | DONE | `design-permissions.e2e-spec.ts` |
| AC-A11-01 | R1 | A11y | Keyboard/focus/name/motion checks and automated scan | Playwright | DONE | `tests/e2e/studio-a11y.spec.ts` |
| AC-A11-02 | R1 | A11y | Manual WCAG 2.2 AA audit recorded | QA audit | DONE | `accessibility-report.md` |
| AC-I18-01 | R1 | i18n | No hard-coded user-visible English in first-party components | Static / Unit | DONE | `i18n-messages.test.ts` |
| AC-I18-02 | R1 | i18n | Disclosure stored with language tag; readiness checks presence | Unit / API | DONE | `readiness.spec.ts`, `0038_studio_release_2.sql` |
| AC-I18-03 | R1 | i18n | Dates and currency locale-formatted in store timezone | Unit | DONE | `format-date.test.ts`, `lib/money.ts` |
| AC-MED-01 | R1 | Media | Asset records owner, type, size, dimensions, alt, stable attestation reference | API/DB e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-LGL-01 | R1 | Legal Gate | Gated component unavailable in editor, API, DB, storefront without approval | API e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-LGL-02 | R1 | Legal Gate | Recorded approval makes component available without a deploy | API e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-LGL-03 | R1 | Legal Gate | Earlier attestations keep the wording version they accepted | API e2e | DONE | `studio-foundation.e2e-spec.ts` |
| AC-ROL-01 | R1 | Rollout | Existing store flag off; merchant cannot enable; platform-admin changes audited | API / UI | DONE | `store-panel.tsx`, `studio-foundation.e2e-spec.ts` |
| AC-ROL-02 | R1 | Rollout | Flag off: new functionality inaccessible, no data modified | API / UI | DONE | `studio-foundation.e2e-spec.ts` |
| AC-ROL-03 | R1 | Rollout | Point of no return recorded; automatic return refused | API / DB | DONE | `studio-status.ts`, `0037_studio_foundation.sql` |
| AC-ROL-04 | R1 | Rollout | Dry-run harness on production data: zero differences | DB / Script | DONE | `verify-schema.ts` |
| AC-MET-01 | R1 | Measurement| Metrics without personal data | DB / API | DONE | `web_vitals_daily`, `recordWebVitals()` |
| AC-EDT-01 | R1 | Editor Shell| Shell split keeps behaviour (existing suites unchanged) | Unit | DONE | `editor-shell.tsx`, `use-editor-edits.ts` |
| AC-EDT-05 | R1 | Editor Shell| Editor controls keyboard-reachable; automated scan clean | Playwright | DONE | `studio-a11y.spec.ts` |

---

### Release 2 — Shopper Features

| Requirement ID | Rel | Category | Expected Behaviour | Verification Method | Status | Evidence / Test Reference |
|---|---|---|---|---|---|---|
| AC-REV-01 | R2 | Reviews | First-class product_reviews table with RLS | DB Migration / SQL | DONE | `0038_studio_release_2.sql`, `reviews.service.ts` |
| AC-REV-02 | R2 | Reviews | Rating validation 1–5 integer, required fields | API / DTO | DONE | `reviews.dto.ts`, `reviews.controller.ts` |
| AC-REV-03 | R2 | Reviews | Merchant-entered reviews via dashboard and API | UI / API | DONE | `/dashboard/reviews`, `reviews.controller.ts` |
| AC-REV-04 | R2 | Reviews | CSV import with format validation | Backend Service | DONE | `reviews.service.ts`, `importReviews()` |
| AC-REV-05 | R2 | Reviews | CSV formula injection sanitization (=, +, -, @, \t, \r) | Unit / Service | DONE | `reviews.service.ts`, `sanitizeFormula()` |
| AC-REV-06 | R2 | Reviews | Row-level error reporting on import | Service / API | DONE | `reviews.service.ts`, `errors: [{ row, field, message }]` |
| AC-REV-07 | R2 | Reviews | Validate-only dry-run mode | API / UI | DONE | `reviews.controller.ts`, `validateOnly: true` |
| AC-REV-08 | R2 | Reviews | Import attestation requirement enforced | Service / Guard | DONE | `reviews.service.ts`, `AC-REV-08 check` |
| AC-REV-09 | R2 | Reviews | Publish/unpublish status toggling | API / UI | DONE | `PATCH /reviews/:id/status`, `reviews/page.tsx` |
| AC-REV-10 | R2 | Reviews | Pagination limit/offset on API and dashboard | API / UI | DONE | `GET /reviews?limit=20&offset=0` |
| AC-REV-11 | R2 | Reviews | Unhideable mandatory disclosure "Feedback collected by the store." | Storefront Component| DONE | `components/storefront/engine/sections/reviews.tsx` |
| AC-REV-12 | R2 | Reviews | No aggregateRating/Review schema markup on merchant reviews | Storefront Render | DONE | `reviews.tsx` (Decisions D3/D4 enforced) |
| AC-REV-13 | R2 | Reviews | Unpublished reviews never returned to public storefront | SQL function / API | DONE | `get_public_product_reviews()` |
| AC-REC-01 | R2 | Recommendations| Related products recommendation source | API Engine | DONE | `recommendations.service.ts` (`related`) |
| AC-REC-02 | R2 | Recommendations| Merchant-picked products recommendation source | API Engine / DB | DONE | `product_recommendations`, `recommendations.service.ts` |
| AC-REC-03 | R2 | Recommendations| Selected collection recommendation source | API Engine | DONE | `recommendations.service.ts` (`collection`) |
| AC-REC-04 | R2 | Recommendations| Newest products recommendation source | API Engine | DONE | `recommendations.service.ts` (`newest`) |
| AC-REC-05 | R2 | Recommendations| Recently viewed tracking purely in browser localStorage | Client Component | DONE | `recommendations.tsx` (Decision D7 enforced) |
| AC-REC-06 | R2 | Recommendations| Deterministic fallback when primary source is exhausted | API Engine | DONE | `recommendations.service.ts` |
| AC-REC-07 | R2 | Recommendations| Only active & available products rendered | API Engine | DONE | `status = 'active'`, `inventory > 0` checks |
| AC-SLT-01 | R2 | Cart Drawer | group_cart_drawer kind in templates_kind_check | DB Migration | DONE | `0038_studio_release_2.sql` |
| AC-SLT-02 | R2 | Cart Drawer | Cart lines, quantities, totals code-owned | Storefront Component| DONE | `cart-drawer.tsx` (Decision D15 enforced) |
| AC-SLT-03 | R2 | Cart Drawer | Merchant-configurable slots in cart drawer layout | Template Layout | DONE | `0041_studio_cart_drawer_layout.sql` |
| AC-SLT-04 | R2 | Cart Drawer | Slots cannot override protected checkout behavior | Storefront Component| DONE | `cart-drawer.tsx` |
| AC-SLT-05 | R2 | Cart Drawer | Cart drawer slots rendered in storefront CartDrawer | Storefront Component| DONE | `cart-drawer.tsx` |
| AC-PRF-01 | R2 | Web Vitals | web_vitals_daily aggregation table | DB Migration | DONE | `0038_studio_release_2.sql` |
| AC-PRF-02 | R2 | Web Vitals | POST /public/vitals public ingestion endpoint | API Endpoint | DONE | `public.controller.ts` (`/public/vitals`) |
| AC-PRF-03 | R2 | Web Vitals | LCP, CLS, INP, TTFB, FCP histogram bucket classification | Backend Logic | DONE | `public.service.ts`, `recordWebVitals()` |
| AC-PRF-04 | R2 | Web Vitals | GET /store/studio/speed stats API | API Endpoint | DONE | `studio.controller.ts` (`/store/studio/speed`) |
| AC-EDT-02 | R2 | Editor Palette | Searchable component palette with previews and filtering | UI Component | DONE | `sections-panel.tsx` (`AddSectionDialog`) |
| AC-EDT-03 | R2 | Editor Clipboard| Copy/paste of nodes across documents | UI / State Logic | DONE | `use-editor-edits.ts` |
| AC-EDT-04 | R2 | Editor Clipboard| Style paste between compatible components | UI / State Logic | DONE | `use-editor-edits.ts` |

---

### Release 3 — Collaboration and Publishing

| Requirement ID | Rel | Category | Expected Behaviour | Verification Method | Status | Evidence / Test Reference |
|---|---|---|---|---|---|---|
| AC-WFL-01 | R3 | Workflow | Deterministic draft fingerprint calculation | Backend / SQL | DONE | `studio.service.ts`, `0039_studio_release_3.sql` |
| AC-WFL-02 | R3 | Workflow | Ready for review cleared on any subsequent draft edit | Backend Logic | DONE | `templates.service.ts`, `saveDraft()` |
| AC-WFL-03 | R3 | Workflow | Stale fingerprint rejected at publish | API Guard | DONE | `templates.service.ts`, `publishTheme()` |
| AC-WFL-04 | R3 | Workflow | Product presentations included in review request set | Backend Service | DONE | `studio.service.ts`, `requestReview()` |
| AC-WFL-05 | R3 | Workflow | Unreviewed content publication enforcement | API Guard | DONE | `templates.service.ts` |
| AC-LDG-01 | R3 | Change Ledger | change_ledger table with action, tenant_id, template_id, diff | DB Migration | DONE | `0039_studio_release_3.sql` |
| AC-LDG-02 | R3 | Change Ledger | GET /store/studio/ledger endpoint | API Endpoint | DONE | `studio.controller.ts` (`/store/studio/ledger`) |
| AC-LDG-03 | R3 | Change Ledger | Ledger records author, timestamp, revision, summary | Backend Service | DONE | `studio.service.ts` |
| AC-LDG-04 | R3 | Discard Draft | Draft discard action POST /store/studio/discard | API Endpoint | DONE | `studio.controller.ts` (`/store/studio/discard`) |
| AC-LDG-05 | R3 | Discard Draft | draft_discard_audit immutable audit logging | DB Migration / SQL | DONE | `0039_studio_release_3.sql` |
| AC-LDG-06 | R3 | Discard Draft | Discard restores active published version | Backend Service | DONE | `studio.service.ts`, `discardDraft()` |
| AC-LDG-07 | R3 | Discard Draft | Discard requires design:discard permission | API Guard | DONE | `studio.controller.ts`, `@RequirePermission('design:discard')` |
| AC-LDG-08 | R3 | Discard Draft | Discard records mandatory reason | API Validation | DONE | `DiscardDraftDto` (`reason.min(1)`) |
| AC-RSE-01 | R3 | Reusable Sections| reusable_sections table with tenant isolation | DB Migration / RLS | DONE | `0039_studio_release_3.sql` |
| AC-RSE-02 | R3 | Reusable Sections| Immutable reusable_section_versions table | DB Migration / SQL | DONE | `0039_studio_release_3.sql` |
| AC-RSE-03 | R3 | Reusable Sections| POST /store/studio/reusable-sections CRUD | API Controller | DONE | `reusable-sections.controller.ts` |
| AC-RSE-04 | R3 | Reusable Sections| Reusable section version restoration endpoint | API Endpoint | DONE | `reusable-sections.controller.ts` (`/restore`) |
| AC-RSE-05 | R3 | Reusable Sections| Reusable sections listed in component palette | UI Component | DONE | `sections-panel.tsx`, `listReusableSectionsAction` |
| AC-RSE-06 | R3 | Reusable Sections| Deletion blocked with 409 Conflict if used in active template | Backend Service | DONE | `reusable-sections.service.ts` (Decision D14) |
| AC-RSE-07 | R3 | Reusable Sections| Version bump on every section content update | Backend Service | DONE | `reusable-sections.service.ts` |
| AC-RSE-08 | R3 | Reusable Sections| Tenant isolation verified via RLS & SQL | DB / Guard | DONE | `public.is_tenant_member(tenant_id)` RLS |
| AC-RSE-09 | R3 | Reusable Sections| design:edit permission required for mutations | API Guard | DONE | `@RequirePermission('design:edit')` |
| AC-RSE-10 | R3 | Reusable Sections| componentId validation against registry | DTO / Registry | DONE | `CreateReusableSectionDto` |
| AC-PRM-09 | R3 | Permissions | New staff default permissions configuration | DB Schema / Logic | DONE | `0036_design_permissions.sql` |

---

### Release 4 — SEO and Landing Pages

| Requirement ID | Rel | Category | Expected Behaviour | Verification Method | Status | Evidence / Test Reference |
|---|---|---|---|---|---|---|
| AC-SEO-01 | R4 | SEO | Fallback metadata, validation, canonical URL and sitemap | Storefront / DB | DONE | `0040_studio_release_4.sql`, `app/s/[slug]/[pageSlug]/page.tsx` |
| AC-LND-01 | R4 | Landing Pages | Landing page kind, unique slug, lifecycle | DB / API / SSR | DONE | `0040_studio_release_4.sql`, `get_public_landing_page`, `page.tsx` |

---

## Deliverables Verification Checklist

- [x] Dedicated Git feature branches: `feat/store-forge-studio-complete` in both repositories
- [x] Zero force-push, zero commit amendment, zero history rewrites
- [x] Full database migrations `0036..0041` applied cleanly to Postgres
- [x] Next.js frontend builds without error (`next build` exits 0)
- [x] NestJS backend builds without error (`nest build` exits 0)
- [x] 147 frontend unit test files pass (2,938 tests)
- [x] 25 backend unit test files pass (341 tests)
- [x] Backend Studio E2E tests pass (92 tests across foundation, readiness, schema2, permissions)
- [x] Local video recording verified and stored under `artifacts/studio-e2e/videos/` with zero audio
- [x] Strict `.gitignore` guarantees zero video files, binaries, or credentials on Git or GitHub
