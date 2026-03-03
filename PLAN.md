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

---

# Sprint 3 — UI Polish, Bug Fixes & UX Improvements

## Feature 21: Direct Navigation from Plan Definition to Plan Authorization

**Problem:** After "Upload to Plan Authorization", the user stays on Plan Definition with a toast message. They must manually navigate to `/plan-authorization` and find their plan. This creates unnecessary friction.

**Solution:**
1. After successful plan upload in `handleUploadPlan`, use `router.push('/plan-authorization?selectPlan=<planId>')` to navigate directly.
2. On the Plan Authorization page (`FlightPlansUploader`), read `selectPlan` query param and auto-select that plan, scrolling it into view.
3. Show a brief success toast on the Plan Authorization page confirming the imported plan.

**Files to modify:**
- `app/components/PlanGenerator.tsx` — Add router.push after upload success
- `app/components/FlightPlansUploader.tsx` — Read `selectPlan` query param, auto-select plan

---

## Feature 22: Update U-Plan STATE on FAS Authorization Response

**Problem:** When FAS sends a PUT with `state: "ACCEPTED"` or `state: "WITHDRAWN"`, the u-plan JSON stored in the database retains its original `state` field. The u-plan should reflect the FAS decision.

**Solution:**
1. In the FAS PUT handler (`/api/fas/[externalResponseNumber]/route.ts`), after setting `authorizationStatus`:
   - Parse the stored u-plan JSON
   - Update `uplan.state` to the value sent by FAS (`ACCEPTED` or `WITHDRAWN`)
   - Re-serialize and save the u-plan JSON back to the database
2. This preserves the exact language sent by FAS.

**Files to modify:**
- `app/api/fas/[externalResponseNumber]/route.ts` — Parse uplan, update state field, save

---

## Feature 23: 3D Viewer InfoBox Dark Theme Fix & Play Animation Reliability

**Problem:**
- In dark theme, the Cesium InfoBox has white background with white text, making content unreadable.
- The play animation in Cesium3DModal sometimes fails to update volume colors in sync. The `setCurrentTimeMs()` call triggers a React re-render, but `updateVolumeColors()` is called in the same tick—if the Cesium entity mutations and the React state are out of sync, volumes may not reflect the animation.
- General UI/UX polish needed across all map viewers (2D and 3D).

**Solution:**
1. **InfoBox fix:** After Cesium Viewer creation, access `viewer.infoBox.frame` (the iframe) and inject custom CSS that forces dark background + light text, or override the `.cesium-infoBox` classes. This makes it theme-independent and always readable.
2. **Play animation fix:** Ensure the `tick` function's `updateVolumeColors(next)` call reliably mutates entities. The current ref-based approach with direct calls should work—verify that `entitiesRef.current` is populated before play starts. Add a guard.
3. **UI/UX improvements:**
   - All Cesium viewers: consistent toolbar styling, hover states, button sizing
   - 2D Leaflet maps: ensure legends, controls visible on both themes
   - Time slider: add tick marks, improve contrast on dark theme

**Files to modify:**
- `app/components/flight-plans/Cesium3DModal.tsx` — InfoBox CSS injection, play animation reliability
- `app/components/flight-plans/AuthorizationResultModal.tsx` — Same InfoBox fix
- `app/components/flight-plans/Denial3DModal.tsx` — Same InfoBox fix
- `app/components/flight-plans/Trajectory3DViewer.tsx` — Same InfoBox fix

---

## Feature 24: Fix Trajectory 3D Viewer — Play Animation & Dual Trajectory

