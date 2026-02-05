# UAS Planner V2.0.0 - Stabilization & UX Fixes

## Overview
This plan addresses critical build compatibility issues, Prisma schema problems, and UI/UX improvements to ensure stable cross-platform deployment.

## Current Issues

### 1. Prisma Schema Critical Errors
- **Duplicate `flightPlan` model** (lines 29-48 and 59-84)
- **Missing `user` model** (referenced by `folder` and `flightPlan` but not defined)
- Build fails with: `The model "flightPlan" cannot be defined because a model with that name already exists`

### 2. Build Compatibility
- `npx prisma generate` fails due to schema errors
- `npm run build` fails on Windows machines after cloning
- TypeScript strict mode differences between environments

### 3. UI/UX Issues
#### 3.1 Header Logo Aspect Ratio
- Logo gets squeezed on certain viewport widths
- `Image` component uses fixed width/height without preserving aspect ratio
- Needs `object-contain` or similar fix

#### 3.2 Theme Independence from Windows
- Theme should depend ONLY on user selection (localStorage)
- Currently defaults correctly to dark but needs explicit CSS isolation
- Prevent any `prefers-color-scheme` affecting UI after user selection

#### 3.3 DateTime Picker Typing Issues
- Native `datetime-local` input has erratic behavior when typing directly
- Cursor jumps, values change unexpectedly
- Users can only reliably use the calendar/clock popup

### 4. Prisma JSON Field Handling
- `uplan` field needs `JSON.parse(JSON.stringify(uplan))` before Prisma update
- Direct object assignment causes Prisma to interpret nested keys as operations
- Error: `Unknown argument 'dataOwnerIdentifier'. Available options are marked with ?`

## Solution Architecture

### Phase 1: Schema & Build Fixes
1. Remove duplicate `flightPlan` model
2. Add `user` model with proper relationships
3. Consolidate to single unified schema based on actual database structure
4. Run `npx prisma generate` and verify
5. Run `npm run build` and fix any TypeScript errors

### Phase 2: UI/UX Improvements
1. Fix header logo with proper aspect-ratio CSS
2. Ensure theme CSS isolation (no system dependency after user choice)
3. Implement custom datetime input or fix native input behavior

### Phase 3: API Fixes
1. Add JSON serialization to uplan route before Prisma updates
2. Apply same pattern to any other JSON field updates

## Files to Modify

### Schema
- `prisma/schema.prisma`

### Header & Theme
- `app/components/header.tsx`
- `app/styles/themes.css`
- `app/hooks/useTheme.ts`

### DateTime Picker
- `app/components/flight-plans/DateTimePicker.tsx`

### API Routes
- `app/api/flightPlans/[id]/uplan/route.ts`
- `app/api/flightPlans/route.ts` (bulk create)

## Success Criteria
1. `npx prisma generate` completes without errors
2. `npm run build` completes without errors on fresh clone
3. Logo maintains aspect ratio at all viewport widths
4. Theme remains as user-selected regardless of Windows theme
5. DateTime picker allows typing without cursor jumping
6. U-Plan sends successfully to FAS API
