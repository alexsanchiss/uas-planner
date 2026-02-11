# PROGRESS.md — Implementation Progress

## Tasks Overview

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | External UPLAN Import — API & Validation | ✅ Completed | externalUplanSchema + POST handler variant |
| 2 | External UPLAN Import — Folder Drag-and-Drop UI | ⬜ Not started | Depends on Task 1 |
| 3 | External UPLAN Import — UI Button State & Display | ⬜ Not started | Depends on Task 2 |
| 4 | Prisma Schema & SQL — Email Verification Fields | ⬜ Not started | |
| 5 | MailerSend Email Service Library | ⬜ Not started | Depends on Task 4 |
| 6 | Email Verification Flow — API Routes | ⬜ Not started | Depends on Task 4, 5 |
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

### Task 1 — External UPLAN Import — API & Validation
- Added `externalUplanSchema` to `lib/validators.ts` — validates `type: 'external_uplan'`, `operationVolumes[]` (min 1), `folderId`, `customName`
- Modified `app/api/flightPlans/route.ts` POST handler to detect `type: 'external_uplan'` requests
- Creates flight plan with `fileContent: null`, `status: 'procesado'`, `csvResult: 0`, `authorizationStatus: 'sin autorización'`
- Extracts `scheduledAt` from first volume's `timeBegin`
- Added comprehensive tests for the new schema in `lib/__tests__/validators.test.ts`
