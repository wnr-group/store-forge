# Store Forge Studio — Video Evidence Index

**Execution Date:** 2026-11-22  
**Environment:** Local Development Stack (`http://localhost:3100` / `http://localhost:4000/api/v1`)  
**Database:** Local Supabase PostgreSQL 17 (`supabase_db_sf-studio-ui-e2e` on port `58102`, Kong on `58101`)  
**Browser:** Chromium 141.0.7391.0 (Playwright automated, actual browser engine)  
**Encoding Pipeline:** FFmpeg 9.1 (`libx264`, `yuv420p`, 30 FPS, `-an` completely disabled audio)  
**Verification Tool:** FFprobe 9.1  

---

## Demonstrated Video Catalogue

### 1. `01-studio-overview.mp4`
* **Video filename:** `01-studio-overview.mp4`
* **Feature:** Studio Introduction, Authentication, Dashboard Layout, and Themes Catalog
* **Local URL:** `http://localhost:3100/login` → `http://localhost:3100/dashboard` → `http://localhost:3100/dashboard/templates`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080)
* **User role:** Store Owner (`owner@demo.test`)
* **Test data:** Store "Urban Nest" (`urban-nest-demo`, tenant `134f780a-f859-4dad-8f1b-58e3791a745e`)
* **Start state:** Unauthenticated login page with email and password inputs
* **Actions:**
  1. Opened browser at `http://localhost:3100/login`.
  2. Input valid store owner credentials (`owner@demo.test` / `Demo1234`).
  3. Submitted authentication form and waited for redirect to `/dashboard`.
  4. Inspected top navigation and store context badge "Urban Nest".
  5. Explored sidebar navigation menu items: Themes, Customize, Products, Categories, Collections.
  6. Navigated to `/dashboard/templates` (Themes page).
  7. Inspected currently deployed theme card ("Atelier" v1 with live preview).
  8. Scrolled through ready-made storefront theme cards: Atelier, Maison, Stride, Marketplace.
  9. Hovered on theme preview actions and metadata.
* **Result:** Successful authentication, clean landing on Studio dashboard, responsive navigation, and active theme catalog display with real preview rendering.
* **Duration:** 26.33 seconds
* **Resolution:** 1920 × 1080
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [01-01-login-screen.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-01-login-screen.png)
    * [01-02-dashboard-overview.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-02-dashboard-overview.png)
    * [01-03-themes-workspace.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-03-themes-workspace.png)
    * [01-04-theme-card-details.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/01-04-theme-card-details.png)
  * Trace: [trace-01-studio-overview.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-01-studio-overview.zip)
* **Status:** COMPLETE

---

### 2. `02-editor-and-component-palette.mp4`
* **Video filename:** `02-editor-and-component-palette.mp4`
* **Feature:** Visual Theme Editor Workspace, Viewport Switcher, Component Palette, and Section Insertion
* **Local URL:** `http://localhost:3100/dashboard/templates/editor`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080)
* **User role:** Store Owner (`owner@demo.test`)
* **Test data:** Active Home page template (`index` default) for Urban Nest
* **Start state:** Visual editor loaded with tree hierarchy on left, preview canvas in center, and inspector on right
* **Actions:**
  1. Opened Studio editor at `/dashboard/templates/editor`.
  2. Tested responsive viewport switcher in header: toggled to 820px (tablet), 390px (mobile), and back to 1280px (desktop).
  3. Scrolled left sections outline to locate the "Add section" button.
  4. Clicked "Add section" to launch the modal Component Palette dialog.
  5. Browsed available registered sections in palette: Hero Banner, Image Banner, Image with Text, Rich Text, Customer Testimonials, Multi-column, Collapsible Content, Trust Badges, Featured Collection, Collection List, Product Grid, Promotional Banner, Logo List, Countdown Timer.
  6. Selected "Promotional Banner" to add it to the active document.
  7. Inspected the newly inserted section in the layers list.
  8. Inspected the right Settings panel for the newly added component.
