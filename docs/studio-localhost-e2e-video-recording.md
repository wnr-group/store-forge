# Store Forge Studio — Localhost E2E Video Recording Workflow

This document explains how to run, record, validate, and reproduce genuine browser-based End-to-End (E2E) feature demonstration videos of **Store Forge Studio** running locally.

The workflow records real browser interactions against the local Next.js frontend, NestJS backend API, and local Supabase PostgreSQL database. **No mock UI, simulated footage, or AI-generated video is used.**

---

## 1. Prerequisites

- **Node.js**: >= 22.12.0
- **npm**: >= 10.0.0
- **Docker**: For local Supabase (PostgreSQL 17, Auth, Storage)
- **FFmpeg & FFprobe**: >= 7.0 installed and accessible in the system `PATH` (used for standard H.264 30 FPS MP4 transcoding and audio-absence verification)
- **Playwright Chromium**: Installed via `npx playwright install chromium`

---

## 2. Required Local Services & Topology

| Service | Local Endpoint | Repository / Source |
|---|---|---|
| **Frontend Application** | `http://localhost:3100` (or `http://localhost:3000`) | `wnr-group/store-forge` (`npm run dev`) |
| **Backend API** | `http://localhost:4000/api/v1` | `wnr-group/store-forge-api` (`npm run start:dev`) |
| **Local Supabase Database** | `localhost:5432` / `localhost:54321` | Docker containers (`supabase_db_sf-studio-ui-e2e`) |

---

## 3. Environment Variables

Create `.env.local` in `store-forge` based on `.env.example`:

| Variable | Description | Example / Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Local frontend origin | `http://localhost:3100` |
| `API_BASE_URL` | Local API address (server-side only) | `http://localhost:4000/api/v1` |
| `AUTH_BFF_SECRET` | Shared secret with NestJS API (32+ chars) | Same value configured in API `.env` |
| `E2E_BASE_URL` | Optional base URL override for E2E runs | `http://localhost:3100` |
| `E2E_OWNER_EMAIL` | Test owner account | `owner@demo.test` |
| `E2E_DEMO_PASSWORD` | Test user password | Local dev credentials |

> [!IMPORTANT]
> Never commit `.env.local` or disclose credentials in documentation or commits.

---

## 4. Starting the Local Environment

### 4.1 Database (Supabase)
```bash
# In the API repository or root supabase folder:
npx supabase start
```

### 4.2 Backend API (`store-forge-api`)
```bash
cd ../store-forge-api
npm install
npm run start:dev
```
Verify the API is healthy:
```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/ready
```

### 4.3 Frontend (`store-forge`)
```bash
cd store-forge
npm install
npm run dev -- -p 3100
```
Verify the frontend is up at `http://localhost:3100/login`.

---

## 5. Running Preflight Checks

Before recording, run the automated preflight verification script to confirm services, browser binaries, media tools, and authentication:

```bash
npm run studio:video:preflight
```

The script verifies:
1. Artifacts directories exist (`artifacts/studio-e2e/{videos,screenshots,traces,reports}`).
2. `ffmpeg` and `ffprobe` binaries are available in `PATH`.
3. Frontend HTTP 200 response.
4. Backend API `/health` HTTP 200 response.
5. Database readiness `/health/ready` response.
6. Playwright Chromium launches cleanly.
7. Real test user authentication succeeds.

Exits with code `0` if all prerequisites pass, or code `1` if any check fails.

---

## 6. Recording Videos

### Record All E2E Feature Journeys
To execute the full suite of genuine browser journeys and record MP4 videos:

```bash
npm run studio:video:record
```

This command:
- Launches headless Chromium at `1920 × 1080`.
- Executes genuine user journeys with realistic interaction timings.
- Records native WebM video streams and Playwright traces.
- Captures intermediate step screenshots.
- Transcodes recordings via FFmpeg into H.264 High Profile, 30 FPS MP4 files without audio (`-an`).
- Automatically produces the canonical full-length concatenated demonstration `storeforge-studio-canonical-e2e-demo.mp4`.

