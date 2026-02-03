# UAS Planner - Progress Tracker v2.0

> **Referencia**: Ver [PLAN.md](PLAN.md) para detalles del plan y [TASKS.md](TASKS.md) para lista de tareas.

## Estado General

| Fase | Descripción | Progreso | Estado |
|------|-------------|----------|--------|
| 1 | Correcciones Críticas | 9/9 | ✅ Completado |
| 2 | Formulario U-Plan | 15/15 | ✅ Completado |
| 3 | Generación de Volúmenes | 8/8 | ✅ Completado |
| 4 | Flujo Autorización FAS | 7/7 | ✅ Completado |
| 5 | Integración Geoawareness WebSocket | 21/21 | ✅ Completado |
| 6 | Correcciones de Tema | 9/9 | ✅ Completado |
| 7 | Mejoras Visualización y Geoawareness | 12/12 | ✅ Completado |
| 8 | Refactor Geoawareness WS & U-Plan | 15/15 | ✅ Completado |
| **TOTAL** | | **96/96** | ✅ 100% |

---

## Fase 1: Correcciones Críticas de Funcionalidad

### 1.1 View Trajectory Fix

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-001 | Fix View Trajectory button enable condition | ✅ Completado |
| TASK-002 | Add tooltip to disabled View Trajectory button | ✅ Completado |
| TASK-003 | Improve TrajectoryMapViewer error handling | ✅ Completado |

### 1.2 Map Overflow Fix

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-004 | Fix UplanViewModal map overflow | ✅ Completado |
| TASK-005 | Add map resize handler in UplanViewModal | ✅ Completado |
| TASK-006 | Verify MapModal consistency | ✅ Completado |

### 1.3 Cascade Delete CsvResult

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-007 | Fix single flightPlan delete cascade | ✅ Completado |
| TASK-008 | Fix bulk flightPlan delete cascade | ✅ Completado |
| TASK-009 | Add delete logging for audit | ✅ Completado |

---

## Fase 2: Formulario U-Plan con Validación

### 2.1 Validador Zod

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-010 | Create Zod schema for U-Plan validation | ✅ Completado |
| TASK-011 | Add partial validation mode for draft saving | ✅ Completado |

### 2.2 Componente UplanFormModal

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-012 | Create UplanFormModal component structure | ✅ Completado |
| TASK-013 | Implement Data Identifiers section | ✅ Completado |
| TASK-014 | Implement Contact Details section | ✅ Completado |
| TASK-015 | Implement Flight Details section | ✅ Completado |
| TASK-016 | Implement UAS Information section | ✅ Completado |
| TASK-017 | Implement Operator section | ✅ Completado |
| TASK-018 | Add read-only Locations section | ✅ Completado |
| TASK-019 | Add read-only Operation Volumes section | ✅ Completado |
| TASK-020 | Implement form validation display | ✅ Completado |
| TASK-021 | Implement Save Draft functionality | ✅ Completado |
| TASK-022 | Implement Send to FAS functionality | ✅ Completado |

### 2.3 Integración

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-023 | Wire Review U-Plan button to UplanFormModal | ✅ Completado |
| TASK-024 | Pre-fill UplanFormModal with existing data | ✅ Completado |

---

## Fase 3: Migración Lógica de Generación de Volúmenes

### 3.1 Funciones Geodésicas

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-025 | Create geodesy-utils.ts with Vincenty functions | ✅ Completado |

### 3.2 Volúmenes Orientados

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-026 | Create generate_oriented_volumes.ts | ✅ Completado |
| TASK-027 | Implement segment type detection | ✅ Completado |
| TASK-028 | Implement along-track/cross-track calculations | ✅ Completado |
| TASK-029 | Implement oriented rectangle corner generation | ✅ Completado |

### 3.3 Actualización tray_to_uplan

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-030 | Update tray_to_uplan.ts parameters | ✅ Completado |
| TASK-031 | Replace generate_bbox with oriented volumes | ✅ Completado |
| TASK-032 | Update generateJSON compatibility | ✅ Completado |

---

## Fase 4: Mejora del Flujo de Autorización FAS

### 4.1 Estados de Autorización

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-033 | Add FAS processing state detection | ✅ Completado |
| TASK-034 | Show loading spinner during FAS processing | ✅ Completado |
| TASK-035 | Disable authorization button during processing | ✅ Completado |
| TASK-036 | Implement polling for FAS response | ✅ Completado |

