# UAS Planner - Lista de Tareas v2.0

> **Referencia**: Ver [PLAN.md](PLAN.md) para contexto detallado de cada tarea.
> **Progreso**: Actualizar [PROGRESS.md](PROGRESS.md) al completar cada tarea.

## Leyenda de Prioridad

- 🔴 **CRÍTICO** - Bloquea funcionalidad existente
- 🟠 **ALTO** - Funcionalidad core incompleta
- 🟡 **MEDIO** - Mejora importante
- 🟢 **BAJO** - Polish/mejoras menores

---

## Fase 1: Correcciones Críticas de Funcionalidad

### 1.1 View Trajectory Fix

- [ ] 🔴 **TASK-001**: Fix View Trajectory button enable condition
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: El botón "View Trajectory" debe deshabilitarse cuando:
    - `status !== 'procesado'` OR
    - `csvResult === null`
  - **Línea aprox**: ~852
  - **Cambio**: Modificar condición `disabled` del botón
  - **Test**: Verificar que el botón solo se habilita para planes procesados con csvResult

- [ ] 🔴 **TASK-002**: Add tooltip to disabled View Trajectory button
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Mostrar tooltip explicando por qué el botón está deshabilitado
  - **Texto tooltip**: 
    - Si status ≠ procesado: "Plan must be processed first"
    - Si csvResult null: "Trajectory data not available"
  - **Test**: Hover sobre botón deshabilitado muestra tooltip correcto

- [ ] 🟡 **TASK-003**: Improve TrajectoryMapViewer error handling
  - **Archivo**: `app/components/flight-plans/TrajectoryMapViewer.tsx`
  - **Descripción**: Mejorar manejo de casos edge:
    - csvResultId existe pero registro eliminado
    - CSV malformado
    - Waypoints vacíos
  - **Test**: Mensajes de error claros para cada caso

---

### 1.2 Map Overflow Fix

- [ ] 🔴 **TASK-004**: Fix UplanViewModal map overflow
  - **Archivo**: `app/components/UplanViewModal.tsx`
  - **Descripción**: Reemplazar dimensiones fijas `w-[400px] h-[400px]` por:
    ```tsx
    className="w-full max-w-[95vw] md:max-w-[600px] h-[50vh] md:h-[400px] max-h-[70vh] overflow-hidden"
    ```
  - **Línea aprox**: ~117
  - **Test**: El mapa no desborda en ningún tamaño de pantalla

- [ ] 🟡 **TASK-005**: Add map resize handler in UplanViewModal
  - **Archivo**: `app/components/UplanViewModal.tsx`
  - **Descripción**: Llamar a `map.invalidateSize()` cuando el modal cambie de tamaño
  - **Test**: El mapa se re-renderiza correctamente al redimensionar ventana

- [ ] 🟢 **TASK-006**: Verify MapModal consistency
  - **Archivo**: `app/components/MapModal.tsx`
  - **Descripción**: Verificar que MapModal usa estilos responsive consistentes
  - **Test**: Ningún desbordamiento en Flight Plan Waypoints modal

---

### 1.3 Cascade Delete CsvResult

- [ ] 🔴 **TASK-007**: Fix single flightPlan delete to use correct csvResult ID
  - **Archivo**: `app/api/flightPlans/[id]/route.ts`
  - **Descripción**: En el DELETE handler, obtener el `csvResult` ID del plan antes de eliminar:
    ```typescript
    const plan = await prisma.flightPlan.findUnique({ 
      where: { id: planId },
      select: { csvResult: true }
    });
    
    await prisma.$transaction([
      ...(plan?.csvResult ? [prisma.csvResult.delete({ where: { id: plan.csvResult } })] : []),
      prisma.flightPlan.delete({ where: { id: planId } })
    ]);
    ```
  - **Línea aprox**: ~240-290
  - **Test**: Eliminar plan también elimina su csvResult

- [ ] 🔴 **TASK-008**: Fix bulk flightPlan delete cascade
  - **Archivo**: `app/api/flightPlans/route.ts`
  - **Descripción**: En DELETE bulk, recoger todos los csvResult IDs de los planes a eliminar
  - **Línea aprox**: ~362-467
  - **Test**: Bulk delete no deja csvResults huérfanos

