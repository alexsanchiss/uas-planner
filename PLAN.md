# UAS Planner - Plan de Implementación v2.0

## Resumen Ejecutivo

Este plan aborda 10 áreas principales de mejora y corrección de bugs en el UAS Planner:

1. **Corrección de View Trajectory** - El botón "View Trajectory" muestra error y debe activarse solo cuando status = procesado
2. **Corrección de desbordamiento del mapa** - El mapa en Flight Plan Waypoints se sale de su contenedor
3. **Cascada de eliminación CsvResult** - Asegurar que al eliminar un flightPlan se elimine su csvResult asociado
4. **Formulario de Review U-Plan con validación** - Permitir revisar/editar datos del U-Plan antes de autorización
5. **Migración de lógica de generación de volúmenes** - Adaptar scripts TypeScript para seguir lógica del C++
6. **Mejora del flujo de autorización FAS** - Mostrar estado de carga mientras FAS procesa
7. **Visor de respuesta RAW del FAS** - Permitir ver la respuesta completa del FAS
8. **Integración WebSocket con Geoawareness** - Nueva arquitectura con selección de U-space y geozonas
9. **Corrección de tema en Login** - El fondo está hardcodeado y no respeta el tema
10. **Logos del Footer adaptativos al tema** - Los logos deben cambiar según el tema claro/oscuro

---

## Fase 1: Correcciones Críticas de Funcionalidad

### 1.1 Corrección de View Trajectory

**Problema:**
- El botón "View Trajectory" muestra el error "Trajectory data not found"
- El botón debería habilitarse solo cuando `status === 'procesado'` Y existe `csvResult`

**Archivos afectados:**
- `app/components/FlightPlansUploader.tsx` - Lógica del botón
- `app/components/flight-plans/TrajectoryMapViewer.tsx` - Componente de visualización

**Solución:**
1. Modificar la condición del botón para verificar:
   - `selectedPlan.status === 'procesado'`
   - `selectedPlan.csvResult !== null`
2. Mejorar el manejo de errores en TrajectoryMapViewer para casos edge
3. Añadir tooltip explicativo cuando el botón está deshabilitado

**Validación:**
- El botón aparece deshabilitado con tooltip cuando status ≠ procesado
- El botón funciona correctamente cuando ambas condiciones se cumplen
- No aparece el error "Trajectory data not found" en condiciones normales

---

### 1.2 Corrección de Desbordamiento del Mapa

**Problema:**
- En Flight Plan Waypoints, el mapa de Leaflet se desborda de la ventana modal que lo contiene
- UplanViewModal usa dimensiones fijas de 400x400 sin responsive

**Archivos afectados:**
- `app/components/UplanViewModal.tsx`
- `app/components/MapModal.tsx` (verificar consistencia)

**Solución:**
1. Reemplazar dimensiones fijas por responsive:
   ```tsx
   // Antes
   <div className="w-[400px] h-[400px]">
   
   // Después
   <div className="w-full max-w-[95vw] h-[60vh] max-h-[500px] min-h-[300px]">
   ```
2. Añadir `overflow-hidden` al contenedor del mapa
3. Usar `invalidateSize()` de Leaflet cuando el modal cambie de tamaño

**Validación:**
- El mapa nunca excede los límites del modal
- El mapa es responsive en diferentes tamaños de pantalla
- Los controles del mapa permanecen accesibles

---

### 1.3 Cascada de Eliminación CsvResult

**Problema:**
- Al eliminar un flightPlan, el csvResult asociado podría quedar huérfano
- No hay foreign key constraint en Prisma, solo lógica a nivel de API
- El código actual asume que `csvResult.id === flightPlan.id`, lo cual es incorrecto

**Archivos afectados:**
- `app/api/flightPlans/[id]/route.ts` - DELETE single
- `app/api/flightPlans/route.ts` - DELETE bulk
- `prisma/schema.prisma` - Schema (opcional: añadir relación)

