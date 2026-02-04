# UAS Planner - Implementation Tasks

## Legend
- 🔴 Critical (Security/Breaking)
- 🟡 High Priority
- 🟢 Medium Priority
- ⚪ Low Priority

---

## Phase 1: Backend Standardization

### 1.1 Security Fixes

- [ ] 🔴 **TASK-001**: Remove hardcoded JWT secret fallback in `lib/auth.ts`, require `JWT_SECRET` env var with startup validation
- [ ] 🔴 **TASK-002**: Create API authentication middleware for App Router (`lib/auth-middleware.ts`)
- [ ] 🔴 **TASK-003**: Create Zod validation schemas for all API inputs (`lib/validators.ts`)

### 1.2 API Migration to App Router

- [ ] 🔴 **TASK-004**: Create `app/api/flightPlans/route.ts` - migrate GET, POST, PUT, DELETE from Pages Router
- [ ] 🔴 **TASK-005**: Create `app/api/flightPlans/[id]/route.ts` - migrate individual flight plan operations
- [ ] 🔴 **TASK-006**: Create `app/api/flightPlans/[id]/uplan/route.ts` - migrate U-Plan generation endpoint
- [ ] 🔴 **TASK-007**: Create `app/api/flightPlans/[id]/reset/route.ts` - new endpoint for plan reset
- [ ] 🔴 **TASK-008**: Create `app/api/folders/route.ts` - migrate folder CRUD operations
- [ ] 🔴 **TASK-009**: Create `app/api/folders/[id]/route.ts` - migrate individual folder operations with rename support
- [ ] 🔴 **TASK-010**: Create `app/api/csvResult/route.ts` - migrate CSV result operations
- [ ] 🔴 **TASK-011**: Create `app/api/fas/[externalResponseNumber]/route.ts` - migrate FAS callback endpoint
- [ ] 🔴 **TASK-012**: Apply auth middleware to all new API routes
- [ ] 🔴 **TASK-013**: Add authorization check - verify userId from token matches requested resources

### 1.3 PrismaClient Standardization

- [ ] 🟡 **TASK-014**: Update `app/api/auth/login/route.ts` to use singleton PrismaClient from `lib/prisma.ts`
- [ ] 🟡 **TASK-015**: Update `app/api/auth/signup/route.ts` to use singleton PrismaClient
- [ ] 🟡 **TASK-016**: Update `app/api/user/route.ts` to use singleton PrismaClient, remove `$disconnect()` call
- [ ] 🟡 **TASK-017**: Audit all API routes to ensure singleton usage

### 1.4 Configuration Externalization

- [ ] 🟡 **TASK-018**: Create environment variable `FAS_API_URL` for external FAS endpoint
- [ ] 🟡 **TASK-019**: Update U-Plan generation endpoint to use `FAS_API_URL` env var
- [ ] 🟡 **TASK-020**: Update `.env.example` file documenting all required environment variables
- [ ] 🟡 **TASK-021**: Add startup validation for required environment variables in `next.config.mjs`

### 1.5 Error Handling

- [ ] 🟡 **TASK-022**: Create standardized API error response utility (`lib/api-errors.ts`)
- [ ] 🟡 **TASK-023**: Implement error logging utility (`lib/logger.ts`)
- [ ] 🟡 **TASK-024**: Apply consistent error handling to all API endpoints

### 1.6 Cleanup Old APIs

- [ ] 🟡 **TASK-025**: Mark Pages Router APIs as deprecated (add deprecation comments)
- [ ] 🟡 **TASK-026**: Update all frontend API calls to use new App Router endpoints
- [ ] 🟡 **TASK-027**: Remove deprecated Pages Router API files after migration verification

---

## Phase 2: Auth System Overhaul

### 2.1 Token Management

- [ ] 🟡 **TASK-028**: Implement refresh token system with separate expiration
- [ ] 🟡 **TASK-029**: Create `app/api/auth/refresh/route.ts` endpoint for token refresh
- [ ] 🟡 **TASK-030**: Store refresh tokens in httpOnly cookies
- [ ] 🟡 **TASK-031**: Add token refresh logic to `useAuth` hook
- [ ] 🟡 **TASK-032**: Implement automatic token refresh before expiration