- [ ] 🟡 **TASK-009**: Add delete logging for audit
  - **Archivos**: `app/api/flightPlans/[id]/route.ts`, `app/api/flightPlans/route.ts`
  - **Descripción**: Añadir logs indicando qué csvResults se eliminan con qué plans
  - **Test**: Logs visibles en consola durante eliminación

---

## Fase 2: Formulario U-Plan con Validación

### 2.1 Validador Zod

- [ ] 🟠 **TASK-010**: Create Zod schema for U-Plan validation
  - **Archivo a crear**: `lib/validators/uplan-validator.ts`
  - **Descripción**: Crear esquema Zod basado en `lib/uplan/uplan_schema_UPV.json`:
    - DataOwnerIdentifier (sac/sic 3 chars)
    - DataSourceIdentifier (sac/sic 3 chars)
    - ContactDetails (firstName, lastName, phones[], emails[])
    - FlightDetails (mode, category, specialOperation, privateFlight)
    - UAS (registrationNumber, serialNumber, flightCharacteristics, generalCharacteristics)
    - operatorId
  - **Exportar**: `UplanSchema`, `validateUplan()`, `getValidationErrors()`
  - **Test**: Validar objeto U-Plan completo y parcial

- [ ] 🟡 **TASK-011**: Add partial validation mode for draft saving
  - **Archivo**: `lib/validators/uplan-validator.ts`
  - **Descripción**: Añadir función `validateUplanPartial()` que permita campos vacíos
  - **Test**: Draft puede guardarse sin todos los campos obligatorios

---

### 2.2 Componente UplanFormModal

- [ ] 🟠 **TASK-012**: Create UplanFormModal component structure
  - **Archivo a crear**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Crear modal con estructura de formulario:
    - Props: `open`, `onClose`, `planId`, `existingUplan`, `onSave`, `onSubmitToFAS`
    - State: `formData`, `validationErrors`, `isSubmitting`
    - Secciones colapsables para cada grupo de campos
  - **Test**: Modal abre/cierra correctamente

- [ ] 🟠 **TASK-013**: Implement Data Identifiers section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Sección con inputs para:
    - dataOwnerIdentifier.sac (3 chars, required)
    - dataOwnerIdentifier.sic (3 chars, required)
    - dataSourceIdentifier.sac (3 chars, required)
    - dataSourceIdentifier.sic (3 chars, required)
  - **Validación**: maxLength=3, mostrar error si incorrecto
  - **Test**: Solo acepta exactamente 3 caracteres

- [ ] 🟠 **TASK-014**: Implement Contact Details section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Sección con:
    - firstName (text, required)
    - lastName (text, required)
    - phones (array dinámico con botón Add/Remove)
    - emails (array dinámico con validación email)
  - **Test**: Puede añadir/eliminar teléfonos y emails

- [ ] 🟠 **TASK-015**: Implement Flight Details section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Sección con:
    - mode (dropdown: VLOS, BVLOS)
    - category (dropdown: OPENA1-3, SAIL I-VI, Certi)
    - specialOperation (dropdown: Police, Traffic, etc.)
    - privateFlight (checkbox)
  - **Test**: Dropdowns muestran opciones correctas

- [ ] 🟠 **TASK-016**: Implement UAS Information section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Sección con subsecciones:
    - registrationNumber (text, required)
    - serialNumber (text, max 20, required)
    - Flight Characteristics:
      - uasMTOM (number, required)
      - uasMaxSpeed (number, required)
      - Connectivity (dropdown)
      - idTechnology (dropdown)
      - maxFlightTime (number)
    - General Characteristics:
      - brand, model, typeCertificate (text, required)
      - uasType (dropdown)
      - uasClass (dropdown)
      - uasDimension (dropdown)
  - **Test**: Todos los campos UAS se guardan correctamente

- [ ] 🟠 **TASK-017**: Implement Operator section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Input para operatorId (required)
  - **Test**: operatorId se valida como requerido

- [ ] 🟡 **TASK-018**: Add read-only Locations section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Mostrar en modo solo lectura:
    - takeoffLocation
    - landingLocation
    - gcsLocation
  - **Nota**: Estos se generan automáticamente desde la trayectoria
  - **Test**: Campos visibles pero no editables

- [ ] 🟡 **TASK-019**: Add read-only Operation Volumes section
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Mostrar contador de volúmenes con botón para ver en mapa
  - **Test**: Click abre UplanViewModal con los volúmenes

