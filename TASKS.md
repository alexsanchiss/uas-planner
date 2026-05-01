# TASKS — UPPS v2.3.0 y v2.4.0

> Lista ejecutable por el orquestador. Cada tarea es atómica y tiene criterios de aceptación (AC) verificables. El orquestador asignará subagentes por tarea, validando AC antes de cerrar. Plan completo en `PLAN.md`.

## Convenciones

- Cada tarea entra en `pending → in_progress → completed`.
- Antes de marcar `completed`: verificar AC + `npm run lint` + `npm test` (si aplica) limpios.
- Commit por tarea (Conventional Commits). Scope sugerido entre paréntesis en cada AC.
- No saltar al siguiente bloque hasta cerrar el bloque actual con su release (T9 cierra v2.3.0; T22 cierra v2.4.0).
- Las tareas con `BLOCKED BY` indican dependencias previas obligatorias.

---

## Bloque v2.3.0

### T1. Eliminar logout por inactividad
- **Archivo único**: `app/hooks/useAuth.ts`.
- **Acción**: borrar `INACTIVITY_TIMEOUT_MS`, `ACTIVITY_THROTTLE_MS`, `lastActivityRef`, `trackActivity`, `lastTracked`, `activityEvents`, todos los `addEventListener`/`removeEventListener` asociados, y la rama `idleTime > INACTIVITY_TIMEOUT_MS` dentro de `executeRefresh`. Eliminar la rama `'inactivity'` del helper `notifySessionExpired`. Mantener intactos: refresh proactivo (2 min antes), retry, cross-tab `storage`, `auth:changed`, `login`, `logout`, `fetchUser`.
- **AC**:
  - Grep en `app/hooks/useAuth.ts` no devuelve coincidencias para `INACTIVITY|idle|lastActivity|trackActivity`.
  - `npm test` y `npm run lint` limpios.
  - Manual: dejar la app abierta sin tocar nada >10 min y verificar que la sesión sigue activa (no redirige a `/login`, no aparece toast).
  - Manual: token con `exp` próximo se refresca correctamente; expirar refresh token cierra sesión con motivo `expired` (no `inactivity`).
- **Commit**: `fix(auth): remove inactivity-based session logout`.

### T2. SSR-fix `DenialMapModal`
- **Archivo principal**: `app/components/flight-plans/DenialMapModal.tsx`.
- **Acción**: refactor con el patrón de `TrajectoryMapViewer.tsx` y `GeoawarenessViewer.tsx`. Sustituir imports estáticos de `react-leaflet` por `dynamic(() => import('react-leaflet').then(m => m.X), { ssr: false })`. Aislar los sub-componentes que usan `useMap` en un módulo client-only `DenialMapModalClient.tsx`. Importar `'leaflet/dist/leaflet.css'` solo en el módulo client-only.
- **AC**:
  - `npm run build` completa sin error `window is not defined`.
  - `npm run dev` arranca y `/plan-authorization` carga sin error en consola.
  - Modal renderiza correctamente con un plan denegado (volúmenes y geozonas visibles, leyenda OK).
  - Test de regresión: importar el módulo en un test Node-environment de Jest no rompe.
- **Commit**: `fix(ui): make DenialMapModal SSR-safe with dynamic Leaflet imports`.

### T3. Nuevo `lib/scrs.ts` + tests
- **Archivos**: `lib/scrs.ts` (nuevo), `lib/__tests__/scrs.test.ts` (nuevo).
- **API exportada** (ver `PLAN.md` para tipos completos):
  - `interface ScrsAlternative`, `parseScrsAlternative(authorizationMessage)`.
- **Comportamiento**:
  - Acepta string u objeto.
  - Devuelve `null` cuando no se cumple `scr_dispatch.sent === true && status_code === 200 && response.status === 'success' && segments.length > 0`.
  - `flatWaypoints` concatena `routePath` de cada segmento, deduplicando puntos contiguos idénticos.
  - Reordena coordenadas GeoJSON `[lon, lat, alt]` → `{lat, lon, alt}`.
- **AC**:
  - Tests con 3 casos: input vacío/malformado/válido (mensaje exacto del enunciado del usuario).
  - Output del caso válido: 2 segmentos, ~43 waypoints planos tras dedup.
  - `npm test -- --testPathPattern=scrs` verde.
- **Commit**: `feat(uplan): add SCRS alternative trajectory parser`.