### 2.2 Login/Signup Improvements

- [ ] 🟡 **TASK-033**: Fix error state handling in `login-form.tsx` (currently commented out)
- [ ] 🟡 **TASK-034**: Display specific error messages (invalid credentials, network error, etc.)
- [ ] 🟡 **TASK-035**: Add loading spinner during login submission
- [ ] 🟡 **TASK-036**: Add loading spinner during signup submission
- [ ] 🟡 **TASK-037**: Implement form validation feedback (email format, password strength)
- [ ] 🟡 **TASK-038**: Add password confirmation field to signup form
- [ ] 🟡 **TASK-039**: Style error messages consistently with app theme

### 2.3 Session Management

- [ ] 🟡 **TASK-040**: Improve `useAuth` hook to handle token expiration gracefully
- [ ] 🟡 **TASK-041**: Add automatic logout on token expiration with user notification
- [ ] 🟡 **TASK-042**: Improve cross-tab synchronization for auth state
- [ ] 🟡 **TASK-043**: Clear all sensitive data from localStorage on logout

### 2.4 Header User Handling

- [ ] 🟡 **TASK-044**: Create `AuthProvider` context component (`app/components/auth/auth-provider.tsx`)
- [ ] 🟡 **TASK-045**: Refactor header to use AuthProvider context instead of direct hook
- [ ] 🟡 **TASK-046**: Add loading skeleton while fetching user info
- [ ] 🟡 **TASK-047**: Handle edge cases (token valid but user deleted)
- [ ] 🟡 **TASK-048**: Add user dropdown menu with profile/logout options

### 2.5 Protected Routes

- [ ] 🟡 **TASK-049**: Create `ProtectedRoute` wrapper component (`app/components/auth/protected-route.tsx`)
- [ ] 🟡 **TASK-050**: Apply protection to `/trajectory-generator` page
- [ ] 🟡 **TASK-051**: Apply protection to `/plan-generator` page
- [ ] 🟡 **TASK-052**: Add redirect to login with return URL preservation

---

## Phase 3: FlightPlansUploader Refactor

### 3.1 Preserve Current Implementation

- [ ] 🟡 **TASK-053**: Copy `FlightPlansUploader.tsx` to `FlightPlansUploaderDev.tsx`
- [ ] 🟡 **TASK-054**: Update `FlightPlansUploaderDev.tsx` exports and component name
- [ ] 🟡 **TASK-055**: Create environment variable `NEXT_PUBLIC_PRODUCTION_MODE` flag
- [ ] 🟡 **TASK-056**: Update trajectory-generator page to conditionally load Dev or Production component

### 3.2 Component Architecture

- [ ] 🟡 **TASK-057**: Create `app/components/flight-plans/` directory structure
- [ ] 🟡 **TASK-058**: Create `StatusBadge.tsx` - plan status and authorization status display
- [ ] 🟡 **TASK-059**: Create `ActionButtons.tsx` - reusable action buttons with disabled state tooltips
- [ ] 🟡 **TASK-060**: Create `FlightPlanCard.tsx` - individual plan display with actions
- [ ] 🟡 **TASK-061**: Create `FlightPlanList.tsx` - plan listing with pagination
- [ ] 🟡 **TASK-062**: Create `FolderCard.tsx` - folder display with expand/collapse
- [ ] 🟡 **TASK-063**: Create `FolderList.tsx` - folder management with create/rename/delete
- [ ] 🟡 **TASK-064**: Create `ProcessingWorkflow.tsx` - step-by-step workflow guide
- [ ] 🟡 **TASK-065**: Create `AuthorizationPanel.tsx` - geoawareness + FAS authorization workflow
- [ ] 🟡 **TASK-066**: Create `GeoawarenessViewer.tsx` - geoawareness map with zone display
- [ ] 🟡 **TASK-067**: Create `TrajectoryViewer.tsx` - refactored trajectory visualization
- [ ] 🟡 **TASK-068**: Create `DateTimePicker.tsx` - timezone-aware datetime picker
- [ ] 🟡 **TASK-069**: Create barrel export file `index.ts`

