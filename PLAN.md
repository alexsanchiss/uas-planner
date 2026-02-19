# UAS Planner — Feature Implementation Plan

## Overview

This plan covers 13 features spanning authentication fixes, UX improvements, new capabilities (Cesium 3D viewer, user profile), and regulatory compliance.

---

## Feature 1: Remove Email Domain Validation on Signup

**Problem:** Corporate email domains with non-standard DNS (proxied MX, internal relays) fail the `validateEmailDomain()` DNS MX lookup, blocking legitimate users.

**Solution:** Remove the `validateEmailDomain()` call from the signup API route. Keep Zod email format validation.

**Files to modify:**
- `app/api/auth/signup/route.ts` — Remove `validateEmailDomain(email)` call and 400 response block
- `lib/validators.ts` — Remove `validateEmailDomain` function and `dns` import

---

## Feature 2: Fix Verification Code Expiry & Reduce to 3 Minutes

**Problem:** Verification codes expire in 24h (too long). Need 3-minute expiry. Also add safeguard against double-verification.

**Solution:**
1. Change expiry from 24h to 3 minutes in signup and resend-verification routes.
2. Fix rate-limit cooldown messaging in resend-verification.
3. Add `emailVerified: false` safeguard in verify-email findFirst query.
4. Add test coverage.

**Files to modify:**
- `app/api/auth/signup/route.ts`
- `app/api/auth/resend-verification/route.ts`
- `app/api/auth/verify-email/route.ts`
- `lib/__tests__/auth.test.ts`

---

## Feature 3: Prevent Map Zoom-Out During SCAN Phase Transitions

**Problem:** Map remounts on each SCAN step transition because `scanHandlerVersion` is used as `PlanMap` key. Each increment forces Leaflet MapContainer unmount/remount, resetting zoom/pan.

**Solution:** Remove `scanHandlerVersion` from key. Use useRef for customClickHandler in PlanMap so handler updates don't cause remount.

**Files to modify:**
- `app/components/PlanGenerator.tsx`
- `app/components/PlanMap.tsx`

---

## Feature 4: Add OK Button & Enter Key Support for Waypoint Lat/Lon Editing

**Problem:** Lat/lon changes only commit on blur. Need OK button and Enter key support.

**Solution:** Add OK button and onKeyDown Enter handler in EditablePopupContent (PlanMap.tsx) and sidebar inputs (PlanGenerator.tsx).

**Files to modify:**
- `app/components/PlanMap.tsx`
- `app/components/PlanGenerator.tsx`

---

## Feature 5: Add "Add Waypoint" Button to Sidebar

**Problem:** Users can only add waypoints by clicking on the map. Need ability to type coordinates.

**Solution:** Add "Add Waypoint" button below waypoint list with inline lat/lon form, validate within bounds.

**Files to modify:**
- `app/components/PlanGenerator.tsx`

---

## Feature 6: Generate Volumes Before U-Plan Download

**Problem:** Download U-Plan button downloads raw u-plan without operational volumes. View U-Plan Map generates them, but download does not.

**Solution:** Check for volumes before download, generate if missing, then download complete u-plan.

**Files to modify:**
- `app/components/FlightPlansUploader.tsx`

---

## Feature 7: Fix Theme System — Windows Theme & Toast Visibility

**Problem:** Windows system theme leaks into CSS. Toasts have insufficient opacity.

**Solution:** Default from system preference, isolate from system overrides, make toasts fully opaque.

**Files to modify:**
- `app/styles/themes.css`
- `app/hooks/useTheme.ts`
- `app/components/ui/toast.tsx`

---

## Feature 8: Toast Error on Invalid U-Plan Upload

**Problem:** Invalid file uploads fail silently.

**Solution:** Add client-side validation (extension, JSON, structure) with toast.error() for each failure.

**Files to modify:**
- `app/components/FlightPlansUploader.tsx`

---

## Feature 9: User Profile Fields (Name, Surname, Phone)

**Problem:** Users re-enter name/phone in every u-plan form. Should be stored in profile and auto-filled.

**SQL (already run by user):**
```sql
ALTER TABLE user ADD COLUMN firstName VARCHAR(255) DEFAULT NULL;
ALTER TABLE user ADD COLUMN lastName VARCHAR(255) DEFAULT NULL;
ALTER TABLE user ADD COLUMN phone VARCHAR(50) DEFAULT NULL;
```

**Code changes:** Update Prisma schema, signup, user profile API, settings page, profile page, UplanFormModal pre-fill, auth hook.

**Files to modify:**
- `prisma/schema.prisma`
- `app/api/auth/signup/route.ts`
- `lib/validators.ts`
- `app/api/user/profile/route.ts` (new)
- `app/settings/page.tsx`
- `app/profile/page.tsx`
- `app/components/flight-plans/UplanFormModal.tsx`
- `app/hooks/useAuth.ts`

---