### 4.2 Visor de Respuesta FAS

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-037 | Verify FASResponseViewer wiring | ✅ Completado |
| TASK-038 | Add FASResponseViewer to details panel | ✅ Completado |
| TASK-039 | Add copy-to-clipboard for FAS response | ✅ Completado |

---

## Fase 5: Integración WebSocket Geoawareness

### 5.1 Carga de U-spaces

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-040 | Create useUspaces hook | ✅ Completado |
| TASK-041 | Create API endpoint for U-spaces proxy | ✅ Completado |

### 5.2 Selector de U-space

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-042 | Create UspaceSelector component | ✅ Completado |
| TASK-043 | Integrate UspaceSelector in PlanGenerator | ✅ Completado |
| TASK-044 | Add loading state for U-spaces | ✅ Completado |
| TASK-045 | Store uspace_identifier in geoawarenessData | ✅ Completado |

### 5.3 WebSocket Hook

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-046 | Create useGeoawarenessWebSocket hook | ✅ Completado |
| TASK-047 | Implement exponential backoff reconnection | ✅ Completado |
| TASK-048 | Add NEXT_PUBLIC env variable | ✅ Completado |

### 5.4 Capa de Geozonas

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-049 | Create GeozoneLayer component | ✅ Completado |
| TASK-050 | Create GeozoneInfoPopup component | ✅ Completado |
| TASK-051 | Integrate GeozoneLayer in PlanMap | ✅ Completado |
| TASK-052 | Add geozone visibility toggle | ✅ Completado |
| TASK-053 | Differentiate geozone click from waypoint | ✅ Completado |

### 5.5 Reemplazo Service Area

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-054 | Replace FAS Service Area with U-space bounds | ✅ Completado |
| TASK-055 | Update world mask for U-space bounds | ✅ Completado |
| TASK-056 | Update label to U-space name | ✅ Completado |

### 5.6 GeoawarenessViewer

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-057 | Refactor GeoawarenessViewer for WebSocket | ✅ Completado |
| TASK-058 | Add loading state to GeoawarenessViewer | ✅ Completado |
| TASK-059 | Add error handling to GeoawarenessViewer | ✅ Completado |
| TASK-060 | Add trajectory overlay | ✅ Completado |

---

## Fase 6: Correcciones de Tema

### 6.1 Login Page

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-061 | Replace hardcoded background colors | ✅ Completado |
| TASK-062 | Replace hardcoded text colors | ✅ Completado |
| TASK-063 | Fix LoginLoading component theme | ✅ Completado |
| TASK-064 | Fix warning box theme in signup | ✅ Completado |

### 6.2 Footer Logos

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-065 | Add useTheme hook to Footer | ✅ Completado |
| TASK-066 | Implement conditional SNA logo | ✅ Completado |
| TASK-067 | Implement conditional UPV logo | ✅ Completado |
| TASK-068 | Implement conditional LinkedIn icon | ✅ Completado |
| TASK-069 | Implement conditional Instagram icon | ✅ Completado |

---

## Fase 7: Mejoras de Visualización y Geoawareness

### 7.1 Información Detallada de Geozonas

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-070 | Enhance GeozoneInfoPopup with expandable sections | ✅ Completado |
| TASK-071 | Implement collapsible/expandable UI for geozone sections | ✅ Completado |

### 7.2 Fix Waypoint Map Modal

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-072 | Fix MapModal container width for waypoints | ✅ Completado |
| TASK-073 | Auto-center map on all waypoints in MapModal | ✅ Completado |

### 7.3 Fix Trajectory Viewer CSV Loading

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-074 | Fix csvResult ID retrieval in FlightPlansUploaderDev | ✅ Completado |

### 7.4 U-space Identifier Storage

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-075 | Store actual U-space identifier instead of "uspace-default" | ✅ Completado |

### 7.5 Check Geoawareness con Timeline

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-076 | Implement Check Geoawareness with trajectory overlay | ✅ Completado |
| TASK-077 | Add time slider for trajectory simulation | ✅ Completado |

### 7.6 U-Plan Processing y Vista de Volúmenes 4D

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-078 | Trigger U-Plan regeneration on form data changes | ✅ Completado |
| TASK-079 | Fix View U-Plan Map button to open waypoint modal | ✅ Completado |
| TASK-080 | Display 4D volumes in U-Plan Map modal | ✅ Completado |
| TASK-081 | Add hover tooltip for 4D volume information | ✅ Completado |

---

## Fase 8: Refactor Geoawareness WebSocket & U-Plan Verification