**Solución:**
1. Corregir la lógica de eliminación:
   ```typescript
   // Antes (incorrecto)
   prisma.csvResult.deleteMany({ where: { id: planId } })
   
   // Después (correcto)
   const plan = await prisma.flightPlan.findUnique({ where: { id: planId } });
   if (plan?.csvResult) {
     await prisma.csvResult.delete({ where: { id: plan.csvResult } });
   }
   ```
2. Mantener transacciones para atomicidad
3. Añadir logging para auditoría

**Validación:**
- Al eliminar un flightPlan, su csvResult asociado se elimina
- No quedan registros huérfanos en csvResult
- La eliminación bulk funciona correctamente

---

## Fase 2: Formulario de U-Plan con Validación

### 2.1 Nuevo Componente UplanFormModal

**Objetivo:**
Permitir al usuario revisar y editar los datos del U-Plan antes de enviar a autorización, con validación según el esquema JSON oficial.

**Archivos a crear:**
- `app/components/flight-plans/UplanFormModal.tsx` - Modal principal
- `app/components/flight-plans/UplanFormSections.tsx` - Secciones del formulario
- `lib/validators/uplan-validator.ts` - Validador con Zod

**Estructura del formulario (basado en uplan_schema_UPV.json):**

```
┌─────────────────────────────────────────────────────────────┐
│ Review U-Plan: [Nombre del Plan]                            │
├─────────────────────────────────────────────────────────────┤
│ ▼ Data Identifiers *                                        │
│   ┌─────────────────┐  ┌─────────────────┐                  │
│   │ Owner SAC: ___  │  │ Owner SIC: ___  │                  │
│   └─────────────────┘  └─────────────────┘                  │
│   ┌─────────────────┐  ┌─────────────────┐                  │
│   │ Source SAC: ___ │  │ Source SIC: ___ │                  │
│   └─────────────────┘  └─────────────────┘                  │
│                                                             │
│ ▼ Contact Details *                                         │
│   First Name: _____________ *                               │
│   Last Name: ______________ *                               │
│   Phones: [+34...] [Add Phone]                              │
│   Emails: [email@...] [Add Email]                           │
│                                                             │
│ ▼ Flight Details *                                          │
│   Mode: [VLOS ▼] *    Category: [OPENA1 ▼] *               │
│   Special Operation: [None ▼]                               │
│   ☐ Private Flight                                          │
│                                                             │
│ ▼ UAS Information *                                         │
│   Registration Number: ____________ *                       │
│   Serial Number: ____________ * (max 20 chars)              │
│   ├─ Flight Characteristics                                 │
│   │  MTOM (kg): _____ *  Max Speed (m/s): _____ *          │
│   │  Connectivity: [LTE ▼] *  ID Tech: [NRID ▼] *          │
│   │  Max Flight Time (min): _____ *                         │
│   └─ General Characteristics                                │
│      Brand: _______ *  Model: _______ *                     │
│      Type Certificate: _______ *                            │
│      UAS Type: [MULTIROTOR ▼] *                            │
│      UAS Class: [C1 ▼] *  Dimension: [LT_1 ▼] *            │
│                                                             │
│ ▼ Operator                                                  │
│   Operator ID: ____________ *                               │
│                                                             │
│ ▼ Locations (read-only, auto-generated)                     │
│   Takeoff: [lat, lon, alt]                                  │
│   Landing: [lat, lon, alt]                                  │
│   GCS: [lat, lon, alt]                                      │
│                                                             │
│ ▼ Operation Volumes (read-only, auto-generated)             │
│   [N volumes] - Click to view on map                        │
│                                                             │
│ ═══════════════════════════════════════════════════════════ │
│ * Required fields - All must be filled before authorization │
│                                                             │
│ [Cancel]                    [Save Draft]  [Send to FAS ▸]  │
└─────────────────────────────────────────────────────────────┘
```

**Campos obligatorios según esquema:**
- `dataOwnerIdentifier`: { sac (3 chars), sic (3 chars) }
- `dataSourceIdentifier`: { sac (3 chars), sic (3 chars) }
- `contactDetails`: { firstName, lastName, phones[], emails[] }
- `flightDetails`: { mode, category, specialOperation, privateFlight }
- `uas`: { registrationNumber, serialNumber, flightCharacteristics, generalCharacteristics }
- `operatorId`

