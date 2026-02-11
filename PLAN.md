# PLAN.md — UAS Planner v2: External UPLANs, Email Service, Denial Visualization, Scan Editing & FAS Cancellation

## TL;DR

Five major features to implement on the UAS Planner interface:

1. **External UPLAN Import** — Drag-and-drop `.json` UPLAN files into folders. These plans have no trajectory or `.plan` file; they come pre-built with volumes and scheduling. Buttons for trajectory/waypoint viewing are disabled; geoawareness shows volumes on the map instead of a trajectory.
2. **MailerSend Email Service** — Email verification after signup (link + 6-digit code), password reset flow, and automatic notifications on FAS approval/denial (with UPLAN JSON attached).
3. **Denial Visualization Map** — Replace raw JSON display for denied plans with an interactive map showing user volumes (conflicting ones in red, based on the `volumes` array from FAS response) and conflicting geozones (in red).
4. **Scan Waypoint Editing** — Make scan pattern waypoints editable in the map popup and the left-side menu. Enable dragging scan polygon vertices and takeoff/landing points on the map.
5. **FAS Cancellation on Delete** — When deleting an approved flight plan, send `PUT /uplan_cancelation/{externalResponseNumber}` to the FAS to cancel it.

---

## Architecture & Key Decisions

### Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | External UPLANs stored with `status: 'procesado'`, `fileContent: null`, `csvResult: 0` | No trajectory to process; volumes already exist in the UPLAN JSON |
| D2 | Detect external plans by `fileContent === null` | Avoids adding a new DB column; external plans never have a `.plan` file |
| D3 | MailerSend via `mailersend` npm package | Official SDK, matches the user's MailerSend account |
| D4 | Email verification: link + 6-digit code (both options in the email) | User preference for flexibility |
| D5 | Post-login verification gate | User can login but sees a "Verify your email" screen until verified |
| D6 | Existing users marked as `emailVerified: true` via SQL migration | Backwards compatibility — existing accounts keep working |
| D7 | Denial `volumes` array = conflicting volume indices | Confirmed by user; these are painted red on the denial map |
| D8 | FAS cancellation: `PUT FAS_API_URL_BASE/uplan_cancelation/{externalResponseNumber}`, no body | Confirmed by user |
| D9 | SQL ALTER TABLE commands provided alongside Prisma schema changes | User manages production DB manually |
| D10 | Scan polygon vertices + takeoff/landing draggable on map | User preference |

---

## Feature 1: External UPLAN Import

### Overview

Users can drag a `.json` file (a complete UPLAN) directly onto a folder card. The system validates the JSON structure (must have `operationVolumes`), creates a flight plan record with `status: 'procesado'`, `fileContent: null`, `csvResult: 0`, and stores the UPLAN JSON in the `uplan` field. The `scheduledAt` is extracted from the first volume's `timeBegin`.

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/flight-plans/FolderCard.tsx` | Accept `.json` file drops (distinguish from flight plan card drag via `dataTransfer.files`). Parse JSON, validate UPLAN structure, call new API endpoint |
| `app/api/flightPlans/route.ts` | Add support for `POST` with `{ type: 'external_uplan', uplan: {...}, folderId, customName }`. Validate UPLAN has `operationVolumes`. Store with `fileContent: null`, `status: 'procesado'`, `csvResult: 0` |
| `lib/validators.ts` | Add `externalUplanSchema` Zod validator for the new POST variant |
| `app/components/flight-plans/FlightPlanCard.tsx` | Disable "View Trajectory" button when `fileContent` is null. Disable "View Waypoints" when `fileContent` is null. Tooltip: "No trajectory available (external UPLAN)" |
| `app/components/flight-plans/ActionButtons.tsx` | Adjust `isDownloadEnabled` / trajectory button logic to check `fileContent !== null`. Process button always disabled for external plans |
| `app/components/FlightPlansUploader.tsx` | Skip processing step for external plans (already processed). Allow geoawareness + authorization steps |
| `app/components/flight-plans/GeoawarenessViewer.tsx` | When trajectory is unavailable (`fileContent: null`), render UPLAN volumes as polygons on the map instead of trajectory line. Use same volume polygon rendering as `UplanViewModal` |
| `app/components/UplanViewModal.tsx` | Handle missing `fileContent` gracefully — show volumes only, hide waypoint/trajectory toggle |
| `app/hooks/useFlightPlans.ts` | Add `importExternalUplan(file: File, folderId: number)` method |
| `app/i18n/translations.ts` | Add translation keys for external UPLAN import UI strings |

### Data Flow

```
User drags .json onto FolderCard
  → FolderCard reads file, parses JSON
  → Validates operationVolumes[] exists
  → POST /api/flightPlans { type: 'external_uplan', uplan, folderId, customName: filename }
  → API creates flightPlan record (fileContent=null, status='procesado', csvResult=0, uplan=JSON)
  → UI refreshes via useFlightPlans polling
