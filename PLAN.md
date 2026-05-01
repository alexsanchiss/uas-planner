# PLAN — UPPS v2.3.0 y v2.4.0

> Documento de referencia para el orquestador autónomo. La lista de tareas a ejecutar está en `TASKS.md`. Plan extendido (con hallazgos del codebase y mapa de archivos) en `C:\Users\ASANMAR4\.claude\plans\vamos-a-seguir-mejorando-pure-peach.md`.

## Estado actual

- Versión `package.json`: **2.2.2**.
- Branch base: `master`.
- ICD: `icd.tex` (única ubicación).
- `CHANGELOG.md`: no existe; debe crearse.

## Releases planificadas

| Release | Alcance | Tag |
| --- | --- | --- |
| **v2.3.0** | Estabilidad (logout inactividad eliminado, fix SSR Leaflet) + flujo de trayectoria alternativa SCRS | `v2.3.0` |
| **v2.4.0** | Página `Plan Activation` completa + nuevos endpoints FAS `/terms` y `/activate` | `v2.4.0` |

## Decisiones de diseño (no negociables — confirmadas con el usuario)

1. **Logout inactividad**: eliminar completamente la lógica en `app/hooks/useAuth.ts`. La sesión solo expira cuando el refresh token vence.
2. **Trigger SCRS**: mostrar la alternativa solo si `scr_dispatch.sent === true && scr_dispatch.status_code === 200 && response.status === 'success' && segments.length > 0`.
3. **Aterrizaje en alternativa**: añadir un waypoint final con `(lat, lon)` del último punto del SCRS y altitud `0 m`.
4. **Modelo BD activación**: extender `flightPlan` con campos nuevos (sin tabla nueva).
5. **Detección de ventana ±1 min**: lazy en frontend, sin cron. Endpoint backend revalida al activar.
6. **ICD por release**: añadir subsección `Novedades en VX.Y.Z` y actualizar las secciones técnicas afectadas.
7. **Versionado**: bump y tag únicos al cierre de cada release.
8. **T&C**: GET on-demand al abrir el modal, sin caché en BD.

---

## v2.3.0 — Diseño de implementación

### F1. Eliminar logout por inactividad

Único archivo a modificar: `app/hooks/useAuth.ts`.

- Borrar `INACTIVITY_TIMEOUT_MS`, `ACTIVITY_THROTTLE_MS`, `lastActivityRef`.
- En `executeRefresh` eliminar el bloque que compara `idleTime > INACTIVITY_TIMEOUT_MS` y la rama `handleSessionExpired('inactivity')`.
- En el `useEffect` eliminar `trackActivity`, `lastTracked`, el array `activityEvents` y todos los `addEventListener`/`removeEventListener` asociados.
- Mantener intacto: refresh proactivo (2 min antes de expiración), retry, `notifySessionExpired` (sin la rama `'inactivity'`), cross-tab `storage`, `auth:changed`, `login`, `logout`, `fetchUser`.

### F2. Fix `window is not defined` en `DenialMapModal`

Archivo único: `app/components/flight-plans/DenialMapModal.tsx`.

Refactor con el patrón de `TrajectoryMapViewer.tsx` y `GeoawarenessViewer.tsx`:

- Sustituir `import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet'` por imports `dynamic(() => import('react-leaflet').then(m => m.X), { ssr: false })`.
- Para `useMap` (utilizado en `MapResizeHandler` / `FitBoundsHandler`): aislar esos sub-componentes en un módulo client-only (e.g. `DenialMapModalClient.tsx`) y montarlos también con `dynamic({ ssr: false })`. Importar `'leaflet/dist/leaflet.css'` solo dentro del módulo client-only.

### F3. Trayectoria alternativa SCRS

#### F3.1 — Parser SCRS

Nuevo módulo `lib/scrs.ts`:

```ts
export interface ScrsAlternative {
  uplanId: string
  segments: Array<{
    segment: number
    start: { lat: number; lon: number; alt: number }
    end:   { lat: number; lon: number; alt: number }
    solutionMethod: string
    routePath: Array<{ lat: number; lon: number; alt: number }>
  }>
  flatWaypoints: Array<{ lat: number; lon: number; alt: number }>
}
export function parseScrsAlternative(authorizationMessage: string | null | undefined): ScrsAlternative | null
```

