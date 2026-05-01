# Changelog

All notable changes to UPPS are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
