# TASKS.md — Implementation Tasks

## Task 1: External UPLAN Import — API & Validation
**Priority**: High  
**Depends on**: None  
**Files**:
- `lib/validators.ts` — Add `externalUplanSchema` Zod schema validating `operationVolumes[]` exists, `folderId` is number, `customName` is string
- `app/api/flightPlans/route.ts` — In POST handler, detect `type: 'external_uplan'` body variant. Validate with new schema. Create flightPlan with `fileContent: null`, `status: 'procesado'`, `csvResult: 0`, `authorizationStatus: 'sin autorización'`, `uplan: JSON.stringify(body.uplan)`. Extract `scheduledAt` from first volume's `timeBegin`

**Acceptance**: POST `/api/flightPlans` with `{ type: 'external_uplan', uplan: {...}, folderId: 1, customName: 'test.json' }` creates a flight plan with correct fields. Invalid UPLAN (no operationVolumes) returns 400.

---

## Task 2: External UPLAN Import — Folder Drag-and-Drop UI
**Priority**: High  
**Depends on**: Task 1  
**Files**:
- `app/components/flight-plans/FolderCard.tsx` — Differentiate between flight plan card drag (`dataTransfer` has `FLIGHT_PLAN_DRAG_TYPE` text data) and file drag (`dataTransfer.files` has items). For file drops: accept only `.json`, read file content (FileReader), parse JSON, validate has `operationVolumes`, call POST API with `type: 'external_uplan'`. Show toast on success/error. Visual feedback: different drop zone style for file drops
- `app/hooks/useFlightPlans.ts` — Add `importExternalUplan(uplan: object, folderId: number, customName: string)` that POSTs to the API
- `app/i18n/translations.ts` — Add: `externalUplanImport`, `externalUplanSuccess`, `externalUplanError`, `externalUplanInvalidFormat`, `dropUplanHere`, `noTrajectoryAvailable`

**Acceptance**: User drags a .json UPLAN file onto a folder → file is uploaded → plan appears in folder with status procesado.

---

## Task 3: External UPLAN Import — UI Button State & Display Adjustments
**Priority**: High  
**Depends on**: Task 2  
**Files**:
- `app/components/flight-plans/FlightPlanCard.tsx` — Check `fileContent` null: disable trajectory view icon button (tooltip: "No trajectory available"), disable waypoint preview click, hide waypoint mini-preview. Process button disabled for external plans (no trajectory to process). Download trajectory button disabled
- `app/components/flight-plans/ActionButtons.tsx` — Adjust enable conditions: `isDownloadEnabled` requires `fileContent !== null`, `isProcessEnabled` requires `fileContent !== null`
- `app/components/UplanViewModal.tsx` — Handle `fileContent` being undefined/null: hide trajectory polyline and waypoint markers, only show volumes. Hide "Show Waypoints" toggle
- `app/components/flight-plans/GeoawarenessViewer.tsx` — When no trajectory data available (CSV fetch returns empty/error because no csvResult): render UPLAN operation volumes as blue/purple polygons on the map instead. Reuse polygon rendering logic from UplanViewModal
- `app/components/FlightPlansUploader.tsx` — For plans with `fileContent === null`: skip Step 2 (DateTime — use extracted scheduledAt), skip Step 3 (Process — already procesado). Show Steps 4 (Geoawareness) and 5 (Authorize) as available

**Acceptance**: External UPLAN plan card shows disabled trajectory/waypoint buttons. UPLAN viewer shows volumes only. Geoawareness viewer shows volumes on map. Workflow skips processing steps.

---

## Task 4: Prisma Schema & SQL — Email Verification Fields
**Priority**: High  
**Depends on**: None  
**Files**:
- `prisma/schema.prisma` — Add to `user` model: `emailVerified Boolean @default(false)`, `verificationToken String? @db.VarChar(255)`, `verificationCode String? @db.VarChar(6)`, `verificationTokenExpiry DateTime?`, `passwordResetToken String? @db.VarChar(255)`, `passwordResetTokenExpiry DateTime?`
- `.env.example` — Add `MAILSENDER_API_KEY=your_mailersend_api_key_here`

**SQL Commands for production DB**:
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

**Acceptance**: Prisma schema validates. SQL commands documented. `.env.example` updated.

---