### 3.3 Data Management Hooks

- [ ] 🟡 **TASK-070**: Create `useFlightPlans.ts` hook - flight plans data fetching with caching
- [ ] 🟡 **TASK-071**: Create `useFolders.ts` hook - folders data fetching with caching
- [ ] 🟡 **TASK-072**: Create `usePolling.ts` hook - reusable polling logic with cleanup
- [ ] 🟡 **TASK-073**: Implement 5-second polling interval for processing status updates
- [ ] 🟡 **TASK-074**: Add optimistic updates for immediate UI feedback

### 3.4 Production FlightPlansUploader

- [ ] 🟡 **TASK-075**: Create new `FlightPlansUploader.tsx` using modular components
- [ ] 🟡 **TASK-076**: Implement individual plan operations only (no bulk)
- [ ] 🟡 **TASK-077**: Remove folder status counters display
- [ ] 🟡 **TASK-078**: Remove global status summary box
- [ ] 🟡 **TASK-079**: Integrate all modular components into cohesive UI

---

## Phase 4: New Production UI

### 4.1 Folder Improvements

- [ ] 🟡 **TASK-080**: Implement folder rename in `FolderCard.tsx`
- [ ] 🟡 **TASK-081**: Add inline editing mode for folder names
- [ ] 🟡 **TASK-082**: Add rename validation (non-empty, unique within user)
- [ ] 🟡 **TASK-083**: Add confirmation for folder deletion

### 4.2 Workflow Implementation

- [ ] 🟡 **TASK-084**: Define workflow state machine (unprocessed → processing → processed → authorizing → authorized/denied)
- [ ] 🟡 **TASK-085**: Create workflow progress indicator in `ProcessingWorkflow.tsx`
- [ ] 🟡 **TASK-086**: Implement step highlighting: Process → Geoawareness → Authorize
- [ ] 🟡 **TASK-087**: Lock scheduledAt editing after processing starts
- [ ] 🟡 **TASK-088**: Add confirmation dialog before starting processing

### 4.3 Button State Management

- [ ] 🟡 **TASK-089**: Create disabled button tooltip system in `ActionButtons.tsx`
- [ ] 🟡 **TASK-090**: Process button: disabled if no scheduledAt → show "Select date/time first"
- [ ] 🟡 **TASK-091**: Process button: disabled if already processing → show "Processing in progress"
- [ ] 🟡 **TASK-092**: Authorize button: disabled if not processed → show "Process trajectory first"
- [ ] 🟡 **TASK-093**: Authorize button: disabled if already authorized → show "Already authorized"
- [ ] 🟡 **TASK-094**: Download button: disabled if no CSV result → show "No trajectory available"
- [ ] 🟡 **TASK-095**: Reset button: disabled if unprocessed → show "Nothing to reset"

### 4.4 Real-time Updates

- [ ] 🟡 **TASK-096**: Implement polling in `useFlightPlans.ts` with 5-second interval
- [ ] 🟡 **TASK-097**: Add visual indicator when data is being refreshed (subtle spinner)
- [ ] 🟡 **TASK-098**: Implement optimistic UI updates for user actions
- [ ] 🟡 **TASK-099**: Add smooth transitions when status changes
- [ ] 🟡 **TASK-100**: Handle polling errors gracefully with retry

### 4.5 DateTime Picker Fix

- [ ] 🟡 **TASK-101**: Investigate timezone offset bug in scheduledAt handling
- [ ] 🟡 **TASK-102**: Standardize DateTime storage as UTC in database
- [ ] 🟡 **TASK-103**: Convert to local timezone only for display in `DateTimePicker.tsx`
- [ ] 🟡 **TASK-104**: Add visual timezone indicator to picker (show UTC offset)
- [ ] 🟡 **TASK-105**: Test DateTime picker across different browser timezones

### 4.6 Plan Reset Functionality

