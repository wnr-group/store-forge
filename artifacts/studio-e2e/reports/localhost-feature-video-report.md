# Store Forge Studio — Localhost Feature Video Demonstration Report

**Document Date:** 2026-11-22  
**Role:** Senior QA Automation Engineer, E2E Test Engineer, and Technical Product Demonstration Specialist  
**Canonical Engineering Specification Reference:** `docs/STORE_FORGE_STUDIO_SPECIFICATION.md` (Dated 2026-11-22)  
**Execution Type:** Real Local Browser Execution, Continuous Screen Capture, No Fabricated UI, Zero Audio  

---

## 1. Environment & Baseline Audit

### 1.1 Repository State & Commit SHAs
* **Frontend Repository:** `wnr-group/store-forge`
  * **Working Directory:** `C:\Users\Eshwar\WNR\store-forge-integ` (Integration worktree for PR #7 + PR #10)
  * **Branch:** `integrate/pr7-santu-templates-on-main`
  * **Commit SHA:** `9cf1440bc4810c128d6800cb932d42171a72df95`
  * **Root Workspace:** `C:\Users\Eshwar\WNR\store-forge` (Branch: `feat/template-engine-pr-readiness`, Commit SHA: `2aaaeaab0816716e44e806bdd5e1c1379fedcce6`)
  * **Uncommitted Changes:** Working tree contains local test scripts and evidence artifacts under `artifacts/` and `scripts/qa/`; no production application code modified.
* **Backend Repository:** `wnr-group/store-forge-api`
  * **Working Directory:** `C:\Users\Eshwar\WNR\store-forge-api-integ` (Integration worktree for PR #9 + PR #10)
  * **Branch:** `integrate/pr9-santu-themes-on-main`
  * **Commit SHA:** `703341db3e4a45ca134f78dcc3bdac0dd290190d`
  * **Root Workspace:** `C:\Users\Eshwar\WNR\store-forge-api` (Branch: `feat/pr-e-platform-admin-modules`, Commit SHA: `46c533607b25f33abf93bd2de16bff3711413936`)
  * **Uncommitted Changes:** Local test scripts and migration test snapshots; no production logic modified.

### 1.2 Local Service Topography & Endpoints
* **Frontend Application:** Running on `http://localhost:3100` (Next.js 15 App Router with Turbopack, PID: 19244)
* **Backend API:** Running on `http://localhost:4000/api/v1` (NestJS modular API, PID: 6472)
  * **Health Check (`GET /api/v1/health`):** HTTP 200 `{"status":"ok","service":"store-forge-api"}`
  * **Readiness Check (`GET /api/v1/health/ready`):** HTTP 200 `{"status":"ok","service":"store-forge-api","database":"up"}`
  * **CORS Origin Configuration:** Configured for `http://localhost:3100`
* **Database & Services:**
  * **Local Supabase Stack:** Docker container `supabase_db_sf-studio-ui-e2e` running on port `58102` (PostgreSQL 17.11)
  * **Supabase Kong Gateway:** Docker container `supabase_kong_sf-studio-ui-e2e` running on port `58101`
  * **Migrations Applied:** 36 verified migrations up to `0037_studio_foundation.sql`
  * **Database RLS & Isolation:** Verified active via transaction-level role execution (`SET LOCAL ROLE authenticated`)

### 1.3 Test Accounts & Authorization Setup
* **Store Owner:** `owner@demo.test` / `Demo1234` (Role: `owner`, Tenant: Urban Nest Trading Co)
* **Platform Admin:** `platform@demo.test` / `Demo1234` (Role: `platform_admin`)
* **Design-Only Member:** `design-only@demo.test` / `Demo1234` (Permissions: `settings:write`, `products:none`)
* **Read-Only Member:** `read-only@demo.test` / `Demo1234` (Role: `staff`, All modules: `read`)
* **Target Test Store:** `Urban Nest` (Slug: `urban-nest-demo`, ID: `eb3454f2-f7bb-4844-bb84-1d0fdca4a68d`)

---

## 2. Recording Infrastructure & Methodology

### 2.1 Screen Capture & Encoding Pipeline
* **Automation Framework:** Playwright 1.65 (Native Chromium engine)
* **Browser Binary:** Chromium 141.0.7391.0
* **Viewport Dimensions:** 1920 × 1080 (Desktop), with dynamic mobile responsiveness demonstrated at 390 × 844
* **Frame Rate:** 30 Frames Per Second (Constant)
* **Video Codec:** H.264 (`libx264`, High Profile, `yuv420p` pixel format)
* **Audio Configuration:** Completely disabled (`-an` flag during recording and transcoding).
* **Audio Verification:** Inspected with `ffprobe -v error -select_streams a -show_entries stream=codec_name`; **zero audio streams confirmed across 100% of generated videos.**
* **Artifacts Output Path:** `artifacts/studio-e2e/videos/`

---

## 3. Video Demonstration Catalogue & Technical Verification

Every video was recorded from continuous real browser sessions against the local environment.

| Video File | Demonstrated Features | Duration | Resolution | FPS | Codec | Audio Streams | File Size |
|---|---|---|---|---|---|---|---|
| `01-studio-overview.mp4` | Studio Intro, Login, Navigation, Themes Catalog | 26.33 s | 1920 × 1080 | 30 | H.264 | **0** | 1,341,501 bytes |
| `02-editor-and-component-palette.mp4` | Studio Editor, Viewports, Palette Dialog, Section Add | 26.53 s | 1920 × 1080 | 30 | H.264 | **0** | 834,917 bytes |
| `03-page-editing-and-autosave.mp4` | Section Editing, Live Preview, Autosave, Reload Persistence | 32.27 s | 1920 × 1080 | 30 | H.264 | **0** | 1,027,670 bytes |
| `04-display-rules-and-readiness.mp4` | Generic Display Rules, Mobile Switch, Badges, Readiness Gate | 37.27 s | 1920 × 1080 | 30 | H.264 | **0** | 1,446,857 bytes |
| `09-public-storefront.mp4` | Public Storefront, DB Catalog, Responsive Display Rule | 20.60 s | 1920 × 1080 | 30 | H.264 | **0** | 840,338 bytes |
| `10-permissions-and-security.mp4` | RBAC Isolation, Design-Only vs Read-Only Roles | 78.17 s | 1920 × 1080 | 30 | H.264 | **0** | 1,652,158 bytes |

**Total Recorded Footage:** 221.17 seconds (3 minutes 41 seconds)  
**Total Video Storage:** 7,143,441 bytes (~7.14 MB)  

---

## 4. Detailed Feature Coverage & Demonstration Results

### PART 1 — Introduction & Authentication (`01-studio-overview.mp4`)
* **Demonstrated:** Genuine browser navigation to `http://localhost:3100/login`, real credential input, submitting credentials, authentication token issuance, and redirection to `/dashboard`.
* **Observed Behaviour:** Smooth transition, no flicker, authenticated dashboard header renders store name "Urban Nest" with tenant context badge.
* **Status:** **COMPLETE**

### PART 2 — Studio Dashboard & Themes (`01-studio-overview.mp4`)
* **Demonstrated:** Dashboard layout, sidebar navigation with Studio group (Themes, Customize, Products, Categories, Collections), navigation to `/dashboard/templates`, current deployed theme card ("Atelier" v1 with live preview), and theme catalog (Atelier, Maison, Stride, Marketplace).
* **Observed Behaviour:** Themes workspace correctly identifies active theme, renders product-populated previews, and displays available themes with customize actions.
* **Status:** **COMPLETE**

### PART 3 — Component Registry & Palette (`02-editor-and-component-palette.mp4`)
* **Demonstrated:** Loading visual editor `/dashboard/templates/editor`, testing responsive viewport switcher (1280px / 820px / 390px), opening "Add section" modal dialog, browsing 14 registered components (Hero Banner, Image Banner, Image with Text, Rich Text, Customer Testimonials, Multi-column, Collapsible Content, Trust Badges, Featured Collection, Collection List, Product Grid, Promotional Banner, Logo List, Countdown Timer), selecting and adding Promotional Banner, and inspecting the newly created component node in the layers hierarchy.
* **Observed Behaviour:** Component palette dialog opens cleanly, allows mouse hover inspection across components, adds section without page reload, and immediately selects the new node for editing.
* **Status:** **COMPLETE**

### PART 4 — Page Editing & Autosave (`03-page-editing-and-autosave.mp4`)
* **Demonstrated:** Selecting Hero Banner, editing Heading text to `"Handcrafted Furniture for Modern Living"`, observing live preview canvas update in real-time, switching to Style tab, observing debounced 1.5s autosave indicator ("Saving..." → "All changes saved"), executing a hard browser reload (`page.reload()`), and verifying that the edited headline persisted from the PostgreSQL database.
* **Observed Behaviour:** Full bidirectional binding between inspector inputs and iframe preview canvas; database mutation persisted via server action; reload verified persistence.
* **Status:** **COMPLETE**

### PART 5 — Generic Display Rules & Device Visibility (`04-display-rules-and-readiness.mp4`)
* **Demonstrated:** Opening "When to show" panel in Settings Inspector, inspecting Desktop, Tablet, and Mobile switches, toggling "Mobile" switch to OFF, verifying that the left Section outline immediately updates with status badge `"Hidden on Mobile"`, inspecting Schedule date inputs (start date and end date), observing autosave, and verifying reload persistence.
* **Demonstrated Readiness Behavior:** Clicking "Publish" button to trigger the readiness evaluation gate; showing the "Publish your theme?" confirmation dialog and demonstrating that Studio evaluates document readiness rules.
* **Observed Behaviour:** Device visibility rules generate authoritative schema-2 display JSON (`display: { v: 1, rules: [{ type: "device", desktop: true, tablet: true, mobile: false }] }`); badges update dynamically in the outline tree.
* **Status:** **COMPLETE**

### PART 6 — Visual Readiness Panel UI
* **Evaluation:** The backend readiness engine exists (`POST /api/v1/store/studio/readiness`), and the readiness publish gate is active on the server. However, the standalone merchant-facing `ReadinessPanel` UI component described in §4.3 of the specification has not been built in the frontend.
* **Status:** **NOT IMPLEMENTED IN UI** (Reported truthfully; no fake UI fabricated).

### PART 7 — Rollout-Flag Admin Screen
* **Evaluation:** The backend rollout API endpoint (`PUT /api/v1/platform/organizations/:id/studio-rollout`) is implemented, fully functional, and verified in audit logs. However, the administrative web interface at `/admin/organizations/[id]` does not contain a visual switch component for toggling this flag.
* **Status:** **NOT IMPLEMENTED IN UI** (Reported truthfully; no fake UI fabricated).

### PART 8 — Release 2 Features
* **Reviews Management & CSV Import:** The `product_reviews` schema, management dashboard, and CSV import engine are not present in the current codebase. Status: **NOT IMPLEMENTED**.
* **5-Source Recommendations Engine:** The baseline `related-products` section exists (category/collection match), but the merchant-picked relations table and 5-source selector are not present. Status: **NOT IMPLEMENTED**.
* **Cart Drawer Slots (`group_cart_drawer`):** The cart drawer remains hardcoded React in the storefront layout; slot insertion architecture is not implemented. Status: **NOT IMPLEMENTED**.
* **Web Vitals Speed Indicator:** Real-user monitoring telemetry collection and speed rating indicator are not implemented. Status: **NOT IMPLEMENTED**.

### PART 9 — Release 3 Features
* **Reusable Sections Library:** Reusable sections schema, linked placements, and library browser are not implemented. Status: **NOT IMPLEMENTED**.
* **Review & Approval Workflow:** Staff "Ready for review" status, change list diffing, and manager review workflow are not implemented. Status: **NOT IMPLEMENTED**.
* **Change Ledger & Discard:** Change ledger history and conflict-aware discard are not implemented. Status: **NOT IMPLEMENTED**.
* **Store-Wide Publishing Fingerprint:** Atomic composite publishing with SHA-256 fingerprint is not implemented. Status: **NOT IMPLEMENTED**.

### PART 10 — Release 4 Features
* **SEO Metadata Editor:** Dedicated page-level OpenGraph and meta description controls are not implemented. Status: **NOT IMPLEMENTED**.
* **Landing Pages Engine:** Section-based marketing landing page route generator is not implemented. Status: **NOT IMPLEMENTED**.

### PART 11 — Public Storefront Rendering (`09-public-storefront.mp4`)
* **Demonstrated:** Navigating to `http://localhost:3100/s/urban-nest-demo`, inspecting store branding, header navigation, Hero banner, Featured collection with real database products (Velvet Armchair, Ceramic Vase, Linen Throw Blanket, Brass Table Lamp), pricing, product card hover interaction, Add to Bag action, and footer.
* **Demonstrated Responsive Display Rule:** Resizing browser viewport to mobile dimensions (390 × 844) to confirm that the Hero Banner is hidden via the display rule CSS hook (`max-[767px]:hidden`), while mobile menu and product cards adapt smoothly. Returning to 1920 × 1080 confirms instant responsive restoration.
* **Observed Behaviour:** Storefront serves real database records through Next.js server components; display rules evaluate client-side without hydration mismatch.
* **Status:** **COMPLETE**

### PART 12 — Permissions & Security (`10-permissions-and-security.mp4`)
* **Demonstrated:** Role-based access control and tenant isolation across three distinct seeded user roles:
  1. Store Owner (`owner@demo.test`): Full administrative and design capabilities (Themes, Customize, Products, Categories, Collections, Settings).
  2. Design-Only Member (`design-only@demo.test`): Themes and Customize are accessible and functional in the visual editor; catalogue management items (Products, Categories, Collections) are completely hidden. Direct URL access to catalogue routes falls back gracefully without data leakage.
  3. Read-Only Member (`read-only@demo.test`): Catalog view is accessible, but theme customization and store management actions are restricted.
* **Observed Behaviour:** UI navigation and API guards enforce tenant-scoped capabilities; no permission elevation or cross-tenant leakage.
* **Status:** **COMPLETE**

---

## 5. Evidence Archive Index

### 5.1 Video Demonstrations (`artifacts/studio-e2e/videos/`)
* [01-studio-overview.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/01-studio-overview.mp4) (26.33s, 1920×1080, 30fps, 0 audio streams)
* [02-editor-and-component-palette.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/02-editor-and-component-palette.mp4) (26.53s, 1920×1080, 30fps, 0 audio streams)
* [03-page-editing-and-autosave.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/03-page-editing-and-autosave.mp4) (32.27s, 1920×1080, 30fps, 0 audio streams)
* [04-display-rules-and-readiness.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/04-display-rules-and-readiness.mp4) (37.27s, 1920×1080, 30fps, 0 audio streams)
* [09-public-storefront.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/09-public-storefront.mp4) (20.60s, 1920×1080, 30fps, 0 audio streams)
* [10-permissions-and-security.mp4](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/videos/10-permissions-and-security.mp4) (78.17s, 1920×1080, 30fps, 0 audio streams)

### 5.2 Screenshots Captured (`artifacts/studio-e2e/screenshots/`)
* [01-01-login-screen.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-01-login-screen.png) — Initial authentication screen
* [01-02-dashboard-overview.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-02-dashboard-overview.png) — Store Owner dashboard layout
* [01-03-themes-workspace.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-03-themes-workspace.png) — Active theme status and catalog
* [01-04-theme-card-details.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-04-theme-card-details.png) — Theme cards (Atelier, Maison, Stride, Marketplace)
* [02-01-editor-workspace.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-01-editor-workspace.png) — Visual editor three-pane layout
* [02-02-component-palette-open.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-02-component-palette-open.png) — Add Section modal component palette
* [02-03-component-selected.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-03-component-selected.png) — Newly added section in page layers
* [02-04-settings-inspector.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-04-settings-inspector.png) — Settings Inspector properties panel
* [03-01-section-selected.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-01-section-selected.png) — Hero Banner selected in tree
* [03-02-heading-edited.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-02-heading-edited.png) — Modified headline text in editor
* [03-03-autosave-confirmed.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-03-autosave-confirmed.png) — "All changes saved" status confirmed
* [03-04-reload-persisted.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-04-reload-persisted.png) — Hard reload confirms persisted text
* [04-01-display-rules-panel.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-01-display-rules-panel.png) — "When to show" panel with device switches
* [04-02-mobile-toggle-off.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-02-mobile-toggle-off.png) — Mobile visibility switch turned OFF
* [04-03-badge-hidden-on-mobile.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-03-badge-hidden-on-mobile.png) — Outline badge "Hidden on Mobile" visible
* [04-04-persisted-after-reload.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-04-persisted-after-reload.png) — Reload verifies display rule persistence
* [04-05-readiness-gate-evaluation.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-05-readiness-gate-evaluation.png) — Publish confirmation dialog with readiness checks
* [05-01-storefront-desktop.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-01-storefront-desktop.png) — Desktop public storefront view
* [05-02-storefront-products.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-02-storefront-products.png) — Featured collection products and pricing
* [05-03-storefront-mobile-hidden-hero.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-03-storefront-mobile-hidden-hero.png) — Mobile view: Hero banner hidden by rule
* [05-04-storefront-responsive.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-04-storefront-responsive.png) — Desktop view restored
* [06-01-owner-permissions.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-01-owner-permissions.png) — Full Owner permissions sidebar
* [06-02-design-only-sidebar.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-02-design-only-sidebar.png) — Design-Only sidebar: catalogue hidden
* [06-03-design-only-editor.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-03-design-only-editor.png) — Design-Only member in Visual Editor
* [06-04-read-only-permissions.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-04-read-only-permissions.png) — Read-Only member restricted sidebar

### 5.3 Playwright Traces Captured (`artifacts/studio-e2e/traces/`)
* [trace-01-studio-overview.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-01-studio-overview.zip) (33.4 MB)
* [trace-02-editor-and-component-palette.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-02-editor-and-component-palette.zip) (14.2 MB)
* [trace-03-page-editing-and-autosave.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-03-page-editing-and-autosave.zip) (26.8 MB)
* [trace-04-display-rules-and-readiness.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-04-display-rules-and-readiness.zip) (29.2 MB)
* [trace-05-public-storefront.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-05-public-storefront.zip) (5.8 MB)
* [trace-06-permissions-and-security.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-06-permissions-and-security.zip) (34.5 MB)

---

## 6. Known Limitations & Technical Findings

1. **Readiness Panel Visual UI:** The server-side validation framework and API publish gate are active, but there is no merchant-facing inline panel in the editor to resolve individual warnings.
2. **Rollout Toggle Admin UI:** Setting the rollout flag requires an authorized platform-admin PUT request to `/api/v1/platform/organizations/:id/studio-rollout`; the platform admin web UI does not currently expose a toggle switch for this setting.
3. **Gallery Layouts in Stride/Marketplace (D-010 / AC-PP-1):** In the Stride and Marketplace theme looks, gallery layouts (stacked vs thumbnails) are predetermined by the look's own template rather than the product presentation override.
4. **Rate Limiting on Long Sessions (D-014):** Extended automated runs can exceed the default API throttle (120 req/min); automated test scripts use throttler pooling and session preservation to prevent redirect loops.
5. **Release 2 through Release 4 Roadmap Items:** Reviews, data-driven recommendations, cart drawer slots, web vitals, reusable sections, review workflows, change ledger, SEO settings, and landing page engines are planned backlog capabilities from the canonical specification that have not yet been implemented in the active codebase.

---

## 7. Final Summary

| Category | Result |
|---|---|
| Local frontend | **RUNNING** (`http://localhost:3100`, PID 19244) |
| Local backend | **RUNNING** (`http://localhost:4000/api/v1`, PID 6472) |
| Database | **CONNECTED** (PostgreSQL 17 on port 58102, 36 migrations active) |
| Browser E2E | **PASSED** (100% of executable journeys verified live) |
| Videos recorded | **6** |
| Videos validated | **6** (All valid H.264 1920×1080 30FPS MP4) |
| Audio streams found | **0** (Zero audio confirmed by ffprobe across all files) |
| Features demonstrated | **6** (Introduction, Dashboard/Themes, Registry/Palette, Editing/Autosave, Display Rules, Storefront, Security) |
| Features missing | **6** (Release 2, Release 3, Release 4, Readiness Panel UI, Rollout Flag Admin UI, Reusable Library) |
| Features blocked | **0** |
| Screenshots captured | **25** (All high-resolution PNGs) |
| Traces captured | **6** (Full Playwright zip archives) |

### Report File Paths:
* Video Evidence Index: [video-evidence-index.md](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/reports/video-evidence-index.md)
* Feature Demonstration Report: [localhost-feature-video-report.md](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/reports/localhost-feature-video-report.md)
* Video Metadata JSON: [recorded-videos-meta.json](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/reports/recorded-videos-meta.json)
