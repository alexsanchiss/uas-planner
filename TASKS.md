# UAS Planner — Task List

## Task 1: Remove Email Domain Validation
**Feature:** 1 | **Priority:** High | **Scope:** Small

Remove `validateEmailDomain()` DNS MX lookup call from `app/api/auth/signup/route.ts` (~lines 47-52). Remove the `validateEmailDomain` function and `dns` import from `lib/validators.ts` (~lines 50-65). Keep Zod `z.string().email()` validation. Remove/update any tests referencing `validateEmailDomain`. Run `just preflight`.

---

## Task 2: Reduce Verification Code Expiry to 3 Minutes
**Feature:** 2 | **Priority:** High | **Scope:** Medium

1. `app/api/auth/signup/route.ts`: Change `verificationTokenExpiry` from `new Date(Date.now() + 24 * 60 * 60 * 1000)` to `new Date(Date.now() + 3 * 60 * 1000)`.
2. `app/api/auth/resend-verification/route.ts`: Same 3-minute expiry. Fix rate-limit message ("two minutes" vs actual 60s check) — unify.
3. `app/api/auth/verify-email/route.ts`: Add `emailVerified: false` to Prisma `findFirst` `where` clause (both token and code paths) as safeguard.
4. `lib/__tests__/auth.test.ts`: Add tests verifying expired codes are rejected and account stays unverified.
5. Run `just preflight`.

---

## Task 3: Fix Map Zoom During SCAN Phase Transitions
**Feature:** 3 | **Priority:** High | **Scope:** Medium

1. `app/components/PlanGenerator.tsx`: Remove `scanHandlerVersion` state. Change `PlanMap` key to stable value (e.g., `"planmap"` or `selectedUspace?.id`). In `handleSetScanMapClickHandler`, remove `setScanHandlerVersion` — only update `scanMapClickHandlerRef.current`.
2. `app/components/PlanMap.tsx`: Store `customClickHandler` in a `useRef`. Add `useEffect` to sync ref when prop changes. Map click handler reads from ref.
3. Test: SCAN mode → zoom in → progress through all 4 steps → map must not reset zoom/pan.
4. Run `just preflight`.

---

## Task 4: Add OK Button & Enter Key to Waypoint Editing
**Feature:** 4 | **Priority:** Medium | **Scope:** Medium

1. `app/components/PlanMap.tsx` — `EditablePopupContent` (~line 98): Add "OK" button that commits pending lat/lng/alt/speed changes. Add `onKeyDown` on lat/lon inputs: Enter triggers commit.
2. `app/components/PlanGenerator.tsx` — sidebar waypoint inputs (~line 2121): Add `onKeyDown` on lat/lon inputs: Enter triggers `handleWaypointChange`.
3. Works in Manual and SCAN modes.
4. Run `just preflight`.

---

## Task 5: Add "Add Waypoint" Button to Sidebar
**Feature:** 5 | **Priority:** Medium | **Scope:** Medium

1. `app/components/PlanGenerator.tsx`: Add "Add Waypoint" button below waypoint list (both modes). Clicking shows inline form with lat/lon inputs. Pre-fill with last waypoint's coords or U-space center. On confirm: validate within service bounds, create waypoint with default alt/speed, append to array. On cancel: hide form.
2. Run `just preflight`.

---

## Task 6: Generate Volumes Before U-Plan Download
**Feature:** 6 | **Priority:** Medium | **Scope:** Small

1. `app/components/FlightPlansUploader.tsx`: In download handler(s) (~line 648, ~line 513), before creating blob: check `uplan.operationVolumes`. If missing/empty, call `POST /api/flightPlans/${planId}/generate-volumes`, fetch updated plan, use that for download. Show loading state. Handle errors with toast.
2. Run `just preflight`.

---

## Task 7: Fix Theme System and Toast Visibility
**Feature:** 7 | **Priority:** Medium | **Scope:** Medium

1. `app/hooks/useTheme.ts`: On init, if no localStorage theme, detect system preference via `window.matchMedia('(prefers-color-scheme: dark)')` and use as default.
2. `app/styles/themes.css`: Verify `color-scheme: dark/light` per `[data-theme]`. Remove any `@media (prefers-color-scheme)` overrides.
3. `app/components/ui/toast.tsx`: Set background opacity to 1.0 (fully opaque). Use solid colors with white text. Add subtle border for contrast on both themes.
4. Run `just preflight`.

