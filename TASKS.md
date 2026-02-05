# Tasks - UAS Planner V2.0.0 Stabilization

## Phase 1: Schema & Build Fixes

### TASK-001: Fix Prisma Schema - Remove Duplicate and Add User Model
**Priority:** CRITICAL  
**File:** `prisma/schema.prisma`  
**Description:**
1. Remove the first `flightPlan` model (lines 29-48) that lacks proper relations
2. Keep the second `flightPlan` model (lines 59-84) that has:
   - `@@map("flightplan")` for table mapping
   - Proper relations to `user`, `machine`, `folder`
   - Database-specific field types (`@db.Text`, `@db.MediumText`, etc.)
3. Add the missing `user` model:
```prisma
model user {
  id          Int         @id @default(autoincrement())
  email       String      @unique @db.VarChar(255)
  password    String      @db.VarChar(255)
  createdAt   DateTime    @default(now()) @db.Timestamp(0)
  flightPlans flightPlan[]
  folders     folder[]
}
```
**Validation:**
```bash
npx prisma generate
```

### TASK-002: Verify and Fix TypeScript Build Errors
**Priority:** CRITICAL  
**Files:** Multiple API routes and components  
**Description:**
1. Run `npm run build` after schema fix
2. Fix any TypeScript errors related to:
   - Prisma client types (may need explicit types for callbacks)
   - Missing function parameter types
   - Null/undefined handling
3. Ensure all `map()`, `filter()` callbacks have explicit parameter types
**Validation:**
```bash
npm run build
```

### TASK-003: Fix uplan JSON Serialization in API Route
**Priority:** HIGH  
**File:** `app/api/flightPlans/[id]/uplan/route.ts`  
**Description:**
Before any `prisma.flightPlan.update()` that includes `uplan`:
```typescript
// Serialize to plain JSON to prevent Prisma interpreting nested keys as operations
const uplanJson = JSON.parse(JSON.stringify(uplan));

await prisma.flightPlan.update({
  where: { id },
  data: {
    uplan: uplanJson,  // Use serialized version
    // ... other fields
  },
});
```
Apply to all 3 update calls in the file (success, axios error, generic error).
**Validation:**
Test sending a U-Plan to FAS and verify no `Unknown argument` errors.

---

## Phase 2: UI/UX Improvements

### TASK-004: Fix Header Logo Aspect Ratio
**Priority:** MEDIUM  
**File:** `app/components/header.tsx`  
**Description:**
1. Modify `ThemedLogo` component to preserve aspect ratio:
```tsx
<Image
  src={isLightTheme ? "/images/logo_black.png" : "/images/logo.jpg"}
  alt="UAS PLANNER Logo"
  width={width}
  height={height}
  className={`object-contain ${className}`}
  style={{ width: 'auto', height: 'auto', maxWidth: width, maxHeight: height }}
/>
```
2. Add `flex-shrink-0` to header container to prevent squishing
3. Consider using `aspect-ratio` CSS property
**Validation:**
Resize browser to various widths and verify logo never distorts.

### TASK-005: Ensure Theme Independence from System
**Priority:** MEDIUM  
**Files:** 
- `app/styles/themes.css`
- `app/hooks/useTheme.ts`  
**Description:**
1. Add CSS at the top of themes.css to block system theme:
```css
/* Block system color-scheme influence */
:root {
  color-scheme: dark;
}
[data-theme="light"] {
  color-scheme: light;
}
```
2. Remove any `prefers-color-scheme` media queries (currently only in getSystemPreference which is unused for defaults now)
3. Ensure `getStoredTheme()` always returns stored value or 'dark' default
**Validation:**
1. Set Windows to light mode
2. Open app - should show dark theme (default)
3. Toggle to light theme, refresh - should stay light
4. Toggle Windows theme - app should NOT change

### TASK-006: Fix DateTime Picker Typing Issues
**Priority:** MEDIUM  
**File:** `app/components/flight-plans/DateTimePicker.tsx`  
**Description:**
The native `datetime-local` input has typing issues. Options:
1. **Option A (Recommended):** Disable direct text input, force popup only:
```tsx
onKeyDown={(e) => e.preventDefault()}
```
2. **Option B:** Use a custom controlled input with masking:
   - Implement manual time parsing
   - Format on blur
3. **Option C:** Use a date-picker library (adds dependency)

Implement Option A as quickest fix while maintaining functionality.
**Validation:**
1. Click calendar icon - should work
2. Try typing in input - should be blocked or handled gracefully
3. User notification that popup is required

---

## Phase 3: Final Validation

### TASK-007: Cross-Platform Build Validation
**Priority:** HIGH  
**Description:**
1. Fresh clone of repository
2. Run:
```bash
npm install
npx prisma generate
npm run build
```
3. All should complete without errors
4. Run `npm run dev` and test basic functionality
**Validation:**
Full build success on Linux and Windows.

### TASK-008: Final Commit and Tag
**Priority:** HIGH  
**Description:**
1. Stage all changes
2. Create conventional commit:
```bash
git add .
git commit -m "fix: stabilize schema, build, and UX for cross-platform compatibility

- Remove duplicate flightPlan model, add user model
- Fix uplan JSON serialization to prevent Prisma errors
- Fix header logo aspect ratio
- Ensure theme independence from system
- Fix datetime picker typing issues"
```
3. Do NOT tag yet - tag will be created when full V2.0.0 is ready
**Validation:**
Push to remote and verify CI passes (if configured).