- [ ] 🟠 **TASK-020**: Implement form validation display
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: 
    - Mostrar asterisco (*) en campos requeridos
    - Resaltar campos con errores en rojo
    - Mostrar resumen de errores antes de submit
  - **Test**: Errores de validación claramente visibles

- [ ] 🟠 **TASK-021**: Implement Save Draft functionality
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Botón "Save Draft" que:
    - Guarda datos actuales sin validación completa
    - Actualiza `flightPlan.uplan` en DB
    - Muestra toast de confirmación
  - **Test**: Draft guardado y recuperable al reabrir

- [ ] 🟠 **TASK-022**: Implement Send to FAS functionality
  - **Archivo**: `app/components/flight-plans/UplanFormModal.tsx`
  - **Descripción**: Botón "Send to FAS" que:
    - Ejecuta validación completa con Zod
    - Si errores → muestra errores, no envía
    - Si OK → llama a `/api/flightPlans/[id]/uplan` con datos actualizados
  - **Test**: No permite enviar si faltan campos obligatorios

---

### 2.3 Integración en FlightPlansUploader

- [ ] 🟠 **TASK-023**: Wire Review U-Plan button to UplanFormModal
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Modificar onClick del botón "Review U-Plan" para abrir UplanFormModal
  - **Línea aprox**: ~821-845
  - **Test**: Click en "Review U-Plan" abre el formulario

- [ ] 🟡 **TASK-024**: Pre-fill UplanFormModal with existing data
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Pasar `selectedPlan.uplan` como prop a UplanFormModal
  - **Test**: Formulario muestra datos existentes del plan

---

## Fase 3: Migración Lógica de Generación de Volúmenes

### 3.1 Funciones Geodésicas

- [ ] 🟠 **TASK-025**: Create geodesy-utils.ts with Vincenty functions
  - **Archivo a crear**: `lib/uplan/geodesy-utils.ts`
  - **Descripción**: Implementar funciones geodésicas mejoradas:
    - `calculateVincentyDistance(lat1, lon1, lat2, lon2): number`
    - `calculateVincentyAzimuth(lat1, lon1, lat2, lon2): number`
    - `calculateDestinationPoint(lat, lon, azimuth, distance): {lat, lon}`
  - **Basado en**: `vincenty.ts` existente pero mejorado
  - **Test**: Resultados coinciden con GeographicLib ±1m

---

### 3.2 Generación de Volúmenes Orientados

- [ ] 🟠 **TASK-026**: Create generate_oriented_volumes.ts
  - **Archivo a crear**: `lib/uplan/generate_oriented_volumes.ts`
  - **Descripción**: Nueva función de generación de volúmenes:
    - Interface `UplanConfig` con parámetros
    - Función `generateOrientedRectangleCorners()`
    - Función `generateOrientedVolumes()`
  - **Parámetros según C++**:
    - TSE_H = 15.0m
    - TSE_V = 10.0m
    - Alpha_H = 7.0
    - Alpha_V = 1.0
    - tbuf = 5.0s
    - compressionFactor = 20
  - **Test**: Volúmenes generados son rectángulos orientados según azimut

- [ ] 🟠 **TASK-027**: Implement segment type detection (horizontal/vertical/mixed)
  - **Archivo**: `lib/uplan/generate_oriented_volumes.ts`
  - **Descripción**: Lógica para detectar tipo de segmento:
    ```typescript
    const isHorizontal = horizontalDistance > Alpha_H * verticalDistance;
    const isVertical = verticalDistance > Alpha_V * horizontalDistance;
    ```
  - **Test**: Segmentos clasificados correctamente

- [ ] 🟠 **TASK-028**: Implement along-track and cross-track calculations
  - **Archivo**: `lib/uplan/generate_oriented_volumes.ts`
  - **Descripción**: Calcular dimensiones del volumen según tipo de segmento
  - **Test**: Dimensiones correctas para cada tipo

- [ ] 🟠 **TASK-029**: Implement oriented rectangle corner generation
  - **Archivo**: `lib/uplan/generate_oriented_volumes.ts`
  - **Descripción**: Generar 4 esquinas del rectángulo orientado usando azimut
  - **Test**: Rectángulo alineado con trayectoria, no axis-aligned

---

### 3.3 Actualización de tray_to_uplan