- Acepta string (lo parsea) u objeto.
- Devuelve `null` si no cumple el guard.
- `flatWaypoints` = concatenación en orden de `routePath` de cada segmento, deduplicando puntos contiguos idénticos.
- Coordenadas GeoJSON `[lon, lat, alt]` → reordenar a `{lat, lon, alt}`.

Tests en `lib/__tests__/scrs.test.ts` con 3 casos: vacío, malformado, mensaje del enunciado.

#### F3.2 — Builder QGC reutilizable

Nuevo módulo `lib/qgc-plan.ts`:

```ts
export interface QgcWaypoint { lat: number; lon: number; alt: number; pauseDuration?: number }
export function buildQgcPlan(waypoints: QgcWaypoint[], opts?: { homeAltitude?: number }): unknown
```

- Mover el helper interno de `app/components/PlanGenerator.tsx` (líneas 200–230) a este módulo.
- Items por waypoint: `{Altitude, AltitudeMode:1, autoContinue:true, command:16, doJumpId, frame:3, params:[hold,0,0,null,lat,lng,alt], type:"SimpleItem"}`.
- Último waypoint con `command:21` (LAND) y `Altitude:0`.
- `plannedHomePosition`: `[waypoints[0].lat, waypoints[0].lon, opts.homeAltitude ?? Number(process.env.NEXT_PUBLIC_PLANNED_HOME_ALTITUDE) ?? 15]`.
- `PlanGenerator.tsx` se refactoriza para llamar a `buildQgcPlan`.

Tests `lib/__tests__/qgc-plan.test.ts`: snapshot del JSON con la lista de waypoints actual del PlanGenerator (regression-proof).

#### F3.3 — Modal comparativo de trayectorias

Nuevo componente `app/components/flight-plans/AlternativeTrajectoryModal.tsx`:

- SSR-safe (mismo patrón que `TrajectoryMapViewer`).
- Props: `{ open, onClose, currentWaypoints, alternativeWaypoints, onAccept, onReject, isProcessing }`.
- Mapa Leaflet con dos `Polyline` (azul sólido = actual; verde dashArray='6 4' = propuesta) y markers con tooltip (ordinal, lat, lon, alt).
- `FitBoundsHandler` con la unión de ambas listas.
- Footer: botón "Rechazar" (no escribe en BD) y "Aceptar" (con spinner mientras `isProcessing`).
- i18n: claves nuevas en `app/i18n/translations.ts` (`flightPlans.alternativeTrajectory`, `.viewAlternative`, `.acceptAlternative`, `.rejectAlternative`, `.proposedRoute`, `.currentRoute`, etc) en `es` y `en`.

Integración: en `app/components/flight-plans/ActionButtons.tsx`, cuando `authorizationStatus === 'denegado' && parseScrsAlternative(authorizationMessage) !== null`, añadir un botón "Ver alternativa" que abre el modal.

#### F3.4 — Endpoint de aceptación

Nuevo endpoint `POST /api/flightPlans/[id]/accept-alternative`. Archivo `app/api/flightPlans/[id]/accept-alternative/route.ts`.

Algoritmo:

1. `withAuth` + ownership check.
2. Cargar `flightPlan`. Validar que `parseScrsAlternative(authorizationMessage)` retorne objeto válido. Si no, 400.
3. Construir lista de waypoints: `flatWaypoints` del SCRS + waypoint final `{lat: last.lat, lon: last.lon, alt: 0}`.
4. Regenerar `fileContent` con `buildQgcPlan`.
5. Actualizar `flightPlan.uplan`: parsear el JSON existente, reemplazar `flightDetails.waypoints` con la nueva lista (`time = 0` en cada uno, se recalculan tras el reproceso), vaciar `operationVolumes: []`. Mantener `flightDetails.{mode,category}`, `uas`, `contactDetails`, `dataOwnerIdentifier`, `dataSourceIdentifier`.
6. Transacción Prisma:
   - `prisma.csvResult.deleteMany({ where: { id } })`.
   - `prisma.flightPlan.update` con `{ fileContent, uplan, status: 'sin procesar', csvResult: null, authorizationStatus: 'sin autorización', authorizationMessage: null, externalResponseNumber: null, machineAssignedId: null }`.
