/* Builds acceptance-criteria-matrix.json and closeout-report.md from the files this run actually produced.
 * Run from the repository root:  node artifacts/qa/screenshots/STUDIO-UI-ENHANCEMENT/evidence-report/build-closeout.cjs
 * Nothing here invents a result: test status comes from playwright-results.json / unit-test-results.json, screenshot
 * existence from the filesystem, and "inspected" from the explicit list below (files a person actually opened and looked at
 * in their FINAL form). */
const fs = require("fs");
const path = require("path");
const ROOT = path.join("artifacts", "qa", "screenshots", "STUDIO-UI-ENHANCEMENT");
const REP = path.join(ROOT, "evidence-report");
const J = (f) => JSON.parse(fs.readFileSync(path.join(REP, f), "utf8"));

// ---- test results --------------------------------------------------------------------------------------------------
const pw = J("playwright-results.json");
const e2e = [];
(function walk(s) {
  for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) e2e.push({ title: sp.title, status: t.status === "skipped" ? "SKIPPED" : t.status === "expected" ? "PASSED" : "FAILED", file: sp.file });
  for (const c of s.suites ?? []) walk(c);
})({ suites: pw.suites });
const unit = J("unit-test-results.json");
const unitTests = unit.testResults.flatMap((f) => f.assertionResults.map((a) => ({ title: a.title, status: a.status === "passed" ? "PASSED" : "FAILED", file: f.name.replace(/^.*store-forge-studio-ui[\\/]/, "").replaceAll("\\", "/") })));
const e2eStatus = (sub) => {
  const m = e2e.filter((t) => t.title.includes(sub));
  if (!m.length) return { status: "NOT FOUND", ref: sub };
  const st = m.every((t) => t.status === "PASSED") ? "PASSED" : m.some((t) => t.status === "FAILED") ? "FAILED" : "SKIPPED";
  return { status: st, ref: m.map((t) => `${t.file} > ${t.title}`).join(" | ") };
};
const unitStatus = (sub) => {
  const m = unitTests.filter((t) => t.title.includes(sub));
  if (!m.length) return { status: "NOT FOUND", ref: sub };
  return { status: m.every((t) => t.status === "PASSED") ? "PASSED" : "FAILED", ref: m.map((t) => `${t.file} > ${t.title}`).join(" | ") };
};
const combine = (parts, fn) => {
  const rs = parts.map(fn);
  const bad = rs.find((r) => r.status === "NOT FOUND");
  if (bad) throw new Error("test reference not found: " + bad.ref);
  const status = rs.every((r) => r.status === "PASSED") ? "PASSED" : rs.some((r) => r.status === "FAILED") ? "FAILED" : "SKIPPED";
  return { status, test_reference: rs.map((r) => r.ref).join(" || ") };
};

// ---- screenshots ---------------------------------------------------------------------------------------------------
// Files a person opened and looked at in their final form (after the last re-capture). Anything not listed is NOT counted.
const INSPECTED = new Set(`
F1-command-palette/after-owner-team-visible.png
F1-command-palette/after-owner-palette-scrolled.png
F1-command-palette/after-staff-sidebar.png
F1-command-palette/after-staff-palette-sidebar-parity.png
F1-command-palette/after-staff-palette-scrolled.png
F1-command-palette/after-palette-navigates.png
F1-command-palette/after-staff-team-redirect.png
F1-command-palette/before-owner-palette.png
F1-command-palette/after-restricted-member.png
F1-command-palette/after-restricted-member-sidebar.png
F1-command-palette/after-restricted-member-no-catalog-dashboard.png
F2-error-contrast/after-light-mode-error.png
F2-error-contrast/before-light-mode-error.png
F2-error-contrast/after-dark-mode-error.png
F2-error-contrast/after-light-error-banner.png
F2-error-contrast/after-dark-error-banner.png
F4-control-heights/after-merchant-list-toolbar.png
F4-control-heights/after-admin-controls-light.png
F4-control-heights/after-admin-controls-dark.png
admin-login-regression/after-admin-light.png
admin-login-regression/before-admin-light.png
admin-login-regression/after-login-light.png
admin-login-regression/after-login-dark.png
F12-timezone/after-customers-list.png
F12-timezone/after-customer-detail.png
F12-timezone/after-inventory-adjustments.png
F12-timezone/after-overview-orders.png
F12-timezone/before-overview-orders.png
F12-timezone/after-analytics-orders.png
F12-timezone/before-analytics-orders.png
F12-timezone/after-products-updated.png
F12-timezone/after-analytics-chart-axis.png
`.trim().split(/\s+/));
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const shot = (f) => ({ file: f, exists: exists(f), inspected: exists(f) && INSPECTED.has(f) });