**Validación con Zod:**
```typescript
const UplanSchema = z.object({
  dataOwnerIdentifier: z.object({
    sac: z.string().length(3),
    sic: z.string().length(3),
  }),
  dataSourceIdentifier: z.object({
    sac: z.string().length(3),
    sic: z.string().length(3),
  }),
  contactDetails: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phones: z.array(z.string()).min(1),
    emails: z.array(z.string().email()).min(1),
  }),
  flightDetails: z.object({
    mode: z.enum(['VLOS', 'BVLOS']),
    category: z.enum(['OPENA1', 'OPENA2', 'OPENA3', 'SAIL_I-II', 'SAIL_III-IV', 'SAIL_V-VI', 'Certi_No_Pass', 'Certi_Pass']),
    specialOperation: z.enum(['', 'POLICE_AND_CUSTOMS', 'TRAFFIC_SURVEILLANCE_AND_PURSUIT', 'ENVIRONMENTAL_CONTROL', 'SEARCH_AND_RESCUE', 'MEDICAL', 'EVACUATIONS', 'FIREFIGHTING', 'STATE_OFFICIALS']),
    privateFlight: z.boolean(),
  }),
  uas: z.object({
    registrationNumber: z.string().min(1),
    serialNumber: z.string().max(20).min(1),
    flightCharacteristics: z.object({
      uasMTOM: z.number().positive(),
      uasMaxSpeed: z.number().positive(),
      Connectivity: z.enum(['RF', 'LTE', 'SAT', '5G']),
      idTechnology: z.enum(['NRID', 'ADSB', 'OTHER']),
      maxFlightTime: z.number().positive(),
    }),
    generalCharacteristics: z.object({
      brand: z.string().min(1),
      model: z.string().min(1),
      typeCertificate: z.string().min(1),
      uasType: z.enum(['NONE_NOT_DECLARED', 'MULTIROTOR', 'FIXED_WING']),
      uasClass: z.enum(['NONE', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']),
      uasDimension: z.enum(['LT_1', 'LT_3', 'LT_8', 'GTE_8']),
    }),
  }),
  operatorId: z.string().min(1),
});
```

**Flujo:**
1. Usuario hace clic en "Review U-Plan" → Abre UplanFormModal
2. El formulario se pre-rellena con datos existentes de `flightPlan.uplan`
3. Usuario puede editar cualquier campo
4. "Save Draft" → Guarda cambios sin validar (para plan-generator)
5. "Send to FAS" → Valida todo, muestra errores si faltan campos obligatorios
6. Si validación OK → Actualiza U-Plan y envía a FAS

---

## Fase 3: Migración de Lógica de Generación de Volúmenes

### 3.1 Diferencias C++ vs TypeScript Actuales

| Parámetro | TypeScript Actual | C++ Nuevo | Cambio |
|-----------|-------------------|-----------|--------|
| compressionFactor | 50 | 20 | Más waypoints |
| TSE_H | 2*sqrt(0.75²+1²+7.05²) ≈ 14.3m | 15.0m | Fijado |
| TSE_V | 2*sqrt(4²+1.5²+1.45²) ≈ 9.1m | 10.0m | Fijado |
| Alpha | 1 (único) | Alpha_H=7, Alpha_V=1 | Separados |
| tbuf | 5s | 5s | Sin cambio |
| Volúmenes | Axis-aligned squares | Oriented rectangles | **Mayor cambio** |

### 3.2 Archivos a Modificar/Crear

**Modificar:**
- `lib/uplan/tray_to_uplan.ts` - Parámetros y llamada a generate_bbox
- `lib/uplan/generate_bbox.ts` - Nueva lógica de volúmenes orientados

**Crear:**
- `lib/uplan/generate_oriented_volumes.ts` - Generación de rectángulos orientados
- `lib/uplan/geodesy-utils.ts` - Funciones geodésicas (vincenty mejorado)

### 3.3 Nueva Lógica de Generación de Volúmenes

