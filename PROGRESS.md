# PROGRESS.md — Implementation Progress

## Tasks Overview

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | External UPLAN Import — API & Validation | ✅ Completed | externalUplanSchema + POST handler variant |
| 2 | External UPLAN Import — Folder Drag-and-Drop UI | ⬜ Not started | Depends on Task 1 |
| 3 | External UPLAN Import — UI Button State & Display | ⬜ Not started | Depends on Task 2 |
| 4 | Prisma Schema & SQL — Email Verification Fields | ✅ Completed | Added email verification and password reset fields to user model |
| 5 | MailerSend Email Service Library | ✅ Completed | mailersend package + lib/email.ts with 3 email functions |
| 6 | Email Verification Flow — API Routes | ✅ Completed | Signup sends verification email, login checks emailVerified, verify-email + resend-verification routes |
| 7 | Email Verification Flow — Frontend Pages | ⬜ Not started | Depends on Task 6 |
| 8 | Password Reset Flow | ⬜ Not started | Depends on Task 5, 6 |
| 9 | FAS Authorization Email Notifications | ⬜ Not started | Depends on Task 5 |
| 10 | Denial Visualization Map — DenialMapModal | ⬜ Not started | |
| 11 | Denial Visualization — Integration with UI | ⬜ Not started | Depends on Task 10 |
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
