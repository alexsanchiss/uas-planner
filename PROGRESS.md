# PROGRESS.md — Implementation Progress

## Tasks Overview

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | External UPLAN Import — API & Validation | ✅ Completed | externalUplanSchema + POST handler variant |
| 2 | External UPLAN Import — Folder Drag-and-Drop UI | ✅ Completed | FolderCard file drop + importExternalUplan hook + i18n |
| 3 | External UPLAN Import — UI Button State & Display | ✅ Completed | Disabled buttons, volume rendering in geoawareness, workflow adjustments |
| 4 | Prisma Schema & SQL — Email Verification Fields | ✅ Completed | Added email verification and password reset fields to user model |
| 5 | MailerSend Email Service Library | ✅ Completed | mailersend package + lib/email.ts with 3 email functions |
| 6 | Email Verification Flow — API Routes | ✅ Completed | Signup sends verification email, login checks emailVerified, verify-email + resend-verification routes |
| 7 | Email Verification Flow — Frontend Pages | ✅ Completed | verify-email page + login redirect + useAuth requiresVerification handling + i18n |
| 8 | Password Reset Flow | ✅ Completed | forgot-password + reset-password API routes & pages |
| 9 | FAS Authorization Email Notifications | ✅ Completed | Sends email with UPLAN attachment on FAS callback |
| 10 | Denial Visualization Map — DenialMapModal | ✅ Completed | New DenialMapModal component with conflict highlighting |
| 11 | Denial Visualization — Integration with UI | ✅ Completed | DenialMapModal integrated into FlightPlanCard, AuthorizationPanel, and FlightPlansUploader |
| 12 | Scan Waypoint Editing — Editable Map Popup | ⬜ Not started | |
| 13 | Scan Pattern — Editable Corner Coordinates | ⬜ Not started | |
| 14 | Scan Pattern — Draggable Markers on Map | ⬜ Not started | Depends on Task 13 |
| 15 | FAS Cancellation on Individual Delete | ✅ Completed | FAS PUT cancellation sent before deleting approved plans |
| 16 | FAS Cancellation on Bulk Delete | ✅ Completed | FAS cancellation sent for each approved plan in bulk delete |
| 17 | Translations & i18n for All Features | ⬜ Not started | Depends on all |

## Dependency Graph

```
Task 1 → Task 2 → Task 3
Task 4 → Task 5 → Task 6 → Task 7
              ↘ Task 9     ↘ Task 8
Task 10 → Task 11
Task 13 → Task 14
Task 15 → Task 16
Task 12 (independent)
All → Task 17
```

## Completed Tasks Log

_(Updated by subagent after each task completion)_

### Task 15 — FAS Cancellation on Individual Delete
- Modified `app/api/flightPlans/[id]/route.ts`
- DELETE handler now sends `PUT /uplan_cancelation/{externalResponseNumber}` to FAS before deleting approved plans
- Cancellation is fire-and-forget: failures are logged but do not block deletion
- FAS base URL derived from `FAS_API_URL` env var

### Task 16 — FAS Cancellation on Bulk Delete
- Modified `app/api/flightPlans/route.ts`
- Bulk DELETE handler now filters approved plans with `externalResponseNumber` and sends FAS cancellation PUTs via `Promise.allSettled`
- Cancellation results are logged (warnings for failures) but do not block deletion
- Reuses same `getFasBaseUrl()` / `sendFasCancellation()` pattern from Task 15

### Task 4 — Prisma Schema & SQL — Email Verification Fields
- Added `emailVerified`, `verificationToken`, `verificationCode`, `verificationTokenExpiry`, `passwordResetToken`, `passwordResetTokenExpiry` fields to `user` model in Prisma schema
- Updated `.env.example` with `MAILERSEND_API_KEY` variable
- SQL migration commands documented in TASKS.md

### Task 1 — External UPLAN Import — API & Validation

### Task 5 — MailerSend Email Service Library
- Installed `mailersend` npm package
- Created `lib/email.ts` with three email functions:
  - `sendVerificationEmail(to, token, code)` — sends verification link + 6-digit code
  - `sendPasswordResetEmail(to, token)` — sends password reset link (1 hour validity)
  - `sendAuthorizationResultEmail(to, planName, status, message, uplanJson)` — sends authorization result with UPLAN JSON attachment
- Graceful error handling: logs errors but never throws (fire-and-forget for notifications)
- Handles missing/placeholder `MAILERSEND_API_KEY` gracefully
- Added 8 tests in `lib/__tests__/email.test.ts`

### Task 6 — Email Verification Flow — API Routes
- Modified `app/api/auth/signup/route.ts` — generates UUID token + 6-digit code with 24h expiry, sends verification email on signup
- Modified `app/api/auth/login/route.ts` — checks `emailVerified` after password validation; returns `{ requiresVerification: true, email }` for unverified users
- Created `app/api/auth/verify-email/route.ts` — POST route accepting `{ token }` or `{ email, code }`; validates token/code not expired, sets `emailVerified: true`, clears verification fields
- Created `app/api/auth/resend-verification/route.ts` — POST route accepting `{ email }`; regenerates token + code, resends email; rate limited to 1 per minute
- Added `verifyEmailSchema` and `resendVerificationSchema` to `lib/validators.ts`