---

## Task 8: Toast Error on Invalid U-Plan File Upload
**Feature:** 8 | **Priority:** Medium | **Scope:** Small

1. `app/components/FlightPlansUploader.tsx`: In external u-plan import flow — validate file extension (`.json` only), wrap JSON.parse in try-catch, validate parsed structure has `operationVolumes`. Show `toast.error()` with specific reason for each failure. Ensure server errors are displayed.
2. Run `just preflight`.

---

## Task 9: User Profile Fields (Name, Surname, Phone)
**Feature:** 9 | **Priority:** High | **Scope:** Large

**SQL (already run by user):**
```sql
ALTER TABLE user ADD COLUMN firstName VARCHAR(255) DEFAULT NULL;
ALTER TABLE user ADD COLUMN lastName VARCHAR(255) DEFAULT NULL;
ALTER TABLE user ADD COLUMN phone VARCHAR(50) DEFAULT NULL;
```
`npx prisma generate` already executed.

**Steps:**
1. `prisma/schema.prisma`: Add `firstName String?`, `lastName String?`, `phone String?` to User model.
2. `lib/validators.ts`: Update `signupSchema` with optional `firstName`, `lastName`, `phone`.
3. `app/api/auth/signup/route.ts`: Extract and store new fields.
4. Signup form UI: Add Name, Surname, Phone inputs.
5. Create `app/api/user/profile/route.ts`: GET (return profile) + PATCH (update profile), auth-protected.
6. `app/settings/page.tsx`: Add Account section with editable profile fields + Save button.
7. `app/profile/page.tsx`: Fix email bug (`user?.username` → `user?.email`), display new fields.
8. `app/components/flight-plans/UplanFormModal.tsx`: Fetch profile on open, pre-fill empty contact fields.
9. `app/hooks/useAuth.ts`: Include profile fields in user object.
10. Run `just preflight`.

---

## Task 10: Email Notification on Approved Plan Deletion
**Feature:** 10 | **Priority:** Medium | **Scope:** Small

1. `lib/email.ts`: Add `sendPlanDeletionEmail(email, planName)` using MailerSend patterns. Subject: "Flight Plan Authorization Cancelled". Body: plan name + reason (user deletion) + timestamp.
2. `app/api/flightPlans/[id]/route.ts`: In DELETE handler, if `authorizationStatus === 'aprobado'`, fetch user email and call `sendPlanDeletionEmail`. Fire-and-forget, log errors.
3. Run `just preflight`.

---

## Task 11: Cesium 3D U-Plan Viewer
**Feature:** 11 | **Priority:** Low | **Scope:** Large

1. `npm install cesium resium copy-webpack-plugin`
2. `next.config.mjs`: Configure Cesium static assets via webpack plugin.
3. Create `app/api/cesium/token/route.ts`: Auth-protected GET returning `{ token: process.env.CESIUM_ION_TOKEN }`.
4. Create `app/components/flight-plans/Cesium3DModal.tsx`: Modal with Cesium Viewer, world terrain, OSM Buildings, extruded volume polygons, auto-fly camera. Cleanup on unmount.
5. `app/components/FlightPlansUploader.tsx`: Add "View 3D U-plan" button. Generate volumes if missing. Dynamic import with `ssr: false`.
6. Run `just preflight`.

---

## Task 12: Improved FAS Denial Visualization
**Feature:** 12 | **Priority:** Medium | **Scope:** Medium

1. `app/components/flight-plans/DenialMapModal.tsx`:
   - When `volumes` empty + `conflicting_geozones` exist: compute 2D polygon intersection between each operational volume and geozone polygons. Only mark intersecting volumes red. Fallback to all-red if geometry unavailable.
   - Add "FAS Denial Reason" section: parse `geozones_information.conflicting_geozones[].{id, type, info}`, display as formatted list. Handle non-geozone reasons gracefully.
2. Run `just preflight`.

---

## Task 13: UAS Class/Weight/Dimension Regulatory Constraints
**Feature:** 13 | **Priority:** Medium | **Scope:** Medium

1. Define `UAS_CLASS_CONSTRAINTS` map: `{ C0: { maxMTOM: 0.25 }, C1: { maxMTOM: 0.9, maxSpeed: 19 }, C2: { maxMTOM: 4 }, C3: { maxMTOM: 25, allowedDimensions: ['LT_1','LT_3'] }, C4-C6: { maxMTOM: 25 }, NONE: no constraints }`.
2. `app/components/PlanGenerator.tsx`: On class change → cap MTOM, filter dimensions, show toast if adjusted.
3. `app/components/flight-plans/UplanFormModal.tsx`: Same constraints on UAS fields.
4. C1: Also constrain max speed to 19 m/s.
5. Run `just preflight`.