## Task 5: MailerSend Email Service Library
**Priority**: High  
**Depends on**: Task 4  
**Files**:
- Install `mailersend` npm package
- `lib/email.ts` — Create MailerSend service with functions:
  - `sendVerificationEmail(to: string, token: string, code: string)` — Sends email with verification link (`{APP_URL}/verify-email?token={token}`) and 6-digit code
  - `sendPasswordResetEmail(to: string, token: string)` — Sends email with reset link (`{APP_URL}/reset-password?token={token}`). Valid 1 hour
  - `sendAuthorizationResultEmail(to: string, planName: string, status: 'aprobado'|'denegado', message: string, uplanJson: string)` — Sends notification with UPLAN JSON as attachment (Buffer → base64)
  - Uses `MAILSENDER_API_KEY` env var. Graceful error handling (log but don't throw for notification emails)

**Acceptance**: Email service exports 3 functions. Handles missing API key gracefully.

---

## Task 6: Email Verification Flow — API Routes
**Priority**: High  
**Depends on**: Task 4, Task 5  
**Files**:
- `app/api/auth/signup/route.ts` — After creating user: generate `crypto.randomUUID()` as token, random 6-digit code, store with 24h expiry, call `sendVerificationEmail()`. Set `emailVerified: false`
- `app/api/auth/verify-email/route.ts` — New POST route. Accepts `{ token }` or `{ email, code }`. Validates token/code exists and not expired. Sets `emailVerified: true`, clears verification fields
- `app/api/auth/resend-verification/route.ts` — New POST route. Accepts `{ email }`. Regenerates token + code, resends email. Rate limit: 1 per minute
- `app/api/auth/login/route.ts` — After password validation: check `emailVerified`. If false, return `{ requiresVerification: true, email }` with 200 status
- `lib/validators.ts` — Add `verifyEmailSchema`, `resendVerificationSchema`

**Acceptance**: Signup sends verification email. Login returns requiresVerification for unverified users. Verify-email route works with both token and code. Resend works with rate limiting.

---

## Task 7: Email Verification Flow — Frontend Pages
**Priority**: High  
**Depends on**: Task 6  
**Files**:
- `app/verify-email/page.tsx` — New page. If URL has `?token=...`, auto-verify on mount. Otherwise show 6-digit code input form with email field. Success/error states. "Resend code" button
- `app/login/page.tsx` — Add "¿Olvidaste tu contraseña?" / "Forgot password?" link. Handle `requiresVerification` response → redirect to `/verify-email?email=...`
- `app/hooks/useAuth.ts` — Handle `requiresVerification` in `login()` method
- `app/i18n/translations.ts` — Add verification translation keys

**Acceptance**: After signup, user redirected to verify page. Code entry works. Link click works. Login redirects unverified users.

---

## Task 8: Password Reset Flow
**Priority**: Medium  
**Depends on**: Task 5, Task 6  
**Files**:
- `app/api/auth/forgot-password/route.ts` — New POST route. Accepts `{ email }`. Generate token, store hashed with 1h expiry. Send reset email. Always return 200
- `app/api/auth/reset-password/route.ts` — New POST route. Accepts `{ token, newPassword }`. Validate token + expiry, hash new password, clear reset fields
- `app/forgot-password/page.tsx` — Email input form → POST → show "Check your email" message
- `app/reset-password/page.tsx` — New password + confirm form → POST → success → redirect to login
- `lib/validators.ts` — Add `forgotPasswordSchema`, `resetPasswordSchema`
- `app/i18n/translations.ts` — Add password reset translation keys

**Acceptance**: "Forgot password" → receive email → click link → enter new password → login works.

---

## Task 9: FAS Authorization Email Notifications
**Priority**: Medium  
**Depends on**: Task 5  
**Files**:
- `app/api/fas/[externalResponseNumber]/route.ts` — After updating authorization status: fetch user email via flightPlan→userId→user.email. Fetch plan's uplan. Call `sendAuthorizationResultEmail()`. Wrap in try/catch (fire-and-forget)

**Acceptance**: FAS callback → user receives email with status and UPLAN attachment. FAS callback returns 200 even if email fails.

---

## Task 10: Denial Visualization Map — DenialMapModal Component
**Priority**: High  
**Depends on**: None  
**Files**:
- `app/components/flight-plans/DenialMapModal.tsx` — New Leaflet map modal. Props: `{ open, onClose, uplan, authorizationMessage, geoawarenessData? }`. Parse authorizationMessage JSON for `volumes[]` and `geozones_information.conflicting_geozones[]`. Render:
  1. All UPLAN operationVolumes → gray/purple for ok, red for conflicting indices
  2. Conflicting geozones → red polygons with popups (id, type, info)
  3. Legend explaining colors
  4. Zoom to fit all polygons
- For geozone polygons: match by id in stored geoawareness data or fetch from service

**Acceptance**: Modal shows volumes with conflicting ones in red. Conflicting geozones in red. Legend. Popups with details.

---

## Task 11: Denial Visualization — Integration with Existing UI
**Priority**: High  
**Depends on**: Task 10  
**Files**:
- `app/components/flight-plans/FlightPlanCard.tsx` — When denied + click icon → open DenialMapModal
- `app/components/flight-plans/AuthorizationPanel.tsx` — Add "View denial on map" button for denied plans. Keep raw JSON as secondary option
- `app/components/FlightPlansUploader.tsx` — When viewing denied plan result → open DenialMapModal
- `app/i18n/translations.ts` — Add denial map keys

**Acceptance**: Denied plan → click icon → DenialMapModal with correct highlights. Raw JSON still accessible.

---

## Task 12: Scan Waypoint Editing — Editable Fields in Map Popup
**Priority**: Medium  
**Depends on**: None  
**Files**:
- `app/components/PlanGenerator.tsx` — Modify map click popup: replace display text with inline `<input>` fields for lat, lng, altitude, speed, pauseDuration, flyOverMode for BOTH scan and manual modes. On change: validate + update waypoint state. For SCAN: regenerate pattern if vertex position changes

**Acceptance**: Click waypoint on map → popup with editable inputs → change value → waypoint updates. Works for SCAN and MANUAL.

---

## Task 13: Scan Pattern — Editable Corner Coordinates in Left Menu
**Priority**: Medium  
**Depends on**: None  
**Files**:
- `app/components/plan-generator/ScanPatternGeneratorV2.tsx` — In Step 2 polygon vertex list: replace read-only lat/lng with editable inputs. On change: validate within service area, update polygon, regenerate scan preview. Takeoff/landing lat/lng also editable

**Acceptance**: Edit lat/lng in left menu → polygon updates on map → scan regenerates. Validation works.

---

## Task 14: Scan Pattern — Draggable Markers on Map
**Priority**: Medium  
**Depends on**: Task 13  
**Files**:
- `app/components/PlanMap.tsx` — Accept `draggableIndices: number[]` prop. Add `onMarkerDragEnd(index, newLatLng)` callback. Leaflet `draggable: true` for specified markers
- `app/components/PlanGenerator.tsx` — Compute draggable indices (polygon vertices + takeoff + landing, NOT generated scan waypoints). On drag end: update position + regenerate scan
- `app/components/plan-generator/ScanPatternGeneratorV2.tsx` — Add `onVertexUpdate(index, lat, lng)` callback for external updates from map drag

**Acceptance**: Drag polygon vertex → polygon reshapes → scan regenerates. Drag takeoff/landing → position updates. Generated waypoints NOT draggable.

---

## Task 15: FAS Cancellation on Individual Delete
**Priority**: High  
**Depends on**: None  
**Files**:
- `app/api/flightPlans/[id]/route.ts` — In DELETE: check `authorizationStatus === 'aprobado'` AND `externalResponseNumber` exists. PUT to `${FAS_BASE_URL}/uplan_cancelation/${externalResponseNumber}` (no body). try/catch — log warning on failure, proceed with deletion

**Acceptance**: Delete approved plan → PUT sent to FAS → plan deleted. Delete non-approved → no FAS call.

---

## Task 16: FAS Cancellation on Bulk Delete
**Priority**: Medium  
**Depends on**: Task 15  
**Files**:
- `app/api/flightPlans/route.ts` — In bulk DELETE: filter approved plans with externalResponseNumber. Send FAS cancellation PUTs via Promise.allSettled. Log results. Proceed with delete

**Acceptance**: Bulk delete with approved plans → FAS cancellation for each → all deleted.

---

## Task 17: Translations & i18n for All New Features
**Priority**: Low  
**Depends on**: All other tasks  
**Files**:
- `app/i18n/translations.ts` — Comprehensive pass: all new UI strings have `en` + `es` translations. Cover external UPLAN import, email verification, password reset, denial map, scan editing, FAS cancellation

**Acceptance**: All new UI elements have English and Spanish translations. No hardcoded strings.