### Task 10 — Denial Visualization Map — DenialMapModal
- Created `app/components/flight-plans/DenialMapModal.tsx` — Leaflet map modal that parses FAS denial authorizationMessage JSON
- Renders all UPLAN operationVolumes: gray/dashed for OK, red/solid for conflicting indices
- Renders conflicting geozones as red dashed polygons with popups (identifier, name, type)
- Includes color-coded legend, summary banner with conflict count, and scrollable geozone detail list
- Auto-fits map bounds to all displayed polygons
- Exported from barrel file `app/components/flight-plans/index.ts`
- Added denial map i18n keys (en + es) to `app/i18n/translations.ts`

### Task 11 — Denial Visualization — Integration with Existing UI

### Task 2 — External UPLAN Import — Folder Drag-and-Drop UI
- Modified `app/components/flight-plans/FolderCard.tsx` — Differentiates between flight plan card drag (`FLIGHT_PLAN_DRAG_TYPE`) and external file drag (`Files`). For file drops: accepts only `.json`, reads file content, parses JSON, validates `operationVolumes`, calls import handler. Green drop zone visual for file drops (vs blue for plan drags)
- Modified `app/hooks/useFlightPlans.ts` — Added `importExternalUplan(uplan, folderId, customName)` function that POSTs to `/api/flightPlans` with `type: 'external_uplan'`
- Modified `app/i18n/translations.ts` — Added `externalUplanImport`, `externalUplanSuccess`, `externalUplanError`, `externalUplanInvalidFormat`, `dropUplanHere`, `noTrajectoryAvailable` keys (en + es)
- Modified `app/components/flight-plans/FolderList.tsx` — Passes through `onImportExternalUplan` prop to FolderCard
- Modified `app/components/FlightPlansUploader.tsx` — Wired `handleImportExternalUplan` handler with toast notifications
- Modified `app/components/FlightPlansUploader.tsx` — denied plan icon/button click now opens DenialMapModal directly; raw JSON still accessible via button in authorization message modal footer
- Modified `app/components/flight-plans/AuthorizationPanel.tsx` — added "View denial on map" button for denied plans, keeping raw JSON as secondary option
- Updated large "View Authorization Details" button for denied plans to show map icon and "View Denial on Map" label
- Added `viewRawJson` and `viewDenialDetails` i18n keys (en + es) to translations

### Task 3 — External UPLAN Import — UI Button State & Display Adjustments

### Task 8 — Password Reset Flow
- Created `app/api/auth/forgot-password/route.ts` — POST route accepts `{ email }`, generates UUID token, stores SHA-256 hash with 1h expiry, sends reset email via MailerSend, always returns 200 (no email enumeration)
- Created `app/api/auth/reset-password/route.ts` — POST route accepts `{ token, newPassword }`, hashes incoming token to look up user, validates expiry, hashes new password with bcrypt, clears reset fields
- Created `app/forgot-password/page.tsx` — Email input form that POSTs to forgot-password API, shows "check your email" confirmation
- Created `app/reset-password/page.tsx` — New password + confirm password form with token from URL query param, client-side match validation, redirects to login on success
- Added `forgotPasswordSchema` and `resetPasswordSchema` to `lib/validators.ts`
- Added 15 password reset i18n keys (en + es) to `app/i18n/translations.ts`

### Task 7 — Email Verification Flow — Frontend Pages
- Created `app/verify-email/page.tsx` — New page with two modes: auto-verify via URL `?token=...` on mount, or manual 6-digit code entry form with email field. Shows verifying/success/error states. "Resend verification code" button with rate-limit feedback. "Back to Login" link
- Modified `app/login/page.tsx` — After signup, redirects to `/verify-email?email=...` instead of switching to login form. Login now handles `requiresVerification` response by redirecting to verify page. Added "Forgot password?" link below submit button
- Modified `app/hooks/useAuth.ts` — `login()` return type updated to `boolean | { requiresVerification: true; email: string }`. Detects unverified-user API response and returns structured object instead of storing empty token
- Modified `app/components/auth/auth-provider.tsx` — Updated `AuthContextType` interface to match new `login()` return type
- Added 13 email verification i18n keys (en + es) to `app/i18n/translations.ts`: verifyEmail, verifyYourEmail, enterVerificationCode, verificationCodePlaceholder, verifying, emailVerified, emailVerifiedSuccess, verificationFailed, verificationLinkExpired, resendCode, resending, codeSent, backToLogin, goToLogin, enterCodeManually

### Task 9 — FAS Authorization Email Notifications
- Modified `app/api/fas/[externalResponseNumber]/route.ts` — After updating authorization status, fetches user email via flightPlan.userId → user.email, then calls `sendAuthorizationResultEmail()` with plan name, status, message, and UPLAN JSON
- Email notification is fire-and-forget: wrapped in try/catch, failures are logged but never block the FAS 200 response
- Uses existing `sendAuthorizationResultEmail` from `lib/email.ts` which attaches the UPLAN JSON as a file
- Modified `app/components/flight-plans/FlightPlanCard.tsx` — Process and Download buttons now require `fileContent` to be enabled; new tooltips ("No trajectory to process", "No trajectory available") for external plans; waypoint mini-preview already hidden when no fileContent
- Modified `app/components/flight-plans/GeoawarenessViewer.tsx` — When no trajectory data (no csvResult), renders UPLAN operation volumes as purple polygons on map with time/altitude tooltips; updated bounds calculation to include volumes; added legend entry for operation volumes
- Modified `app/components/FlightPlansUploader.tsx` — "View U-Plan Map" button enabled for external plans with uplan data (not just fileContent); workflow steps already correctly skip datetime/process for external plans