**Problem:**
1. The drone (yellow ball) does not update position when using the play button—only when manually dragging the slider. The `useEffect` watching `currentTime` updates the drone position, but `currentTime` state updates via `setCurrentTime(prev => ...)` inside the RAF tick may batch, causing the effect to not fire every frame.
2. Two trajectory paths are visible: one starting at ground level (AGL via `RELATIVE_TO_GROUND` on waypoint markers) and another at an absolute altitude (AMSL via `HeightReference.NONE` on the drone + polyline). The drone follows the AMSL path. This is because:
   - Waypoint markers use `heightReference: RELATIVE_TO_GROUND` (AGL)
   - The polyline uses `Cesium.Cartesian3.fromDegrees(lng, lat, alt)` with `clampToGround: false` (AMSL)
   - The drone entity uses `HeightReference.NONE` (AMSL)
   All three should use the same reference. Since CSV altitudes are AGL, everything should use `RELATIVE_TO_GROUND`.

**Solution:**
1. **Play animation fix:** Use a ref-based approach (like Cesium3DModal's `currentTimeMsRef`) instead of `setCurrentTime(prev => ...)`. In the `tick` function, directly mutate the drone entity position and call `setCurrentTime(next)` for UI (slider) only. Don't rely on `useEffect` to update the drone—do it in the RAF tick directly.
2. **Unified height reference:** Change the polyline to use `clampToGround: false` with positions created using a height reference. Actually, Cesium polylines don't support `heightReference`. Instead, use `Cesium.Cartographic` to query terrain height at each point, then add the AGL altitude to get absolute positions. Or simpler: use `Cesium.Cartesian3.fromDegrees(lng, lat, alt)` where `alt` is the AGL value, and render everything with the same method. The real fix is to make the drone use `RELATIVE_TO_GROUND` to match the waypoint markers. For the polyline, use `SampledPositionProperty` with height reference or compute absolute heights.
3. **Simplest fix:** Make the drone and polyline both use AGL. For the drone entity, set `heightReference: RELATIVE_TO_GROUND`. For the polyline, Cesium polylines in 3D don't support height references—so we need to either use ground-clamped entities or accept the polyline at approximate height. The most common approach is to compute terrain heights and add AGL on top.

**Files to modify:**
- `app/components/flight-plans/Trajectory3DViewer.tsx` — Fix drone update in RAF tick, unify height references

---

## Feature 25: HTTPS-Compatible Geoawareness WebSocket

**Problem:** When the app is served over HTTPS, the browser blocks `ws://` WebSocket connections (mixed content). The error: "Failed to construct WebSocket. An insecure WebSocket connection may not be initiated from a page loaded over HTTPS."

**Analysis:** The `getWebSocketUrl()` function in `useGeoawarenessWebSocket.ts` converts based on the configured protocol prefix. If `NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP` is set to `http://...` or bare IP, the result is `ws://`, which fails over HTTPS.

**Solution:**
1. **Client-side:** Auto-detect page protocol. If `window.location.protocol === 'https:'`, always force `wss://` regardless of env var protocol. Add a fallback that tries `wss://` first when on HTTPS.
2. **Documentation:** Add a note that when deploying over HTTPS, the geoawareness service must also support TLS (WSS). The env var should be set to `wss://host` or `https://host`.
3. The geoawareness service operator needs to enable TLS on their WebSocket endpoint, OR a reverse proxy (nginx/traefik) in front of the geoawareness service must terminate TLS and proxy to the `ws://` backend.

**Files to modify:**
- `app/hooks/useGeoawarenessWebSocket.ts` — Auto-force `wss://` when page is HTTPS
- `README.md` or inline comments — Document HTTPS requirements

---

## Feature 26: U-Plan Form Field Help Tooltips

**Problem:** The u-plan form fields use aviation acronyms (SAC, SIC, MTOM, VLOS, BVLOS, SAIL) that may be unfamiliar to operators. No inline help is provided.

**Solution:**
1. Create a reusable `FieldHelp` component: a small `?` icon button that shows a tooltip/popover on click with a brief explanation.
2. Add help tooltips to all UplanFormModal fields:
   - **SAC** (System Area Code): "3-character alphanumeric code identifying the geographic area of the data source"
   - **SIC** (System Identification Code): "3-character alphanumeric code uniquely identifying the data source within a SAC"
   - **MTOM**: "Maximum Take-Off Mass in kilograms, including payload and batteries"
   - **VLOS**: "Visual Line of Sight — pilot maintains direct visual contact with the UAS at all times"
   - **BVLOS**: "Beyond Visual Line of Sight — UAS operates outside the pilot's direct visual contact"
   - **SAIL**: "Specific Assurance and Integrity Levels — risk assessment category for specific operations"
   - **Flight Mode**, **Category**, **Special Operation**, etc.
3. Also add help tooltips to PlanGenerator fields where applicable.

**Files to create:**
- `app/components/ui/field-help.tsx` — Reusable tooltip component

**Files to modify:**
- `app/components/flight-plans/UplanFormModal.tsx` — Add FieldHelp next to each field label
- `app/components/PlanGenerator.tsx` — Add FieldHelp to relevant fields

---

## Sprint 3 Recommended Implementation Order

1. Feature 22 (quick backend fix, FAS state update)
2. Feature 25 (WebSocket HTTPS, small change + documentation)
3. Feature 24 (Trajectory 3D fixes — play + height reference)
4. Feature 23 (3D InfoBox + play reliability + UI/UX)
5. Feature 21 (Plan Definition → Plan Authorization navigation)
6. Feature 26 (Form tooltips, standalone UI work)

---

# Sprint 4 — Bug Fixes, UX Polish & New Features

## Feature 27: Fix Manual Waypoint Popup Close on OK/Enter

**Problem:** In Plan Definition (Manual mode), the OK button in each waypoint's map popup commits the lat/lng data but does NOT close the popup. Pressing Enter only blurs the input — it does not click OK or close the popup.

**Solution:**
1. In `PlanMap.tsx` `EditablePopupContent`: after committing lat/lng values in the OK handler, call `map.closePopup()` (via `useMap()` from `react-leaflet`).
2. Change Enter key handler to trigger the OK handler (not just blur), which then also closes the popup.
3. Apply the same pattern to all Leaflet `<Popup>` instances: SCAN takeoff/landing popups and polygon vertex popups.

**Files to modify:**
- `app/components/PlanMap.tsx` — EditablePopupContent OK handler + Enter key, SCAN overlay popups

---

## Feature 28: SCAN Pattern Polygon Vertex Improvements

**Problem:** Multiple SCAN pattern issues:
1. No "Add Vertex" button in the sidebar — vertices can only be added by clicking the map.
2. Polygon vertex popups lack an OK button and Enter-to-close behavior.
3. SCAN waypoint click-placement uses hardcoded `SERVICE_LIMITS` instead of the selected U-Space bounds — clicking outside the default bounds is rejected even when a larger U-Space is selected.
4. Dragging vertices in SCAN has no bounds validation — vertices can be dragged outside any U-Space limits.

**Solution:**
1. Add "Add Vertex" button in `ScanPatternGeneratorV2.tsx` sidebar (step 2) below the last vertex. Pre-fill with a sensible position (midpoint between last two vertices or polygon centroid). Validate against `serviceBounds`.
2. In `PlanMap.tsx` SCAN polygon vertex popups: add OK button + Enter→OK→close pattern (same as Feature 27).
3. In `PlanGenerator.tsx` line 1160: change `serviceBounds={[SERVICE_LIMITS[...]]}` to `serviceBounds={effectiveServiceLimits}` so SCAN respects the selected U-Space.
4. In `ScanPatternGeneratorV2.tsx` drag handlers (`handleVertexUpdate`, `handleExternalTakeoffUpdate`, `handleExternalLandingUpdate`): add `isWithinBounds()` validation; revert to previous position if outside bounds.

**Files to modify:**
- `app/components/plan-definition/ScanPatternGeneratorV2.tsx` — Add Vertex button, drag bounds check
- `app/components/PlanGenerator.tsx` — Pass effectiveServiceLimits to SCAN
- `app/components/PlanMap.tsx` — SCAN vertex popup OK/Enter/close

---

## Feature 29: Selected Plan Click Opens Waypoints Modal

**Problem:** In Plan Authorization (FlightPlansUploader), the small map preview on each plan card shows "Click to view waypoints map" on hover and works when clicked at folder level. But when a plan is already selected (highlighted), clicking the plan card body only toggles selection off — the user expects a second click on a selected plan to open the waypoints modal.

**Solution:**
In `FlightPlanCard.tsx` `handleCardClick`: if the plan is already selected (`isSelected === true`), instead of deselecting, call `onWaypointPreviewClick(plan.id, waypoints)` to open the waypoints map modal.

**Files to modify:**
- `app/components/flight-plans/FlightPlanCard.tsx` — Modify handleCardClick for second-click behavior

---

## Feature 30: Fix 4D Volume Animation During Play in Cesium3DModal

**Problem:** In the "View 3D U-Plan" Cesium modal, the 4D time slider bar advances during play, but the volume colors/visibility do NOT update. Manual slider drag works correctly. The RAF loop calls both `setCurrentTimeMs(next)` and `updateVolumeColors(next)`, but `updateVolumeColors` assigns raw `Cesium.Color` objects to `entity.polygon.material`, which Cesium may not detect as a property change — Cesium expects `ColorMaterialProperty`.

**Solution:**
1. In `Cesium3DModal.tsx` `updateVolumeColors`: assign material using `new Cesium.ColorMaterialProperty(color)` instead of raw `Cesium.Color.fromCssColorString(...)`.
2. Optionally also assign outlineColor via `new Cesium.ConstantProperty(color)`.
3. Additionally, add `viewer.scene.requestRender()` after each `updateVolumeColors` call in the RAF tick to force the scene to repaint.

**Files to modify:**
- `app/components/flight-plans/Cesium3DModal.tsx` — Fix material assignment in updateVolumeColors

---

## Feature 31: Fix Trajectory 3D Viewer Polyline & Labels

**Problem:** The Trajectory 3D viewer draws two visual paths:
1. Blue waypoint dots using `RELATIVE_TO_GROUND` (AGL) — correct.
2. A glowing polyline using absolute positions `terrainHeights[i] + p.alt` (AMSL) — visually mismatched with the dots.
The polyline also has Takeoff/Landing labels at positions that don't match the dot markers. The terrain sampling adds unnecessary complexity and visual discrepancy.

**Solution:**
1. Remove the terrain sampling code entirely (`sampleTerrainMostDetailed` section).
2. Change the polyline to use AGL positions: `Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt)` matching the waypoint markers.
3. Keep polyline `clampToGround: false` but with AGL altitudes.
4. Since Cesium polylines don't natively support `heightReference`, and the polyline will be at AGL altitude (not terrain-adjusted), it may slightly float/sink relative to terrain. This is acceptable — the blue dots with `RELATIVE_TO_GROUND` provide the accurate reference. The polyline is a visual guide.
5. Takeoff and Landing labels are already on the correct waypoint markers — no change needed there.

**Files to modify:**
- `app/components/flight-plans/Trajectory3DViewer.tsx` — Remove terrain sampling, simplify polyline

---

## Feature 32: Geoawareness 3D Viewer

**Problem:** Geoawareness geozones are only viewable in a 2D Leaflet modal. A 3D view with extruded geozone volumes would help users understand vertical airspace restrictions better. Also, the current 2D modal is too small for the dense geozone info popups.

**Solution:**
1. Create `Geoawareness3DModal.tsx` with Cesium viewer showing:
   - Trajectory as blue polyline (from plan's CSV data or operation volumes).
   - Geozones as 3D extruded polygons: height from `lowerLimit`, extruded to `upperLimit`, colored per `GEOZONE_COLORS` palette from `GeoawarenessModal.tsx`.
   - Clickable geozones: on entity click, Cesium InfoBox shows the same detailed info as the 2D modal (General Info, Restriction Conditions, Authority Info, Applicability).
2. Add a "3D" button next to the existing Geoawareness button in `FlightPlansUploader.tsx`.
3. Enlarge the 2D GeoawarenessModal from `70vw / 1200px` to `85vw / 1600px`, map height to `60vh / min 400px / max 650px`.
4. The 3D modal uses the same enlarged dimensions.

**Files to create:**
- `app/components/flight-plans/Geoawareness3DModal.tsx`

**Files to modify:**
- `app/components/GeoawarenessModal.tsx` — Enlarge modal dimensions
- `app/components/FlightPlansUploader.tsx` — Add 3D Geoawareness button, dynamic import

---

## Feature 33: Auto-fill Email in U-Plan Form

**Problem:** The U-Plan form auto-fills firstName, lastName, and phone from the user profile, but does NOT auto-fill the email address field. The user's registration email should be pre-filled.

**Solution:**
1. In `UplanFormModal.tsx`, in the profile fetch `useEffect`: after pre-filling name/phone, also check `contactDetails.emails[0]` — if empty, fill with the user's email from the `useAuth()` hook (`user.email`) or from the profile API response (add `email` to the profile endpoint response).
2. Update `/api/user/profile` GET handler to include the user's `email` field in the response.

**Files to modify:**
- `app/components/flight-plans/UplanFormModal.tsx` — Pre-fill emails[0] from user email
- `app/api/user/profile/route.ts` — Include email in GET response

---

## Feature 34: Profile U-Plan Drafts System

**Problem:** Users re-enter the same U-Plan form data repeatedly. Need a draft system where users can save, load, update, and delete pre-filled form configurations from their profile.

**SQL to execute manually:**
```sql
CREATE TABLE uplan_draft (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  draftData JSON NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  INDEX idx_user (userId)
);
```

**Solution:**
1. Add `uplanDraft` model in `prisma/schema.prisma` + relation on `user`. Run `npx prisma generate`.
2. Create API routes:
   - `GET /api/user/drafts` — List all user's drafts (id, name, updatedAt).
   - `POST /api/user/drafts` — Create draft with `{ name, draftData }`.
   - `GET /api/user/drafts/[id]` — Get single draft (full draftData).
   - `PATCH /api/user/drafts/[id]` — Update draft name/data.
   - `DELETE /api/user/drafts/[id]` — Delete draft.
3. Profile page (`/profile`): Add "U-Plan Drafts" section below profile fields. List drafts with name, last updated, Edit/Delete buttons. "New Draft" button opens a form to name and fill draft data.
4. `UplanFormModal`: Add "Load Draft" dropdown at the top. Selecting a draft fetches its `draftData` and merges into the form via `mergeWithDefaults()`.

**Files to create:**
- `app/api/user/drafts/route.ts`
- `app/api/user/drafts/[id]/route.ts`

**Files to modify:**
- `prisma/schema.prisma` — Add uplanDraft model
- `app/profile/page.tsx` — Add drafts section
- `app/components/flight-plans/UplanFormModal.tsx` — Add Load Draft button

---

## Feature 35: Remove Flight Plan Details from Plan Definition

**Problem:** The "Flight Plan Details" inline form in Plan Definition duplicates the U-Plan form available in Plan Authorization. It should be removed so form data entry only happens via the UplanFormModal in Plan Authorization.

**Solution:**
1. In `PlanGenerator.tsx`: Remove the "Flight Plan Details" collapsible button (lines ~1617–1625) and its entire content block (lines ~1626–1939).
2. Remove `detailsOpen` state, `initialFlightPlanDetails` constant, and all `flightPlanDetails` state.
3. In `handleUploadPlan`: stop spreading `flightPlanDetails` into the U-Plan JSON. The plan will be uploaded with waypoints + datetime only; the U-Plan form data will be filled via the UplanFormModal in Plan Authorization.
4. Clean up any unused imports.

**Files to modify:**
- `app/components/PlanGenerator.tsx` — Remove Flight Plan Details section and related state

---

## Feature 36: Update ICD & Move v2.2.0 Tag

**Problem:** All Sprint 4 changes need to be documented in the ICD, and the v2.2.0 git tag must be moved to the final commit.

**Solution:**
1. Update `icd.tex` "Novedades V2.2.0" section with Sprint 4 changes: popup fixes, SCAN bounds, selected plan click, 4D play fix, trajectory polyline fix, Geoawareness 3D, email auto-fill, drafts system, Flight Plan Details removal.
2. Add new endpoints to Annex B: `GET/POST /api/user/drafts`, `GET/PATCH/DELETE /api/user/drafts/[id]`.
3. Add new components to Annex E: `Geoawareness3DModal`, `uplanDraft` model.
4. Amend or create new commit, delete old v2.2.0 tag, create new annotated v2.2.0 tag on final commit, force push.

**Files to modify:**
- `icd.tex`

---

## Sprint 4 Implementation Order

1. Feature 27 (Manual popup OK/Enter close — small, foundational)
2. Feature 28 (SCAN pattern improvements — builds on F27 pattern)
3. Feature 29 (Selected plan click — small standalone fix)
4. Feature 30 (4D play animation fix — small Cesium fix)
5. Feature 31 (Trajectory polyline fix — small Cesium fix)
6. Feature 35 (Remove Flight Plan Details — cleanup before new features)
7. Feature 33 (Email auto-fill — small, quick)
8. Feature 34 (Profile drafts system — large, new DB + API + UI)
9. Feature 32 (Geoawareness 3D — large, new Cesium component)
10. Feature 36 (ICD update & tag — final task)

---

# Sprint 5 — Bug Fixes & UX Refinements

## Feature 37: Fix Selected Plan Preview Click → Waypoints Modal

**Problem:** When a plan is selected and displayed at the top in the "Selected plan" panel, clicking the waypoint mini-preview SVG does NOT open the waypoints map modal. The `FlightPlanCard` inside the selected plan panel is missing the `onWaypointPreviewClick` prop.

**Solution:**
1. In `FlightPlansUploader.tsx`: pass `onWaypointPreviewClick={handleWaypointPreviewClick}` to the `FlightPlanCard` rendered inside the "Selected plan" panel (around line 1411).

**Files to modify:**
- `app/components/FlightPlansUploader.tsx`

---

## Feature 38: Fix 4D Volume Color Update — Force Periodic Re-render

**Problem:** During Play animation on the 4D time slider in Cesium3DModal, volume colors do not visually update even though `ColorMaterialProperty` and `requestRender()` are used. Cesium's `requestRenderMode` may be suppressing continuous updates.

**Solution:**
1. In `Cesium3DModal.tsx`: after creating the viewer, explicitly set `viewer.scene.requestRenderMode = false` to force continuous rendering while the modal is open. This ensures Cesium re-draws every frame so material/color property changes are always visible.
2. Additionally, in the play animation `tick` function, add `viewer.scene.requestRender()` calls every iteration to be safe.

**Files to modify:**
- `app/components/flight-plans/Cesium3DModal.tsx`

---

## Feature 39: Remove Trajectory Polyline from 3D Viewers

**Problem:** In the Trajectory 3D Viewer, the polyline connecting waypoints still appears and is drawn at wrong AMSL altitudes. The user wants ONLY the waypoint dots visible (no connecting polyline).

**Solution:**
1. In `Trajectory3DViewer.tsx`: Remove the polyline entity that connects all trajectory points. Keep only the individual waypoint point+label entities and the drone entity.
2. In `Geoawareness3DModal.tsx`: Replace the trajectory polyline with individual waypoint markers (point entities) like in Trajectory3DViewer — takeoff (green), landing (red), cruise (blue). Remove the polyline entirely.

**Files to modify:**
- `app/components/flight-plans/Trajectory3DViewer.tsx`
- `app/components/flight-plans/Geoawareness3DModal.tsx`

---

## Feature 40: Fix Geoawareness 3D Viewer — AGL Heights, Waypoint Markers, Camera Zoom

**Problem:** In `Geoawareness3DModal.tsx`:
1. Operation volumes are rendered as AMSL but their altitudes are AGL — they need `RELATIVE_TO_GROUND` height reference (already present, but check).
2. Trajectory is drawn as a polyline at wrong altitude. Should be individual waypoint markers (same as in Trajectory3DViewer).
3. Camera does not zoom/center on the geozones + volumes properly.

**Solution:**
1. Verify operation volumes use `RELATIVE_TO_GROUND` for both `heightReference` and `extrudedHeightReference` (they already do — verify).
2. Replace trajectory polyline rendering with individual waypoint point entities (takeoff green, landing red, cruise blue) with `RELATIVE_TO_GROUND` height reference on each point.
3. Ensure camera `flyToBoundingSphere` includes all geozone, volume, and trajectory positions for proper centering.

**Files to modify:**
- `app/components/flight-plans/Geoawareness3DModal.tsx`

Note: Feature 39 and 40 overlap for Geoawareness3DModal — they should be handled together.

---

## Feature 41: Fix Cesium InfoBox/Popup Text Color Across All 3D Modals

**Problem:** In dark theme, the Cesium InfoBox popups display text that inherits the app's dark theme CSS (light text on light background or vice-versa), making it unreadable. Need to force all Cesium InfoBox popups and other overlay elements (like the toolbar, navigation help, etc.) to have fixed dark-background/light-text styling.

**Solution:**
All four Cesium 3D components already inject InfoBox CSS. The issue is that the Cesium *widget container itself* (toolbar buttons, credit display, etc.) inherits the app's CSS variables and theme. We need to:
1. In each of the 4 Cesium modals (`Cesium3DModal.tsx`, `Trajectory3DViewer.tsx`, `Geoawareness3DModal.tsx`, `AuthorizationResultModal.tsx`): after creating the viewer, inject a `<style>` tag into the main document scoped to the Cesium container that forces all Cesium widget text/background to fixed dark theme colors, overriding CSS variable inheritance.
2. This includes `.cesium-widget`, `.cesium-viewer`, toolbar buttons, credit element, selection indicator, etc.

**Files to modify:**
- `app/components/flight-plans/Cesium3DModal.tsx`
- `app/components/flight-plans/Trajectory3DViewer.tsx`
- `app/components/flight-plans/Geoawareness3DModal.tsx`
- `app/components/flight-plans/AuthorizationResultModal.tsx`

---

## Feature 42: Draft Delete from Form + Styled Draft Buttons

**Problem:**
1. Users want to delete a draft directly from the UplanFormModal (not only from profile page).
2. The "Update Draft", "Save as Draft", and "Delete Draft" buttons need distinguishing colors or icons.
3. Remove draft delete option from profile page.

**Solution:**
1. In `UplanFormModal.tsx`:
   - Add a "Delete Draft" button (red, with trash icon) next to "Update Draft" when a draft is loaded. It calls `DELETE /api/user/drafts/[id]` and clears `loadedDraftId`.
   - Style "Update Draft" button with a blue/teal color and a refresh/save icon.
   - Style "Save as Draft" button with a green color and a plus/document icon.
   - Style "Delete Draft" button with a red color and a trash icon.
2. In `app/profile/page.tsx`: Remove the delete button from the drafts list. Keep rename only.

**Files to modify:**
- `app/components/flight-plans/UplanFormModal.tsx`
- `app/profile/page.tsx`

---

## Sprint 5 Implementation Order

1. Feature 37 (Selected plan preview click fix — trivial, one-line)
2. Feature 38 (4D play animation re-render — small Cesium fix)
3. Feature 39 + 40 (Trajectory polyline removal + Geoawareness fixes — combined)
4. Feature 41 (InfoBox text color fix across all Cesium modals)
5. Feature 42 (Draft delete from form + styled buttons)