### T4. Nuevo `lib/qgc-plan.ts` + tests + refactor `PlanGenerator`
- **Archivos**: `lib/qgc-plan.ts` (nuevo), `lib/__tests__/qgc-plan.test.ts` (nuevo), `app/components/PlanGenerator.tsx` (refactor).
- **API exportada**: `buildQgcPlan(waypoints: QgcWaypoint[], opts?: { homeAltitude?: number }): unknown`.
- **Acción**: extraer el helper anidado en `app/components/PlanGenerator.tsx` (líneas ~200–230). Mantener formato exacto del JSON `.plan` (ver `PLAN.md`). Refactorizar `PlanGenerator.tsx` para usar el nuevo helper.
- **AC**:
  - Test snapshot: dado un set de 3 waypoints y `homeAltitude=15`, el output coincide bit-a-bit con el shape actual del `PlanGenerator`.
  - Test: último waypoint genera `command:21` (LAND) con `Altitude:0`.
  - `app/components/PlanGenerator.tsx` ya no contiene la función inline.
  - Tests existentes y `npm run build` verdes.
- **Commit**: `refactor(uplan): extract QGC plan builder to lib/qgc-plan.ts`.
- **BLOCKED BY**: ninguno.

### T5. `AlternativeTrajectoryModal`
- **Archivos**: `app/components/flight-plans/AlternativeTrajectoryModal.tsx` (nuevo), `app/components/flight-plans/index.ts` (export), `app/i18n/translations.ts` (claves nuevas en `es` y `en`).
- **Acción**: modal SSR-safe con dos `Polyline` (actual + propuesta), markers con tooltip, leyenda, footer con botones "Rechazar" y "Aceptar" (spinner + disabled mientras `isProcessing`). Props especificadas en `PLAN.md`.
- **i18n**: `flightPlans.alternativeTrajectory`, `.viewAlternative`, `.acceptAlternative`, `.rejectAlternative`, `.proposedRoute`, `.currentRoute`, `.alternativeAcceptedToast`, `.alternativeRejectedToast`, `.waypointsCount`.
- **AC**:
  - `npm run build` sin errores SSR.
  - Render manual con mock data (vía Storybook o ruta de prueba): ambas trayectorias visibles, leyenda correcta, `FitBounds` ajusta a la unión.
  - Botones funcionan (callbacks invocados).
- **Commit**: `feat(ui): add AlternativeTrajectoryModal for SCRS proposals`.
- **BLOCKED BY**: T3.

### T6. Endpoint `POST /api/flightPlans/[id]/accept-alternative`
- **Archivos**: `app/api/flightPlans/[id]/accept-alternative/route.ts` (nuevo), `app/api/flightPlans/[id]/accept-alternative/__tests__/route.test.ts` (nuevo).
- **Acción**: implementar el endpoint según el algoritmo del `PLAN.md` (validar SCRS, construir waypoints + landing 0m, regenerar `fileContent` con `buildQgcPlan`, actualizar `uplan` preservando metadatos, transacción Prisma que borra `csvResult` y resetea estados, sin emails ni cancelación FAS).
- **AC**:
  - Test integración: plan denegado con `scr_dispatch` válido + body válido → 200 con `flightPlan` actualizado; verificar `status='sin procesar'`, `csvResult=null`, `fileContent` no vacío con landing waypoint, `uplan.flightDetails.waypoints.length === flatWaypoints.length + 1`, `uplan.operationVolumes === []`.
  - Test: plan denegado sin `scr_dispatch` → 400.
  - Test: plan no propio → 403.
  - Test: plan no autenticado → 401.
- **Commit**: `feat(api): add accept-alternative endpoint for SCRS-proposed routes`.
- **BLOCKED BY**: T3, T4.

### T7. Integración modal + botón en `ActionButtons`
- **Archivos**: `app/components/flight-plans/ActionButtons.tsx` (modificación), llamada al endpoint vía `useFlightPlans` o axios directo.
- **Acción**: añadir botón "Ver alternativa" condicionado a `authorizationStatus === 'denegado' && parseScrsAlternative(authorizationMessage) !== null`. Click abre `AlternativeTrajectoryModal`. Aceptar dispara `POST /api/flightPlans/[id]/accept-alternative` con loader. Tras 200, cerrar modal, toast de éxito, refresh polling.
- **AC**:
  - Plan denegado SIN `scr_dispatch` no muestra el botón.
  - Plan denegado CON `scr_dispatch` muestra el botón en posición coherente con los demás action buttons.
  - Aceptar → plan transita a `sin procesar` y la card se actualiza vía polling.
  - Rechazar → no escribe nada en BD, modal se cierra, plan sigue denegado.
