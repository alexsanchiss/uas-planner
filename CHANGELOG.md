# Changelog

All notable changes to UPPS are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] - 2026-10-26 (restructure)

### Before deploying (operators)

- Run `npm ci` on each instance (3002, 3003, 3004). `bcrypt` 6 and `sharp` 0.35 ship new native binaries; then `npm run build` and restart.
- Node >= 20.9 is now required (`engines`).
- Set `NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA` explicitly. Random U-Plan data is on unless the value is `false`; the UI and the server now read it the same way. It is baked in at build time.
- Optional: set `FAS_CALLBACK_ALLOWED_IPS` (comma-separated) to restrict the FAS callback. First check the logged `[FAS Callback] source IP` for a real callback; with the variable unset nothing changes. The check uses the right-most `X-Forwarded-For` entry, so all traffic must go through Caddy.
- `.env.example` is now complete. New or newly listed variables: `MACHINE_API_KEY`, `CESIUM_ION_TOKEN`, `NEXT_PUBLIC_APP_URL`, `MAILERSEND_SENDER_EMAIL`, `MAILERSEND_SENDER_NAME`, `SUPPORT_EMAIL`, `FAS_CALLBACK_ALLOWED_IPS`, `LOG_LEVEL`.
- In production the server now refuses to start without `JWT_SECRET`.
- Uncommitted at the time of writing: `GET /api/machine/flightPlans` filters out plans scheduled more than 5 minutes ago. Confirm with its consumer before shipping.

### Changed (users)

- Plan Authorization is one screen for both modes (dev adds bulk and researcher tools). It has a folders panel, an accessible plan table with mobile cards, status chips, an upload dropzone, a schedule popover and a sync indicator. Heavy viewers load on demand.
- Plan Definition has a keyboard-reachable U-space list, collapsible planner sections, labelled inputs, waypoint reordering and a bottom sheet on small screens. It warns before leaving with unsaved waypoints.
- Plan Activation groups plans into Ready now, Upcoming and History, with a countdown.
- Dark mode follows the in-app toggle instead of the OS. Colours meet WCAG AA, dialogs trap focus and close with Escape, and every delete or reset asks for confirmation.
- English is the default language; the page language and titles follow the selected one.
- Fixed: the Dev U-Plan save double-encoded its content, production polling never stopped, and "View CSV" and plan deletion used the `csvResult` flag as an id.

### Changed (API and security)

- `GET /api/flightPlans?fields=summary` and `GET /api/folders?fields=summary` return light listings. Default responses are unchanged. The UI polls every 3 s while a plan is in flight and every 15 s otherwise, and pauses on hidden tabs.
- Ownership is enforced on `/api/csvResult` and `/api/flightPlans/[id]/geoawareness`; clients can only reset authorization fields; `folderId` must belong to the caller; folder deletes are scoped to the owner. A plan that is approved or pending can no longer have its U-Plan edited.
- All FAS calls go through `lib/fas.ts` (30 s timeout, 120 s for the U-Plan POST).
- Rate limits and the callback allowlist use the right-most `X-Forwarded-For`. Signup, resend and contact are rate-limited. Email content is HTML-escaped, and baseline security headers are set.
- Cloned folders start unauthorized and unactivated.
- No change to the FAS callback, `/api/machine/*`, outbound FAS calls, the geoawareness service, the MySQL schema or the email links.

### Tooling

- Dependencies: Next 15.5.28, Cesium 1.146, zod 4, ESLint 9 (flat config), `bcrypt` 6, `sharp` 0.35. Unused packages removed. `npm audit` went from 35 findings to 0. Dependabot covers npm and GitHub Actions.
- CI is one job: prisma validate/generate, typecheck, lint, jest, build, audit. `next build` no longer lints. New `npm run typecheck`.
- Docs rewritten: `AGENTS.md` is the single source for agents, plus `docs/ARCHITECTURE.md` and `docs/API.md`. Stale planning files and dead code were removed; the ICD sources moved to `docs/icd`.

## [2.4.0] — 2026-05-02

