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
| `lib/email.ts` | MailerSend service: `sendVerificationEmail(to, token, code)`, `sendPasswordResetEmail(to, token)`, `sendAuthorizationResultEmail(to, planName, status, message, uplanJson)`. Uses `MAILSENDER_API_KEY` env var. Configures sender domain from MailerSend account |
| `app/api/auth/verify-email/route.ts` | `POST { token }` or `POST { code, email }` — verifies token/code, sets `emailVerified: true`, clears token fields |
| `app/api/auth/forgot-password/route.ts` | `POST { email }` — generates reset token (crypto.randomBytes), stores hashed, sends email. Always returns 200 (no email enumeration) |
| `app/api/auth/reset-password/route.ts` | `POST { token, newPassword }` — validates token + expiry, hashes new password, clears token |
| `app/api/auth/resend-verification/route.ts` | `POST { email }` — regenerates verification token/code, resends email |
| `app/verify-email/page.tsx` | Verification page: code input (6 digits) + auto-verify from URL token. Shows success/error states |
| `app/forgot-password/page.tsx` | Email input form for password reset request |
| `app/reset-password/page.tsx` | New password form (token from URL query param) |

### Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 6 new fields to `user` model |
| `.env.example` | Add `MAILSENDER_API_KEY=your_mailersend_api_key_here` |
| `app/api/auth/signup/route.ts` | After creating user: generate verification token (crypto.randomUUID) + 6-digit code, store with 24h expiry, send verification email |
| `app/api/auth/login/route.ts` | After successful password check: if `!emailVerified`, return `{ requiresVerification: true, email }` instead of tokens. Client redirects to verification page |
| `app/login/page.tsx` | Add "Forgot password?" link. Handle `requiresVerification` response → redirect to `/verify-email?email=...`. Add resend verification option |
| `app/api/fas/[externalResponseNumber]/route.ts` | After updating authorization status: look up user email via flightPlan→userId, send notification email with UPLAN JSON attached. Use `sendAuthorizationResultEmail()` |
| `app/hooks/useAuth.ts` | Handle `requiresVerification` in login response |
| `app/i18n/translations.ts` | Add translation keys for email verification, password reset, notification emails |
| `lib/validators.ts` | Add Zod schemas: `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema` |

### Email Templates