### Record a Specific Scenario
You can record an individual scenario using the `--scenario` flag:

```bash
# Record Scenario 01: Studio Overview & Themes Catalog
npx tsx tests/studio-video/record.ts --scenario 01

# Record Scenario 02: Visual Editor & Component Palette
npx tsx tests/studio-video/record.ts --scenario 02

# Record Scenario 03: Page Editing & Autosave Persistence
npx tsx tests/studio-video/record.ts --scenario 03

# Record Scenario 04: Generic Display Rules & Publish Readiness
npx tsx tests/studio-video/record.ts --scenario 04

# Record Scenario 09: Public Storefront & Responsive Behavior
npx tsx tests/studio-video/record.ts --scenario 09

# Record Scenario 10: Role-Based Access Control & Permission Isolation
npx tsx tests/studio-video/record.ts --scenario 10
```

---

## 7. Validating Videos

Validate all generated demonstration videos against media requirements:

```bash
npm run studio:video:validate
```

The validation inspects every `.mp4` file using `ffprobe`:
- **File existence and size**: Non-zero, realistic size (> 50 KB).
- **Video Stream**: Codec `h264`, resolution `1920 × 1080`, frame rate `30 FPS`, duration > 0s.
- **Audio Stream**: Confirms **0 audio streams exist** across all deliverables.
- **Exit Code**: Returns `0` on 100% pass, or `1` on any non-compliance.

---

## 8. Artifact Locations

| Artifact Type | Directory | Git Tracking Policy |
|---|---|---|
| **MP4 Videos** | `artifacts/studio-e2e/videos/` | Excluded from Git (`.gitignore`) due to binary size (~7.1 MB total). Kept locally. |
| **Screenshots** | `artifacts/studio-e2e/screenshots/` | PNG evidence captured at key journey milestones. |
| **Playwright Traces** | `artifacts/studio-e2e/traces/` | Zip traces containing action snapshots and DOM trees. Excluded from Git. |
| **Evidence Indexes & Reports** | `artifacts/studio-e2e/reports/` | Committed to Git: `video-evidence-index.md`, `localhost-feature-video-report.md`, `recorded-videos-meta.json`. |

---

## 9. Feature Demonstration Coverage & Limitations

### Demonstrated Features (Pass)
1. **Studio Overview & Themes Catalog** (`01-studio-overview.mp4`): Authentication, dashboard layout, theme cards (Atelier, Maison, Stride, Marketplace), active theme preview.
2. **Editor & Component Palette** (`02-editor-and-component-palette.mp4`): Responsive viewport toggle (Desktop / Tablet / Mobile), 14-component palette modal, section insertion.
3. **Page Editing & Autosave Persistence** (`03-page-editing-and-autosave.mp4`): Hero Banner property editing, live iframe canvas update, 1.5s debounced autosave, hard page reload persistence.
4. **Display Rules & Readiness** (`04-display-rules-and-readiness.mp4`): Generic display rules, mobile visibility switch, layer badges ("Hidden on Mobile"), publish readiness confirmation gate.
5. **Public Storefront** (`09-public-storefront.mp4`): Live database catalog rendering, product card hover, responsive mobile layout, client-side display rule evaluation.
6. **Permissions & Security** (`10-permissions-and-security.mp4`): Role isolation (Owner vs Design-Only vs Read-Only), hiding of catalog from design roles, restriction of Studio editor from read-only roles.

### Non-Demonstrated / Backlog Features (Not Implemented)
- **Visual Readiness Panel**: The backend `/store/studio/readiness` endpoint is functional, but a dedicated multi-tab readiness panel UI is not built.
- **Rollout Flag Admin Screen**: The backend rollout endpoint exists, but an admin UI toggle screen has not been implemented.
- **Release 2, 3, 4 Backlog Items**: Product reviews CSV, recommendation engine, cart drawer slots, reusable section library, change ledger/discard, and landing pages remain on the specification roadmap.

*Per project safety rules, missing features are classified as NOT IMPLEMENTED rather than fabricated.*
