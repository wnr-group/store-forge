# Security and tenant isolation

Executed this pass (API e2e on PGlite with the real migrations, 404 tests green, plus real-DB spot checks):
- **Permissions:** design none/read/write/publish at API and direct authenticated-role SQL; attest/discard independent of level; migration idempotent; real local DB members mapped (manager publish+attest, staff read).
- **Tenant isolation (tests that exist for tables/routes that exist):** rollout flag, legal wording, attestations, media assets, publishes, readiness, schema-2 saves (cross-tenant save returns 404), media paths of other tenants rejected. Executed in the automated suites; a browser-level two-tenant journey was NOT run.
- **Append-only:** rollout events, approvals, attestations, studio_publishes reject UPDATE/DELETE/TRUNCATE for owner and app roles (suite).
- **Upload and links:** svg/gif/html/pdf/oversize/bad dimensions/client path rejected (suite); unsafe link checks only as FE unit helpers.
- **CSRF/rate limits:** global guards exist; the long editor run exceeded the throttle earlier in the day (finding D-014); not freshly tested here.

Not verified: tenant isolation for reviews, recommendations, reusable sections, ledger, discard audit (tables absent); direct role tests on a hosted database; secret-exposure scan of bundles/logs; CSS-injection and protected-content browser tests; concurrency/failure injection beyond the revision-conflict tests; the implementer-reported gap that the legal gate is not enforced on media upload-requests/attestations (not reproduced).
Environment integrity finding: another process (`record-all-videos.cjs`) mutates the same store and rollout flag during testing; tenant data and the flag can change under a test run.
**Security verdict: PARTIALLY VERIFIED (existing surface only); not verified for the full specification.**
