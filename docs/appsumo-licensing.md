# TaskNera ATS — AppSumo Licensing API v2 Integration Guide

This document describes the production-ready implementation of the **AppSumo Licensing API v2** for the TaskNera AI Recruitment Platform. It details the architecture, webhook security, database models, tier quota mapping, local test workflows, and AppSumo Partner Portal configuration.

---

## 1. Architecture Overview

TaskNera is a multi-tenant applicant tracking system where customer data (jobs, candidates, resumes, and evaluations) is isolated by `organization_id`. 

The AppSumo integration integrates directly with this multi-tenant architecture:
- **Webhook Endpoint**: Listens for asynchronous lifecycle events (`purchase`, `activate`, `upgrade`, `downgrade`, `migrate`, `deactivate`) signed with HMAC SHA-256.
- **Idempotency Engine**: Stores all events in an audit history table (`appsumo_license_events`) to guarantee that duplicate webhooks never trigger double updates.
- **Onboarding Portal (`/appsumo/activate`)**: Allows AppSumo buyers to either provision a brand new client organization or link their license to an existing TaskNera organization.
- **Atomic Migrations**: Utilizes Prisma database transactions (`$transaction`) so upgrades, downgrades, and deactivations migrate cleanly without data inconsistency or tenant cross-contamination.
- **API Client**: Includes a rate-limited (20 requests/minute) AppSumo API Client for super-admin auditing and reconciliation.

```
                          ┌────────────────────────┐
                          │  AppSumo Partner API   │
                          └───────────┬────────────┘
                                      │
           Webhook Delivery (HMAC)    │    OAuth / Activation Redirect
                                      │
             ┌────────────────────────┴───────────────────────┐
             │                                               │
             ▼                                               ▼
  [POST /v2/webhooks]                             [GET /v2/redirect-url]
  [POST /api/v1/appsumo/webhooks]                 [GET /api/v1/appsumo/redirect]
             │                                               │
             ▼                                               ▼
    HMAC Verification                               Frontend Activation Page
    Idempotency Filter                              [/appsumo/activate]
             │                                               │
             ▼                                               ▼
  Prisma Database Transactions                   TaskNera Client Organization
  (AppSumoLicense & Event Log)                   (Quota Allocation & Admin Auth)
```

---

## 2. Environment Variables

