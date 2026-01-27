# UAS Planner - Progress Tracker v2.0

> **Referencia**: Ver [PLAN.md](PLAN.md) para detalles del plan y [TASKS.md](TASKS.md) para lista de tareas.

## Estado General

| Fase | Descripción | Progreso | Estado |
|------|-------------|----------|--------|
| 1 | Correcciones Críticas | 9/9 | ✅ Completado |
| 2 | Formulario U-Plan | 15/15 | ✅ Completado |
| 3 | Generación de Volúmenes | 8/8 | ✅ Completado |
| 4 | Flujo Autorización FAS | 0/7 | 🔴 Pendiente |
| 5 | Integración Geoawareness WebSocket | 0/21 | 🔴 Pendiente |
| 6 | Correcciones de Tema | 0/9 | 🔴 Pendiente |
| **TOTAL** | | **32/69** | 🟡 46% |

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
| TASK-033 | Add FAS processing state detection | ⬜ Pendiente |
| TASK-034 | Show loading spinner during FAS processing | ⬜ Pendiente |
| TASK-035 | Disable authorization button during processing | ⬜ Pendiente |
| TASK-036 | Implement polling for FAS response | ⬜ Pendiente |

### 4.2 Visor de Respuesta FAS

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-037 | Verify FASResponseViewer wiring | ⬜ Pendiente |
| TASK-038 | Add FASResponseViewer to details panel | ⬜ Pendiente |
| TASK-039 | Add copy-to-clipboard for FAS response | ⬜ Pendiente |

---

## Fase 5: Integración WebSocket Geoawareness

### 5.1 Carga de U-spaces

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-040 | Create useUspaces hook | ⬜ Pendiente |
| TASK-041 | Create API endpoint for U-spaces proxy | ⬜ Pendiente |

### 5.2 Selector de U-space

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-042 | Create UspaceSelector component | ⬜ Pendiente |
| TASK-043 | Integrate UspaceSelector in PlanGenerator | ⬜ Pendiente |
| TASK-044 | Add loading state for U-spaces | ⬜ Pendiente |
| TASK-045 | Store uspace_identifier in geoawarenessData | ⬜ Pendiente |

### 5.3 WebSocket Hook

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-046 | Create useGeoawarenessWebSocket hook | ⬜ Pendiente |
| TASK-047 | Implement exponential backoff reconnection | ⬜ Pendiente |
| TASK-048 | Add NEXT_PUBLIC env variable | ⬜ Pendiente |

### 5.4 Capa de Geozonas

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-049 | Create GeozoneLayer component | ⬜ Pendiente |
| TASK-050 | Create GeozoneInfoPopup component | ⬜ Pendiente |
| TASK-051 | Integrate GeozoneLayer in PlanMap | ⬜ Pendiente |
| TASK-052 | Add geozone visibility toggle | ⬜ Pendiente |
| TASK-053 | Differentiate geozone click from waypoint | ⬜ Pendiente |

### 5.5 Reemplazo Service Area

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-054 | Replace FAS Service Area with U-space bounds | ⬜ Pendiente |
| TASK-055 | Update world mask for U-space bounds | ⬜ Pendiente |
| TASK-056 | Update label to U-space name | ⬜ Pendiente |

### 5.6 GeoawarenessViewer

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-057 | Refactor GeoawarenessViewer for WebSocket | ⬜ Pendiente |
| TASK-058 | Add loading state to GeoawarenessViewer | ⬜ Pendiente |
| TASK-059 | Add error handling to GeoawarenessViewer | ⬜ Pendiente |
| TASK-060 | Add trajectory overlay | ⬜ Pendiente |

---

## Fase 6: Correcciones de Tema

### 6.1 Login Page

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-061 | Replace hardcoded background colors | ⬜ Pendiente |
| TASK-062 | Replace hardcoded text colors | ⬜ Pendiente |
| TASK-063 | Fix LoginLoading component theme | ⬜ Pendiente |
| TASK-064 | Fix warning box theme in signup | ⬜ Pendiente |

### 6.2 Footer Logos

| Task ID | Descripción | Estado |
|---------|-------------|--------|
| TASK-065 | Add useTheme hook to Footer | ⬜ Pendiente |
| TASK-066 | Implement conditional SNA logo | ⬜ Pendiente |
| TASK-067 | Implement conditional UPV logo | ⬜ Pendiente |
| TASK-068 | Implement conditional LinkedIn icon | ⬜ Pendiente |
| TASK-069 | Implement conditional Instagram icon | ⬜ Pendiente |

---

## Historial de Cambios

| Fecha | Task ID | Descripción | Commit |
|-------|---------|-------------|--------|
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