---

# Sprint 2 Tasks

---

## Task 14: Move Profile Editing to /profile Page
**Feature:** 14 | **Priority:** High | **Scope:** Small

1. Read `app/settings/page.tsx` — find the Account/Profile section with firstName, lastName, phone inputs and Save button.
2. Read `app/profile/page.tsx` — currently read-only display.
3. Move the profile editing form (inputs + save logic + `PATCH /api/user/profile` call) from settings to the profile page. Make the fields editable inline (replace the read-only cards with input fields + Save button).
4. Remove the Account section from settings page (keep Appearance, Language, Notifications, Quick Links).
5. Keep using `GET /api/user/profile` to fetch and `PATCH /api/user/profile` to save. Show success/error toasts.
6. Run `just preflight`.

---

## Task 15: AGL Altitude Correction for Trajectory Processing
**Feature:** 15 | **Priority:** High | **Scope:** Medium

1. Add `PLANNED_HOME_ALTITUDE=15` to `.env.example`.
2. In `app/components/PlanGenerator.tsx` (~line 284): Replace hardcoded `15` in `plannedHomePosition` with `Number(process.env.NEXT_PUBLIC_PLANNED_HOME_ALTITUDE || '15')`. Also add `NEXT_PUBLIC_PLANNED_HOME_ALTITUDE` to `.env.example`.
3. In `lib/uplan/tray_to_uplan.ts` in the `trayToUplan` function: After parsing csv with Papa Parse, read `plannedHomePosition[2]` from the flight plan's `fileContent` (passed as parameter or extracted). Subtract this altitude offset from every waypoint's `Alt` value in the parsed CSV data. This normalizes all altitudes to AGL. **Only do this once** — the corrected values feed into volume generation.
4. Add `fileContent` parameter to `trayToUplan` if needed, or extract `plannedHomePosition` from the uplan/plan data passed to it.
5. In `app/components/flight-plans/Cesium3DModal.tsx`: When creating volume entities, use `Cesium.HeightReference.RELATIVE_TO_GROUND` for polygon height so volumes render above terrain at AGL altitudes. Set `polygon.height` and `polygon.extrudedHeight` with `heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND`.
6. Also ensure 2D viewers (UplanViewModal) display altitudes labeled as "AGL" in tooltips.
7. Run `just preflight`.

---

## Task 16: 4D Time Slider for 3D U-Plan Viewer
**Feature:** 16 | **Priority:** Medium | **Scope:** Medium

1. Read `app/components/flight-plans/Cesium3DModal.tsx` — understand current volume rendering.
2. Read `app/components/UplanViewModal.tsx` — study the existing 4D time slider implementation (play/pause, time range, active volume highlighting).
3. Add to Cesium3DModal:
   - Parse `timeBegin`/`timeEnd` from each operation volume (ISO 8601 strings → Date objects).
   - Compute global time range (earliest timeBegin to latest timeEnd).
   - Add a time slider bar at the bottom of the modal: range input, play/pause button, current time display, speed control.
   - When time changes: iterate volumes, set active ones to bright blue + opacity 0.7, inactive to gray + opacity 0.15. Use Cesium.Entity `show` property or material color changes.
   - Play mode: animate time using requestAnimationFrame or setInterval, advancing by 1 second per tick (adjustable speed).
4. Run `just preflight`.

---

## Task 17: 3D Denial Map with Geozone Volumes
**Feature:** 17 | **Priority:** Medium | **Scope:** Large

1. Create `app/components/flight-plans/Denial3DModal.tsx`:
   - Same modal pattern as Cesium3DModal (Cesium viewer, world terrain, OSM buildings).
   - Props: `isOpen`, `onClose`, `operationVolumes`, `conflictingIndices`, `geozonesData`, `geoawarenessData`.
   - Render operation volumes as extruded polygons: conflicting ones in red, OK ones in gray semi-transparent.
   - Render geozone volumes from geoawareness data as semi-transparent red 3D prisms using `verticalReference.upper/lower` altitude data. If altitude reference is AGL, use `RELATIVE_TO_GROUND`.
   - Camera flies to encompass all volumes.