```

### External Plan Detection

Throughout the UI, external plans are identified by `fileContent === null`:
- **Process button**: disabled (nothing to process)
- **Trajectory view**: disabled (no CSV trajectory)
- **Waypoint preview**: hidden (no QGC plan)
- **Download trajectory**: disabled
- **Geoawareness viewer**: shows volumes instead of trajectory
- **UPLAN viewer**: shows volumes, hides trajectory/waypoint toggles
- **Authorization**: available (UPLAN already complete with volumes)

---

## Feature 2: Email Service (MailerSend)

### Overview

Integrate MailerSend for: (a) email verification after signup, (b) password reset, (c) FAS result notifications with UPLAN attachment.

### Prisma Schema Changes

Add to `user` model:
- `emailVerified Boolean @default(false)`
- `verificationToken String? @db.VarChar(255)`
- `verificationCode String? @db.VarChar(6)`
- `verificationTokenExpiry DateTime?`
- `passwordResetToken String? @db.VarChar(255)`
- `passwordResetTokenExpiry DateTime?`

### SQL Migration Commands

```sql
ALTER TABLE `user`
  ADD COLUMN `emailVerified` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `verificationToken` VARCHAR(255) NULL,
  ADD COLUMN `verificationCode` VARCHAR(6) NULL,
  ADD COLUMN `verificationTokenExpiry` DATETIME(3) NULL,
  ADD COLUMN `passwordResetToken` VARCHAR(255) NULL,
  ADD COLUMN `passwordResetTokenExpiry` DATETIME(3) NULL;

-- Mark all existing users as verified
UPDATE `user` SET `emailVerified` = 1;
```

### Files to Create

| File | Purpose |
|------|---------|
| `lib/email.ts` | MailerSend service: `sendVerificationEmail(to, token, code)`, `sendPasswordResetEmail(to, token)`, `sendAuthorizationResultEmail(to, planName, status, message, uplanJson)`. Uses `MAILSENDER_API_KEY` env var |
| `app/api/auth/verify-email/route.ts` | `POST { token }` or `POST { code, email }` — verifies token/code, sets `emailVerified: true`, clears token fields |
| `app/api/auth/forgot-password/route.ts` | `POST { email }` — generates reset token (crypto.randomBytes), stores hashed, sends email. Always returns 200 (no email enumeration) |
| `app/api/auth/reset-password/route.ts` | `POST { token, newPassword }` — validates token + expiry, hashes new password, clears token |
| `app/api/auth/resend-verification/route.ts` | `POST { email }` — regenerates verification token/code, resends email |
| `app/verify-email/page.tsx` | Verification page: code input (6 digits) + auto-verify from URL token |
| `app/forgot-password/page.tsx` | Email input form for password reset request |
| `app/reset-password/page.tsx` | New password form (token from URL query param) |

### Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 6 new fields to `user` model |
| `.env.example` | Add `MAILSENDER_API_KEY=your_mailersend_api_key_here` |
| `app/api/auth/signup/route.ts` | After creating user: generate verification token + code, store with 24h expiry, send verification email |
| `app/api/auth/login/route.ts` | After successful password check: if `!emailVerified`, return `{ requiresVerification: true, email }` |
| `app/login/page.tsx` | Add "Forgot password?" link. Handle `requiresVerification` response |
| `app/api/fas/[externalResponseNumber]/route.ts` | After updating authorization: send notification email with UPLAN attached |
| `app/hooks/useAuth.ts` | Handle `requiresVerification` in login response |
| `app/i18n/translations.ts` | Add translation keys for all email/verification/reset UI strings |
| `lib/validators.ts` | Add Zod schemas for verify-email, forgot-password, reset-password |

### Auth Flow Changes

```
Signup → Create user (emailVerified=false) → Send verification email
  → User clicks link OR enters code → emailVerified=true