## Feature 10: Email Notification on Approved Plan Deletion

**Problem:** Deleting approved plan sends FAS cancellation but no email to user.

**Solution:** Add `sendPlanDeletionEmail()` in email.ts, call in DELETE handler for approved plans.

**Files to modify:**
- `lib/email.ts`
- `app/api/flightPlans/[id]/route.ts`

---

## Feature 11: Cesium 3D U-Plan Viewer

**Problem:** Only 2D view available. 3D viewer with buildings improves spatial awareness.

**Solution:** Install cesium+resium, create Cesium3DModal, secure token API, add View 3D button.

**New files:**
- `app/components/flight-plans/Cesium3DModal.tsx`
- `app/api/cesium/token/route.ts`

**Modified:**
- `package.json`, `next.config.mjs`, `app/components/FlightPlansUploader.tsx`

---

## Feature 12: Improved FAS Denial Visualization

**Problem:** Geozone-only denials color ALL volumes red. Only overlapping ones should be. FAS reason details not shown.

**Solution:** 2D polygon intersection check, only color intersecting volumes red. Parse and display FAS reason.

**Files to modify:**
- `app/components/flight-plans/DenialMapModal.tsx`

---

## Feature 13: UAS Class/Weight/Dimension Regulatory Constraints

**EU Regulation:**
| Class | Max MTOM (kg) | Max Dimension |
|-------|--------------|---------------|
| C0 | 0.25 | No limit |
| C1 | 0.9 | No limit (max speed 19 m/s) |
| C2 | 4 | No limit |
| C3 | 25 | < 3m (LT_1, LT_3) |
| C4 | 25 | No limit |
| C5 | 25 | No limit |
| C6 | 25 | No limit |

**Solution:** Constraint map linking class → max MTOM + allowed dimensions. Apply in PlanGenerator and UplanFormModal.

**Files to modify:**
- `app/components/PlanGenerator.tsx`
- `app/components/flight-plans/UplanFormModal.tsx`
- `lib/validators/uplan-validator.ts`

---

## Recommended Implementation Order (Sprint 1 — Completed)

1–13: All completed.

---

# Sprint 2 — New Features

## Feature 14: Move Profile Editing to /profile Page

**Problem:** Profile editing (firstName, lastName, phone) is on /settings but should be on /profile. The /profile page is currently read-only.

**Solution:**
1. Move the profile editing form (firstName, lastName, phone + Save button) from `/settings` to `/profile`.
2. Remove the Account section from settings (keep theme, language, notifications, quick links).
3. The profile page uses `GET /api/user/profile` on load and `PATCH /api/user/profile` to save. Persist to database.

**Files to modify:**
- `app/profile/page.tsx` — Add editable inputs + save button
- `app/settings/page.tsx` — Remove Account/profile editing section

---

## Feature 15: AGL Altitude Correction for Trajectory Processing

**Problem:** Generated trajectories assume AMSL altitude, but the `plannedHomePosition[2]` (currently hardcoded to 15m) represents ground elevation offset. All waypoint altitudes in the csvResult need to have this offset subtracted so trajectories are in AGL (Above Ground Level), starting/ending at 0m AGL. This must happen exactly once during CSV result generation.

**Design:**
- Extract the hardcoded `15` from `PlanGenerator.tsx` (line 284) into env var `PLANNED_HOME_ALTITUDE` (default `15`).
- When CSV result data is used to build a U-plan (in `tray_to_uplan.ts`), read `plannedHomePosition[2]` from the flight plan's `fileContent` JSON and subtract it from all waypoint `Alt` values in the CSV data.
- This correction happens once during trajectory-to-uplan conversion — the corrected CSV is what feeds volume generation.
- For 2D/3D visualization: display altitudes as AGL. In the 3D Cesium viewer, set `heightReference` to `RELATIVE_TO_GROUND` so volumes render above terrain at AGL altitudes.
- For future-proofing: the system reads `plannedHomePosition[2]` dynamically from the flight plan, not a hardcoded value. The env var `PLANNED_HOME_ALTITUDE` is used only for `.plan` file generation.

**Files to modify:**
- `app/components/PlanGenerator.tsx` — Use env var for `plannedHomePosition` altitude
- `lib/uplan/tray_to_uplan.ts` — Subtract `plannedHomePosition[2]` from all CSV Alt values
- `app/components/flight-plans/Cesium3DModal.tsx` — Use `RELATIVE_TO_GROUND` height reference
- `.env.example` — Add `PLANNED_HOME_ALTITUDE=15`

---

## Feature 16: 4D Time Slider for 3D U-Plan Viewer

**Problem:** The 3D U-plan viewer shows all volumes statically. Need a time slider (like the 2D `UplanViewModal` already has) to show which volumes are active at each moment.

**Solution:**
- Add a time slider bar to `Cesium3DModal` with play/pause controls.
- Parse `timeBegin`/`timeEnd` from each operation volume.
- At each time step, highlight the active volume(s) brightly and dim inactive ones.
- Animate time progression when playing.