7. **No** disparar `sendFasCancellation` ni `sendPlanDeletionEmail` (el plan venía de `denegado`, no de `aprobado`).
8. Devolver `200 { flightPlan }`.

Tests de integración en `app/api/flightPlans/[id]/accept-alternative/__tests__/route.test.ts` (mockear Prisma).

#### F3.5 — Compatibilidad

- El plan vuelve al estado `sin procesar`. `traj-assigner` lo recoge automáticamente. El usuario re-autoriza con el botón existente. Los emails de aprobación/denegación funcionan igual.
- El `useFlightPlans` ya hace polling cada 5 s; la UI se actualiza sola.

---

## v2.4.0 — Diseño de implementación

### F4.1 — Migración Prisma

Añadir a `prisma/schema.prisma`, modelo `flightPlan`:

```prisma
activationStatus       String    @default("no activable")
activatedAt            DateTime?
activationMessage      String?   @db.LongText
termsAcceptedAt        DateTime?
lastActivationAttempt  DateTime?
```

Estados (`activationStatus`): `'no activable' | 'activable' | 'activando' | 'autorizado_despegue' | 'denegado_activacion' | 'ventana_pasada'`.

`activationStatus` se calcula lazy en frontend con la siguiente prioridad:

1. Si `authorizationStatus !== 'aprobado'` → no aparece en plan-activation.
2. Si `activatedAt !== null && now <= activatedAt + 60s` → `autorizado_despegue`.
3. Si `activatedAt !== null && now > activatedAt + 60s` → `ventana_pasada`.
4. Si `now < scheduledAt - 60s` → `no activable`.
5. Si `now > scheduledAt + 60s` → `ventana_pasada`.
6. En cualquier otro caso → `activable`.

Migración: `npx prisma migrate dev --name add_activation_fields`.

### F4.2 — Endpoints

| Ruta | Método | Función |
| --- | --- | --- |
| `/api/flightPlans/[id]/terms` | GET | Proxy autenticado al FAS `${FAS_BASE_URL}/terms/[externalResponseNumber]`. 401/403/400 según corresponda. Devuelve el JSON crudo. |
| `/api/flightPlans/[id]/activate` | POST | Body `{ termsAccepted: true }`. Valida ownership, `aprobado`, ventana ±60s, cooldown 5s. Persiste `termsAcceptedAt`, `lastActivationAttempt`, `activationStatus='activando'`. GET al FAS `${FAS_BASE_URL}/activation/[externalResponseNumber]` (timeout 10s). 200 → `activatedAt=now`, `activationStatus='autorizado_despegue'`. !=200 → `activationStatus='denegado_activacion'`, `activationMessage` con error. |
| `/api/flightPlans/active` | GET | Lista planes del usuario con `authorizationStatus='aprobado'` y `scheduledAt ∈ [now-1h, now+24h]`. Filtrado fino en frontend. |
| `/api/flightPlans/history` | GET | Lista planes pasados del usuario (`now > scheduledAt+60s` o `activatedAt+60s`, o `denegado/withdrawn`). Orden `scheduledAt DESC`. Paginado (límite 50). |

`FAS_BASE_URL` se deriva de `FAS_API_URL` (quitando el sufijo `/uplan`).

### F4.3 — Página y componentes

Estructura nueva en `app/plan-activation/`:

```
PlanActivationPage (reemplazo del stub)
├── Sección "Vuelos activables" (ventana ±1 min)
│   └── FlightPlanActivationCard[]
└── Sección "Historial" (collapsible, default cerrada)
    └── HistoricalFlightPlanList
```

`FlightPlanActivationCard` (`app/components/plan-activation/FlightPlanActivationCard.tsx`):
- Reutiliza `Cesium3DModal`, `Trajectory3DViewer`, `Geoawareness3DModal` (o `GeoawarenessViewer`).
- Sin acciones de procesar/autorizar/reset/eliminar.
- Botón "Activar vuelo": disabled si fuera de ventana o cooldown activo.
- Si `now <= activatedAt + 60s`: panel verde grande "PUEDE DESPEGAR" con countdown.