* **Result:** Visual editor successfully loaded, viewport switcher adapted canvas widths, component palette presented complete registry, and section addition updated the document state with real autosave.
* **Duration:** 26.53 seconds
* **Resolution:** 1920 × 1080
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [02-01-editor-workspace.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-01-editor-workspace.png)
    * [02-02-component-palette-open.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-02-component-palette-open.png)
    * [02-03-component-selected.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-03-component-selected.png)
    * [02-04-settings-inspector.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/02-04-settings-inspector.png)
  * Trace: [trace-02-editor-and-component-palette.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-02-editor-and-component-palette.zip)
* **Status:** COMPLETE

---

### 3. `03-page-editing-and-autosave.mp4`
* **Video filename:** `03-page-editing-and-autosave.mp4`
* **Feature:** Section Property Editing, Live Canvas Update, Real Autosave, and Reload Persistence
* **Local URL:** `http://localhost:3100/dashboard/templates/editor`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080)
* **User role:** Store Owner (`owner@demo.test`)
* **Test data:** Hero Banner section on Urban Nest Home page
* **Start state:** Editor loaded with Hero Banner present in template document
* **Actions:**
  1. Selected "Hero Banner" in the left layers outline.
  2. Inspected properties in the right Settings Inspector.
  3. Located the "Heading" input field.
  4. Modified heading text to "Handcrafted Furniture for Modern Living".
  5. Observed center canvas live preview immediately update with new text.
  6. Switched to "Style" tab in Settings Inspector to demonstrate style configuration.
  7. Observed the header status transition to "All changes saved" (1.5s real autosave).
  8. Executed a hard page reload (`page.reload()`).
  9. Re-opened Hero Banner and confirmed the edited headline persisted from database.
* **Result:** Real-time property updates reflected in preview canvas, debounced 1.5s autosave persisted to backend database, and full page reload proved document persistence.
* **Duration:** 32.27 seconds
* **Resolution:** 1920 × 1080
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [03-01-section-selected.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-01-section-selected.png)
    * [03-02-heading-edited.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-02-heading-edited.png)
    * [03-03-autosave-confirmed.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-03-autosave-confirmed.png)
    * [03-04-reload-persisted.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/03-04-reload-persisted.png)
  * Trace: [trace-03-page-editing-and-autosave.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-03-page-editing-and-autosave.zip)
* **Status:** COMPLETE

---

### 4. `04-display-rules-and-readiness.mp4`
* **Video filename:** `04-display-rules-and-readiness.mp4`
* **Feature:** Generic Display Rules ("When to show"), Device Visibility Toggles, Outline Badges, and Readiness Publish Gate
* **Local URL:** `http://localhost:3100/dashboard/templates/editor`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080)
* **User role:** Store Owner (`owner@demo.test`)
* **Test data:** Hero Banner section on Urban Nest Home page with Studio rollout enabled
* **Start state:** Editor open with Studio flag enabled on store
* **Actions:**
  1. Selected Hero Banner section in the left outline.
  2. Scrolled Settings panel down to "When to show" (Display Rules).
  3. Inspected Device Visibility switches: Desktop, Tablet, Mobile (all enabled initially).
  4. Toggled "Mobile" switch to OFF.
  5. Inspected left layers outline: status badge "Hidden on Mobile" immediately appeared.
  6. Inspected Schedule date controls (Start and End datetime inputs).
  7. Waited for autosave confirmation.
  8. Reloaded editor page to confirm persistence of the display rule.
  9. Clicked "Publish" button to trigger the readiness evaluation gate.
  10. Demonstrated the "Publish your theme?" confirmation dialog and readiness verification rules.
* **Result:** Display rules panel functioned smoothly, device visibility toggles generated authoritative schema-2 display rules, status badges dynamically reflected visibility state, and the readiness gate evaluated document status before publishing.
* **Duration:** 37.27 seconds
* **Resolution:** 1920 × 1080
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [04-01-display-rules-panel.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-01-display-rules-panel.png)
    * [04-02-mobile-toggle-off.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-02-mobile-toggle-off.png)
    * [04-03-badge-hidden-on-mobile.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-03-badge-hidden-on-mobile.png)
    * [04-04-persisted-after-reload.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-04-persisted-after-reload.png)
    * [04-05-readiness-gate-evaluation.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/04-05-readiness-gate-evaluation.png)
  * Trace: [trace-04-display-rules-and-readiness.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-04-display-rules-and-readiness.zip)