```typescript
interface UplanConfig {
  TSE_H: number;      // 15.0
  TSE_V: number;      // 10.0
  Alpha_H: number;    // 7.0
  Alpha_V: number;    // 1.0
  tbuf: number;       // 5.0
  compressionFactor: number;  // 20
}

function generateOrientedVolumes(
  waypoints: Waypoint[],
  startTimestamp: number,
  config: UplanConfig
): OperationVolume[] {
  const volumes: OperationVolume[] = [];
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];
    
    // Calcular distancia y azimut usando Vincenty
    const distance = calculateVincentyDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
    const azimuth = calculateVincentyAzimuth(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
    
    // Punto medio
    const midLat = (wp1.lat + wp2.lat) / 2;
    const midLon = (wp1.lon + wp2.lon) / 2;
    const minAlt = Math.min(wp1.h, wp2.h);
    const maxAlt = Math.max(wp1.h, wp2.h);
    const midAlt = (minAlt + maxAlt) / 2;
    
    const horizontalDistance = distance;
    const verticalDistance = Math.abs(wp2.h - wp1.h);
    
    // Determinar tipo de segmento
    const isHorizontal = horizontalDistance > config.Alpha_H * verticalDistance;
    const isVertical = verticalDistance > config.Alpha_V * horizontalDistance;
    
    let alongTrack: number, crossTrack: number, verticalBuffer: number;
    
    if (isHorizontal) {
      alongTrack = distance / 2 + config.TSE_H;
      crossTrack = config.TSE_H;
      verticalBuffer = config.TSE_V;
    } else if (isVertical) {
      alongTrack = config.TSE_H;
      crossTrack = config.TSE_H;
      verticalBuffer = verticalDistance / 2 + config.TSE_V;
    } else {
      alongTrack = distance / 2 + config.TSE_H;
      crossTrack = config.TSE_H;
      verticalBuffer = verticalDistance / 2 + config.TSE_V;
    }
    
    // Generar esquinas del rectángulo orientado
    const corners = generateOrientedRectangleCorners(
      midLat, midLon, azimuth, alongTrack, crossTrack
    );
    
    // Construir volumen
    volumes.push({
      geometry: {
        type: 'Polygon',
        coordinates: [corners.map(c => [c.lon, c.lat])],
        bbox: calculateBbox(corners),
      },
      timeBegin: formatISO(startTimestamp + wp1.time - config.tbuf),
      timeEnd: formatISO(startTimestamp + wp2.time + config.tbuf),
      minAltitude: {
        value: Math.max(midAlt - verticalBuffer, 10), // mínimo 10m sobre suelo
        reference: 'AGL',
        uom: 'M',
      },
      maxAltitude: {
        value: midAlt + verticalBuffer,
        reference: 'AGL',
        uom: 'M',
      },
      ordinal: i,
    });
  }
  
  return volumes;
}
```

---

## Fase 4: Mejora del Flujo de Autorización FAS

### 4.1 Estados de Autorización

| authorizationStatus | authorizationMessage | UI State |
|---------------------|---------------------|----------|
| "sin autorización" | null | Botón "Request Authorization" habilitado |
| "sin autorización" | "FAS procesando..." | Loading spinner, botón deshabilitado |
| "aprobado" | JSON response | Badge verde + respuesta visible |
| "denegado" | JSON response | Badge rojo + respuesta visible |

### 4.2 Cambios Requeridos

**FlightPlansUploader.tsx:**
```typescript
// Determinar si está procesando
const isFasProcessing = selectedPlan.authorizationMessage === 'FAS procesando...';

// Botón de autorización
<Button
  disabled={!canAuthorize || isFasProcessing}
  onClick={handleAuthorizePlan}
>
  {isFasProcessing ? (
    <>
      <Spinner className="mr-2" />
      FAS Processing...
    </>
  ) : (
    'Request Authorization'
  )}
</Button>

// Badge de estado
{isFasProcessing && (
  <Badge variant="warning" className="animate-pulse">
    <Spinner size="sm" /> Awaiting FAS Response...
  </Badge>
)}
```

**Polling para actualizaciones:**
```typescript
// Usar usePolling hook existente mientras status = procesando
usePolling(
  () => fetchPlanStatus(selectedPlan.id),
  5000, // cada 5 segundos
  isFasProcessing // solo cuando está procesando
);
```