`ActivateFlightModal` (`app/components/plan-activation/ActivateFlightModal.tsx`):
1. On open → `GET /api/flightPlans/[id]/terms` (sin caché).
2. Render con `JsonViewerSections` (componente nuevo, recursivo: claves de primer nivel → secciones; sub-objetos → subsecciones; primitivos → `Key: value`; arrays → bullets).
3. Checkbox obligatorio "Acepto los T&C".
4. Botón "Activar" (disabled hasta checkbox).
5. Click → `POST /api/flightPlans/[id]/activate { termsAccepted: true }` con spinner.
6. 200 → toast verde, cerrar modal, refrescar lista.
7. Error → banner rojo con `error.message` exacto del FAS, botón rehabilitado tras countdown 5s.

`HistoricalFlightPlanList`:
- Paginación de `/api/flightPlans/history`.
- Click → modal de solo lectura con visualizaciones (volúmenes 3D, trayectoria, geozonas, denegación si aplica).

`useActivationPlans` (`app/hooks/useActivationPlans.ts`):
- Polling 30s.
- Tick local 1s en componentes para reevaluar ventana sin re-fetch.
- API: `{ activablePlans, historicalPlans, refresh, activate(id, termsAccepted) }`.

i18n nuevo (claves `planActivation.*` en `es` y `en`).

---

## Disciplina de release

Tras completar todo el bloque y antes de cerrar:

1. `npm test`, `npm run lint`, `npm run build` — los tres limpios.
2. Bump `package.json` → `2.3.0` (o `2.4.0`).
3. `icd.tex`:
   - Línea 24: actualizar versión mostrada.
   - Añadir `\subsection*{Novedades en V2.3.0}` (o V2.4.0) en estilo de las existentes, con bullets por feature.
   - v2.3.0: editar la sección de autorización para mencionar la propuesta SCRS y el endpoint accept-alternative.
   - v2.4.0: añadir nueva sección `\section*{Plan Activation}` con flujo, endpoints `/terms` y `/activate`, estados nuevos.
4. `CHANGELOG.md` (crear si no existe) con entrada Keep-a-Changelog: `Added/Changed/Fixed/Removed`.
5. Commit `chore(release): v2.3.0` (o `v2.4.0`).
6. Tag anotado:
   - `git tag -a v2.3.0 -m "v2.3.0 — <resumen>"` con cuerpo = entrada CHANGELOG.
7. **Push del commit y del tag**: requiere confirmación explícita del usuario; el orquestador NO debe hacer push sin aprobación.

---

## Verificación end-to-end

### Tras v2.3.0
- `npm run dev` en `:3003` → consola limpia.
- Navegar a `/plan-authorization`, abrir modal de denegación de un plan denegado → mapa renderiza, sin error en consola.
- Sesión >10 min sin actividad → sigue válida.
- Plan denegado con `scr_dispatch` exitoso → botón "Ver alternativa" → modal con dos trayectorias → aceptar → plan vuelve a `sin procesar` con `fileContent` y `uplan` actualizados → `traj-assigner` reprocesa → re-autorizar → email aprobado/denegado normal.
- Plan denegado SIN `scr_dispatch` → botón NO aparece, comportamiento idéntico al previo.

### Tras v2.4.0
- Plan aprobado dentro de la ventana ±1 min de `scheduledAt` → aparece en `/plan-activation` con botón "Activar" habilitado.
- Plan aprobado fuera de ventana → no aparece en activable o aparece deshabilitado.
- Activación con error del FAS → mensaje exacto visible; botón rehabilitado tras 5s.
- "PUEDE DESPEGAR" se muestra exactamente 60 s tras 200 OK del FAS.
- Historial muestra planes pasados en orden descendente, sólo lectura.

### Release checks
- `git tag --list` muestra `v2.3.0` y `v2.4.0`.
- `package.json` con la versión correspondiente.
- `icd.tex` y `CHANGELOG.md` reflejan los cambios.