- **Commit**: `feat(flight-plans): wire alternative trajectory acceptance flow`.
- **BLOCKED BY**: T5, T6.

### T8. End-to-end manual v2.3.0
- **Acción**: ejecutar el plan de verificación completo descrito en `PLAN.md`. Si algún paso falla, abrir tarea de fix antes de avanzar a T9.
- **AC**:
  - Ningún error en consola al navegar `/plan-authorization`.
  - Sesión activa tras >10 min sin actividad.
  - Aceptar alternativa SCRS → plan reprocesa correctamente y se re-autoriza con el flujo estándar; email recibido.
  - Plan denegado sin `scr_dispatch` muestra solo `DenialMapModal` (sin "Ver alternativa").
- **Commit**: ninguno (verificación).
- **BLOCKED BY**: T1, T2, T7.

### T9. Release v2.3.0
- **Archivos**: `package.json`, `icd.tex`, `CHANGELOG.md` (crear).
- **Acción**:
  1. Bump `package.json.version` → `2.3.0`.
  2. `icd.tex`: actualizar versión en línea 24, añadir `\subsection*{Novedades en V2.3.0}`, actualizar la sección de autorización (mención de la propuesta SCRS y el endpoint `accept-alternative`).
  3. Crear `CHANGELOG.md` con la entrada `## [2.3.0]` Keep-a-Changelog (`### Added`, `### Changed`, `### Fixed`, `### Removed`).
  4. Commit `chore(release): v2.3.0`.
  5. Tag anotado `git tag -a v2.3.0 -m "v2.3.0 — <resumen>"` con cuerpo = entrada CHANGELOG.
  6. **Solicitar al usuario confirmación explícita antes de hacer `git push --tags`**.
- **AC**:
  - `git tag --list` incluye `v2.3.0`.
  - `npm run build` y `npm test` limpios.
  - `package.json.version === '2.3.0'`.
  - `CHANGELOG.md` y `icd.tex` reflejan los cambios.
- **Commit**: `chore(release): v2.3.0`.
- **BLOCKED BY**: T8.

---

## Bloque v2.4.0

### T10. Migración Prisma — campos de activación
- **Archivos**: `prisma/schema.prisma`.
- **Acción**: añadir al modelo `flightPlan`: `activationStatus String @default("no activable")`, `activatedAt DateTime?`, `activationMessage String? @db.LongText`, `termsAcceptedAt DateTime?`, `lastActivationAttempt DateTime?`. Ejecutar `npx prisma migrate dev --name add_activation_fields`.
- **AC**:
  - Migración generada en `prisma/migrations/<timestamp>_add_activation_fields/`.
  - `npx prisma generate` regenera tipos sin errores.
  - Tests existentes pasan.
- **Commit**: `feat(db): add activation fields to flightPlan model`.

### T11. Endpoint `GET /api/flightPlans/[id]/terms`
- **Archivos**: `app/api/flightPlans/[id]/terms/route.ts` (nuevo), tests.
- **Acción**: proxy autenticado al FAS `${FAS_BASE_URL}/terms/[externalResponseNumber]`. Validaciones: 401 si no auth, 403 si no owner, 400 si `externalResponseNumber` falta o `authorizationStatus !== 'aprobado'`. Devolver el JSON crudo del FAS.
- **AC**:
  - Tests para los 5 escenarios de validación.
  - Test happy-path con axios mockeado.
- **Commit**: `feat(api): add /terms endpoint for FAS terms retrieval`.
- **BLOCKED BY**: T10.

### T12. Endpoint `POST /api/flightPlans/[id]/activate`
- **Archivos**: `app/api/flightPlans/[id]/activate/route.ts` (nuevo), tests.
- **Acción**: ver algoritmo en `PLAN.md`. Validar ownership, `aprobado`, ventana ±60s alrededor de `scheduledAt`, cooldown 5s desde `lastActivationAttempt`, `body.termsAccepted === true`. Persistir `termsAcceptedAt`, `lastActivationAttempt`, `activationStatus='activando'`. GET al FAS, manejar 200 vs error.
- **AC**:
  - Tests para 5 escenarios (200, 500, fuera de ventana, sin termsAccepted, plan no aprobado, cooldown activo).
  - 200 → DB actualizada con `activatedAt`, `activationStatus='autorizado_despegue'`, `activationMessage` con respuesta.
  - Error → DB con `activationStatus='denegado_activacion'`, `activationMessage` con error exacto.