### 8.1 WebSocket Protocol Switch

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-082 | Replace HTTP useGeozones with WebSocket in PlanGenerator | ✅ Completado |
| TASK-083 | Replace HTTP useGeozones with WebSocket in GeoawarenessViewer | ✅ Completado |
| TASK-084 | Update GeozoneData types for new format | ✅ Completado |
| TASK-085 | Update WebSocket message parsing for new format | ✅ Completado |

### 8.2 Hybrid Fallback System

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-086 | Implement fallback to legacy geojson on WS failure | ✅ Completado |
| TASK-087 | Create unified geozone normalizer function | ✅ Completado |

### 8.3 UI/UX Improvements

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-088 | Update GeozoneInfoPopup for new format fields | ✅ Completado |
| TASK-089 | Add WebSocket connection status indicator | ✅ Completado |

### 8.4 U-Plan Logic Verification

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-090 | Verify U-Plan form data persistence | ✅ Completado |
| TASK-091 | Fix U-Plan volume generation timing | ✅ Completado |
| TASK-092 | Verify generateOrientedBBox follows C++ logic | ✅ Completado |

### 8.5 Documentation Update

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-093 | Update ICD to version 1.0.0 | ✅ Completado |
| TASK-094 | Document new geozone data format in ICD | ✅ Completado |

### 8.6 Cleanup

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-095 | Remove deprecated HTTP geozone endpoint | ✅ Completado |
| TASK-096 | Remove unused useGeozones HTTP hook | ✅ Completado |

---

## Historial de Cambios