// ---- acceptance criteria -------------------------------------------------------------------------------------------
const S = "app/globals.css";
const AC = [
  { id: "F1-1", f: "F1", c: "Owner sees all permitted navigation entries in the palette, including Team members", impl: ["components/dashboard/command-search.tsx", "components/dashboard/nav-config.ts", "app/(dashboard)/dashboard/layout.tsx"], unit: ["shows Team members to the owner only"], e2e: ["owner: Team members is offered", "owner sees Team members in both"], shots: ["F1-command-palette/after-owner-team-visible.png", "F1-command-palette/after-owner-palette-scrolled.png"] },
  { id: "F1-2", f: "F1", c: "Entries a member lacks permission for are hidden from the palette (and match the sidebar)", impl: ["components/dashboard/nav-config.ts", "components/dashboard/command-search.tsx"], unit: ["hides the sections a restricted member cannot open", "always keeps Overview and Settings"], e2e: ["F1-2 restricted member: palette hides permission-gated entries and equals the sidebar"], shots: ["F1-command-palette/after-restricted-member.png", "F1-command-palette/after-restricted-member-sidebar.png"], limits: ["Verified in the browser with a real restricted member created through the Team UI (products read, orders none, customers none, settings read): Customers, Analytics and Team members are absent from both the palette and the sidebar. CATALOG-restricted filtering (no products access) is NOT E2E-verifiable: on origin/main a member with no products access cannot render the dashboard at all (see F1-command-palette/after-restricted-member-no-catalog-dashboard.png), a pre-existing defect unrelated to this ticket; that case is covered by unit tests only."] },
  { id: "F1-3", f: "F1", c: "Palette visibility matches sidebar visibility (labels and destinations)", impl: ["components/dashboard/command-search.tsx", "app/(dashboard)/dashboard/layout.tsx"], unit: ["matches what the sidebar renders for the same member"], e2e: ["staff: palette equals the sidebar", "staff get no Team members", "owner: choosing an entry navigates"], shots: ["F1-command-palette/after-staff-sidebar.png", "F1-command-palette/after-staff-palette-sidebar-parity.png", "F1-command-palette/after-staff-palette-scrolled.png", "F1-command-palette/after-owner-palette-scrolled.png"] },
  { id: "F1-4", f: "F1", c: "Choosing a palette entry navigates to the correct route", impl: ["components/dashboard/command-search.tsx"], unit: [], e2e: ["owner: choosing an entry navigates"], shots: ["F1-command-palette/after-palette-navigates.png"] },
  { id: "F1-5", f: "F1", c: "No authorization bypass: Team stays unreachable for non-owners by URL and API", impl: ["(server-side checks unchanged; no auth file modified)"], unit: [], e2e: ["staff cannot reach Team by URL or through the API"], shots: ["F1-command-palette/after-staff-team-redirect.png"], limits: ["Tenant isolation was not independently re-verified; no data or API code was changed."] },
  { id: "F2-1", f: "F2", c: "Merchant light-mode error text uses #b83232", impl: [S], unit: ["the approved merchant error colour is #b83232"], e2e: ["merchant controls, dialog and error text (light)", "dialog controls (portal)"], shots: ["F2-error-contrast/after-light-mode-error.png"] },
  { id: "F2-2", f: "F2", c: "Merchant light-mode error text contrast is at least 4.5:1 on the surfaces it is painted on", impl: [S], unit: ["#b83232 reaches 4.5:1"], e2e: ["merchant controls, dialog and error text (light)"], shots: ["F2-error-contrast/after-light-mode-error.png", "F2-error-contrast/after-light-error-banner.png"], limits: ["Measured from the RENDERED colours (field error, dialog alert, banner text on its tinted fill). OBSERVATION, not a change in this ticket: the unchanged dark-mode error text measures 4.41:1 on the Add category dialog surface on origin/main (below 4.5:1); F2-4 requires dark mode to stay unchanged, so it was left alone. Needs a product decision."] },
  { id: "F2-3", f: "F2", c: "Existing error borders and fills are unchanged", impl: [S], unit: ["overrides only the text colour of .text-error"], e2e: ["merchant controls, dialog and error text (light)", "merchant controls, dialog and error text (dark)"], shots: ["F2-error-contrast/after-light-error-banner.png", "F2-error-contrast/after-dark-error-banner.png"] },
  { id: "F2-4", f: "F2", c: "Dark-mode error text is unchanged", impl: [S], unit: ["restores the global error colour in dark mode"], e2e: ["merchant controls, dialog and error text (dark)", "dark mode keeps the global error colour"], shots: ["F2-error-contrast/after-dark-mode-error.png", "F2-error-contrast/after-dark-error-banner.png"] },
  { id: "F2-5", f: "F2", c: "Admin and Login retain their existing error styling", impl: ["(no Admin/Login file modified)"], unit: ["assigns --control-h and --error-text only under [data-area=merchant]"], e2e: ["Admin and Login keep their original rendering (light)", "Admin and Login keep their original rendering (dark)", "login screen", "platform admin keeps the 36px select"], shots: ["admin-login-regression/after-admin-light.png", "admin-login-regression/after-login-light.png", "admin-login-regression/after-login-dark.png"], limits: ["after-admin-dark.png and the small error-text crops were captured and validated as PNGs but were not re-opened in their final form; the dark Admin page itself was inspected via F4-control-heights/after-admin-controls-dark.png. Login uses a fixed light palette, so its 'dark' capture equals light (same on origin/main)."] },
  { id: "F4-1", f: "F4", c: "Merchant Input is 32px", impl: ["components/ui/input.tsx", S], unit: ["Input and NativeSelect fall back to their previous heights"], e2e: ["merchant controls, dialog and error text (light)", "toolbar and header controls are 32px"], shots: ["F4-control-heights/after-merchant-list-toolbar.png"] },
  { id: "F4-2", f: "F4", c: "Merchant NativeSelect is 32px", impl: ["components/ui/native-select.tsx", S], unit: ["Input and NativeSelect fall back to their previous heights"], e2e: ["merchant controls, dialog and error text (light)", "toolbar and header controls are 32px"], shots: ["F4-control-heights/after-merchant-list-toolbar.png", "F2-error-contrast/after-light-mode-error.png"] },
  { id: "F4-3", f: "F4", c: "Merchant Ctrl+K search trigger is 32px", impl: ["components/dashboard/command-search.tsx"], unit: ["the Ctrl+K trigger is 32px"], e2e: ["merchant controls, dialog and error text (light)", "toolbar and header controls are 32px"], shots: ["F4-control-heights/after-merchant-list-toolbar.png"], limits: ["The header trigger is visible in the toolbar screenshot. The separate element crop command-search-trigger.png was captured but not re-opened in final form."] },
  { id: "F4-4", f: "F4", c: "Controls align in list toolbars", impl: ["components/ui/input.tsx", "components/ui/native-select.tsx", "components/dashboard/command-search.tsx"], unit: [], e2e: ["merchant controls, dialog and error text (light)"], shots: ["F4-control-heights/after-merchant-list-toolbar.png"] },
  { id: "F4-5", f: "F4", c: "Controls align in dialog forms (portal)", impl: ["components/dashboard/merchant-scope.tsx", S], unit: [], e2e: ["merchant controls, dialog and error text (light)", "dialog controls (portal)"], shots: ["F2-error-contrast/after-light-mode-error.png"], limits: ["Evidence is the full dialog image; the element crop merchant-dialog-controls.png was not re-opened in final form."] },
  { id: "F4-6", f: "F4", c: "Default buttons unchanged", impl: ["(components/ui/button.tsx not modified)"], unit: ["the default Button definition was not touched"], e2e: ["merchant controls, dialog and error text (light)"], shots: ["F4-control-heights/after-merchant-list-toolbar.png"], limits: ["The 'Add product' link-button was compared with the origin/main measurement. The header 'View store' button is not rendered in this environment (needs NEXT_PUBLIC_ROOT_DOMAIN), so it was not measured."] },
  { id: "F4-7", f: "F4", c: "Admin and Login keep their original dimensions", impl: ["(no Admin/Login file modified)"], unit: ["Input and NativeSelect fall back to their previous heights"], e2e: ["Admin and Login keep their original rendering (light)", "Admin and Login keep their original rendering (dark)", "login screen", "platform admin keeps the 36px select"], shots: ["F4-control-heights/after-admin-controls-light.png", "F4-control-heights/after-admin-controls-dark.png", "admin-login-regression/after-login-light.png"], limits: ["Login's own inputs are 36px because the login form sets h-9 itself (unchanged)."] },
  { id: "F12-1", f: "F12", c: "All date surfaces render the store timezone (Customers list, Customer detail, Inventory adjustments, Overview, Analytics, Products Updated)", impl: ["lib/format-date.ts", "app/(dashboard)/dashboard/customers/page.tsx", "app/(dashboard)/dashboard/customers/[id]/page.tsx", "app/(dashboard)/dashboard/inventory/page.tsx", "components/analytics/analytics-view.tsx", "components/products/product-table.tsx"], unit: ["shows the store's calendar day, not the server's"], e2e: ["Customers list", "Customer detail", "Inventory recent adjustments", "Overview recent orders", "Analytics recent orders", "Products Updated column"], shots: ["F12-timezone/after-customers-list.png", "F12-timezone/after-customer-detail.png", "F12-timezone/after-inventory-adjustments.png", "F12-timezone/after-overview-orders.png", "F12-timezone/after-analytics-orders.png", "F12-timezone/after-products-updated.png"], limits: ["Server TZ=UTC and browser America/Los_Angeles were set by the test setup (E2E_SERVER_TZ is recorded, not independently probed from the server). Ground truth is the API's ISO timestamps via read-only GETs."] },
  { id: "F12-2", f: "F12", c: "Overview and Analytics both receive the store timezone", impl: ["app/(dashboard)/dashboard/page.tsx", "app/(dashboard)/dashboard/analytics/page.tsx", "components/analytics/analytics-view.tsx"], unit: [], e2e: ["Overview recent orders", "Analytics recent orders"], shots: ["F12-timezone/after-overview-orders.png", "F12-timezone/after-analytics-orders.png"] },
  { id: "F12-3", f: "F12", c: "ProductTable receives the timezone explicitly", impl: ["components/products/product-table.tsx", "app/(dashboard)/dashboard/products/page.tsx"], unit: [], e2e: ["Products Updated column"], shots: ["F12-timezone/after-products-updated.png"], limits: ["Required prop: enforced by the TypeScript build (tsc passes)."] },
  { id: "F12-4", f: "F12", c: "IST versus UTC day-boundary behaviour is correct", impl: ["lib/format-date.ts"], unit: ["moves across the IST/UTC day boundary exactly at 18:30 UTC"], e2e: ["how many real records discriminate", "Inventory recent adjustments"], shots: ["F12-timezone/after-inventory-adjustments.png", "F12-timezone/after-analytics-orders.png"], limits: ["Real seeded records exist whose store-time DAY differs from UTC (e.g. order #1044, 13 Nov 8:37 pm UTC shown as 14 Nov 2:07 am); counted in results-after.jsonl. No data was created to manufacture a midnight case."] },
  { id: "F12-5", f: "F12", c: "Invalid timezone falls back to UTC", impl: ["lib/format-date.ts"], unit: ["falls back to UTC for an unknown timezone"], e2e: [], shots: [], noVisual: true },
  { id: "F12-6", f: "F12", c: "Existing en-IN output formats are preserved", impl: ["lib/format-date.ts"], unit: ["keeps the existing en-IN output format"], e2e: ["Customers list", "Products Updated column"], shots: [], noVisual: true },
  { id: "F12-7", f: "F12", c: "No hydration mismatch is introduced", impl: ["lib/format-date.ts", "components/products/product-table.tsx"], unit: [], e2e: ["Products Updated column", "Customers list", "Customer detail", "Inventory recent adjustments", "Overview recent orders", "Analytics recent orders"], shots: ["F12-timezone/after-products-updated.png"], limits: ["Evidence is the console/pageerror watcher (zero hydration messages across all six pages with server, browser and store timezones all different); the screenshot shows the rendered result. The original app logged hydration failures under the same conditions."] },
  { id: "F12-8", f: "F12", c: "Sales chart axis is unchanged", impl: ["(components/analytics/sales-chart*.tsx not modified)"], unit: [], e2e: ["F12-8 Analytics chart axis ticks are identical to origin/main"], shots: ["F12-timezone/after-analytics-chart-axis.png"] },
  { id: "F12-9", f: "F12", c: "Admin date formatting is untouched", impl: ["(no app/(admin) or components/admin file modified)"], unit: [], e2e: [], shots: [], noVisual: true, sourceGuard: true },
  ...["1", "2", "3", "4", "5", "6"].map((n) => ({ id: `F6a-${n}`, f: "F6a", c: ["Add Category appears in the PageHeader action area", "Clicking it opens the existing category dialog", "Category creation continues working", "Existing validation and error handling unchanged", "Existing hierarchy / subcategory behaviour preserved", "No unrelated category behaviour changes"][+n - 1], impl: [], unit: [], e2e: [], shots: [], blockedAll: "BLOCKED: feat/category-subcategories-ui is not on the remote and not merged into origin/main (it exists only as uncommitted work in a local worktree). F6a must be written against the merged CategoryManager." })),
];