- [ ] 🟡 **TASK-106**: Implement reset logic in `app/api/flightPlans/[id]/reset/route.ts`
- [ ] 🟡 **TASK-107**: Reset deletes csvResult, clears authorization fields, sets status to "sin procesar"
- [ ] 🟡 **TASK-108**: Add reset button to `FlightPlanCard.tsx`
- [ ] 🟡 **TASK-109**: Add confirmation dialog for plan reset with warning
- [ ] 🟡 **TASK-110**: Show reset option only when plan has been processed

### 4.7 Geoawareness Integration

- [ ] 🟡 **TASK-111**: Remove placeholder fallback for geoawareness connection errors
- [ ] 🟡 **TASK-112**: Implement proper error message display for geoawareness failures
- [ ] 🟡 **TASK-113**: Add retry button for failed geoawareness requests
- [ ] 🟡 **TASK-114**: Display geoawareness response map with trajectory overlay in `GeoawarenessViewer.tsx`
- [ ] 🟡 **TASK-115**: Highlight violated geozones with different colors/patterns
- [ ] 🟡 **TASK-116**: Add legend explaining geozone types and colors

### 4.8 Visualization Improvements

- [ ] 🟡 **TASK-117**: Improve trajectory visualization with time-based playback controls
- [ ] 🟡 **TASK-118**: Add speed control for trajectory playback
- [ ] 🟡 **TASK-119**: Create FAS response message viewer with proper JSON formatting
- [ ] 🟡 **TASK-120**: Add copy-to-clipboard for FAS response messages

---

## Phase 5: PlanGenerator Enhancements

### 5.1 Waypoint Pause Configuration

- [ ] 🟢 **TASK-121**: Add `pauseDuration` field to Waypoint interface
- [ ] 🟢 **TASK-122**: Add pause duration input field to waypoint editor UI
- [ ] 🟢 **TASK-123**: Update `generateQGCPlan` to include pause in params[0]
- [ ] 🟢 **TASK-124**: Add validation for pause duration (0-3600 seconds)
- [ ] 🟢 **TASK-125**: Display pause duration indicator on waypoint markers

### 5.2 Fly-By / Fly-Over Toggle

- [ ] 🟢 **TASK-126**: Add `flyOverMode` field to Waypoint interface (boolean)
- [ ] 🟢 **TASK-127**: Create toggle switch UI for fly-by/fly-over in waypoint editor
- [ ] 🟢 **TASK-128**: Update `generateQGCPlan`: set params[0]=0.1 for fly-over waypoints
- [ ] 🟢 **TASK-129**: Add visual indicator on map for fly-over waypoints (different marker style)
- [ ] 🟢 **TASK-130**: Add tooltip explaining fly-by vs fly-over behavior

### 5.3 SCAN Pattern Generator

- [ ] 🟢 **TASK-131**: Create `ScanPatternGenerator.tsx` component
- [ ] 🟢 **TASK-132**: Implement polygon drawing tool on map (click to add vertices)
- [ ] 🟢 **TASK-133**: Add polygon editing (drag vertices, delete vertices)
- [ ] 🟢 **TASK-134**: Add start point selection on map
- [ ] 🟢 **TASK-135**: Add end point selection on map
- [ ] 🟢 **TASK-136**: Create altitude input for SCAN pattern (fixed altitude)
- [ ] 🟢 **TASK-137**: Create spacing input (meters between parallel scan lines)
- [ ] 🟢 **TASK-138**: Create angle input (direction of scan lines, 0-360 degrees)
- [ ] 🟢 **TASK-139**: Create angle visual indicator on map
- [ ] 🟢 **TASK-140**: Implement SCAN algorithm in `lib/scan-generator.ts`
- [ ] 🟢 **TASK-141**: Generate parallel lines based on angle and spacing
- [ ] 🟢 **TASK-142**: Clip parallel lines to polygon boundary
- [ ] 🟢 **TASK-143**: Create zigzag path connecting parallel lines efficiently
- [ ] 🟢 **TASK-144**: Add takeoff waypoint at start point
- [ ] 🟢 **TASK-145**: Add landing waypoint at end point
- [ ] 🟢 **TASK-146**: Show real-time preview of generated SCAN pattern on map
- [ ] 🟢 **TASK-147**: Add "Apply" button to generate waypoints from SCAN pattern
- [ ] 🟢 **TASK-148**: Add "Cancel" button to discard SCAN configuration
- [ ] 🟢 **TASK-149**: Validate SCAN parameters (minimum polygon area, reasonable spacing)
- [ ] 🟢 **TASK-150**: Add SCAN statistics display (estimated flight time, total distance, waypoint count)

