# Razorpay tenant configuration: user guide

For organization owners and developers. This guide covers what is implemented on the `feat/razorpay-config` branch (frontend PR
wnr-group/store-forge#9, API PR wnr-group/store-forge-api#10). Anything not listed under "What is implemented" is **not available**.

## 1. What the integration does

An organization owner stores that organization's Razorpay **Key ID** and **Key Secret** in Store Forge. The Key Secret is encrypted on the
server (AES-256-GCM) before it is stored, is bound to the organization, and is never sent back to the browser. Each organization has its own
credentials; one organization can never read, replace or remove another's.

### What is implemented, and what is not

| Capability | Status |
|---|---|
| Save, replace and remove an organization's Razorpay Key ID and Key Secret | **Implemented and tested** |
| Per-organization isolation and owner-only access | **Implemented and tested** |
| Encryption at rest (AES-256-GCM, tenant-bound) | **Implemented and tested** |
| Razorpay checkout initialization (creating orders, opening Razorpay Checkout) | **Not implemented**: future integration |
| Payment verification (signature check on the payment response) | **Not implemented**: future integration |
| Webhooks (payment captured, failed, refund events) | **Not implemented**: future integration |
| Refunds | **Not implemented**: future integration |
| Settlement and reconciliation | **Not implemented**: future integration |
| "Test connection" against Razorpay | **Not implemented**: by design the app makes no outbound call to Razorpay, so saved credentials are *saved, not verified* |
| Encryption key rotation tooling | **Not implemented**: keep `CREDENTIALS_ENCRYPTION_KEY_CURRENT=1` (see section 9) |

Saving credentials does not enable payments for shoppers. It is the prerequisite for the future checkout work.

## 2. Razorpay account prerequisites

- A Razorpay account. TEST mode is available immediately; LIVE mode needs Razorpay's activation and KYC.
- Permission in Razorpay to generate API keys.

## 3. TEST versus LIVE credentials

| | TEST | LIVE |
|---|---|---|
| Key ID prefix | `rzp_test_` | `rzp_live_` |
| Moves real money | No | Yes |
| Use for | Development, QA, demos | Production only |

Store Forge accepts both and shows a **Test** or **Live** badge from the Key ID prefix. Use TEST keys everywhere except production.
Never paste LIVE credentials into a development, QA or demo environment.

## 4. Where to get the Key ID and Secret

In the Razorpay Dashboard, switch to **Test Mode**, open **Account & Settings > API Keys**, and generate a key. Razorpay shows the Key Secret
**once**; copy it then. If it is lost, regenerate the key in Razorpay and enter the new pair in Store Forge.

## 5. Configure credentials (organization owner)

1. Sign in as the organization **owner**.
2. Make sure the right organization is active (workspace switcher, top left).
3. Open **Payments** in the dashboard navigation.
4. Enter the **Key ID**: `rzp_test_` or `rzp_live_` followed by at least 8 letters or numbers.
5. Enter the **Key Secret**: 16 to 128 letters and numbers, no spaces or symbols. The field is masked.
6. Select **Save credentials**.

On success the page shows **Configured (saved)**, the Test or Live badge, the masked Key ID (for example `rzp_test_••••ab12`) and who last
updated it and when. The secret field is cleared. The status text says *saved, not verified*.

## 6. Update or remove credentials

- **Update:** enter a new Key ID and Key Secret and select **Replace credentials**. Both fields are required. The previous secret is overwritten
  and cannot be retrieved. The Key Secret is never pre-filled.
- **Remove:** select **Remove credentials** and confirm. Removing an already removed configuration also succeeds.

## 7. How tenant-specific configuration works

- The server decides which organization a request is for from the signed-in user's memberships and the active-organization setting; the
  browser never chooses the organization for a save.
- Only the **owner** of an organization can view or change its credentials. Admin and Staff members, Platform Admins, signed-out visitors and
  members of other organizations cannot.
- Switching workspace switches the credentials shown. A forged active-organization cookie only selects among the organizations the user
  really belongs to.

## 8. How to verify the configuration

- After saving, refresh the page: the same masked Key ID and **Configured (saved)** appear and the secret field is empty.
- Switch to another organization you own and confirm it shows its own state.
- Developers: `GET /api/v1/payments/razorpay` with `Authorization` and `X-Organization-Id` returns `configured`, `keyIdMasked`, `mode`, `updatedAt`,
  `updatedByName`. It never returns the secret.
- Saving does not contact Razorpay, so a wrong but well-formed key is accepted. Verify keys in the Razorpay Dashboard.

## 9. Security architecture

- **Encryption:** AES-256-GCM, a 32-byte key, a fresh random 12-byte IV per write, a 16-byte authentication tag, and the organization id as
  additional authenticated data. A row copied to another organization fails to decrypt.
- **Storage:** table `tenant_razorpay_config` holds `key_id`, `secret_ciphertext`, `iv`, `auth_tag` and `key_version`. No plaintext secret column exists.
- **Server only:** the secret travels browser to Next.js Server Action to API once, over your TLS, and is never returned, logged or placed in
  an error message. Next.js server-function argument logging is switched off for this reason.
- **Keys:** set on the API only, never in the browser or the repository.
  - `CREDENTIALS_ENCRYPTION_KEY_V1`: 32 random bytes in base64. Generate with `openssl rand -base64 32`.
  - `CREDENTIALS_ENCRYPTION_KEY_CURRENT`: the version used for new writes. Keep `1`.
  - The API starts without the key. Without it a save answers `503 PAYMENTS_UNAVAILABLE` and writes nothing; reading status and removing still work.
  - **Back the key up separately.** If it is lost, every stored secret is unrecoverable and each owner must re-enter their credentials. Never
    change or delete a key version that stored rows still use. Rotation tooling is not built.
- **Rate limits:** saving is throttled. After too many attempts the page shows "Too many requests. Please wait a moment and try again."

## 10. Troubleshooting

| Symptom | Cause and action |
|---|---|
| Payments is missing from the navigation | You are not the owner of the active organization. Switch workspace or ask the owner. |
| `/dashboard/payments` redirects to the dashboard or login | Not an owner, or the session expired. Sign in again. |
| "Enter a valid Razorpay Key ID..." | The Key ID must start with `rzp_test_` or `rzp_live_` followed by at least 8 letters or numbers. |
| "Enter a valid Razorpay Key Secret..." | 16 to 128 letters and numbers only. |
| "Payment settings are temporarily unavailable. Please contact support." | The API has no valid `CREDENTIALS_ENCRYPTION_KEY_V1`. Operators: set it and restart the API. Nothing was saved. |
| "Too many requests..." | Wait about a minute and retry. |
| "Something went wrong" | The request failed (network or server). Your input is kept; retry. |
| "No active workspace" immediately after heavy navigation | Observed during automated runs when the API's general rate limit returned 429 on session checks. Wait a minute and reload. |

## 11. Production activation prerequisites

Do not treat this as production-ready until all of these are true. Several are outside engineering's control and are tracked in the PR
readiness report:

1. The upstream API migration dependency (API PR #9) is merged and migrations are applied in order.
2. Security Lead review of the key handling and documentation is recorded.
3. A Product Owner decision on the non-member and Platform Admin denial contract (404 `NO_WORKSPACE` versus 403) is recorded.
4. Independent CODEOWNERS review of both PRs is recorded on GitHub.
5. Hosted staging verification is done (or a waiver is recorded).
6. `CREDENTIALS_ENCRYPTION_KEY_V1` is created in the secret manager and backed up separately.
7. The checkout, verification and webhook work (section 1) is built before any shopper can pay.

## 12. Not supported by the current implementation

Everything marked "Not implemented" in section 1, plus: more than one credential set per organization, per-user credentials, automatic key
rotation, and verifying keys against Razorpay.