| Fecha | Task ID | Descripción | Commit |
|-------|---------|-------------|--------|
| 2026-02-03 | TASK-093, TASK-094 | Update ICD to version 1.0.0: document WebSocket integration for Geoawareness (/ws/gas/{USPACEID}), new 3-block message format, geozone data structure with restrictionConditions/zoneAuthority/limitedApplicability, deprecate HTTP polling, add fallback system documentation | docs(icd): update to v1.0.0 with WebSocket geoawareness integration |
| 2026-02-03 | TASK-096 | Move deprecated useGeozones HTTP hook to app/hooks/deprecated/: add deprecation notice with migration guide, update endpoint path to use /api/deprecated/geoawareness-geozones | refactor(hooks): move deprecated useGeozones HTTP hook to deprecated folder |
| 2026-02-03 | TASK-095 | Move deprecated HTTP geozone endpoint to /api/deprecated/geoawareness-geozones: update fallback path in useGeoawarenessWebSocket, add deprecation notice, clean up old folder | refactor(api): move deprecated geozone HTTP endpoint to deprecated folder |
| 2026-02-03 | TASK-092 | Fix compressWaypoints to match C++ logic: skip first waypoint, start from index 1 and step by compressionFactor (matching MATLAB wp(2:compression_factor:end,:)), ensure last waypoint is always included if not already sampled | fix(uplan): align compressWaypoints with C++ reference implementation |
| 2026-02-03 | TASK-086, TASK-087 | Implement hybrid fallback system: create unified geozone normalizer (lib/geoawareness/geozone-normalizer.ts) supporting both WebSocket and legacy formats; add automatic fallback to HTTP API when WebSocket fails after max retries; return usingFallback and loadingFallback states from hook | feat(geoawareness): add fallback to HTTP API when WebSocket fails |
| 2026-02-03 | TASK-088 | Update GeozoneInfoPopup for new WebSocket format: handle restrictionConditions, zoneAuthority, limitedApplicability as objects (not JSON strings), add verticalReference altitude limits section, support both new field names (startDatetime, specialOperation, contactName, SiteURL) and legacy names, add intervalBefore field | feat(geoawareness): support new WebSocket format in GeozoneInfoPopup |
| 2026-02-03 | TASK-089 | Add WebSocket connection status indicator to PlanMap: visual dot (green/yellow/red/gray) with status text (Live/Connecting/Error/Offline), click to reconnect on error/disconnected, tooltip with detailed status | feat(geoawareness): add WebSocket connection status indicator |
| 2026-02-03 | TASK-090 | Fix U-Plan form data persistence: merge form data with existing U-Plan when saving draft or submitting to FAS to preserve auto-generated fields (operationVolumes, takeoffLocation, landingLocation, gcsLocation) | fix(uplan): preserve auto-generated fields when saving form data |
| 2026-02-03 | TASK-091 | Fix U-Plan volume generation timing: change "U-Plan ready" to "U-Plan preview" with purple styling to clarify volumes are estimated based on waypoint positions, final calculation happens after trajectory processing | fix(uplan): clarify volume preview is estimated before trajectory processing |
| 2026-02-03 | TASK-085 | Add normalizeGeoawarenessMessage function to parse new 3-block WebSocket format: extracts geozones.features to populate legacy geozones_data array, maintains backward compatibility with existing components | feat(geoawareness): parse new 3-block WebSocket message format |
| 2026-02-03 | TASK-084 | Update GeozoneData types for new geoawareness format: add VerticalReference, RestrictionConditions, ZoneAuthority, LimitedApplicability interfaces; restructure GeoawarenessData with 3 blocks (control fields, uspace_data, geozones FeatureCollection); maintain legacy compatibility | feat(geoawareness): update types for new WebSocket message format |
| 2026-02-02 | TASK-078 | Trigger U-Plan regeneration on form data changes: auto-generate operation volumes when waypoints or flight details change, show preview status indicator with volume count, upload pre-generated U-Plan with volumes | feat(uplan): auto-regenerate U-Plan preview on form changes |
| 2026-02-02 | TASK-076, TASK-077 | Add Check Geoawareness modal with trajectory overlay and time slider for flight simulation: play/pause controls, speed options (1x/2x/4x), drone position marker, and detailed timeline visualization | feat(geoawareness): add trajectory simulation with interactive time slider |
| 2026-02-02 | TASK-070, TASK-071 | Enhance GeozoneInfoPopup with collapsible/expandable sections: General Information, Restriction Conditions, Limited Applicability, Authority Information, and Schedule with chevron icons and smooth animations | feat(geoawareness): add expandable sections to geozone popup |
| 2026-02-02 | TASK-075 | Verify U-space identifier storage: default service area correctly uses 'VLCUspace' as identifier instead of 'uspace-default', implementation already present from TASK-045 | chore: mark TASK-075 as complete |
| 2026-02-02 | TASK-080, TASK-081 | Add hover tooltips to 4D operation volumes showing time start/end, altitude range, and approximate dimensions | feat(uplan): add hover tooltips with volume details in U-Plan Map modal |
| 2026-02-02 | TASK-079 | Fix View U-Plan Map button: now shows waypoints extracted from fileContent even without operationVolumes, with toggleable waypoint/volume layers and visual legend | feat(uplan): enable View U-Plan Map button for all plans with waypoints |
| 2026-02-02 | TASK-074 | Fix CSV result ID retrieval in FlightPlansUploaderDev: use plan.csvResult instead of plan.id when fetching CSV data for download, view single, view selected, and view folder operations | fix(csv): use actual csvResult ID instead of plan ID for CSV fetches |
| 2026-02-02 | TASK-072, TASK-073 | Fix WaypointMapModal: add maxWidth prop to Modal component for larger map displays, use FitBoundsHelper to auto-center map on all waypoints, prevent map overflow on all screen sizes | fix(ui): prevent map overflow and auto-center on waypoints |
| 2026-01-27 | TASK-057 to TASK-060 | Refactor GeoawarenessViewer to use WebSocket for real-time geozone data: connect via useGeoawarenessWebSocket hook, render geozones using GeozoneLayer component, add trajectory overlay from plan's CSV data, loading state during connection, error handling with retry button | feat(geoawareness): integrate WebSocket for real-time geozone updates |
| 2026-01-27 | TASK-054 to TASK-056 | Replace hardcoded FAS Service Area with dynamic U-space bounds: add uspaceName prop to PlanMap, update error messages with dynamic area name, add visual label overlay on map showing selected U-space name | feat(plan-generator): display U-space name on map and in error messages |
| 2026-01-27 | TASK-052 | Add geozone visibility toggle in PlanGenerator sidebar with count badge, allowing users to show/hide geozones on the map via a switch control in the U-space bounds panel | feat(geoawareness): add toggle to show/hide geozones on map |
| 2026-01-27 | TASK-053 | Differentiate geozone info click from waypoint placement by stopping event propagation on original DOM event, preventing accidental waypoints when clicking geozones to view info | fix(geoawareness): prevent waypoint placement when clicking geozones |
| 2026-01-27 | TASK-051 | Integrate GeozoneLayer in PlanMap with WebSocket connection for real-time geozone data, info popup on click, and proper layer ordering between bounds and waypoints | feat(geoawareness): integrate GeozoneLayer in PlanMap for geozone visualization |
| 2026-01-27 | TASK-050 | Create GeozoneInfoPopup component for detailed geozone information display with name, type, restrictions, temporal limits, and authority contact information in a themed popup | feat(geoawareness): add GeozoneInfoPopup for detailed geozone info |
| 2026-01-27 | TASK-049 | Create GeozoneLayer component for rendering geozones on Leaflet maps with color-coded types (prohibited, restricted, controlled, advisory, warning, temporary), hover effects, and tooltips | feat(geoawareness): add GeozoneLayer component for geozone visualization |
| 2026-01-27 | TASK-046 to TASK-048 | Create useGeoawarenessWebSocket hook with exponential backoff reconnection (1s, 2s, 4s, 8s, 16s), status tracking, and auto-cleanup. NEXT_PUBLIC env variable already exists in .env.example | feat(geoawareness): add WebSocket hook for real-time geozone updates |
| 2026-01-27 | TASK-045 | Store uspace_identifier in geoawarenessData when publishing plan from PlanGenerator, enabling future WebSocket connections and GeoawarenessViewer integration | feat(geoawareness): persist uspace_identifier on flight plan creation |
| 2026-01-27 | TASK-043, TASK-044 | Integrate UspaceSelector in PlanGenerator with step-based flow: U-space selection before waypoint planning, dynamic bounds based on selected U-space, and loading state while fetching | feat(plan-generator): add U-space selection step before waypoint planning |
| 2026-01-27 | TASK-040 to TASK-042 | Add U-space selection: useUspaces hook, API endpoint proxy, and interactive UspaceSelector component with map-based selection | feat(geoawareness): add U-space selector for flight area selection |
| 2026-01-27 | TASK-065 to TASK-069 | Make footer logos theme-aware: SNA, UPV logos and LinkedIn, Instagram icons now adapt to light/dark theme | feat(ui): make footer logos adapt to light/dark theme |
| 2026-01-27 | TASK-061 to TASK-064 | Fix login page theme: replace hardcoded colors with CSS variables for backgrounds, text, warning box, and loading skeleton | fix(ui): make login page respect theme settings |
| 2026-01-27 | TASK-033 to TASK-039 | Implement FAS authorization flow: processing state detection, animated spinner during FAS processing, disable button during processing, verify FASResponseViewer with copy-to-clipboard | feat(auth): improve FAS authorization flow with processing state feedback |
| 2026-01-27 | TASK-030 to TASK-032 | Update tray_to_uplan.ts to use C++ parameters and replace generate_bbox with generateOrientedBBox | feat(uplan): integrate oriented volumes in U-Plan generation pipeline |
| 2026-01-27 | TASK-026 to TASK-029 | Create generate_oriented_volumes.ts with segment type detection, track buffer calculations, and oriented rectangle generation | feat(uplan): add oriented volume generation for trajectory-aligned operation volumes |
| 2026-01-27 | TASK-025 | Create geodesy-utils.ts with Vincenty functions for oriented volume generation | feat(uplan): add geodesy utilities for volume generation |
| 2026-01-27 | TASK-003 | Improve TrajectoryMapViewer error handling with specific error types | fix(trajectory): improve error handling with detailed error messages |
| 2026-01-27 | TASK-005, TASK-006 | Add map resize handler to UplanViewModal and MapModal for responsive behavior | fix(ui): add map resize handler for responsive map rendering |
| 2026-01-27 | TASK-001, TASK-002 | Fix View Trajectory button to require status=procesado AND csvResult, with tooltip | fix(flight-plans): require processed status for View Trajectory button |
| 2026-01-27 | TASK-004 | Fix UplanViewModal map overflow with responsive dimensions | fix(ui): make UplanViewModal map responsive to prevent overflow |
| 2026-01-27 | TASK-007, TASK-008, TASK-009 | Fix cascade delete for csvResult (single & bulk) + audit logging | fix(api): correct cascade delete to use actual csvResult IDs |
| 2026-01-27 | TASK-010, TASK-011 | Create Zod schema for U-Plan validation with full and partial validation modes | feat(validators): add comprehensive U-Plan validation with Zod |
| 2026-01-27 | TASK-012 to TASK-024 | Complete UplanFormModal with all sections, validation, save draft, FAS submission, and FlightPlansUploader integration | feat(uplan): add editable U-Plan form modal with FAS submission |

---

## Notas

- Cada tarea completada debe verificar `just preflight` antes de marcar como ✅
- Actualizar este archivo después de cada tarea completada
- Los commits deben seguir formato convencional: `feat(scope): description`