### 4.3 Visor de Respuesta RAW del FAS

Verificar que el componente `FASResponseViewer` en `AuthorizationPanel.tsx` está correctamente conectado:

```typescript
// En FlightPlansUploader o AuthorizationPanel
{selectedPlan.authorizationMessage && 
 selectedPlan.authorizationMessage !== 'FAS procesando...' && (
  <FASResponseViewer 
    response={selectedPlan.authorizationMessage}
    status={selectedPlan.authorizationStatus}
  />
)}
```

---

## Fase 5: Integración WebSocket Geoawareness

### 5.1 Nueva Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLAN GENERATOR                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SELECCIÓN DE U-SPACE                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Mapa con todos los U-spaces disponibles]                  │ │
│  │                                                            │ │
│  │    ┌──────────────┐      ┌──────────────┐                 │ │
│  │    │  Benidorm    │      │  Manduria    │                 │ │
│  │    │  U-space     │      │  Flight Zone │                 │ │
│  │    └──────────────┘      └──────────────┘                 │ │
│  │                                                            │ │
│  │  Click to select U-space                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↓                                      │
│  2. PLANIFICACIÓN DE WAYPOINTS (con geozonas)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Mapa centrado en U-space seleccionado]                    │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ CAPA: Límites U-space (borde naranja discontinuo)   │  │ │
│  │  │ CAPA: Geozonas (colores según tipo) [Toggle ☑]      │  │ │
│  │  │ CAPA: Waypoints del plan de vuelo                   │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  [ℹ] Click en geozona = info popup (NO coloca waypoint)   │ │
│  │  [+] Click en mapa = coloca waypoint                       │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Endpoints y Formato de Respuesta

**1. Obtener lista de U-spaces:**
```
GET http://${GEOAWARENESS_SERVICE_IP}/${GEOAWARENESS_USPACES_ENDPOINT}
```

Respuesta:
```json
{
  "u_spaces": [
    {
      "name": "Benidorm U-space",
      "id": "USP-ESP-BEN-01",
      "boundary": [
        { "latitude": 38.5210, "longitude": -0.1651 },
        { "latitude": 38.5555, "longitude": -0.1651 },
        { "latitude": 38.5555, "longitude": -0.1013 },
        { "latitude": 38.5210, "longitude": -0.1013 },
        { "latitude": 38.5210, "longitude": -0.1651 }
      ]
    }
  ]
}
```

**2. WebSocket para datos de U-space:**
```
WebSocket: ws://${GEOAWARENESS_SERVICE_IP}/ws/gas/{uspace_identifier}
```

Respuesta (streaming):
```json
{
  "status": "success",
  "timestamp": "2026-01-23T14:30:00Z",
  "uspace_identifier": "USP-ESP-BEN-01",
  
  "uspace_data": { ... },
  
  "geozones_data": [
    {
      "uas_geozones_identifier": "GZ_001",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": { "name": "Airport Zone", "type": "prohibited" },
      "restrictions": { ... },
      "temporal_limits": { ... }
    }
  ],
  
  "notams_data": [...],
  "manned_aircrafts_data": [...],
  
  "metadata": { ... }
}
```

### 5.3 Archivos a Crear/Modificar

**Crear:**
- `app/hooks/useUspaces.ts` - Hook para cargar lista de U-spaces
- `app/hooks/useGeoawarenessWebSocket.ts` - Hook WebSocket con reconexión automática
- `app/components/plan-generator/UspaceSelector.tsx` - Selector de U-space en mapa
- `app/components/plan-generator/GeozoneLayer.tsx` - Capa de geozonas para Leaflet
- `app/components/plan-generator/GeozoneInfoPopup.tsx` - Popup de info de geozona

**Modificar:**
- `app/components/PlanGenerator.tsx` - Integrar selector y geozonas
- `app/components/PlanMap.tsx` - Añadir capa de geozonas con toggle
- `app/components/flight-plans/GeoawarenessViewer.tsx` - Migrar a WebSocket

### 5.4 Hook de WebSocket con Reconexión