- [ ] 🟠 **TASK-030**: Update tray_to_uplan.ts to use new parameters
  - **Archivo**: `lib/uplan/tray_to_uplan.ts`
  - **Descripción**: Actualizar valores por defecto:
    - compressionFactor: 50 → 20
    - TSE_H: ~14.3 → 15.0
    - TSE_V: ~9.1 → 10.0
    - Alpha: 1 → Alpha_H: 7.0, Alpha_V: 1.0
  - **Test**: Parámetros coinciden con C++

- [ ] 🟠 **TASK-031**: Replace generate_bbox with generate_oriented_volumes
  - **Archivo**: `lib/uplan/tray_to_uplan.ts`
  - **Descripción**: Cambiar llamada de generate_bbox a generateOrientedVolumes
  - **Test**: U-Plan generado usa nuevos volúmenes orientados

- [ ] 🟡 **TASK-032**: Update generateJSON to work with oriented volumes
  - **Archivo**: `lib/uplan/generate_json.ts`
  - **Descripción**: Asegurar compatibilidad con nuevo formato de volúmenes
  - **Test**: JSON final válido respecto al esquema

---

## Fase 4: Mejora del Flujo de Autorización FAS

### 4.1 Estados de Autorización

- [ ] 🟠 **TASK-033**: Add FAS processing state detection
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Añadir lógica para detectar estado "FAS procesando...":
    ```typescript
    const isFasProcessing = selectedPlan.authorizationMessage === 'FAS procesando...';
    ```
  - **Test**: Estado detectado correctamente

- [ ] 🟠 **TASK-034**: Show loading spinner during FAS processing
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Cuando `isFasProcessing === true`:
    - Mostrar spinner en botón de autorización
    - Mostrar badge "Awaiting FAS Response..." con animación pulse
  - **Test**: UI muestra estado de carga durante procesamiento

- [ ] 🟠 **TASK-035**: Disable authorization button during FAS processing
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: El botón "Request Authorization" debe estar disabled mientras FAS procesa
  - **Test**: No se puede hacer doble submit mientras FAS procesa

- [ ] 🟡 **TASK-036**: Implement polling for FAS response
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Usar `usePolling` hook para refrescar estado cada 5s mientras FAS procesa
  - **Test**: UI se actualiza automáticamente cuando FAS responde

---

### 4.2 Visor de Respuesta FAS

- [ ] 🟡 **TASK-037**: Verify FASResponseViewer is properly wired
  - **Archivo**: `app/components/flight-plans/AuthorizationPanel.tsx`
  - **Descripción**: Verificar que el componente FASResponseViewer se muestra cuando:
    - `authorizationMessage !== null`
    - `authorizationMessage !== 'FAS procesando...'`
  - **Test**: Respuesta RAW visible después de autorización

- [ ] 🟡 **TASK-038**: Add FASResponseViewer to FlightPlansUploader panel
  - **Archivo**: `app/components/FlightPlansUploader.tsx`
  - **Descripción**: Mostrar respuesta del FAS en el panel de detalles del plan
  - **Test**: Usuario puede ver respuesta completa del FAS

- [ ] 🟢 **TASK-039**: Add copy-to-clipboard for FAS response
  - **Archivo**: `app/components/flight-plans/AuthorizationPanel.tsx`
  - **Descripción**: Verificar funcionalidad de copiar respuesta FAS
  - **Test**: Botón de copiar funciona correctamente

---

## Fase 5: Integración WebSocket Geoawareness

### 5.1 Carga de U-spaces

- [ ] 🟠 **TASK-040**: Create useUspaces hook
  - **Archivo a crear**: `app/hooks/useUspaces.ts`
  - **Descripción**: Hook para cargar lista de U-spaces:
    ```typescript
    interface USpace {
      name: string;
      id: string;
      boundary: Array<{latitude: number; longitude: number}>;
    }
    
    export function useUspaces(): {
      uspaces: USpace[];
      loading: boolean;
      error: Error | null;
      refetch: () => void;
    }
    ```
  - **Endpoint**: `GET http://${GEOAWARENESS_SERVICE_IP}/${GEOAWARENESS_USPACES_ENDPOINT}`
  - **Test**: Lista de U-spaces cargada correctamente