1. **Verification Email**: Subject: "Verify your UAS Planner account". Body: "Click the link below to verify your account: {link}. Or enter this code: {code}. Valid for 24 hours."
2. **Password Reset**: Subject: "Reset your UAS Planner password". Body: "Click the link to reset: {link}. Valid for 1 hour. Ignore if you didn't request this."
3. **Authorization Result**: Subject: "Your flight plan {name} has been {approved/denied}". Body: "{approval/denial message}. Check UPPS for more information." Attachment: `uplan.json`

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
| `app/components/flight-plans/DenialMapModal.tsx` | New Leaflet map modal. Renders: (1) all UPLAN `operationVolumes` — conflicting indices in red, rest in gray/purple; (2) conflicting geozones as red polygons with info popups. Legend explaining colors. Parses `authorizationMessage` JSON for `volumes` and `geozones_information` |

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/flight-plans/FlightPlanCard.tsx` | When clicking denial authorization icon, open `DenialMapModal` instead of raw JSON viewer |
| `app/components/flight-plans/AuthorizationPanel.tsx` | Add "View on Map" button for denied plans that opens `DenialMapModal`. Keep raw JSON as secondary option |
| `app/components/FlightPlansUploader.tsx` | Handle denial result viewing: instead of just showing message, open DenialMapModal |
| `app/i18n/translations.ts` | Add keys for denial map: legend labels, popup content, button labels |

### Geozone Polygon Resolution

The FAS response `conflicting_geozones` only includes `id`, `type`, `conflict`, `info` — NOT the polygon geometry. To render geozones on the map:
- Option A: Use the geoawareness WebSocket to fetch geozone geometries by the plan's `geoawarenessData.uspace_identifier`, then match by geozone `id`.
- Option B: Use the static geozones file at `lib/geozones/geozones_static_NEW.json` to find matching geozone polygons.
- **Recommended**: Use geoawareness data already stored with the plan (if available) or fetch via HTTP fallback. Match geozone features by `id` field against `conflicting_geozones[].id`.

---

## Feature 4: Scan Waypoint Editing & Dragging

### Overview

Make waypoint fields editable in the map popup for both SCAN and MANUAL modes. In SCAN mode, make the lat/lng fields editable in the left-side corner list. Enable dragging of scan polygon vertices and takeoff/landing points on the map.

### Files to Modify

| File | Changes |
|------|---------|
| `app/components/PlanGenerator.tsx` | **Map popup editing**: Currently shows read-only waypoint info on click. Make all fields (lat, lng, altitude, speed, pauseDuration, flyOverMode) editable in the popup for both SCAN and MANUAL modes. Use inline number inputs with validation. On change, update waypoint state and regenerate scan pattern if in SCAN mode. **SCAN marker dragging**: Add `draggable: true` to SCAN waypoint markers. On `dragend`, update polygon vertex / takeoff / landing position and regenerate scan pattern |
| `app/components/plan-generator/ScanPatternGeneratorV2.tsx` | **Editable corner inputs**: In the left-side polygon vertex list, make lat/lng fields into editable number inputs (currently display-only text). On change, update polygon vertex and regenerate scan preview. Validate that new coordinates are within service area bounds. Add `onVertexDrag` callback prop for map drag events |
| `app/components/PlanMap.tsx` | Support `draggable` prop on waypoint markers. Add `onMarkerDragEnd(index, newLatLng)` callback. Differentiate scan vertices vs generated waypoints (only vertices + takeoff/landing are draggable) |

### Interaction Details

**Map Popup (SCAN + MANUAL)**:
- Click waypoint marker → popup opens with editable fields
- Each field is an inline input: lat (number, 6 decimals), lng (number, 6 decimals), altitude (0-200m), speed (1-30 m/s), pauseDuration (0-3600s), flyOverMode (toggle)
- Changes apply immediately to state; SCAN mode regenerates the pattern

**Scan Corner Editing (left menu)**:
- Each polygon vertex row shows editable lat/lng inputs
- On change: validate within service area, update polygon, regenerate scan

**Map Dragging (SCAN mode)**:
- Polygon vertices: draggable markers, on dragend update polygon + regenerate scan
- Takeoff/landing markers: draggable, on dragend update position
- Generated scan waypoints: NOT draggable (they're computed from the polygon)

---

## Feature 5: FAS Cancellation on Delete

### Overview

When deleting a flight plan that has `authorizationStatus: 'aprobado'`, send a `PUT` request to `FAS_API_URL_BASE/uplan_cancelation/{externalResponseNumber}` before deleting from the database. The FAS URL base is derived from `FAS_API_URL` (strip `/uplan` suffix).

### Files to Modify

| File | Changes |
|------|---------|
| `app/api/flightPlans/[id]/route.ts` | In `DELETE`: before deleting, check `authorizationStatus === 'aprobado'`. If so, `PUT` to `${FAS_BASE_URL}/uplan_cancelation/${externalResponseNumber}` (no body). Log result but don't block deletion on FAS error (fire-and-forget with warning log). Then proceed with existing delete transaction |
| `app/api/flightPlans/route.ts` | In bulk `DELETE`: for each approved plan in the batch, send FAS cancellation `PUT`. Collect approved plans, send cancellations in parallel (Promise.allSettled), then proceed with bulk delete |

### FAS URL Derivation

```
FAS_API_URL = "http://158.42.167.56:8000/uplan"
FAS_BASE_URL = "http://158.42.167.56:8000"  // strip /uplan
Cancellation URL = FAS_BASE_URL + "/uplan_cancelation/" + externalResponseNumber
```

---

## Verification

### Automated Tests
- `jest` test suite passes (`npm test`)
- `npm run build` succeeds (no TypeScript errors)
- `npm run lint` passes

### Manual Testing Checklist
1. **External UPLAN**: Drag `.json` to folder → appears as procesado → volumes viewable → trajectory buttons disabled → geoawareness shows volumes on map → can authorize
2. **Email Verification**: Signup → receive email → click link OR enter code → can use app. Old users: auto-verified
3. **Password Reset**: "Forgot password" → receive email → click link → set new password → login works
4. **FAS Email Notification**: When FAS approves/denies → user receives email with UPLAN attached
5. **Denial Map**: Denied plan → click view → map shows volumes (red = conflicting) + geozones (red = conflicting)
6. **Scan Editing**: Click scan waypoint on map → popup with editable fields. Edit corner lat/lng in left menu → pattern regenerates. Drag polygon vertices → pattern regenerates. Drag takeoff/landing → position updates
7. **FAS Cancellation**: Delete approved plan → PUT sent to FAS → plan deleted from DB

### SQL Verification
```sql
-- Verify new columns exist
DESCRIBE `user`;
-- Verify existing users are marked as verified
SELECT id, email, emailVerified FROM `user`;
```
