# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Reglas de ingeniería globales en `~/.claude/rules/user.instructions.md` (auto-cargadas, no negociables).
> Para tareas no triviales: escribir plan en `tasks/todo.md` → implementar → verificar → registrar lecciones en `tasks/lessons.md`.

## Commands

```bash
npm run dev              # Dev server → http://localhost:3003 (not 3000 — README is wrong)
npm run build            # Production build (also runs copy-cesium)
npm run start            # Prod server → http://localhost:3003
npm run lint             # ESLint via next lint
npm test                 # Jest unit tests
npm test -- --testPathPattern=<file>  # Run single test file
npm run test:watch       # Jest watch mode
npm run test:coverage
npx prisma migrate dev   # Apply DB migrations (MySQL required)
npx prisma studio        # GUI for DB inspection
npm run copy-cesium      # Manual: copies Cesium assets to public/cesium
node traj-assigner       # Trajectory dispatcher — runs separately from Next.js
```

## Stack

Next.js 15 App Router · React 18 · TypeScript · Tailwind CSS · MySQL + Prisma ORM · JWT auth · Zod validation · Jest · CesiumJS (3D) · Leaflet (2D)

## Critical Gotchas

### `csvResult` is a boolean flag, NOT an ID

```typescript
// ❌ WRONG
prisma.csvResult.findUnique({ where: { id: flightPlan.csvResult } })

// ✅ CORRECT — csvResult shares the same PK as flightPlan (1:1)
if (!plan.csvResult) return null;   // 0/null = no result exists
prisma.csvResult.findUnique({ where: { id: plan.id } })
```

### JWT: split storage

- **Access token** (15 min): `localStorage.getItem('authToken')` — sent as `Authorization: Bearer <token>`
- **Refresh token** (7 days): httpOnly cookie — auto-sent on `POST /api/auth/refresh`
- All protected API routes use `withAuth()` from `lib/auth-middleware.ts`
- **FAS callback** `PUT /api/fas/[externalResponseNumber]` is public — no JWT required

### Cesium postinstall

`npm install` auto-runs `copy-cesium`. If `public/cesium/` is missing after install, run `npm run copy-cesium` manually.

### `NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA`

Controls behavior of `POST /api/flightPlans/[id]/generate-volumes`:
- `!== 'false'` (default): generates 4D volumes + random placeholder data for all U-Plan fields
- `'false'`: generates only 4D volumes; user fills remaining fields manually in the form

## Architecture

```
app/
  api/
    auth/             # login, signup, refresh, logout, verify-email, forgot/reset-password
    flightPlans/      # CRUD + bulk ops
      [id]/           # Single plan: GET/PUT/DELETE, /reset, /uplan, /generate-volumes, /geoawareness
      regenerate-volumes/  # Bulk volume regeneration
    folders/          # Folder CRUD ([id]/)
    csvResult/        # GET (single), POST (bulk fetch), DELETE
    fas/[externalResponseNumber]/  # FAS authorization callback (public, no JWT)
    geoawareness/
      uspaces/        # List U-spaces
      stream/[uspaceId]/  # WebSocket-based geoawareness stream
    user/             # GET current user, /profile, /drafts ([id]/)
    cesium/token/     # Cesium ion token
    contact/
  components/
    FlightPlansUploader.tsx       # Production uploader (simpler)
    FlightPlansUploaderDev.tsx    # Dev uploader — bulk ops, all features enabled
    PlanGenerator.tsx             # Individual plan creation via the plan-definition flow
    flight-plans/                 # FlightPlanCard, FolderCard, StatusBadge, UplanFormModal,
                                  # TrajectoryMapViewer, GeoawarenessViewer, Trajectory3DViewer,
                                  # Cesium3DModal, ProcessingWorkflow, ActionButtons, etc.
    plan-definition/              # ScanPatternGenerator(V2), UspaceSelector, GeozoneLayer
    auth/                         # LoginForm, SignupForm, AuthProvider, ProtectedRoute, etc.
    ui/                           # Shared primitives (button, modal, toast, badge, etc.)
  hooks/
    useFlightPlans.ts    # 5-second polling, CRUD, optimistic updates
    useFolders.ts
    useAuth.ts
    usePolling.ts
    useGeoawarenessWebSocket.ts
    useVolumeRegeneration.ts
    useUspaces.ts
    useToast.ts, useTheme.ts
  styles/
    themes.css           # CSS custom properties — always use vars, never hardcoded hex
lib/
  auth.ts               # JWT sign/verify utilities
  auth-middleware.ts    # withAuth() — returns userId or NextResponse 401
  validators.ts         # Zod schemas for all API inputs
  prisma.ts             # PrismaClient singleton
  api-errors.ts         # Standardized error responses
  scan-generator.ts     # SCAN pattern algorithm
  date-utils.ts         # Date/timezone helpers
  uplan/                # U-Plan generation library
    tray_to_uplan.ts        # Converts trajectory CSV → U-Plan JSON (entry point)
    generate_oriented_volumes.ts
    generate_json.ts / generate_random_json.ts / generate_bbox.ts
    geodesy-utils.ts, vincenty.ts
  __tests__/            # Unit tests (auth, validators, date-utils, scan-generator, geodesy)
prisma/schema.prisma    # DB schema (MySQL)
types/                  # Shared TypeScript types
traj-assigner/          # Standalone Node process — assigns trajectory jobs to VMs
```