### 5.4 Service Area Visualization

- [ ] 🟢 **TASK-151**: Improve FAS service area rectangle styling (dashed border, subtle fill)
- [ ] 🟢 **TASK-152**: Add semi-transparent overlay outside service area
- [ ] 🟢 **TASK-153**: Show service area bounds in sidebar info panel
- [ ] 🟢 **TASK-154**: Add warning when waypoints approach service area boundary

---

## Phase 6: UI/UX Polish

### 6.1 Theme System

- [ ] 🟢 **TASK-155**: Create `app/styles/themes.css` with CSS custom properties
- [ ] 🟢 **TASK-156**: Define light theme color palette
- [ ] 🟢 **TASK-157**: Define dark theme color palette (refine current)
- [ ] 🟢 **TASK-158**: Create `useTheme.ts` hook for theme management
- [ ] 🟢 **TASK-159**: Store theme preference in localStorage with system preference detection
- [ ] 🟢 **TASK-160**: Create `ThemeToggle.tsx` component with sun/moon icons
- [ ] 🟢 **TASK-161**: Add theme toggle to header
- [ ] 🟢 **TASK-162**: Apply CSS variables to all components systematically
- [ ] 🟢 **TASK-163**: Update Tailwind config to use CSS variables
- [ ] 🟢 **TASK-164**: Test theme consistency across all pages
- [ ] 🟢 **TASK-165**: Add smooth transition when switching themes

### 6.2 Loading States and Animations

- [ ] 🟢 **TASK-166**: Create `LoadingSpinner.tsx` component with multiple sizes
- [ ] 🟢 **TASK-167**: Create `LoadingSkeleton.tsx` for content placeholders
- [ ] 🟢 **TASK-168**: Add loading spinner to login form during submission
- [ ] 🟢 **TASK-169**: Add loading skeleton to flight plans list while fetching
- [ ] 🟢 **TASK-170**: Add loading indicator during trajectory processing
- [ ] 🟢 **TASK-171**: Add loading indicator during authorization requests
- [ ] 🟢 **TASK-172**: Add loading indicator during geoawareness requests
- [ ] 🟢 **TASK-173**: Implement smooth fade transitions between loading and content states
- [ ] 🟢 **TASK-174**: Add subtle page transition animations
- [ ] 🟢 **TASK-175**: Add micro-interactions for buttons (hover scale, active press)
- [ ] 🟢 **TASK-176**: Add success animation when operations complete

### 6.3 Responsive Design

- [ ] 🟢 **TASK-177**: Define breakpoints: mobile (640px), tablet (768px), desktop (1024px), large (1280px)
- [ ] 🟢 **TASK-178**: Make header responsive with collapsible mobile menu
- [ ] 🟢 **TASK-179**: Make flight plans list responsive (card layout on smaller screens)
- [ ] 🟢 **TASK-180**: Make folder list responsive with collapsible folders
- [ ] 🟢 **TASK-181**: Make PlanGenerator sidebar collapsible/drawer on tablet
- [ ] 🟢 **TASK-182**: Make map components full-width on mobile with overlay controls
- [ ] 🟢 **TASK-183**: Test all pages on mobile viewport (640px)
- [ ] 🟢 **TASK-184**: Test all pages on tablet viewport (768px)
- [ ] 🟢 **TASK-185**: Test all pages on desktop viewport (1024px+)

### 6.4 Unified Color Scheme