2. In `app/components/FlightPlansUploader.tsx`:
   - Where denial is shown, add two buttons: "View 2D Denial Map" (existing DenialMapModal) and "View 3D Denial Map" (new Denial3DModal).
   - Pass same data to both modals.
   - Dynamic import Denial3DModal with `ssr: false`.
3. Run `just preflight`.

---

## Task 18: FAS Approval Modal with 2D/3D Map and Parsed Reason
**Feature:** 18 | **Priority:** Medium | **Scope:** Large

1. Create `app/components/flight-plans/AuthorizationResultModal.tsx`:
   - Modal with tabs/buttons: "2D Map" | "3D Map" | "Details".
   - **2D Map tab**: Leaflet map showing operation volumes (like UplanViewModal) — colored by authorization (green=approved, red=denied).
   - **3D Map tab**: Cesium viewer showing volumes (like Cesium3DModal) — colored by status.
   - **Details tab**: Parsed FAS message:
     - For `{"volumes":[0,1,2],"geozones_information":{"number_conflicting_geozones":0,"conflicting_geozones":[]}}`:
       - "Conflicting volumes: 0, 1, 2" or "No conflicting volumes"
       - "Conflicting geozones: none" or list them
     - For approved: "Status: Approved" + volume/geozone summary
   - "FAS Reason" section always visible regardless of tab.
   - Props: `isOpen`, `onClose`, `uplanData`, `authorizationStatus`, `authorizationMessage`, `fileContent`, `geoawarenessData`.
2. In `app/components/FlightPlansUploader.tsx`:
   - Replace the current raw JSON modal for approved plans AND the DenialMapModal for denied plans with this unified `AuthorizationResultModal`.
   - Both "View Authorization Details" (approved) and "View Denial on Map" (denied) open the same modal with different status.
3. Run `just preflight`.

---

## Task 19: Contact Us Page with Ticket System
**Feature:** 19 | **Priority:** Medium | **Scope:** Medium

1. In `lib/email.ts`, add two functions:
   - `sendContactTicketEmail(userEmail, ticketNumber, subject, category)` — confirmation to user
   - `sendContactNotificationEmail(ticketNumber, subject, category, description, userEmail)` — notification to upps@sna-upv.com with Reply-To set to user's email
2. Create `app/api/contact/route.ts`:
   - POST, auth-protected. Body: `{ subject, category, description }`.
   - Generate ticket number: `UPPS-YYYYMMDD-XXXX` (date + random 4-digit).
   - Send both emails. Return `{ ticketNumber }`.
3. In `app/contact-us/page.tsx`:
   - Replace static content with a form: Subject (text), Category (select: Bug Report, Feature Request, Support, Other), Description (textarea).
   - Submit calls `POST /api/contact`. Show success toast with ticket number. Show error toast on failure.
   - Keep the UPPS branding and support email reference.
4. Run `just preflight`.

---

## Task 20: 3D Trajectory Viewer with Drone Animation
**Feature:** 20 | **Priority:** Medium | **Scope:** Large

1. Create `app/components/flight-plans/Trajectory3DViewer.tsx`:
   - Cesium-based modal (same Cesium loading pattern as Cesium3DModal).
   - Fetches trajectory CSV (same data as TrajectoryMapViewer: `/api/csvResult?id=${planId}`).
   - Parses CSV to array of `{ lat, lng, alt, time }` points.
   - Shows full trajectory as a semi-transparent 3D polyline (Cesium.PolylineCollection or Entity with polyline, slight blue color, low opacity).
   - Drone representation: Use a Cesium point billboard or a simple 3D shape (box/sphere primitive) at the current trajectory position. If a GLB model is available in `public/models/drone.glb`, use `Cesium.ModelGraphics`. Otherwise, use a large point entity or billboard with a drone icon.
   - Time slider + play/pause: slider covers trajectory time range. Drone moves to the interpolated position at each time step. Full trajectory always visible but semi-transparent.
   - Waypoint markers: takeoff (green), cruise (blue), landing (red) as point entities.
   - Camera: default view encompasses full trajectory, user can orbit freely.
2. In `app/components/FlightPlansUploader.tsx`:
   - Replace `TrajectoryMapViewer` usage with `Trajectory3DViewer` (dynamic import, ssr: false).
   - Pass same props (planId at minimum).
3. Run `just preflight`.
