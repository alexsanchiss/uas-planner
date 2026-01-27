# UAS Planner - Global Improvement Plan

## Executive Summary

This plan outlines a comprehensive modernization of the UAS Planner application, addressing critical security vulnerabilities, architectural inconsistencies, and UI/UX improvements. The goal is to transform the current functional but disorganized codebase into a production-ready, maintainable, and user-friendly application.

## Current State Analysis

### Critical Issues Identified

1. **Security Vulnerabilities**
   - Hardcoded JWT fallback secret (`your-super-secret-jwt-key-here`)
   - No JWT authentication on Pages Router APIs (flightPlans, folders, csvResult)
   - APIs trust client-provided `userId` without verification

2. **Architectural Problems**
   - Hybrid App Router + Pages Router causing inconsistent patterns
   - Multiple PrismaClient instantiations instead of singleton
   - FlightPlansUploader component is ~2400 lines (unmaintainable)
   - No proper error handling/feedback in auth flow

3. **UI/UX Deficiencies**
   - No light/dark mode toggle (hardcoded dark)
   - Bulk operations exposed in production UI (confusing for operators)
   - No real-time updates for FAS authorization responses
   - DateTime picker has timezone offset bug

4. **Missing Features**
   - PlanGenerator lacks waypoint pauses, fly-by/fly-over, SCAN patterns
   - No folder rename capability
   - No plan reset functionality
   - No proper loading states and animations

## Architecture Decisions

### Decision 1: Migrate to App Router (Long-term)
We will migrate all Pages Router APIs to App Router for consistent authentication middleware and modern patterns. This will be done incrementally to avoid breaking changes.

### Decision 2: Create New Modular Components
Rather than refactoring the 2400-line FlightPlansUploader, we'll create new modular components for production use. **The current FlightPlansUploader will be preserved** as `FlightPlansUploaderDev.tsx` for development and bulk planning use cases.

### Decision 3: Polling Pattern for Updates
- **Processing status**: Poll every 5 seconds (external service updates DB directly)
- **FAS authorization**: Poll with fallback (external FAS service updates via endpoint)

### Decision 4: Theme System
Implement CSS custom properties with Tailwind for consistent theming with day/night toggle.

## Implementation Phases

### Phase 1: Backend Standardization (Priority: Critical)
- Fix authentication security vulnerabilities
- Standardize PrismaClient usage
- Add API authentication middleware
- Migrate APIs to App Router
- Externalize configuration (FAS URL)
- Add input validation with Zod

### Phase 2: Auth System Overhaul (Priority: High)
- Implement refresh tokens
- Add proper error feedback to login/signup forms
- Improve session management
- Fix header user state handling
- Add loading states during auth operations

### Phase 3: FlightPlansUploader Refactor (Priority: High)
- Preserve current component as `FlightPlansUploaderDev.tsx` for bulk operations
- Split into modular components:
  - `FolderList` - Folder management
  - `FlightPlanCard` - Individual plan display
  - `ProcessingWorkflow` - Step-by-step process guide
  - `AuthorizationPanel` - Geoawareness + FAS authorization
  - `TrajectoryViewer` - Map visualization
- Create production mode flag to switch between dev/production UI

### Phase 4: New Production UI (Priority: High)
- Build guided workflow: Process → Geoawareness → Authorize
- Real-time updates with polling
- Restricted button states with explanatory messages
- Fix DateTime picker timezone issue
- Add plan reset functionality

### Phase 5: PlanGenerator Enhancements (Priority: Medium)
- Add waypoint pause configuration
- Implement fly-by/fly-over toggle
- Build SCAN polygon pattern generator
- Improve service area visualization

### Phase 6: UI/UX Polish (Priority: Medium)
- Implement day/night theme toggle
- Add loading animations and transitions
- Make all components responsive
- Unify color scheme
- Add helpful error messages and guidance

## Technical Specifications

### Authentication Middleware (App Router)
```typescript
// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

export async function withAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return payload;
}
```

### Theme System
```css
:root {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
}
```

### SCAN Pattern Algorithm
```typescript
interface ScanConfig {
  polygon: [number, number][];
  startPoint: [number, number];
  endPoint: [number, number];
  altitude: number;
  spacing: number; // meters between parallel lines
  angle: number; // degrees
}

function generateScanWaypoints(config: ScanConfig): Waypoint[] {
  // 1. Rotate polygon to align with angle
  // 2. Calculate bounding box
  // 3. Generate parallel lines with spacing
  // 4. Clip lines to polygon boundary
  // 5. Create waypoints at intersections
  // 6. Add takeoff at start, landing at end
}
```