```typescript
// app/hooks/useGeoawarenessWebSocket.ts

interface UseGeoawarenessWebSocketOptions {
  uspaceId: string | null;
  onMessage?: (data: GeoawarenessData) => void;
  onError?: (error: Event) => void;
  maxRetries?: number;
  baseDelay?: number;
}

export function useGeoawarenessWebSocket({
  uspaceId,
  onMessage,
  onError,
  maxRetries = 5,
  baseDelay = 1000,
}: UseGeoawarenessWebSocketOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [data, setData] = useState<GeoawarenessData | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  
  const connect = useCallback(() => {
    if (!uspaceId) return;
    
    const wsUrl = `ws://${process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}/ws/gas/${uspaceId}`;
    setStatus('connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setStatus('connected');
      setRetryCount(0);
    };
    
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      setData(parsed);
      onMessage?.(parsed);
    };
    
    ws.onerror = (event) => {
      setStatus('error');
      onError?.(event);
    };
    
    ws.onclose = () => {
      setStatus('disconnected');
      
      // Reconexión con backoff exponencial
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        setTimeout(() => {
          setRetryCount(r => r + 1);
          connect();
        }, delay);
      }
    };
  }, [uspaceId, retryCount, maxRetries, baseDelay, onMessage, onError]);
  
  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
  
  return { status, data, reconnect: connect };
}
```

### 5.5 Jerarquía de Visualización en PlanMap

```
Capas (de abajo a arriba):
1. TileLayer (OpenStreetMap)
2. Máscara mundial (oscurece fuera de U-space)
3. Límites del U-space (borde naranja discontinuo)
4. Geozonas (colores por tipo, toggle on/off)
5. Waypoints y líneas del plan
6. Marcadores de info de geozona
```

**Colores de geozonas:**
- `prohibited` → Rojo (#DC2626)
- `restricted` → Naranja (#F97316)
- `controlled` → Amarillo (#EAB308)
- `advisory` → Azul (#3B82F6)
- `warning` → Púrpura (#8B5CF6)
- `temporary` → Gris (#6B7280)

### 5.6 GeoawarenessViewer Adaptado

Modificar el componente para usar WebSocket en lugar de HTTP:

```typescript
// Antes: HTTP POST a /api/flightPlans/[id]/geoawareness
// Después: WebSocket a /ws/gas/{uspace_identifier}

export function GeoawarenessViewer({ planId, uspaceId }) {
  const { status, data } = useGeoawarenessWebSocket({ uspaceId });
  
  if (status === 'connecting') return <LoadingSpinner />;
  if (status === 'error') return <ErrorMessage retry={reconnect} />;
  
  return (
    <MapContainer>
      {/* Renderizar geozonas */}
      {data?.geozones_data.map(zone => (
        <GeozonePolygon key={zone.uas_geozones_identifier} zone={zone} />
      ))}
      
      {/* Renderizar trayectoria del plan */}
      <TrajectoryPolyline planId={planId} />
    </MapContainer>
  );
}
```

---

## Fase 6: Correcciones de Tema

### 6.1 Login Page Theme Fix

**Problema:**
El archivo `app/login/page.tsx` usa clases hardcodeadas:
- `bg-gray-900` → Debería ser `bg-[var(--bg-primary)]`
- `bg-gray-800` → Debería ser `bg-[var(--surface-primary)]`
- `text-white` → Debería ser `text-[var(--text-primary)]`
- `text-gray-400` → Debería ser `text-[var(--text-secondary)]`

**Solución:**
Reemplazar todas las clases hardcodeadas por variables CSS del tema.

### 6.2 Footer Logos Theme-Aware

**Problema:**
Los logos actuales son solo blancos, no se ven bien en tema claro.

**Logos disponibles:**
| Tema | SNA Logo | UPV Logo | LinkedIn | Instagram |
|------|----------|----------|----------|-----------|
| Dark | SNA_WHITE.png | marca_UPV_principal_blanco150.png | white SVG | white SVG |
| Light | SNA_DEEPBLUE.png | marca_UPV_principal_negro150.png | LinkedIN_dark.svg | Instagram_dark.svg |

**Solución:**
```tsx
// app/components/footer.tsx
import { useTheme } from '../hooks/useTheme';

