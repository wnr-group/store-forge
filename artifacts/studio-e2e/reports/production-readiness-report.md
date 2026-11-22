# Production readiness

| Requirement | Evidence | Met |
|---|---|---|
| All in-scope acceptance criteria | 23 of 129 DONE | No |
| Production build | earlier build exit 0 (not re-run in this pass) | Not freshly verified |
| Migration safety | applied once to local DB; idempotency tested on PGlite; no production-data copy, no hosted DB | No |
| Tenant isolation | existing surface tested; most new tables absent | No |
| Permission enforcement | API + DB tested; UI publish gating unverified | Partly |
| Legal approval gates | gate mechanism tested; no approvals exist | Gate verified; approvals missing |
| Feature-flag defaults | existing store default off verified | Yes |
| Hosted environment verification | not performed | No |
| Performance | lab LCP p75 444 ms on dev server; no field data, no INP | No |
| Accessibility | 1 reproducible serious failure; no manual audit | No |
| Monitoring / operational visibility | health endpoint only; no alerts | No |
| Rollback and recovery | procedure written; simulation partial | No |
| Data preservation | schema-2 content survives flag off (observed) | Partly |
| Backward compatibility of storefront | schema-1 golden tests pass; storefront 200 at three widths | Yes (existing pages) |
| Operational release procedure | draft in docs/qa/studio-deployment-rollout-rollback.md | Not exercised |
**Verdict: NOT PRODUCTION READY.** Rollout is also gated by missing legal approvals (open dependency O3).
