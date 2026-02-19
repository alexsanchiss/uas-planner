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
