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

---

# Sprint 3 Tasks

---

## Task 21: Direct Navigation from Plan Generator to Trajectory Generator
**Feature:** 21 | **Priority:** High | **Scope:** Small

1. `app/components/PlanGenerator.tsx`: In `handleUploadPlan`, after successful POST to `/api/flightPlans`:
   - Get the created plan's ID from the API response.
   - Use Next.js `useRouter` to navigate: `router.push(\`/trajectory-generator?selectPlan=\${planId}\`)`.
   - Remove the "saved in Plan Generator folder" toast — user will see the plan directly.
2. `app/components/FlightPlansUploader.tsx`: On mount or when URL changes:
   - Read `selectPlan` query parameter from `window.location.search` or `useSearchParams()`.
   - If present, find the plan by ID in the loaded flight plans list and auto-select it (set `selectedPlanId`).
   - Show a success toast: "Plan imported from Plan Generator" or similar.
   - Clean up the URL param after selection (optional, `router.replace` without the param).
3. Run `npm run build && npm run lint && npm test`.

---

## Task 22: Update U-Plan STATE on FAS Authorization Response
**Feature:** 22 | **Priority:** High | **Scope:** Small

1. `app/api/fas/[externalResponseNumber]/route.ts`: In the PUT handler, after determining `authorizationStatus`:
   - Read the flight plan's current `uplan` field.
   - Parse it as JSON (handle string or object).
   - Set `uplan.state` to the FAS `state` value directly (e.g., `"ACCEPTED"`, `"WITHDRAWN"`).
   - Include the updated `uplan: JSON.stringify(updatedUplan)` in the Prisma `update` call alongside `authorizationStatus` and `authorizationMessage`.
2. Add test in `lib/__tests__/` or verify manually.
3. Run `npm run build && npm run lint && npm test`.

---

## Task 23: Fix 3D Viewer InfoBox Theme & Play Animation Reliability
**Feature:** 23 | **Priority:** High | **Scope:** Medium

1. **InfoBox dark theme fix** — In ALL Cesium viewers (`Cesium3DModal.tsx`, `AuthorizationResultModal.tsx`, `Denial3DModal.tsx`, `Trajectory3DViewer.tsx`):
   - After creating the Cesium Viewer, access `viewer.infoBox.frame` (the iframe).
   - Listen for the iframe's `load` event, then inject a `<style>` tag into the iframe's `document.head`:
     ```css
     .cesium-infoBox { background: rgba(38, 38, 38, 0.95) !important; }
     .cesium-infoBox-title { color: #ffffff !important; }
     .cesium-infoBox-description, .cesium-infoBox-description * { color: #e0e0e0 !important; background: transparent !important; }
     table { color: #e0e0e0 !important; }
     td, th { color: #e0e0e0 !important; border-color: #555 !important; }
     ```
   - This makes it always readable regardless of app theme.

2. **Play animation reliability** — In `Cesium3DModal.tsx`:
   - Ensure `entitiesRef.current` is populated before play starts. Add guard: if `entitiesRef.current.length === 0`, don't start animation.
   - Verify the `tick → updateVolumeColors(next)` path works by adding a check that the viewer is not destroyed.

3. **UI/UX review across all maps:**
   - Verify Leaflet maps (DenialMapModal, UplanViewModal) have visible controls in dark theme.
   - Ensure consistent button/toolbar styling in all Cesium modals.
   - Verify time slider track/thumb contrast on dark backgrounds.

4. Run `npm run build && npm run lint && npm test`.

---

## Task 24: Fix Trajectory 3D Viewer — Play Animation & Unified Height Reference
**Feature:** 24 | **Priority:** High | **Scope:** Medium

1. **Play animation fix** — `app/components/flight-plans/Trajectory3DViewer.tsx`:
   - The current approach uses `setCurrentTime(prev => ...)` functional updater, which batches state updates. The `useEffect` watching `currentTime` may not fire every frame.
   - Fix: Use a ref-based approach (like `currentTimeRef`). In the `tick` function, directly compute the interpolated position and mutate the drone entity position. Call `setCurrentTime(next)` for UI slider only.
   - Move the drone position update logic INTO the `tick` function instead of relying on a `useEffect`.