### Added
- **`GET /api/flightPlans/[id]/terms`** — Proxy autenticado al FAS que devuelve los términos y condiciones para un plan aprobado, bajo demanda en cada apertura del modal.
- **`POST /api/flightPlans/[id]/activate`** — Endpoint de activación: valida ventana ±60 s de `scheduledAt`, cooldown de 5 s, llama al FAS `GET /activation/[externalResponseNumber]` y persiste el resultado (`activatedAt`, `activationStatus`, `activationMessage`).
- **`GET /api/flightPlans/active`** — Lista planes aprobados del usuario con `scheduledAt` entre `now-1h` y `now+24h`.
- **`GET /api/flightPlans/history`** — Lista planes históricos paginados (activados, ventana pasada, denegados/retirados). Parámetros `limit` (max 100) y `offset`.
- **`ActivateFlightModal`** — Modal que carga los T&C del FAS con `JsonViewerSections`, requiere checkbox de aceptación, ejecuta la activación y muestra cooldown de 5 s en reintentos denegados.
- **`FlightPlanActivationCard`** — Tarjeta de plan activable: muestra nombre, `scheduledAt`, estado de autorización, panel verde "PUEDE DESPEGAR" con countdown de 60 s, y botón "Activar vuelo" deshabilitado fuera de la ventana.
- **`HistoricalFlightPlanList`** — Lista paginada (10 por página) de planes históricos con nombre, fecha, estado de autorización y estado de activación.
- **`JsonViewerSections`** — Componente recursivo que renderiza JSON arbitrario como secciones colapsables con jerarquía visual (h3/h4/dl/ul), maxDepth configurable.
- **`useActivationPlans`** — Hook con polling a 30 s, tick local de 1 s para ventanas en tiempo real, y función `activate(planId, termsAccepted)`.
- **`/plan-activation` page** — Página completa: sección "Vuelos activables" (filtrado ±60 s en cliente con tick 1 s) y sección "Historial" colapsable.
- **Campos de activación en `flightPlan`**: `activationStatus`, `activatedAt`, `activationMessage`, `termsAcceptedAt`, `lastActivationAttempt`.

### Fixed
- **Traducciones i18n duplicadas** — Bloque `planActivation` consolidado en interfaz, `en` y `es` con 25 claves completas (sin duplicados).

---

## [2.3.0] — 2026-05-01

### Added
- **`lib/scrs.ts`** — Parser defensivo para el campo `scr_dispatch` del `authorizationMessage` del FAS. Extrae la trayectoria alternativa propuesta por el SCRS, convierte coordenadas GeoJSON y concatena waypoints de todos los segmentos con deduplicación en costuras.
- **`lib/qgc-plan.ts`** — Extracción del builder de planes QGroundControl (`.plan`) a una librería reutilizable (`buildQgcPlan`). Permite generar el JSON de misión desde cualquier endpoint sin depender del componente React.
- **`AlternativeTrajectoryModal`** — Nuevo modal SSR-safe que muestra la trayectoria actual del plan (azul) y la alternativa propuesta por el SCRS (verde discontinua) sobre un mapa Leaflet. Incluye botones Rechazar / Aceptar alternativa con spinner.
- **`POST /api/flightPlans/[id]/accept-alternative`** — Endpoint que acepta la alternativa SCRS: valida el mensaje, construye waypoints + landing a 0 m, regenera `fileContent` (QGC .plan), actualiza `uplan.flightDetails.waypoints`, y resetea el plan a `sin procesar` en transacción Prisma.
- **Botón "Ver alternativa"** en el modal de resultado de autorización: solo visible cuando el plan está denegado y el `authorizationMessage` contiene un `scr_dispatch` válido (`sent=true`, `status_code=200`, `response.status=success`, segmentos no vacíos).
- **`DenialMapContent.tsx`** — Módulo client-only que aisla la lógica del mapa Leaflet de `DenialMapModal`, siguiendo el patrón de `TrajectoryMapViewer` y `GeoawarenessViewer`.

### Changed
- **`app/components/PlanGenerator.tsx`** — Refactorizado para delegar en `buildQgcPlan` de `lib/qgc-plan.ts`. Comportamiento idéntico al anterior.

### Fixed
- **Cierre de sesión por inactividad** — Eliminada completamente la lógica de *inactivity timeout* (10 min) en `app/hooks/useAuth.ts`. La sesión solo expira cuando caduca el refresh token, evitando cierres erróneos en sesiones activas.
- **`window is not defined` en SSR** — `DenialMapModal` importaba `react-leaflet` directamente, causando el error en el servidor. Corregido con importaciones dinámicas `ssr: false` en el nuevo `DenialMapContent.tsx`.

### Removed
- Constantes `INACTIVITY_TIMEOUT_MS` y `ACTIVITY_THROTTLE_MS` en `useAuth.ts`.
- Listeners de eventos de actividad (`mousemove`, `keydown`, `scroll`, `touchstart`, `click`) para el tracking de inactividad.

---

## [2.2.2] — 2025-??

Initial tracked release.