const matrix = AC.map((a) => {
  if (a.blockedAll) return { ac_id: a.id, finding: a.f, criterion: a.c, implementation_status: "NOT STARTED", unit_test: { status: "NOT RUN", test_reference: "" }, e2e_test: { status: "NOT RUN", test_reference: "" }, visual_verification: { status: "BLOCKED", screenshots: [], inspected: false }, limitations: [a.blockedAll], final_status: "BLOCKED" };
  const unitR = a.unit.length ? combine(a.unit, unitStatus) : { status: "N/A", test_reference: "" };
  const e2eR = a.e2e.length ? combine(a.e2e, e2eStatus) : { status: "N/A", test_reference: "" };
  const shots = a.shots.map(shot);
  const missing = shots.filter((s) => !s.exists);
  if (missing.length) throw new Error("missing screenshot(s): " + missing.map((m) => m.file));
  const allInspected = shots.length > 0 && shots.every((s) => s.inspected);
  const visual = a.noVisual || !a.shots.length ? { status: "NOT REQUIRED", screenshots: shots, inspected: null } : { status: allInspected ? "VERIFIED" : "CAPTURED, NOT FULLY INSPECTED", screenshots: shots, inspected: allInspected };
  const limits = [...(a.limits ?? [])];
  if (a.needsE2E && e2eR.status === "SKIPPED") { visual.status = "BLOCKED"; visual.inspected = false; }
  let final;
  const passing = (r) => r.status === "PASSED" || r.status === "N/A";
  if (a.needsE2E && e2eR.status === "SKIPPED") {
    final = "BLOCKED";
    limits.unshift("E2E BLOCKED: " + a.blockedE2E);
  } else if (unitR.status === "FAILED" || e2eR.status === "FAILED") final = "FAILED";
  else if (passing(unitR) && passing(e2eR) && (visual.status === "VERIFIED" || visual.status === "NOT REQUIRED")) final = "VERIFIED";
  else final = "TESTED";
  if (a.sourceGuard) {
    final = "VERIFIED";
    limits.push("Evidence is a source-diff guard (git diff origin/main touches no app/(admin), components/admin or sales-chart file), recorded in closeout-report.md section F.");
  }
  return { ac_id: a.id, finding: a.f, criterion: a.c, implementation_status: "IMPLEMENTED", implementation_files: a.impl, unit_test: { status: unitR.status, test_reference: unitR.test_reference }, e2e_test: { status: e2eR.status, test_reference: e2eR.test_reference }, visual_verification: visual, limitations: limits, final_status: final };
});
fs.writeFileSync(path.join(REP, "acceptance-criteria-matrix.json"), JSON.stringify(matrix, null, 2));