export function Footer() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <footer>
      <Image
        src={isDark ? '/images/SNA_WHITE.png' : '/images/SNA_DEEPBLUE.png'}
        alt="SNA Logo"
      />
      <Image
        src={isDark 
          ? '/images/marca_UPV_principal_blanco150.png' 
          : '/images/marca_UPV_principal_negro150.png'
        }
        alt="UPV Logo"
      />
      {/* Social icons también condicionales */}
      <Image
        src={isDark ? '/images/LinkedIN_white.svg' : '/images/LinkedIN_dark.svg'}
        alt="LinkedIn"
      />
      <Image
        src={isDark ? '/images/Instagram_white.svg' : '/images/Instagram_dark.svg'}
        alt="Instagram"
      />
    </footer>
  );
}
```

---

## Fase 7: Mejoras de Visualización y Geoawareness

### 7.1 Información Detallada de Geozonas (TASK-070, TASK-071)

**Problema:**
- El popup de información de geozonas no muestra todos los datos disponibles como en geozones_map.html
- Falta información de: Restriction Conditions, Limited Applicability, Authority Information, Schedule

**Archivos afectados:**
- `app/components/plan-generator/GeozoneInfoPopup.tsx`

**Solución:**
1. Añadir secciones desplegables:
   - General Information (Geozone name, Country, Region)
   - Restriction Conditions (Type, UAS classes, Max noise, Special ops, Photography)
   - Limited Applicability (Start/End datetime)
   - Authority Information (Name, Phone, Email, Website, Purpose)
   - Schedule (Days, Start/End time, Events)
2. Implementar UI colapsable con chevron icons y animaciones

---

### 7.2 Fix Waypoint Map Modal (TASK-072, TASK-073)

**Problema:**
- El modal "Click to view waypoints on map" no contiene el mapa correctamente
- El mapa se sale de los bordes del contenedor
- El mapa no se centra automáticamente en los waypoints

**Archivos afectados:**
- `app/components/MapModal.tsx`

**Solución:**
1. Ajustar width del contenedor para que el mapa quepa dentro
2. Calcular bounds de todos los waypoints con `L.latLngBounds()`
3. Usar `map.fitBounds()` para centrar el mapa en todos los waypoints

---

### 7.3 Fix Trajectory Viewer CSV Loading (TASK-074)

**Problema:**
- El visualizador hace GET /api/csvResult?id=1 en lugar del ID correcto
- El ID del csvResult no se está obteniendo del flightPlan correctamente

**Archivos afectados:**
- `app/components/flight-plans/TrajectoryMapViewer.tsx`

**Solución:**
1. Verificar que el prop `csvResultId` se pasa correctamente desde el componente padre
2. Usar el ID real del csvResult almacenado en `flightPlan.csvResult`

---

### 7.4 U-space Identifier Storage (TASK-075)

**Problema:**
- Al usar "Use Default Service Area", se guarda "uspace-default" en la base de datos
- Debería guardarse el identificador real del U-space (ej: "VLCUspace")

**Archivos afectados:**
- `app/components/PlanGenerator.tsx`
- `app/api/flightPlans/route.ts`

**Solución:**
1. Cuando `useDefaultArea === true`, usar "VLCUspace" como identificador
2. Actualizar la lógica de creación para guardar el ID real

---

### 7.5 Check Geoawareness con Timeline (TASK-076, TASK-077)

**Problema:**
- El botón "Check Geoawareness" debe mostrar la trayectoria sobre geozonas actualizadas
- El usuario necesita poder simular el tiempo de vuelo

**Archivos afectados:**
- `app/components/flight-plans/GeoawarenessViewer.tsx`

**Solución:**
1. Al pulsar "Check Geoawareness":
   - Obtener el `uspace_identifier` del plan desde la base de datos
   - Cargar geozonas actualizadas del servicio geoawareness
   - Mostrar la trayectoria del CSV sobre las geozonas
2. Añadir barra deslizable de tiempo:
   ```tsx
   <input type="range" min={0} max={trajectoryDuration} onChange={setSimulationTime} />
   ```
3. Mover punto indicador a lo largo de la trayectoria según el tiempo

---

### 7.6 U-Plan Processing y Vista de Volúmenes 4D (TASK-078 to TASK-081)

**Problema:**
- El U-Plan no se regenera automáticamente al cambiar datos del formulario
- El botón "View U-Plan Map" no funciona
- Los volúmenes 4D generados para el U-Plan no se visualizan

**Archivos afectados:**
- `app/components/PlanGenerator.tsx`
- `app/components/UplanViewModal.tsx`

**Solución:**
1. Detectar cambios en datos del formulario y regenerar U-Plan
2. "View U-Plan Map" abre el modal con waypoints + volúmenes 4D
3. Renderizar volúmenes como polígonos:
   ```tsx
   {volumes.map(vol => (
     <Polygon 
       positions={vol.polygon}
       onMouseOver={() => setHoveredVolume(vol)}
     />
   ))}
   ```
4. Tooltip con información del volumen: tiempo inicio/fin, altitud min/max

---

## Resumen de Archivos a Modificar/Crear

### Archivos a Modificar:
1. `app/components/FlightPlansUploader.tsx` - Tareas 1, 4, 6
2. `app/components/flight-plans/TrajectoryMapViewer.tsx` - Tarea 1
3. `app/components/UplanViewModal.tsx` - Tarea 2
4. `app/api/flightPlans/[id]/route.ts` - Tarea 3
5. `app/api/flightPlans/route.ts` - Tarea 3
6. `lib/uplan/tray_to_uplan.ts` - Tarea 5
7. `lib/uplan/generate_bbox.ts` - Tarea 5
8. `app/components/PlanGenerator.tsx` - Tarea 8
9. `app/components/PlanMap.tsx` - Tarea 8
10. `app/components/flight-plans/GeoawarenessViewer.tsx` - Tarea 8
11. `app/login/page.tsx` - Tarea 9
12. `app/components/footer.tsx` - Tarea 10

### Archivos a Crear:
1. `app/components/flight-plans/UplanFormModal.tsx` - Tarea 4
2. `app/components/flight-plans/UplanFormSections.tsx` - Tarea 4
3. `lib/validators/uplan-validator.ts` - Tarea 4
4. `lib/uplan/generate_oriented_volumes.ts` - Tarea 5
5. `lib/uplan/geodesy-utils.ts` - Tarea 5
6. `app/hooks/useUspaces.ts` - Tarea 8
7. `app/hooks/useGeoawarenessWebSocket.ts` - Tarea 8
8. `app/components/plan-generator/UspaceSelector.tsx` - Tarea 8
9. `app/components/plan-generator/GeozoneLayer.tsx` - Tarea 8
10. `app/components/plan-generator/GeozoneInfoPopup.tsx` - Tarea 8

---

## Dependencias a Instalar

```bash
npm install zod                    # Validación de esquemas
# WebSocket nativo, no requiere dependencia adicional
```

---

## Orden de Implementación Recomendado

1. **Fase 1** (Crítico): Correcciones de bugs existentes
   - Tarea 1: View Trajectory
   - Tarea 2: Map overflow
   - Tarea 3: Cascade delete

2. **Fase 2** (Core): U-Plan form
   - Tarea 4: UplanFormModal con validación

3. **Fase 3** (Backend): Generación de volúmenes
   - Tarea 5: Migrar lógica C++ a TypeScript

4. **Fase 4** (Integración): FAS flow
   - Tarea 6: Estados de autorización
   - Tarea 7: FAS response viewer

5. **Fase 5** (Mayor): Geoawareness WebSocket
   - Tarea 8: Nueva arquitectura completa

6. **Fase 6** (Polish): UI/Theme
   - Tarea 9: Login theme
   - Tarea 10: Footer logos

---

## Criterios de Aceptación

Cada tarea debe:
1. Pasar `just preflight` sin errores
2. Funcionar correctamente en desarrollo
3. Tener commit con mensaje convencional descriptivo
4. Actualizar PROGRESS.md con el estado completado