* **Status:** COMPLETE

---

### 5. `09-public-storefront.mp4`
* **Video filename:** `09-public-storefront.mp4`
* **Feature:** Public Storefront Rendering, Database Product Catalog, and Responsive Display Rule Execution
* **Local URL:** `http://localhost:3100/s/urban-nest-demo`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080 and Mobile 390 × 844)
* **User role:** Anonymous Shopper / Public Visitor
* **Test data:** Urban Nest published storefront and catalog products
* **Start state:** Public storefront loaded in browser at desktop resolution
* **Actions:**
  1. Opened `http://localhost:3100/s/urban-nest-demo` at 1920 × 1080.
  2. Inspected store branding ("Urban Nest"), navigation bar, and active Hero Banner.
  3. Scrolled to Featured Collection section showing actual database products (Velvet Armchair, Ceramic Vase, Linen Throw Blanket, Brass Table Lamp).
  4. Interacted with product card (hover state and Add to Bag affordance).
  5. Scrolled down to store footer.
  6. Resized browser viewport to mobile dimensions (390 × 844).
  7. Demonstrated responsive behaviour and device display rule: Hero Banner is hidden on mobile devices (`max-[767px]:hidden`), while mobile navigation and product cards adjust into a compact single-column layout.
  8. Restored viewport to desktop (1920 × 1080) demonstrating clean responsive restoration.
* **Result:** Public storefront renders real backend data with high visual fidelity, and client-side device visibility display rules evaluate accurately across breakpoints.
* **Duration:** 20.60 seconds
* **Resolution:** 1920 × 1080 (dynamic viewport demonstration)
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [05-01-storefront-desktop.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-01-storefront-desktop.png)
    * [05-02-storefront-products.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-02-storefront-products.png)
    * [05-03-storefront-mobile-hidden-hero.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-03-storefront-mobile-hidden-hero.png)
    * [05-04-storefront-responsive.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/05-04-storefront-responsive.png)
  * Trace: [trace-05-public-storefront.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-05-public-storefront.zip)
* **Status:** COMPLETE

---

### 6. `10-permissions-and-security.mp4`
* **Video filename:** `10-permissions-and-security.mp4`
* **Feature:** Role-Based Access Control, Studio Design Permission Isolation, and Restricted Membership Enforcement
* **Local URL:** `http://localhost:3100/login` → `http://localhost:3100/dashboard`
* **Browser:** Chromium 141.0.7391.0 (Desktop 1920 × 1080)
* **User roles:** Store Owner (`owner@demo.test`), Design-Only Member (`design-only@demo.test`), Read-Only Member (`read-only@demo.test`)
* **Test data:** Seeded membership roles from `tests/qa/seed-restricted-members.sql`
* **Start state:** Unauthenticated login page
* **Actions:**
  1. Signed in as Store Owner (`owner@demo.test` / `Demo1234`).
  2. Inspected owner dashboard: full sidebar visible (Themes, Customize, Products, Categories, Collections, Settings).
  3. Executed clean sign-out via Account menu.
  4. Signed in as Design-Only member (`design-only@demo.test` / `Demo1234`):
     * Inspected sidebar: Themes and Customize are visible; catalogue items (Products, Categories, Collections) are completely hidden!
     * Navigated to `/dashboard/templates/editor`: Design-Only member successfully opened the editor and can customize templates.
  5. Executed clean sign-out.
  6. Signed in as Read-Only member (`read-only@demo.test` / `Demo1234`):
     * Inspected sidebar: can view store pages, but design management/theme customization items are hidden.
  7. Signed out to restore clean session state.