## DB Models (Key Relationships)

```
user          1──* flightPlan   (userId, onDelete: Cascade)
user          1──* folder       (userId)
user          1──* uplanDraft   (userId, onDelete: Cascade)
folder        1──* flightPlan   (folderId)
flightPlan    1──1 csvResult    (same PK — see Critical Gotchas)
flightPlan    *──1 machine      (machineAssignedId)
```

`uplanDraft` stores serialized U-Plan form state as JSON (`draftData`). Load/save via `GET|POST /api/user/drafts` and `GET|PUT|DELETE /api/user/drafts/[id]`.

## Flight Plan Processing Pipeline

```
Upload → "sin procesar"
  └→ Schedule (set scheduledAt)
      └→ Queue → "en cola"
          └→ traj-assigner picks up → "procesando" → VM runs traj-runner
              └→ VM callback creates csvResult → "procesado", csvResult=1
                  └→ generate-volumes → U-Plan JSON written to flightPlan.uplan
                      └→ POST /uplan → FAS API → authorizationStatus: "aprobado"/"denegado"
                          └→ FAS callback PUT /api/fas/[externalResponseNumber]
```

## API Patterns

### Unified bulk operations (flightPlans + csvResult)

```typescript
// Individual vs bulk detection is automatic based on body shape:
POST /api/flightPlans           // { customName, ... }  → single
POST /api/flightPlans           // { items: [...] }     → bulk (up to 500/call)

PUT  /api/flightPlans           // { id, data }         → single
PUT  /api/flightPlans           // { ids, data }        → bulk uniform
PUT  /api/flightPlans           // { items: [{id,data}] } → bulk per-item

DELETE /api/flightPlans         // { id }               → single
DELETE /api/flightPlans         // { ids }              → bulk (chunked in 200-item DB transactions)

POST /api/csvResult             // { ids: [...] }       → bulk fetch (up to 5000 IDs)
```

### Flight plan status values

```typescript
type FlightPlanStatus    = 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error'
type AuthorizationStatus = 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado' | 'withdrawn'
```

## Environment Variables

```env
DATABASE_URL=mysql://root:password@localhost:3306/uas_planner   # required
JWT_SECRET=...                                                   # required
FAS_API_URL=...                                                  # optional — FAS submission target
NEXT_PUBLIC_PRODUCTION_MODE=...                                  # optional — controls UI mode
NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA=...                       # optional — see gotcha above
```

## Themes

CSS custom properties in `app/styles/themes.css`. Always use `--bg-primary`, `--text-primary`, `--brand-primary`, etc. — never hardcoded hex values in components.

## Tests

Unit tests in `lib/__tests__/`. Run a single file: `npm test -- --testPathPattern=scan-generator`.

## Commit Convention

Conventional Commits: `feat(scope): description`
Scopes: `api`, `ui`, `auth`, `db`, `flight-plans`, `scan`, `uplan`