- **Commit**: `feat(api): add /activate endpoint with ±1min window and 5s cooldown`.
- **BLOCKED BY**: T10.

### T13. Endpoints `/api/flightPlans/active` y `/api/flightPlans/history`
- **Archivos**: `app/api/flightPlans/active/route.ts`, `app/api/flightPlans/history/route.ts`, tests.
- **Acción**:
  - `active`: GET, autenticado, devuelve planes del usuario con `authorizationStatus='aprobado'` y `scheduledAt ∈ [now-1h, now+24h]`.
  - `history`: GET, paginado (`?page=1&limit=50`), devuelve planes pasados (criterios en `PLAN.md`), orden `scheduledAt DESC`.
- **AC**:
  - Tests para ambos: filtros correctos, paginación funciona, ownership respetado.
- **Commit**: `feat(api): add /active and /history endpoints for plan-activation`.
- **BLOCKED BY**: T10.

### T14. `JsonViewerSections` recursivo
- **Archivos**: `app/components/plan-activation/JsonViewerSections.tsx` (nuevo), tests.
- **Acción**: render recursivo de cualquier JSON. Claves de primer nivel → secciones (`<h3>`). Sub-objetos → subsecciones (`<h4>`, `<h5>`...). Primitivos → `<dl>` con `<dt>Key</dt><dd>value</dd>`. Arrays → listas con bullets, mostrando index. Estilos legibles, dark mode compatible (vars CSS de `themes.css`).
- **AC**:
  - Tests con 3 shapes de JSON: objeto plano, anidado profundo, con arrays.
  - Render manual: legible, sin claves crudas tipo `[object Object]`.
- **Commit**: `feat(ui): add JsonViewerSections for FAS terms rendering`.

### T15. `ActivateFlightModal`
- **Archivos**: `app/components/plan-activation/ActivateFlightModal.tsx` (nuevo).
- **Acción**: flujo completo descrito en `PLAN.md` (fetch terms, render con `JsonViewerSections`, checkbox, botón con cooldown de 5s tras error).
- **AC**:
  - Render manual con mock terms.
  - Botón "Activar" disabled hasta que checkbox marcado.
  - Tras error de activación: banner rojo con `error.message`, botón rehabilitado tras 5s con countdown UI.
  - 200 → toast verde, modal cierra.
- **Commit**: `feat(plan-activation): add ActivateFlightModal with terms acceptance`.
- **BLOCKED BY**: T11, T12, T14.

### T16. `FlightPlanActivationCard` + countdown UI
- **Archivos**: `app/components/plan-activation/FlightPlanActivationCard.tsx` (nuevo).
- **Acción**: card con visualizaciones (Cesium3D, Trajectory3D, Geoawareness), botón "Activar" con habilitación según ventana ±1 min, panel verde "PUEDE DESPEGAR" con countdown 60s tras activación.
- **AC**:
  - Render con plan en cada estado: fuera de ventana (botón disabled), dentro de ventana (botón enabled), activado (panel verde + countdown).
  - Countdown tick por segundo (sin re-fetch).
  - Sin botones de procesar/autorizar/reset/eliminar.
- **Commit**: `feat(plan-activation): add FlightPlanActivationCard with takeoff countdown`.
- **BLOCKED BY**: T15.

### T17. `HistoricalFlightPlanList`
- **Archivos**: `app/components/plan-activation/HistoricalFlightPlanList.tsx` (nuevo).
- **Acción**: lista paginada de `/api/flightPlans/history`. Click en fila abre modal de solo lectura con todas las visualizaciones.
- **AC**:
  - Paginación funciona (anterior/siguiente).
  - Modal de detalle: solo lectura, sin botones de acción.
  - Orden por `scheduledAt DESC`.
- **Commit**: `feat(plan-activation): add HistoricalFlightPlanList`.
- **BLOCKED BY**: T13.

### T18. Reemplazo de `app/plan-activation/page.tsx`
- **Archivos**: `app/plan-activation/page.tsx` (reemplazo del stub).
- **Acción**: estructura `PlanActivationPage` con dos secciones: "Vuelos activables" y "Historial" (collapsible). Usa `useActivationPlans`.
- **AC**:
  - Stub reemplazado.
  - Header del proyecto sigue mostrando link a `/plan-activation`.
  - Página renderiza ambas secciones; la de historial está cerrada por defecto.