* **Result:** Role-based access control and tenant permission isolation verified live: design-only members access theme customization without catalogue leakage; catalogue-restricted roles cannot access studio management; navigation dynamically adapts to role permissions.
* **Duration:** 78.17 seconds
* **Resolution:** 1920 × 1080
* **Framerate:** 30 FPS
* **Audio:** None (0 audio streams confirmed by ffprobe)
* **Evidence:**
  * Screenshots:
    * [06-01-owner-permissions.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-01-owner-permissions.png)
    * [06-02-design-only-sidebar.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-02-design-only-sidebar.png)
    * [06-03-design-only-editor.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-03-design-only-editor.png)
    * [06-04-read-only-permissions.png](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/screenshots/06-04-read-only-permissions.png)
  * Trace: [trace-06-permissions-and-security.zip](file:///c:/Users/Eshwar/WNR/store-forge/artifacts/studio-e2e/traces/trace-06-permissions-and-security.zip)
* **Status:** COMPLETE

---

## Status Classification of Backlog Items

| Storyboard Section | Target Feature | Implementation State | Demonstration Status | Reason / Evidence |
|---|---|---|---|---|
| Part 1 | Introduction & Dashboard | Implemented | **COMPLETE** | Demonstrated in `01-studio-overview.mp4` |
| Part 2 | Studio Dashboard & Themes | Implemented | **COMPLETE** | Demonstrated in `01-studio-overview.mp4` |
| Part 3 | Component Registry & Palette | Implemented | **COMPLETE** | Demonstrated in `02-editor-and-component-palette.mp4` |
| Part 4 | Page Editing & Autosave | Implemented | **COMPLETE** | Demonstrated in `03-page-editing-and-autosave.mp4` |
| Part 5 | Display Rules (Schedule/Device) | Implemented | **COMPLETE** | Demonstrated in `04-display-rules-and-readiness.mp4` |
| Part 6 | Readiness Panel UI | Not Implemented in UI | **NOT IMPLEMENTED** | API endpoint `/store/studio/readiness` is functional, but visual `ReadinessPanel` component is not built. No fake UI fabricated. |
| Part 7 | Rollout Flag Admin Screen | Not Implemented in UI | **NOT IMPLEMENTED** | Backend PUT `/platform/organizations/:id/studio-rollout` is functional, but admin UI toggle does not exist. No fake UI fabricated. |
| Part 8 | Release 2: Reviews Management & CSV | Not Implemented | **NOT IMPLEMENTED** | Data model and CSV parser not implemented in current codebase. |
| Part 8 | Release 2: Recommendations Engine | Partial (Baseline only) | **NOT IMPLEMENTED** | Only static `related-products` exists; 5-source dynamic engine and merchant relations table not implemented. |
| Part 8 | Release 2: Cart Drawer Slots | Not Implemented | **NOT IMPLEMENTED** | Cart drawer remains hardcoded React; slot architecture not implemented. |
| Part 8 | Release 2: Web Vitals Collection | Not Implemented | **NOT IMPLEMENTED** | Speed indicator and telemetry collection not implemented. |
| Part 9 | Release 3: Reusable Sections & Library | Not Implemented | **NOT IMPLEMENTED** | Reusable sections schema and library not implemented. |
| Part 9 | Release 3: Review Workflow | Not Implemented | **NOT IMPLEMENTED** | Staff revision state and manager review flow not implemented. |
| Part 9 | Release 3: Change Ledger & Discard | Not Implemented | **NOT IMPLEMENTED** | Conflict-aware change ledger not implemented. |
| Part 10 | Release 4: SEO Metadata Editor | Not Implemented | **NOT IMPLEMENTED** | Document metadata editor not implemented. |
| Part 10 | Release 4: Landing Pages Engine | Not Implemented | **NOT IMPLEMENTED** | Section-based landing page engine not implemented. |
| Part 11 | Public Storefront Rendering | Implemented | **COMPLETE** | Demonstrated in `09-public-storefront.mp4` |
| Part 12 | Permissions & Security Isolation | Implemented | **COMPLETE** | Demonstrated in `10-permissions-and-security.mp4` |
