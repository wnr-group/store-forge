# Testing

## Automated checks

Run these before opening a pull request and after changing an API-backed module.

| Check | Command |
|---|---|
| Type-check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm run test:unit` |
| Timing tests | `npm run test:timing` |
| Unit and timing tests together | `npm test` |
| End-to-end (Playwright) | `npm run test:e2e` |
| Studio video preflight | `npm run studio:video:preflight` |
| Studio video recording | `npm run studio:video:record` |
| Studio video validation | `npm run studio:video:validate` |
| Studio video reporting | `npm run studio:video:report` |
| Production build | `npm run build` |

See [docs/studio-localhost-e2e-video-recording.md](studio-localhost-e2e-video-recording.md) for the end-to-end browser video demonstration workflow.

`npm run build` runs the type-check, so a type error in a test file also fails the build.

API tests live in the `store-forge-api` repository (`npm test`, `npm run test:e2e`).

Key suites for the API integration:

| Suite | Covers |
|---|---|
| `tests/unit/api-client.test.ts` | The API client: token, headers, query serialization, envelope parsing, error mapping |
| `tests/unit/*-service-api.test.ts` | Each service against mocked endpoints: data shapes, permission checked before the call |
| `tests/unit/auth-api-mode.test.ts` | Sign-in, refresh and sign-out against a local HTTP server |
| `tests/unit/no-direct-db-static.test.ts` | Fails if direct database access is added to the app |

## Live verification

Needs a staging Supabase project and the running API. Never use production data.

Repeat for each role: Platform Admin, Owner, Manager (view-only), Manager (manage) and Staff.

1. Sign in, reload (session restore), wait past token expiry (refresh), then sign out.
2. Open every page of the module. Check the data, and the empty, loading and error states.
3. Create, edit and delete records. Submit invalid data and check the field error messages.
4. A user without permission gets a clear message and no data.
5. Organization switching and the store subdomain host select the right workspace.
6. **Cross-tenant:** send another organization's id (tamper with the cookie or header). Expect 403 or no data. Another tenant's record ids must return 404.
7. A Platform Admin sees no tenant business data. Tenant users get 403 on `/platform/*`.

### Module-specific checks

| Module | Check |
|---|---|
| Products | Image upload, replace and delete removes the file; bulk actions; currency lock |
| Inventory | Concurrent adjustments never go negative; one ledger row per change |
| Team | Owner only; cannot edit self or the Owner |
| Platform | The last super admin is protected; audit rows are written |