Store these variables in `backend/.env` (and see [backend/.env.example](file:///c:/Users/Shubham/OneDrive/Desktop/ATS/backend/.env.example)):

```bash
# ==============================================================================
# AppSumo Licensing API v2
# ==============================================================================

# Partner API Key provided by AppSumo Partner Portal.
# NOTE: According to the AppSumo Licensing specification, this API key serves as
# the default HMAC secret for validating incoming webhook signatures (X-Appsumo-Signature).
APPSUMO_API_KEY=your_appsumo_licensing_key_here

# AppSumo OAuth credentials
APPSUMO_CLIENT_ID=your_appsumo_client_id_here
APPSUMO_CLIENT_SECRET=your_appsumo_client_secret_here

# Optional: Separate webhook secret override (if configured separately in AppSumo dashboard;
# defaults to APPSUMO_API_KEY if left blank)
APPSUMO_WEBHOOK_SECRET=

# Base URL for AppSumo Licensing API v2
APPSUMO_API_BASE_URL=https://api.licensing.appsumo.com/v2/

# Frontend URL for browser redirect destinations
FRONTEND_URL=https://app.tasknera.com

# Optional Tier Quota Overrides (Leave blank to use default configuration)
APPSUMO_TIER_1_MAX_USERS=5
APPSUMO_TIER_1_MAX_RECRUITERS=5
APPSUMO_TIER_1_MAX_ACTIVE_JOBS=25
APPSUMO_TIER_1_MAX_RESUMES=1000

APPSUMO_TIER_2_MAX_USERS=15
APPSUMO_TIER_2_MAX_RECRUITERS=15
APPSUMO_TIER_2_MAX_ACTIVE_JOBS=75
APPSUMO_TIER_2_MAX_RESUMES=3000

APPSUMO_TIER_3_MAX_USERS=50
APPSUMO_TIER_3_MAX_RECRUITERS=50
APPSUMO_TIER_3_MAX_ACTIVE_JOBS=250
APPSUMO_TIER_3_MAX_RESUMES=10000
```

---

## 3. Database Schema Changes

Two dedicated models were added to [schema.prisma](file:///c:/Users/Shubham/OneDrive/Desktop/ATS/backend/prisma/schema.prisma):

### 1. `AppSumoLicense` (Table: `appsumo_licenses`)
Tracks the active license state, tier, and multi-tenant links:
- `id`: UUID Primary Key
- `licenseKey`: Unique AppSumo license key
- `previousLicenseKey`: Preceding license key (set upon upgrade/downgrade)
- `parentLicenseKey`: Parent deal license key for add-on products
- `organizationId`: Foreign key to `Organization` (tenant container)
- `userId`: Foreign key to `User` (the purchasing admin)
- `tier`: Integer tier (1, 2, 3...)
- `status`: Enum (`ACTIVE`, `INACTIVE`, `REFUNDED`, `DEACTIVATED`)
- `partnerPlanName`: Name of the partner plan in AppSumo
- `unitQuantity`: Add-on quantity (defaults to 1)
- `isTest`: Boolean indicating AppSumo test webhook origins
- `createdAtFromAppSumo`: AppSumo purchase timestamp
- `lastEventTimestamp`: Timestamp of latest received event
- `lastWebhookReceivedAt`: Timestamp webhook was received
- `activatedAt`, `deactivatedAt`: Lifecycle timestamps

### 2. `AppSumoLicenseEvent` (Table: `appsumo_license_events`)
Immutable audit log of all raw and processed webhook payloads:
- `id`: UUID Primary Key
- `licenseKey`: Target license key
- `event`: Webhook event name (`purchase`, `activate`, `upgrade`, `downgrade`, `migrate`, `deactivate`)
- `eventTimestamp`: Timestamp supplied by AppSumo
- `payload`: Full JSON payload as received
- `processingStatus`: `PENDING` | `COMPLETED` | `FAILED` | `SKIPPED_TEST`
- `errorMessage`: Captured stack/error if processing fails
- Compound Index `[licenseKey, event, eventTimestamp]` enforces event idempotency.

---

## 4. Webhook Endpoints

The backend supports both the standard AppSumo route and the project-prefixed route:

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/webhooks` | `POST` | Primary AppSumo specification webhook endpoint |
| `/api/v1/appsumo/webhooks` | `POST` | Namespaced webhook endpoint |

### Expected Success Response:
HTTP `200 OK`:
```json
{
  "event": "<same event received in payload>",
  "success": true
}
```

---

## 5. Webhook Security & HMAC Verification

AppSumo provides two verification headers:
- `X-Appsumo-Signature`: Hex-encoded HMAC-SHA256 signature
- `X-Appsumo-Timestamp`: Epoch timestamp in seconds

### Verification Algorithm:
1. Access the **RAW REQUEST BODY BUFFER** (`req.rawBody`).
2. Concatenate:
   ```
   timestamp + raw_request_body
   ```
3. Generate HMAC SHA-256 with the secret (`APPSUMO_API_KEY` or `APPSUMO_WEBHOOK_SECRET`).
4. Perform timing-safe equality comparison using Node's `crypto.timingSafeEqual` to eliminate timing attack vectors.
5. Requests with missing or invalid signatures are rejected immediately with HTTP `401 Unauthorized`.

---

## 6. Event Handling Logic

### `purchase`
- AppSumo issues this when a customer buys a deal.
- Creates a placeholder record in `appsumo_licenses` with `status: INACTIVE`.
- Does **not** grant active access until the user activates their account.
- If `test: true`, records event safely as `SKIPPED_TEST` without mutating live subscriptions.

### `activate`
- AppSumo or TaskNera triggers activation.
- Marks license `status: ACTIVE`.
- Links license to organization and client admin.
- Applies corresponding Tier quotas to the organization.
- **Important**: As noted in the AppSumo guide, incoming `license_status` may still be "inactive" because AppSumo only marks it active after receiving HTTP 200. TaskNera safely activates the license.

### `upgrade`
- Triggered when a customer buys higher tiers.
- AppSumo provides `license_key` (new key) and `prev_license_key` (old key).
- Executes inside a Prisma transaction:
  1. Finds existing organization via `prev_license_key`.
  2. Creates/updates new license key as `status: ACTIVE`.
  3. Marks old license key as `DEACTIVATED` (migrated).
  4. Elevates organization quotas (`maxUsers`, `maxRecruiters`, `maxActiveJobs`, `maxResumesPerMonth`).
  5. Preserves all organization data, candidates, jobs, and evaluations intact.

### `downgrade`
- Follows the same atomic migration as upgrade (`prev_license_key` -> new license key).
- Updates tier and quotas while keeping all customer assets intact.

### `migrate`
- Triggered for add-ons.
- AppSumo passes `license_key`, `parent_license_key`, `partner_plan_name`, `unit_quantity`.
- Updates add-on license relationship without disrupting parent deal limits.

### `deactivate`
- Triggered upon refund, cancellation, or AppSumo staff intervention.
- Marks license `status: DEACTIVATED`.
- If the tenant organization has no other active AppSumo licenses, suspends active platform usage (`status: SUSPENDED`).
- **Data Preservation**: Candidates, jobs, resumes, evaluations, and user accounts are **never deleted**.

---

## 7. Plan / Tier Mapping

Centralized in [backend/src/config/appsumoConfig.ts](file:///c:/Users/Shubham/OneDrive/Desktop/ATS/backend/src/config/appsumoConfig.ts):

| Tier | Plan Name | Team Seats (`maxUsers`) | Recruiters (`maxRecruiters`) | Active Jobs (`maxActiveJobs`) | AI Resumes / Month |
|---|---|---|---|---|---|
| **Tier 1** | AppSumo Tier 1 (Starter LTD) | 5 | 5 | 25 | 1,000 |
| **Tier 2** | AppSumo Tier 2 (Growth LTD) | 15 | 15 | 75 | 3,000 |
| **Tier 3** | AppSumo Tier 3 (Scale LTD) | 50 | 50 | 250 | 10,000 |
| **Tier 4+** | Dynamic Enterprise Scaling | Tier 3 × (Tier - 2) | Tier 3 × (Tier - 2) | Tier 3 × (Tier - 2) | Tier 3 × (Tier - 2) |

---

## 8. AppSumo Partner Portal Setup

Enter the following URLs in your AppSumo Partner Dashboard:

### Production Settings:
- **Webhook URL**:
  ```
  https://api.tasknera.com/v2/webhooks
  ```
  *(or `https://api.tasknera.com/api/v1/appsumo/webhooks`)*

- **OAuth / Redirect URL**:
  ```
  https://api.tasknera.com/v2/redirect-url
  ```
  *(or `https://app.tasknera.com/appsumo/activate`)*

---

## 9. Local Testing with Tunnel (ngrok)

To test webhooks locally from AppSumo or using custom curl commands:

1. **Start backend**:
   ```powershell
   cd backend
   npm run dev
   ```

2. **Start frontend**:
   ```powershell
   cd FrontEnd
   npm run dev
   ```

3. **Expose backend with ngrok**:
   ```bash
   ngrok http 5000
   ```
   Example forward: `https://abc1234.ngrok-free.app`

4. **Set ngrok Webhook URL in AppSumo Partner Portal**:
   ```
   https://abc1234.ngrok-free.app/v2/webhooks
   ```

5. **Run the automated E2E test suite**:
   ```powershell
   cd backend
   npx ts-node src/scripts/testAppSumoE2E.ts
   ```

---

## 10. Super Admin Dashboard

Super Admins can monitor and debug all AppSumo licenses directly from the TaskNera portal:
- Route: `/super-admin`
- Tab: **AppSumo LTD Licenses**
- Features:
  - Real-time search across license keys, emails, organization names
  - Filter by status (`ACTIVE`, `INACTIVE`, `DEACTIVATED`)
  - **Inspect** button: Opens modal displaying complete webhook audit trail and raw payloads
  - **Sync (↻)** button: Reconciles license state directly with AppSumo Licensing API v2

---

## 11. Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| `401 Invalid signature` | `APPSUMO_API_KEY` mismatch or raw body altered | Verify `APPSUMO_API_KEY` in `.env` matches Partner Portal. Ensure reverse proxies do not mutate the raw payload buffer. |
| Duplicate updates | AppSumo resending webhook | The idempotency engine automatically detects duplicate `(licenseKey, event, timestamp)` and returns HTTP 200 without double-updating. |
| License shows `INACTIVE` after purchase | Buyer has not activated yet | Purchase events intentionally record licenses as `INACTIVE` until the buyer visits `/appsumo/activate` or an `activate` webhook is delivered. |
| Rate limit 429 from AppSumo | More than 20 requests/minute | The built-in `AppSumoApiClient` contains a sliding-window rate limiter ensuring TaskNera stays within the 20 requests/minute budget. |