- [ ] 🟠 **TASK-041**: Create API endpoint for U-spaces proxy
  - **Archivo a crear**: `app/api/geoawareness/uspaces/route.ts`
  - **Descripción**: Endpoint proxy para evitar CORS:
    - GET → fetch de servicio externo
    - Retornar lista de u_spaces
  - **Test**: Endpoint retorna datos del servicio geoawareness

---

### 5.2 Selector de U-space

- [ ] 🟠 **TASK-042**: Create UspaceSelector component
  - **Archivo a crear**: `app/components/plan-generator/UspaceSelector.tsx`
  - **Descripción**: Mapa interactivo que muestra todos los U-spaces:
    - Renderizar polígonos de cada U-space con su nombre
    - Click en U-space → selecciona y centra mapa
    - Devuelve `uspace_identifier` seleccionado
  - **Test**: Click selecciona U-space y centra vista

- [ ] 🟠 **TASK-043**: Integrate UspaceSelector in PlanGenerator
  - **Archivo**: `app/components/PlanGenerator.tsx`
  - **Descripción**: Añadir paso inicial de selección de U-space:
    - Mostrar UspaceSelector antes de mostrar PlanMap
    - Guardar `selectedUspaceId` en estado
    - Pasar límites del U-space al PlanMap
  - **Test**: Flujo: Seleccionar U-space → Ver mapa de planificación

- [ ] 🟡 **TASK-044**: Add loading state while fetching U-spaces
  - **Archivo**: `app/components/PlanGenerator.tsx`
  - **Descripción**: Mostrar spinner mientras se cargan U-spaces
  - **Test**: Loading spinner visible durante carga

- [ ] 🟡 **TASK-045**: Store uspace_identifier in geoawarenessData on publish
  - **Archivo**: `app/components/PlanGenerator.tsx`
  - **Descripción**: Al publicar plan, incluir `uspace_identifier` en `geoawarenessData`
  - **Test**: Campo guardado en DB al crear plan

---

### 5.3 WebSocket Hook para Geoawareness

- [ ] 🟠 **TASK-046**: Create useGeoawarenessWebSocket hook
  - **Archivo a crear**: `app/hooks/useGeoawarenessWebSocket.ts`
  - **Descripción**: Hook de WebSocket con:
    - Conexión a `ws://${IP}/ws/gas/${uspaceId}`
    - Estados: connecting, connected, disconnected, error
    - Auto-reconexión con backoff exponencial
    - Limpieza al desmontar
  - **Test**: Conexión WebSocket exitosa

- [ ] 🟠 **TASK-047**: Implement exponential backoff reconnection
  - **Archivo**: `app/hooks/useGeoawarenessWebSocket.ts`
  - **Descripción**: Reconexión automática con delays: 1s, 2s, 4s, 8s, 16s (max 5 intentos)
  - **Test**: Reconecta después de desconexión

- [ ] 🟡 **TASK-048**: Add NEXT_PUBLIC env variable for WebSocket URL
  - **Archivo**: `.env`
  - **Descripción**: Añadir `NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP` para uso en cliente
  - **Test**: Variable accesible desde componentes cliente

---

### 5.4 Capa de Geozonas en PlanMap

- [ ] 🟠 **TASK-049**: Create GeozoneLayer component
  - **Archivo a crear**: `app/components/plan-generator/GeozoneLayer.tsx`
  - **Descripción**: Componente Leaflet que renderiza geozonas:
    - Recibe array de `geozones_data`
    - Colorea según tipo (prohibited=rojo, restricted=naranja, etc.)
    - Soporta visibilidad toggle
  - **Test**: Geozonas visibles en mapa

- [ ] 🟠 **TASK-050**: Create GeozoneInfoPopup component
  - **Archivo a crear**: `app/components/plan-generator/GeozoneInfoPopup.tsx`
  - **Descripción**: Popup con información de geozona:
    - Nombre, tipo, restricciones
    - Límites temporales
    - Estilo similar a `/lib/geozones/geozones_map.html`
  - **Test**: Click en geozona muestra popup info

- [ ] 🟠 **TASK-051**: Integrate GeozoneLayer in PlanMap
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: Añadir GeozoneLayer detrás de waypoints:
    - Props: geozonesData, visible
    - Capa entre límites y waypoints
  - **Test**: Geozonas renderizadas correctamente