**Files to modify:**
- `app/components/flight-plans/Cesium3DModal.tsx` — Add time slider UI + volume highlight logic

---

## Feature 17: 3D Denial Map with Geozone Volumes

**Problem:** The denial visualization is 2D-only. A 3D view with geozone altitude volumes (from geoawareness service) would help users understand airspace conflicts.

**Solution:**
1. Create `Denial3DModal` component or extend `DenialMapModal` to support a 3D mode.
2. Add two buttons in the denial view: "View 2D Map" and "View 3D Map".
3. In 3D mode: render operational volumes as extruded polygons + geozone volumes as red semi-transparent 3D prisms using their altitude data (`verticalReference.upper/lower` from geoawareness).
4. Show conflicting volumes in red, OK volumes in gray, geozones in semi-transparent red.

**Files to create:**
- `app/components/flight-plans/Denial3DModal.tsx`

**Files to modify:**
- `app/components/FlightPlansUploader.tsx` — Add 3D denial view button
- `app/components/flight-plans/DenialMapModal.tsx` — May need to expose data for 3D modal

---

## Feature 18: FAS Approval Modal with 2D/3D Map and Parsed Reason

**Problem:** When a plan is approved by FAS, clicking the status button shows raw JSON. Need a proper modal with:
- 2D and 3D map views of the approved volumes
- Parsed FAS response message (both for approved and denied)
- Better formatting: "Conflicting volumes: X, Y" / "No conflicting volumes" / "Conflicting geozones: X, Y" / "No conflicting geozones"

**FAS response format for denied plans:**
```json
{"volumes":[0,1,2,3,4,5,6],"geozones_information":{"number_conflicting_geozones":0,"conflicting_geozones":[]}}
```

**Solution:**
1. Replace the raw JSON modal for approved plans with a proper `AuthorizationResultModal` that shows:
   - 2D map (reuse UplanViewModal principles) and 3D map (reuse Cesium3DModal) with tabs/buttons
   - Parsed FAS reason section: "Conflicting volumes: none" / "Conflicting geozones: none" for approved, or listing them for denied
2. Use the same modal for denied plans too (unifying the approval/denial display).
3. Parse the FAS message properly and display a human-readable summary.

**Files to create:**
- `app/components/flight-plans/AuthorizationResultModal.tsx`

**Files to modify:**
- `app/components/FlightPlansUploader.tsx` — Use new modal for both approved and denied

---

## Feature 19: Contact Us Page with Ticket System

**Problem:** Contact page is a static email link. Need a proper ticket submission form.

**Solution:**
1. Add a contact form to `/contact-us` with fields: Subject, Category (Bug Report, Feature Request, Support, Other), Description, optional attachment reference.
2. On submit, create a ticket (generate ticket number, e.g., `UPPS-YYYYMMDD-XXXX`).
3. Send email to the user: "Your ticket #UPPS-... has been created. We'll review it and contact you soon."
4. Send email to `upps@sna-upv.com`: full ticket details (subject, category, description, user email) so support can reply in the same thread.
5. Both emails use MailerSend via existing `lib/email.ts` patterns.

**Files to create:**
- `app/api/contact/route.ts` — Ticket creation endpoint

**Files to modify:**
- `app/contact-us/page.tsx` — Add form UI
- `lib/email.ts` — Add `sendContactTicketEmail` and `sendContactNotificationEmail` functions

---

## Feature 20: 3D Trajectory Viewer with Drone Animation

**Problem:** Current `TrajectoryMapViewer` only shows 2D points on a Leaflet map. Need a 3D viewer where a drone model follows the trajectory in time.

**Solution:**
1. Replace TrajectoryMapViewer with a 3D Cesium-based viewer.
2. Load a 3D drone model (glTF/GLB — can use a simple quad-rotor model file or a Cesium primitive shape).
3. Show the full trajectory as a semi-transparent 3D polyline.
4. Time slider + play/pause: the drone model moves along the trajectory path at each time step.
5. Camera follows the drone or allows free orbit.
6. Waypoint markers at key points (takeoff, cruise, landing).

**Files to create:**
- `app/components/flight-plans/Trajectory3DViewer.tsx`

**Files to modify:**
- `app/components/FlightPlansUploader.tsx` — Replace TrajectoryMapViewer with Trajectory3DViewer
- `public/models/` — Add a drone 3D model (glTF)

---

## Sprint 2 Recommended Implementation Order

1. Feature 14 (trivial, quick UI move)
2. Feature 15 (foundational altitude fix, affects all visualizers)
3. Feature 16 (extends existing Cesium3DModal)
4. Feature 18 (FAS modal unification, needs Cesium)
5. Feature 17 (3D denial — builds on Cesium patterns)
6. Feature 19 (contact form, standalone)
7. Feature 20 (3D trajectory — largest, most isolated)