Login → Check password → Check emailVerified
  → If false: return requiresVerification, redirect to /verify-email
  → If true: return tokens (normal flow)

Forgot Password → Enter email → Send reset email → Click link → New password form
```

---

## Feature 3: Denial Visualization Map

### Overview

When a plan is denied by the FAS, instead of showing raw JSON, open an interactive Leaflet map that displays:
- All user UPLAN volumes as polygons (non-conflicting in default purple/gray)
- Conflicting volumes (indices in the `volumes` array from FAS response) in **red**
- Conflicting geozones (from `geozones_information.conflicting_geozones`) in **red** with info popups

### FAS Denial Response Format

```json
{
  "volumes": [0, 1, 2, ...],
  "geozones_information": {
    "number_conflicting_geozones": 1,
    "conflicting_geozones": [{
      "id": "CIUDAD DE LAS ARTES",
      "type": "REQ_AUTHORIZATION",
      "conflict": true,
      "info": "Authorization required..."
    }]
  }
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `app/components/flight-plans/DenialMapModal.tsx` | New Leaflet map modal. Renders all UPLAN volumes (conflicting in red, rest gray). Conflicting geozones in red with popups. Legend. Zoom to fit |

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/flight-plans/FlightPlanCard.tsx` | When denied → click icon opens `DenialMapModal` |
| `app/components/flight-plans/AuthorizationPanel.tsx` | Add "View on Map" for denied plans |
| `app/components/FlightPlansUploader.tsx` | Handle denial viewing via DenialMapModal |
| `app/i18n/translations.ts` | Add denial map translation keys |

### Geozone Polygon Resolution

The FAS response `conflicting_geozones` includes `id`, `type`, `conflict`, `info` — NOT polygon geometry. To render geozones on the map:
- Use geoawareness data stored with the plan (if available) to get geozone geometries
- Match geozone features by `id` field against `conflicting_geozones[].id`
- If geometry not available, show as info markers only

---

## Feature 4: Scan Waypoint Editing & Dragging

### Overview

Make waypoint fields editable in the map popup for both SCAN and MANUAL modes. In SCAN mode, make lat/lng fields editable in the left-side corner list. Enable dragging of scan polygon vertices and takeoff/landing points on the map.

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/PlanGenerator.tsx` | Editable popup fields for SCAN + MANUAL. SCAN marker dragging. Draggable indices computation |
| `app/components/plan-generator/ScanPatternGeneratorV2.tsx` | Editable corner lat/lng inputs in left menu. Vertex update callbacks |
| `app/components/PlanMap.tsx` | Support draggable markers with `onMarkerDragEnd` callback |

### Interaction Details

**Map Popup (SCAN + MANUAL)**: Click waypoint → popup with editable inputs (lat, lng, altitude, speed, pauseDuration, flyOverMode)

**Scan Corner Editing (left menu)**: Editable lat/lng inputs per polygon vertex → update polygon + regenerate scan

**Map Dragging (SCAN)**: Polygon vertices + takeoff/landing = draggable. Generated scan waypoints = NOT draggable.

---

## Feature 5: FAS Cancellation on Delete

### Overview

When deleting a flight plan with `authorizationStatus: 'aprobado'`, send `PUT` to `FAS_BASE_URL/uplan_cancelation/{externalResponseNumber}` first.

### Files to Modify

| File | Changes |
|------|---------|
| `app/api/flightPlans/[id]/route.ts` | In DELETE: check approved → PUT to FAS → proceed with delete |
| `app/api/flightPlans/route.ts` | In bulk DELETE: send cancellations for approved plans via Promise.allSettled |

### FAS URL Derivation

```
FAS_API_URL = "http://158.42.167.56:8000/uplan"
FAS_BASE_URL = "http://158.42.167.56:8000"  // strip /uplan
Cancellation URL = FAS_BASE_URL + "/uplan_cancelation/" + externalResponseNumber
```