2. **Unified height reference** — Fix the dual trajectory rendering:
   - **Root cause:** Waypoint markers use `HeightReference.RELATIVE_TO_GROUND` (AGL). Polyline positions use `Cartesian3.fromDegrees(lng, lat, alt)` which is AMSL. Drone entity uses `HeightReference.NONE` (AMSL). CSV altitudes are AGL values.
   - **Fix for drone:** Set `heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND` on the drone point entity.
   - **Fix for polyline:** Cesium polylines don't support `heightReference`. Use a `wall` entity or a `corridor` entity that supports height reference. OR: use `sampleTerrainMostDetailed` to query terrain heights at each waypoint, add the AGL altitude to get absolute height, then create polyline with absolute positions. This is the most accurate approach.
   - **Simpler alternative:** Remove the separate polyline entirely. Instead, show the trajectory as a sequence of closely-spaced point entities with `RELATIVE_TO_GROUND`, connected visually. Or use a `Cesium.PolylineCollection` with ground-clamped positions.
   - **Recommended approach:** Query terrain height at trajectory points using `Cesium.sampleTerrainMostDetailed()`, add AGL altitude to terrain height, use resulting absolute positions for the polyline. This way polyline, markers, and drone all show at the same position.

3. Run `npm run build && npm run lint && npm test`.

---

## Task 25: HTTPS-Compatible Geoawareness WebSocket
**Feature:** 25 | **Priority:** Medium | **Scope:** Small

1. `app/hooks/useGeoawarenessWebSocket.ts` — In `getWebSocketUrl`:
   - Check `typeof window !== 'undefined' && window.location.protocol === 'https:'`.
   - If on HTTPS, force the WebSocket URL to use `wss://` regardless of the env var protocol.
   - Log a warning if the env var specifies `ws://` while the page is on HTTPS, explaining the auto-upgrade.
2. Add an inline comment explaining the HTTPS/WSS requirement.
3. **Document:** The geoawareness service operator must either:
   - Enable TLS on their WebSocket endpoint, OR
   - Put a reverse proxy (nginx/traefik) in front that terminates TLS and proxies `wss://` → `ws://` internally.
4. Update env var docs (`.env.example` or README) to note: "Use `wss://` prefix when serving over HTTPS."
5. Run `npm run build && npm run lint && npm test`.

---

## Task 26: U-Plan Form Field Help Tooltips
**Feature:** 26 | **Priority:** Medium | **Scope:** Medium

1. Create `app/components/ui/field-help.tsx`:
   - A small `?` circle icon button.
   - On click, shows a tooltip/popover with the help text.
   - Click outside or click again to dismiss.
   - Styled to be unobtrusive (gray circle, small font) but visible.
   - Props: `text: string` (the help description).

2. `app/components/flight-plans/UplanFormModal.tsx` — Add `<FieldHelp>` next to field labels:
   - **Owner SAC**: "System Area Code — 3-character alphanumeric code identifying the geographic area of the data source"
   - **Owner SIC**: "System Identification Code — 3-character code uniquely identifying the data source within a SAC"
   - **Source SAC / SIC**: Same as above but for the data source
   - **MTOM**: "Maximum Take-Off Mass — total mass of the UAS at takeoff including payload and batteries, in kilograms"
   - **Flight Mode (VLOS)**: "Visual Line of Sight — pilot maintains direct unaided visual contact with the UAS"
   - **Flight Mode (BVLOS)**: "Beyond Visual Line of Sight — UAS operates outside the pilot's direct visual range"
   - **Category (OPEN A1-A3)**: "Open category subcategories based on risk level and proximity to people"
   - **Category (SAIL)**: "Specific Assurance and Integrity Levels — risk assessment category for specific operations under EU regulation"
   - **Category (Certified)**: "Certified category — highest risk level, requires type certificate"
   - **UAS Class (C0-C6)**: "EU UAS class marking per Delegated Regulation (EU) 2019/945"
   - **Dimension (LT_1, LT_3)**: "Maximum characteristic dimension — LT_1: less than 1m, LT_3: less than 3m"
   - **Connectivity**: "Communication protocol used by the UAS (e.g., LTE, 5G, WiFi)"
   - **ID Technology**: "Remote identification technology (e.g., Direct Remote ID, Network Remote ID)"
   - **Registration Number**: "UAS operator registration number from national aviation authority"
   - **Serial Number**: "Manufacturer's serial number for the specific UAS unit (max 20 characters)"
   - **Operator ID**: "Unique identifier for the UAS operator, typically the registration number"

3. `app/components/PlanGenerator.tsx` — Add `<FieldHelp>` to relevant fields:
   - Same identifiers (SAC, SIC) and UAS fields
   - Flight mode, category explanations

4. Run `npm run build && npm run lint && npm test`.