## File Structure (New Components)

```
app/
├── components/
│   ├── flight-plans/              # New modular components (Production)
│   │   ├── FolderList.tsx
│   │   ├── FolderCard.tsx
│   │   ├── FlightPlanCard.tsx
│   │   ├── FlightPlanList.tsx
│   │   ├── ProcessingWorkflow.tsx
│   │   ├── AuthorizationPanel.tsx
│   │   ├── GeoawarenessViewer.tsx
│   │   ├── TrajectoryViewer.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ActionButtons.tsx
│   │   ├── DateTimePicker.tsx
│   │   └── index.ts
│   ├── FlightPlansUploader.tsx    # Production entry point (uses modular components)
│   ├── FlightPlansUploaderDev.tsx # Preserved original for bulk/dev operations
│   ├── plan-generator/            # Refactored plan generator
│   │   ├── WaypointEditor.tsx
│   │   ├── WaypointList.tsx
│   │   ├── ScanPatternGenerator.tsx
│   │   ├── PlanMap.tsx
│   │   ├── FlightDetailsForm.tsx
│   │   └── index.ts
│   ├── ui/                        # Extended UI components
│   │   ├── theme-toggle.tsx
│   │   ├── loading-spinner.tsx
│   │   ├── loading-skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── tooltip.tsx
│   │   └── index.ts
│   └── auth/                      # Improved auth components
│       ├── login-form.tsx
│       ├── signup-form.tsx
│       ├── auth-provider.tsx
│       ├── protected-route.tsx
│       └── index.ts
├── api/                           # Migrated to App Router
│   ├── flightPlans/
│   │   ├── route.ts              # GET, POST, PUT, DELETE
│   │   └── [id]/
│   │       ├── route.ts          # Individual operations
│   │       ├── uplan/route.ts    # U-Plan generation
│   │       └── reset/route.ts    # Plan reset
│   ├── folders/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── csvResult/
│   │   └── route.ts
│   └── fas/
│       └── [externalResponseNumber]/route.ts
├── hooks/
│   ├── useAuth.ts                 # Improved auth hook
│   ├── useTheme.ts                # Theme management
│   ├── usePolling.ts              # Reusable polling hook
│   ├── useFlightPlans.ts          # Flight plans data hook
│   └── useFolders.ts              # Folders data hook
├── lib/
│   ├── auth.ts                    # Auth utilities (improved)
│   ├── auth-middleware.ts         # New auth middleware for App Router
│   ├── prisma.ts                  # Singleton (exists)
│   ├── validators.ts              # Zod schemas
│   └── scan-generator.ts          # SCAN algorithm
└── styles/
    └── themes.css                 # Theme variables
```

## Development vs Production Mode

The application will support two modes controlled by environment variable:

### Production Mode (`NEXT_PUBLIC_PRODUCTION_MODE=true`)
- Uses new modular `FlightPlansUploader.tsx`
- Simplified UI with guided workflow
- Individual plan operations only
- Clear button state restrictions with explanations
- No bulk operations visible

### Development Mode (`NEXT_PUBLIC_PRODUCTION_MODE=false`)
- Uses preserved `FlightPlansUploaderDev.tsx` (current component)
- Full bulk operations available
- Folder-level batch processing
- Status counters and summary boxes
- Useful for bulk testing and development scenarios

## Success Criteria

1. **Security**: All APIs require valid JWT, no hardcoded secrets
2. **Performance**: Page load < 2s, real-time updates within 5s
3. **UX**: Clear workflow guidance, no unexplained disabled buttons
4. **Maintainability**: No component > 500 lines, clear separation of concerns
5. **Responsiveness**: Works on tablet (768px) and desktop (1024px+)
6. **Backward Compatibility**: Dev mode preserves all current functionality

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Preserve original component as Dev version, test thoroughly |
| Database performance with many trajectories | Medium | Pagination, lazy loading, query optimization |
| Theme inconsistencies | Low | Design tokens, component library approach |
| External FAS API changes | Medium | Abstract API calls, add retry logic |
| Migration complexity | Medium | Incremental migration, maintain both routers during transition |

## Timeline Estimate

- Phase 1 (Backend): ~25 tasks
- Phase 2 (Auth): ~25 tasks
- Phase 3 (Refactor): ~25 tasks
- Phase 4 (Production UI): ~40 tasks
- Phase 5 (PlanGenerator): ~25 tasks
- Phase 6 (UI/UX): ~50 tasks
- Phase 7 (Testing/Docs): ~15 tasks

**Total: ~205 tasks**