- [ ] 🟠 **TASK-052**: Add geozone visibility toggle in PlanMap
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: Botón/checkbox para mostrar/ocultar capa de geozonas
  - **Test**: Toggle funciona correctamente

- [ ] 🟠 **TASK-053**: Differentiate geozone info click from waypoint placement
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: Asegurar que:
    - Click en icono info de geozona → abre popup, NO coloca waypoint
    - Click en área vacía del mapa → coloca waypoint
  - **Test**: No se colocan waypoints al consultar info de geozona

---

### 5.5 Reemplazo de FAS Service Area

- [ ] 🟠 **TASK-054**: Replace FAS Service Area with U-space bounds in PlanMap
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: 
    - Eliminar constante `SERVICE_LIMITS` hardcodeada
    - Recibir límites del U-space seleccionado como props
    - Renderizar polígono del U-space en lugar de rectángulo fijo
  - **Test**: Límites corresponden al U-space seleccionado

- [ ] 🟡 **TASK-055**: Update world mask to use U-space bounds
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: El overlay que oscurece el exterior debe usar límites del U-space
  - **Test**: Área fuera del U-space oscurecida correctamente

- [ ] 🟡 **TASK-056**: Update label from "FAS Service Area" to U-space name
  - **Archivo**: `app/components/PlanMap.tsx`
  - **Descripción**: Mostrar nombre del U-space seleccionado en lugar de "FAS Service Area"
  - **Test**: Label muestra nombre correcto

---

### 5.6 GeoawarenessViewer con WebSocket

- [ ] 🟠 **TASK-057**: Refactor GeoawarenessViewer to use WebSocket
  - **Archivo**: `app/components/flight-plans/GeoawarenessViewer.tsx`
  - **Descripción**: Reemplazar fetch HTTP por useGeoawarenessWebSocket hook:
    - Obtener uspaceId de `flightPlan.geoawarenessData.uspace_identifier`
    - Conectar via WebSocket
    - Renderizar geozonas sobre mapa con trayectoria
  - **Test**: Geozonas cargadas via WebSocket

- [ ] 🟡 **TASK-058**: Add loading state to GeoawarenessViewer
  - **Archivo**: `app/components/flight-plans/GeoawarenessViewer.tsx`
  - **Descripción**: Mostrar spinner mientras se conecta WebSocket
  - **Test**: Spinner visible durante conexión

- [ ] 🟡 **TASK-059**: Add error handling to GeoawarenessViewer
  - **Archivo**: `app/components/flight-plans/GeoawarenessViewer.tsx`
  - **Descripción**: Mostrar mensaje de error si WebSocket falla, con botón retry
  - **Test**: Error mostrado y retry funciona

- [ ] 🟡 **TASK-060**: Add trajectory overlay in GeoawarenessViewer
  - **Archivo**: `app/components/flight-plans/GeoawarenessViewer.tsx`
  - **Descripción**: Renderizar trayectoria del plan sobre las geozonas
  - **Test**: Trayectoria visible sobre geozonas

---

## Fase 6: Correcciones de Tema

### 6.1 Login Page Theme

- [ ] 🟡 **TASK-061**: Replace hardcoded background colors in login page
  - **Archivo**: `app/login/page.tsx`
  - **Descripción**: Reemplazar:
    - `bg-gray-900` → `bg-[var(--bg-primary)]`
    - `bg-gray-800` → `bg-[var(--surface-primary)]`
  - **Test**: Fondo cambia según tema

- [ ] 🟡 **TASK-062**: Replace hardcoded text colors in login page
  - **Archivo**: `app/login/page.tsx`
  - **Descripción**: Reemplazar:
    - `text-white` → `text-[var(--text-primary)]`
    - `text-gray-400` → `text-[var(--text-secondary)]`
    - `text-gray-300` → `text-[var(--text-secondary)]`
  - **Test**: Texto legible en ambos temas

- [ ] 🟡 **TASK-063**: Fix LoginLoading component theme
  - **Archivo**: `app/login/page.tsx`
  - **Descripción**: Aplicar mismos cambios al componente LoginLoading
  - **Test**: Loading skeleton usa colores de tema

- [ ] 🟡 **TASK-064**: Fix warning box theme in signup
  - **Archivo**: `app/login/page.tsx`
  - **Descripción**: Reemplazar:
    - `bg-yellow-900/30` → `bg-[var(--color-warning)]/10`
    - `border-yellow-700` → `border-[var(--color-warning)]`
    - `text-yellow-200` → `text-[var(--color-warning)]`
  - **Test**: Warning box visible en ambos temas