- **Commit**: `feat(plan-activation): replace stub with full page`.
- **BLOCKED BY**: T16, T17.

### T19. Hook `useActivationPlans` + tick 1s
- **Archivos**: `app/hooks/useActivationPlans.ts` (nuevo).
- **Acción**: polling 30s a `/active` y `/history`. Tick local 1s en componentes consumidores. API: `{ activablePlans, historicalPlans, refresh, activate(id, termsAccepted) }`.
- **AC**:
  - Polling ocurre cada 30s (sin más, sin menos).
  - El cambio de ventana ±1 min se refleja en UI sin re-fetch (gracias al tick local).
- **Commit**: `feat(plan-activation): add useActivationPlans hook with 1s window tick`.
- **BLOCKED BY**: T13.

### T20. i18n completo Plan Activation
- **Archivos**: `app/i18n/translations.ts`.
- **Acción**: añadir todas las claves `planActivation.*` en `es` y `en` (lista en `PLAN.md`).
- **AC**:
  - Cambiar idioma traduce todos los strings de la página `/plan-activation`.
  - No hay strings hardcoded en componentes nuevos.
- **Commit**: `feat(i18n): add plan-activation translations`.
- **BLOCKED BY**: T18.

### T21. End-to-end manual v2.4.0
- **Acción**: ejecutar el plan de verificación de v2.4.0 descrito en `PLAN.md`. Si algún paso falla, abrir tarea de fix antes de T22.
- **AC**:
  - Plan aprobado dentro de ventana → "Activar" habilitado.
  - Plan aprobado fuera de ventana → no aparece o disabled.
  - Cooldown de 5s tras error funciona con countdown UI.
  - "PUEDE DESPEGAR" visible exactamente 60s.
  - Historial ordenado descendente, solo lectura.
- **Commit**: ninguno (verificación).
- **BLOCKED BY**: T20.

### T22. Release v2.4.0
- **Archivos**: `package.json`, `icd.tex`, `CHANGELOG.md`.
- **Acción**:
  1. Bump `package.json.version` → `2.4.0`.
  2. `icd.tex`: actualizar versión, añadir `\subsection*{Novedades en V2.4.0}`, añadir nueva `\section*{Plan Activation}` con flujo, endpoints `/terms` y `/activate`, estados nuevos.
  3. `CHANGELOG.md`: entrada `## [2.4.0]`.
  4. Commit `chore(release): v2.4.0`.
  5. Tag anotado `v2.4.0` con cuerpo = entrada CHANGELOG.
  6. **Solicitar al usuario confirmación explícita antes de `git push --tags`**.
- **AC**:
  - `git tag --list` incluye `v2.3.0` y `v2.4.0`.
  - `npm run build` y `npm test` limpios.
  - `package.json.version === '2.4.0'`.
  - `CHANGELOG.md` y `icd.tex` reflejan los cambios.
- **Commit**: `chore(release): v2.4.0`.
- **BLOCKED BY**: T21.

---

## Resumen de dependencias

```
v2.3.0:
  T1 ─┐
  T2 ─┤
  T3 ──► T5, T6
  T4 ──► T6
  T5 ─┐
  T6 ─┴──► T7
  T1, T2, T7 ──► T8 ──► T9

v2.4.0:
  T10 ──► T11, T12, T13
  T14 ──┐
  T11 ──┤
  T12 ──┴──► T15 ──► T16
  T13 ──► T17, T19
  T16, T17 ──► T18 ──► T20 ──► T21 ──► T22
```

## Reglas para el orquestador

1. **No saltar al bloque v2.4.0** hasta cerrar T9.
2. **Push de tags requiere confirmación humana** — el orquestador NO debe hacer `git push origin v2.X.0` sin aprobación explícita.
3. **Verificación obligatoria**: antes de marcar `completed`, ejecutar `npm test` y `npm run lint` (ambos limpios) y los AC específicos de la tarea.
4. **Stop-the-line**: si una tarea introduce regresión en el resto del proyecto, parar y abrir una tarea de fix antes de continuar.
5. **Conventional Commits** en todos los commits, con scope sugerido.
6. **No tocar archivos fuera del alcance** de la tarea actual.
