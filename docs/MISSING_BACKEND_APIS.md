# Missing Backend APIs

**No backend endpoint is missing for any feature that exists in the product today.** The items below were in the integration brief but do not exist in the current app, so no API was invented (brief section 7: "not permission to invent features").

| Brief item | Status | Decision |
|---|---|---|
| Order list / details / create / update / status / cancel | No order UI or service exists; orders appear only in customer history and analytics | Not built. Needs a product decision (what is an order flow here?) before any API |
| Discounts and taxes on orders | No such model | Not built |
| Invitations | Accounts are created by Owner/Platform Admin with a password | Not built |
| Tenant-side ownership transfer | Platform Admin only | Preserved as is |
| Organization creation by tenants (onboarding) | Platform Admin only; users cannot self-onboard | Preserved |
| Audit log "details" endpoint | Not verified to exist in UI | Re-check when the admin module is migrated; list endpoint exists |
| Template customization | Excluded by the brief and by the API repo | Stays in Next.js |

## Gaps in the integration (not missing endpoints)

| Gap | Impact | Plan |
|---|---|---|
| Workspace resolution (`lib/tenant/context.ts`) still reads memberships/store through Drizzle on every page | A "migrated" module still performs this one direct read per request | Migrate last via `GET /organizations` + `/organizations/current`; needs care (host-based store selection, cookie preference are frontend concerns the API replaces with `X-Organization-Id`) |
| Host-based tenant selection (`<store>.<root domain>`) | API has no concept of host | Frontend resolves host -> tenant id and sends it as `X-Organization-Id`; membership still verified by API |
| API never exercised against real Supabase | Storage/Admin/JWKS paths verified with fakes | Run API repo's staging smoke checklist before enabling `*` |