- [ ] 🟢 **TASK-186**: Define semantic color tokens (primary, secondary, accent, muted)
- [ ] 🟢 **TASK-187**: Define status colors (success: green, warning: amber, error: red, info: blue)
- [ ] 🟢 **TASK-188**: Define processing state colors (queued: yellow, processing: blue, completed: green, error: red)
- [ ] 🟢 **TASK-189**: Define authorization state colors (pending: yellow, approved: green, denied: red)
- [ ] 🟢 **TASK-190**: Apply consistent colors to all status badges
- [ ] 🟢 **TASK-191**: Apply consistent colors to all buttons (primary, secondary, danger)
- [ ] 🟢 **TASK-192**: Apply consistent colors to all form inputs

### 6.5 Toast and Notifications

- [ ] 🟢 **TASK-193**: Create `Toast.tsx` component with variants (success, error, warning, info)
- [ ] 🟢 **TASK-194**: Create `ToastProvider.tsx` context for global toast management
- [ ] 🟢 **TASK-195**: Create `useToast.ts` hook for easy toast triggering
- [ ] 🟢 **TASK-196**: Implement toast auto-dismiss with configurable duration
- [ ] 🟢 **TASK-197**: Add toast animations (slide in from top-right, fade out)
- [ ] 🟢 **TASK-198**: Replace all `alert()` calls with toast notifications
- [ ] 🟢 **TASK-199**: Add success toast for completed operations
- [ ] 🟢 **TASK-200**: Add error toast for failed operations with retry option

### 6.6 Tooltips and Help

- [ ] 🟢 **TASK-201**: Create `Tooltip.tsx` component with positioning options
- [ ] 🟢 **TASK-202**: Add tooltips to all icon-only buttons
- [ ] 🟢 **TASK-203**: Add help tooltips to complex form fields
- [ ] 🟢 **TASK-204**: Add contextual help icons for workflow steps

---

## Phase 7: Testing and Documentation

### 7.1 Testing

- [ ] ⚪ **TASK-205**: Set up Jest for unit testing
- [ ] ⚪ **TASK-206**: Write tests for auth utilities (`lib/auth.ts`)
- [ ] ⚪ **TASK-207**: Write tests for SCAN pattern generator (`lib/scan-generator.ts`)
- [ ] ⚪ **TASK-208**: Write tests for API validators (`lib/validators.ts`)
- [ ] ⚪ **TASK-209**: Write tests for date/timezone utilities

### 7.2 Documentation

- [ ] ⚪ **TASK-210**: Update README with new architecture overview
- [ ] ⚪ **TASK-211**: Update API_DOCUMENTATION.md with new endpoints
- [ ] ⚪ **TASK-212**: Add JSDoc comments to all utility functions
- [ ] ⚪ **TASK-213**: Document environment variables in .env.example
- [ ] ⚪ **TASK-214**: Create CONTRIBUTING.md with development guidelines

---

## Task Dependencies

```
Phase 1 (Backend) - Foundation
├── TASK-001 (JWT secret) ──┐
├── TASK-002 (Middleware) ──┼── TASK-004..011 (API Migration)
├── TASK-003 (Validators) ──┘
└── TASK-012..013 (Auth on APIs) ── requires TASK-004..011

Phase 2 (Auth) - Depends on Phase 1
├── TASK-028..032 (Tokens) ── requires TASK-001..002
├── TASK-033..039 (Forms) ── independent
├── TASK-044..048 (Header) ── requires TASK-028..032
└── TASK-049..052 (Protected) ── requires TASK-044

Phase 3 (Refactor) - Depends on Phase 2
├── TASK-053..056 (Preserve Dev) ── independent
├── TASK-057..069 (Components) ── independent
├── TASK-070..074 (Hooks) ── requires TASK-004..011
└── TASK-075..079 (Production UI) ── requires TASK-057..074

Phase 4 (Production UI) - Depends on Phase 3
├── TASK-080..083 (Folders) ── requires TASK-063
├── TASK-084..095 (Workflow/Buttons) ── requires TASK-064..065
├── TASK-096..100 (Polling) ── requires TASK-070..072
├── TASK-101..105 (DateTime) ── requires TASK-068
├── TASK-106..110 (Reset) ── requires TASK-007
└── TASK-111..120 (Geoawareness/Viz) ── requires TASK-066..067

Phase 5 (PlanGenerator) - Independent
├── TASK-121..125 (Pauses) ── independent
├── TASK-126..130 (Fly-Over) ── independent
├── TASK-131..150 (SCAN) ── sequential within
└── TASK-151..154 (Service Area) ── independent

Phase 6 (UI/UX) - Depends on Phase 3
├── TASK-155..165 (Theme) ── requires component structure
├── TASK-166..176 (Loading) ── requires TASK-155..165
├── TASK-177..185 (Responsive) ── requires all components
├── TASK-186..192 (Colors) ── requires TASK-155..165
├── TASK-193..200 (Toast) ── independent
└── TASK-201..204 (Tooltips) ── requires TASK-059

Phase 7 (Testing) - After all phases
└── All testing tasks depend on respective implementations
```