---

### 6.2 Footer Theme-Aware Logos

- [ ] 🟡 **TASK-065**: Add useTheme hook to Footer
  - **Archivo**: `app/components/footer.tsx`
  - **Descripción**: Importar y usar `useTheme` hook para detectar tema actual
  - **Test**: Hook funciona correctamente

- [ ] 🟡 **TASK-066**: Implement conditional SNA logo rendering
  - **Archivo**: `app/components/footer.tsx`
  - **Descripción**: Renderizar logo según tema:
    - Dark: `/images/SNA_WHITE.png`
    - Light: `/images/SNA_DEEPBLUE.png`
  - **Test**: Logo correcto según tema

- [ ] 🟡 **TASK-067**: Implement conditional UPV logo rendering
  - **Archivo**: `app/components/footer.tsx`
  - **Descripción**: Renderizar logo según tema:
    - Dark: `/images/marca_UPV_principal_blanco150.png`
    - Light: `/images/marca_UPV_principal_negro150.png`
  - **Test**: Logo correcto según tema

- [ ] 🟡 **TASK-068**: Implement conditional LinkedIn icon rendering
  - **Archivo**: `app/components/footer.tsx`
  - **Descripción**: Usar SVG o imagen según tema:
    - Dark: SVG path fill="white" o `/images/LinkedIN_white.svg`
    - Light: `/images/LinkedIN_dark.svg`
  - **Test**: Icono visible en ambos temas

- [ ] 🟡 **TASK-069**: Implement conditional Instagram icon rendering
  - **Archivo**: `app/components/footer.tsx`
  - **Descripción**: Usar SVG o imagen según tema:
    - Dark: SVG path fill="white" o `/images/Instagram_white.svg`
    - Light: `/images/Instagram_dark.svg`
  - **Test**: Icono visible en ambos temas

---

## Dependencias entre Tareas

```
FASE 1 (Independiente - Crítico)
├── TASK-001..003 (View Trajectory)
├── TASK-004..006 (Map Overflow)
└── TASK-007..009 (Cascade Delete)

FASE 2 (Depende de FASE 1 parcialmente)
├── TASK-010..011 (Validador Zod) ─┐
└── TASK-012..024 (UplanFormModal) ←┘

FASE 3 (Independiente)
├── TASK-025 (geodesy-utils) ─────┐
├── TASK-026..029 (oriented volumes) ←┘
└── TASK-030..032 (tray_to_uplan update)

FASE 4 (Depende de FASE 2 parcialmente)
├── TASK-033..036 (FAS states)
└── TASK-037..039 (FAS viewer)

FASE 5 (Mayor - Semi-independiente)
├── TASK-040..041 (U-spaces API) ─────────┐
├── TASK-042..045 (UspaceSelector) ←───────┤
├── TASK-046..048 (WebSocket hook) ────────┤
├── TASK-049..053 (GeozoneLayer) ←─────────┤
├── TASK-054..056 (Replace Service Area) ←─┤
└── TASK-057..060 (GeoawarenessViewer) ←───┘

FASE 6 (Independiente - UI Polish)
├── TASK-061..064 (Login theme)
└── TASK-065..069 (Footer logos)
```

---

## Resumen

| Fase | Tareas | Prioridad | Esfuerzo Est. |
|------|--------|-----------|---------------|
| 1 | 9 | 🔴 CRÍTICO | 4-6h |
| 2 | 15 | 🟠 ALTO | 8-12h |
| 3 | 8 | 🟠 ALTO | 6-8h |
| 4 | 7 | 🟠 ALTO | 3-4h |
| 5 | 21 | 🟠 ALTO | 12-16h |
| 6 | 9 | 🟡 MEDIO | 2-3h |
| **TOTAL** | **69** | - | **35-49h** |

---

## Comandos de Verificación

Antes de marcar cualquier tarea como completada:

```bash
# Verificar que no hay errores de TypeScript
npm run build

# Ejecutar tests
npm run test

# Verificar linting
npm run lint

# Preflight completo
just preflight
```

Formato de commit:
```
feat(component): descripción concisa del cambio

- Detalle 1
- Detalle 2
```
