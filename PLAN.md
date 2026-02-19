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

## Recommended Implementation Order

1. Feature 1 (trivial, high impact)
2. Feature 2 (auth fix)
3. Feature 7 (theme, affects all UI)
4. Feature 8 (error visibility)
5. Feature 9 (schema change, foundational)
6. Feature 4 (UX)
7. Feature 5 (UX)
8. Feature 3 (map zoom fix)
9. Feature 6 (volume generation)
10. Feature 10 (email notification)
11. Feature 12 (denial visualization)
12. Feature 13 (regulatory validation)
13. Feature 11 (Cesium 3D — largest)