## Priority Execution Order

### Sprint 1: Critical Security & Foundation
1. TASK-001 to TASK-003 (Security fixes)
2. TASK-004 to TASK-013 (API migration with auth)
3. TASK-014 to TASK-024 (Standardization)

### Sprint 2: Auth System
4. TASK-028 to TASK-052 (Complete auth overhaul)

### Sprint 3: Component Architecture
5. TASK-053 to TASK-056 (Preserve dev component)
6. TASK-057 to TASK-079 (New modular components)

### Sprint 4: Production UI Features
7. TASK-080 to TASK-120 (All production UI features)

### Sprint 5: PlanGenerator Features
8. TASK-121 to TASK-154 (All PlanGenerator enhancements)

### Sprint 6: UI/UX Polish
9. TASK-155 to TASK-204 (All polish tasks)

### Sprint 7: Testing & Documentation
10. TASK-205 to TASK-214 (Testing and docs)

---

## Notes

### Development Mode Access
After completion, the original `FlightPlansUploaderDev.tsx` will remain available for:
- Bulk upload operations
- Batch processing of folders
- Development and testing scenarios
- Status counters and monitoring

Access via: `NEXT_PUBLIC_PRODUCTION_MODE=false`

### Migration Safety
- All Pages Router APIs will be deprecated but kept during transition
- Frontend will be updated to use new App Router endpoints
- Old APIs removed only after thorough testing

---

## Phase 8: Post-Launch QA Fixes

### 8.1 SCAN Pattern Generator Fixes

- [ ] 🔴 **TASK-215**: Fix SCAN mode map click handler - clicks currently add waypoints to manual mode instead of SCAN polygon
- [ ] 🟡 **TASK-216**: Integrate ScanPatternGeneratorV2 properly with PlanMap click events using refs for stable handlers

### 8.2 Trajectory Generator UI Improvements

- [ ] 🔴 **TASK-217**: Add plan selection UI in Trajectory Generator - users cannot select plans to work with
- [ ] 🟡 **TASK-218**: Make Trajectory Generator buttons larger and more touch-friendly
- [ ] 🟡 **TASK-219**: Replace CSV download with trajectory map viewer - show trajectory on interactive map
- [ ] 🟡 **TASK-220**: Add waypoint preview/viewer for each flight plan card
- [ ] 🟡 **TASK-221**: Make plan names larger and add inline editing capability
- [ ] 🟡 **TASK-222**: Implement drag-and-drop for moving plans between folders
- [ ] 🟢 **TASK-223**: Improve desktop layout - reduce max-width and better use of horizontal space

---

**Total Tasks: 223**

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Backend | 27 | 🔴🟡 Critical/High |
| Phase 2: Auth | 25 | 🟡 High |
| Phase 3: Refactor | 27 | 🟡 High |
| Phase 4: Production UI | 41 | 🟡 High |
| Phase 5: PlanGenerator | 34 | 🟢 Medium |
| Phase 6: UI/UX | 50 | 🟢 Medium |
| Phase 7: Testing | 10 | ⚪ Low |
| Phase 8: Post-Launch QA | 9 | 🔴🟡 Critical/High |
