# Changelog

All notable changes to UPPS are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

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