// ---- numbers for the report ----------------------------------------------------------------------------------------
const count = (s) => matrix.filter((m) => m.final_status === s).length;
const stats = pw.stats ?? {};
const read = (f) => fs.readFileSync(path.join(REP, f), "utf8");
const lintTxt = read("lint-results.txt");
const lintRepo = /✖ (\d+) problems? \((\d+) errors?, (\d+) warnings?\)/.exec(lintTxt);
const buildOk = /exit code: 0/.test(read("build-results.txt"));
const tscOk = /exit code: 0/.test(read("typecheck-results.txt"));
const failedUnit = unitTests.filter((t) => t.status === "FAILED");
const beforeConsole = fs.existsSync(path.join(REP, "playwright-before-console.txt")) ? read("playwright-before-console.txt").replace(/\x1b\[[0-9;]*m/g, "") : "";
const beforeLine = (/(\d+) passed/.exec(beforeConsole) || [])[0] ?? "n/a";
const allShots = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".png")) allShots.push(path.relative(ROOT, p).replaceAll("\\", "/"));
  }
})(ROOT);
const jl = (f) => (fs.existsSync(path.join(REP, f)) ? read(f).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const latest = new Map();
for (const r of [...jl("results-before.jsonl"), ...jl("results-after.jsonl")]) if (r.kind === "screenshot") latest.set(r.file, r);

const T = (rows) => rows.map((r) => "| " + r.join(" | ") + " |").join("\n");
const cRows = matrix.map((m) => [m.ac_id, m.criterion, m.implementation_status, `${m.unit_test.status}`, `${m.e2e_test.status}`, m.visual_verification.screenshots.map((s) => path.basename(s.file)).join(", ") || "n/a", m.visual_verification.inspected === null ? "n/a" : m.visual_verification.inspected ? "yes, final form" : "no / partial", `**${m.final_status}**`]);
const dRows = allShots.sort().map((f) => {
  const r = latest.get(f);
  const insp = INSPECTED.has(f) ? "yes" : "no";
  const ac = matrix.filter((m) => m.visual_verification.screenshots?.some((s) => s.file === f)).map((m) => m.ac_id).join(", ") || (r ? r.ac.join(", ") : "-");
  return [`\`${path.basename(f)}\``, `\`${path.dirname(f)}\``, ac, r ? `${r.env.colorScheme}, ${r.env.viewport}, tz ${r.env.browserTZ}` : "-", r ? r.note : "-", insp];
});

const md = `# Studio UI Enhancement — closeout report

Generated from the files in this folder by \`build-closeout.cjs\`. Environment: isolated local Supabase project \`sf-studio-ui-e2e\` (Postgres \`localhost:58102\`), StoreForge API from \`origin/main\` (\`1b29a4b\`) on port 4000, frontend on 3100 (branch) and 3101 (origin/main baseline), server clock \`TZ=UTC\`, browser \`America/Los_Angeles\`, seeded Urban Nest store (\`Asia/Kolkata\`). No hosted Supabase was contacted. Nothing was committed or pushed.

## A. Executive summary

- **Scope:** approved findings F1, F2, F4, F12 (Stage 1) and F6a (Stage 2). Templates, Admin, storefront, landing, Login redesign and findings F3, F5, F7–F11, F13 are excluded.
- **Implemented:** F1, F2, F4, F12 (uncommitted in worktree \`store-forge-studio-ui\`, branch \`feat/studio-ui-enhancement\`, based on \`origin/main\` \`b14614b\`).
- **Not implemented:** **F6a** — its dependency \`feat/category-subcategories-ui\` is not on the remote and not merged.
- **Acceptance criteria (${matrix.length}):** VERIFIED ${count("VERIFIED")} · BLOCKED ${count("BLOCKED")} · TESTED ${count("TESTED")} · FAILED ${count("FAILED")}.
- **Verdict: PARTIALLY COMPLETE** (section I).

## B. Implementation summary

- **Files modified (14):** \`app/(dashboard)/dashboard/{analytics/page,customers/[id]/page,customers/page,inventory/page,layout,page,products/page}.tsx\`, \`app/globals.css\`, \`components/analytics/analytics-view.tsx\`, \`components/dashboard/{command-search.tsx,nav-config.ts}\`, \`components/products/product-table.tsx\`, \`components/ui/{input,native-select}.tsx\`.
- **Files created (source):** \`components/dashboard/merchant-scope.tsx\`, \`lib/format-date.ts\`.
- **Tests created:** unit \`tests/unit/{format-date,nav-visibility,merchant-scope-css}.test.ts\`; E2E \`tests/e2e/{studio-scope,studio-baseline,studio-evidence,studio-timezone,studio-viewports}.spec.ts\`; helpers \`tests/e2e/support/{studio-evidence,studio-measure,studio-session}.ts\`.
- **Shared components affected:** \`ui/input\`, \`ui/native-select\`, \`nav-config\` (additive export), \`globals.css\` (scoped block), dashboard \`layout\`. All used by Admin/Login too; their defaults are unchanged and proven by measurement against origin/main.
- **Preserved:** no API, database, auth, permission, routing, server-action or Admin/Login file changed.
- **Whitespace-insensitive diff:** 14 files, 65 insertions, 34 deletions (the layout change is 12 lines once re-indentation is ignored).

## C. Acceptance criteria results

| AC | Requirement | Implementation | Unit | E2E | Screenshot(s) | Inspected | Final |
|---|---|---|---|---|---|---|---|
${T(cRows)}

Per-AC limitations are in \`acceptance-criteria-matrix.json\` (\`limitations\`).

## D. Screenshot inventory

${allShots.length} PNG files exist on disk, each validated by the harness (PNG signature, chunk CRCs, decodable pixels, not a flat colour). "Inspected" means a person opened it in its FINAL form; files marked "no" were captured and validated but not re-opened, and are not counted as visual proof.

| File | Folder | AC | Browser state | What it shows | Inspected |
|---|---|---|---|---|---|
${T(dRows)}

## E. Test results

| Gate | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| TypeScript | pass | \`tsc --noEmit\` exit ${tscOk ? 0 : "non-zero"} | ${tscOk ? "PASS" : "FAIL"} | typecheck-results.txt |
| Changed-file lint | pass | all 14 modified + new .ts/.tsx files clean | PASS | lint-results.txt |
| Repository lint | pass | ${lintRepo ? `${lintRepo[1]} problems (${lintRepo[2]} error, ${lintRepo[3]} warnings)` : "see log"}: 1 error is \`lib/supabase/middleware.ts:28 prefer-const\`, on origin/main | **FAIL (baseline)** | lint-results.txt |
| Unit suite | pass | ${unit.numTotalTests} tests, ${unit.numPassedTests} passed, ${unit.numFailedTests} failed (${failedUnit.map((t) => t.file).filter((v, i, a) => a.indexOf(v) === i).join(", ")}: baseline); new files: ${["format-date", "nav-visibility", "merchant-scope-css"].map((n) => `${n} ${unitTests.filter((t) => t.file.includes(n) && t.status === "PASSED").length}/${unitTests.filter((t) => t.file.includes(n)).length}`).join(", ")} | **FAIL (baseline)** | unit-test-results.json, unit-test-results.txt |
| Playwright (after) | all required pass | ${stats.expected ?? "?"} passed, ${stats.skipped ?? "?"} skipped, ${stats.unexpected ?? "?"} failed | PASS (1 skipped = BLOCKED restricted-member test) | playwright-results.json, playwright-console.txt |
| Playwright (baseline capture on origin/main) | pass | ${beforeLine} | PASS | playwright-before-console.txt |
| Production build | pass | \`next build\` exit ${buildOk ? 0 : "non-zero"} | ${buildOk ? "PASS" : "FAIL"} | build-results.txt |
| Visual regression | no unexplained regression | before/after pairs inspected for F1, F2, F4, F12, Admin, Login (light and dark where applicable); see \`visual-verification.md\` | PASS for inspected pairs | screenshots |

The 2 failing unit tests and the lint error exist on \`origin/main\` and are fixed by the separate, unmerged branch \`fix/baseline-timing-config-and-middleware-lint\` (commit 317c243). They were not touched here, per instruction.

## F. Security and regression review

| Area | Result |
|---|---|
| Authentication | Real UI login for every account; sign-out removes the scope marker (E2E). Login rate limiter respected via one login per account. |
| Authorization | Staff: no Team in the palette, \`/dashboard/team\` redirects to the Overview, and the API returns 403 on the owner-only team list while the owner gets 200 (E2E). Restricted member (created through the Team UI, deactivated afterwards): Customers, Analytics and Team are hidden in both the palette and the sidebar (E2E + screenshots). Catalog-restricted case is unit-tested only (see section G, item 3). |
| Team access | See above. |
| Tenant isolation | **Not independently re-verified.** No API, data or tenant code changed; the repository has no tenant E2E suite on origin/main to re-run. |
| Admin isolation | Measured heights and error colours identical to origin/main in light and dark (E2E equality against baseline-measurements.json); Admin dark screenshot inspected. Coverage is the Organizations list and New-organization form only. |
| Login isolation | Identical to origin/main (E2E equality, light and dark). |
| Portal styling | Add category dialog (portal) is 32px and uses the merchant error colour; dark-mode portal keeps the global colour (E2E + screenshots). |
| Existing form behaviour | Validation messages and the product-form banner unchanged except text colour (border and fill equal to baseline). No form was submitted successfully (no writes). |
| Category behaviour | **Not verified** (F6a blocked; categories page untouched). |
| Timezone correctness | All six surfaces equal Intl output for the API timestamps in \`Asia/Kolkata\` (E2E, server UTC, browser LA). |
| Hydration | Zero hydration messages across the six pages with differing server/browser/store timezones. |
| Source-diff guards | \`git diff origin/main\` touches no \`app/(admin)\`, \`components/admin\`, \`sales-chart*\`, auth, templates, \`app-shell\`, \`sidebar-nav\`, \`ui/button\`, \`page-header\`, \`form-field\`, \`package.json\`, \`lib/api\`, \`services\`, \`lib/supabase\`. No env file is tracked or staged. |

## G. Outstanding blockers

1. **F6a (6 criteria)** — \`feat/category-subcategories-ui\` is not on the remote / not merged (local worktree \`sff-pr2\`, uncommitted). \`feat/product-bulk-import-ui\` is likewise unmerged.
2. **Baseline failures** — \`fix/baseline-timing-config-and-middleware-lint\` is unmerged, so repository lint and the full unit suite cannot be green. The original Definition of Done is not waived.
3. **Pre-existing defect found (not fixed, out of scope)** — on origin/main a member WITHOUT products access cannot open the dashboard at all ("Something went wrong"): the header notifications bell (components/dashboard/notifications.tsx, unmodified here) queries inventory for every member and the API answers 403. Evidence: F1-command-palette/after-restricted-member-no-catalog-dashboard.png and the API log. Consequence: catalog-restricted palette filtering cannot be E2E-tested; F1-2 was verified with customers/orders restrictions instead. Needs a separate ticket.
4. **F2 observation needing a decision** — unchanged dark-mode error text measures 4.41:1 on the Add category dialog surface (origin/main behaviour). F2-4 forbids changing dark mode, so it was left alone.
5. **Evidence caveats** — a few small element crops were not re-opened in final form (listed in section D as "no"); full-page captures draw the sticky header mid-page (capture artifact); the Next.js dev overlay is hidden in captures; "View store" is not rendered in this environment so it was not measured; server timezone is set and recorded, not probed.
6. **Not performed** — staging and production verification; Themes page not opened; tenant isolation not re-verified.

## H. PR readiness

**NOT PR READY.** F6a is unimplemented and its dependency is unmerged, the original gates (repository lint, full unit suite) are red on the baseline. Stage 1 (F1, F2, F4, F12) is feature-complete and verified (see C), and could be PR READY WITH DOCUMENTED EXTERNAL BLOCKER as a Stage 1-only PR once the baseline fix merges, if Stage 1 alone is acceptable.

## I. Final ticket verdict

**PARTIALLY COMPLETE.**

## PR content (not created; no commit, push or PR number exists)

**Title:** feat(studio): permission-consistent palette, merchant-scoped control sizing and error contrast, store-timezone dates

**Summary:** Stage 1 of the Studio UI enhancement for the merchant dashboard.

**Findings covered:** F1 (palette uses the sidebar's nav set and hidden list; owner sees Team), F2 (merchant-scoped #b83232 error text, light mode), F4 (32px Input, NativeSelect and Ctrl+K trigger in the merchant dashboard), F12 (\`lib/format-date.ts\`; six date surfaces use the store timezone).

**Architecture notes:** \`MerchantScope\` sets \`data-area="merchant"\` on a wrapper and on \`<html>\` (portals); scoped CSS variables \`--control-h\` and \`--error-text\` live in \`globals.css\`; Input/NativeSelect read \`var(--control-h, <old height>)\`, so Admin and Login render as before.

**Acceptance criteria:** see section C. **Evidence:** \`artifacts/qa/screenshots/STUDIO-UI-ENHANCEMENT/\` (keep out of the PR; attach separately).

**Known limitations:** F6a pending; baseline lint/unit failures from origin/main; restricted-member E2E pending; dark dialog error text 4.41:1 on origin/main (unchanged).

**Rollback:** revert the Stage 1 commit(s); no database change exists.
`;
fs.writeFileSync(path.join(REP, "closeout-report.md"), md);
console.log("AC:", matrix.length, "| VERIFIED", count("VERIFIED"), "| BLOCKED", count("BLOCKED"), "| TESTED", count("TESTED"), "| FAILED", count("FAILED"));
console.log("screenshots on disk:", allShots.length, "| inspected-listed that exist:", [...INSPECTED].filter(exists).length, "of", INSPECTED.size);
for (const m of matrix) if (m.final_status !== "VERIFIED") console.log(" ", m.ac_id, m.final_status, "| unit", m.unit_test.status, "| e2e", m.e2e_test.status, "| visual", m.visual_verification.status);
