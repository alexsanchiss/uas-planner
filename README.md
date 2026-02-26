# UAS - PLANNER

## Versión

**v1.2.0 - UI/UX Overhaul Release**

- Fecha de lanzamiento: Enero 2026
- Estado: Producción

## Descripción

Esta aplicación es una interfaz de usuario para operadores de drones, diseñada para procesar planes de vuelo basados en waypoints. Los usuarios pueden cargar sus planes de vuelo desde QGroundControl y recibir trayectorias realistas y completas. La aplicación permite:

- Generar planes de vuelo con waypoints personalizados
- Generar patrones SCAN automatizados para misiones de inspección
- Procesar trayectorias con simulación física realista
- Enviar planes a las autoridades (FAS) para aprobación
- Verificar cumplimiento de geoawareness

Las trayectorias se procesan en varias máquinas virtuales, cada una ejecutando el script [traj-runner](https://github.com/0xMastxr/traj-runner), que se encarga de recibir y procesar las trayectorias en orden.

## Funcionalidades incluidas en v1.2.0

- **Generador de Planes de Vuelo**: Crear planes de vuelo personalizados, definiendo waypoints, modos de vuelo (fly-by/fly-over), pausas, categorías, características del UAS y detalles del operador.
- **Generador de Patrones SCAN**: Genera automáticamente rutas de escaneo sobre un polígono definido con ángulo y espaciado configurables.
- **Procesador de Trayectorias**: Sube archivos de planes de vuelo (QGroundControl), procesa trayectorias y permite descargar los resultados en CSV.
- **Gestión de Carpetas y Planes**: Organización de planes en carpetas, filtrado y paginación.
- **Visualización de Trayectorias**: Muestra trayectorias en un mapa interactivo con playback y control de velocidad.
- **Geoawareness Integration**: Verificación de zonas de vuelo restringidas con visualización de infracciones.
- **Autorización FAS**: Envío automático de planes a la API de Flight Authorization Service.
- **Gestión de Estado de Procesamiento**: Visualización del estado de cada plan (sin procesar, en cola, procesando, procesado, error).
- **Autenticación de Usuarios**: Registro, inicio de sesión con JWT (access + refresh tokens) y gestión de sesión.
- **Sistema de Temas**: Soporte para modo claro y oscuro con persistencia en localStorage.
- **Notificaciones Toast**: Sistema de notificaciones elegante con auto-dismiss y acciones de retry.
- **Interfaz Responsiva**: Adaptación completa a móvil, tablet y desktop.

## 🏗️ Arquitectura

### **Stack Tecnológico**
- **Framework**: Next.js 14 con App Router
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + CSS Custom Properties (temas)
- **Base de Datos**: MySQL con Prisma ORM
- **Autenticación**: JWT (access tokens 15min, refresh tokens 7 días)
- **Validación**: Zod schemas
- **Testing**: Jest + ts-jest

### **Estructura del Proyecto**

```
uas-planner/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (App Router)
│   │   ├── auth/             # Authentication endpoints
│   │   │   ├── login/        # POST - User login
│   │   │   ├── logout/       # POST - Clear session
│   │   │   ├── refresh/      # POST - Refresh access token
│   │   │   └── signup/       # POST - User registration
│   │   ├── flightPlans/      # Flight plan CRUD
│   │   │   ├── route.ts      # GET, POST, PUT, DELETE (bulk support)
│   │   │   └── [id]/         # Individual plan operations
│   │   │       ├── route.ts  # GET, PUT, DELETE single plan
│   │   │       ├── reset/    # POST - Reset plan to initial state
│   │   │       └── uplan/    # POST - Generate and submit U-Plan
│   │   ├── folders/          # Folder management
│   │   ├── csvResult/        # Trajectory results
│   │   ├── fas/              # FAS callback endpoint
│   │   └── user/             # User profile
│   ├── components/           # React components
│   │   ├── auth/             # Auth-related components
│   │   ├── flight-plans/     # Flight plan UI components
│   │   ├── plan-definition/   # Plan Definition components
│   │   └── ui/               # Shared UI components
│   ├── hooks/                # Custom React hooks
│   ├── styles/               # CSS (themes.css)
│   └── [pages]/              # Route pages
├── lib/                      # Shared utilities
│   ├── auth.ts               # JWT authentication utilities
│   ├── auth-middleware.ts    # API route protection
│   ├── validators.ts         # Zod validation schemas
│   ├── scan-generator.ts     # SCAN pattern algorithm
│   ├── date-utils.ts         # Date/timezone helpers
│   ├── api-errors.ts         # Standardized error responses
│   ├── logger.ts             # Structured logging
│   └── prisma.ts             # PrismaClient singleton
├── prisma/                   # Database schema
└── types/                    # TypeScript type definitions
```

### **Sistema de Temas**

El sistema de temas utiliza CSS Custom Properties definidas en `app/styles/themes.css`:

```css
:root {
  /* Dark theme (default) */
  --bg-primary: #121212;
  --text-primary: #ffffff;
  --brand-primary: #3b82f6;
  /* ... */
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #111827;
  /* ... */
}
```

**Hooks y componentes:**
- `useTheme()` - Hook para acceder y cambiar el tema
- `<ThemeToggle />` - Botón de cambio de tema en el header

### **Arquitectura de Componentes**

```
FlightPlansUploader (Producción)
├── FolderList
│   └── FolderCard
│       └── FlightPlanList
│           └── FlightPlanCard
│               ├── StatusBadge
│               └── ActionButtons
├── ProcessingWorkflow
│   ├── DateTimePicker
│   └── ConfirmDialog
├── TrajectoryViewer
├── GeoawarenessViewer
└── AuthorizationPanel
```

### **API Routes (App Router)**

Todos los endpoints usan el nuevo App Router de Next.js en `app/api/`:

| Endpoint | Métodos | Descripción |
|----------|---------|-------------|
| `/api/auth/login` | POST | Autenticación de usuario |
| `/api/auth/signup` | POST | Registro de usuario |
| `/api/auth/refresh` | POST | Refrescar access token |
| `/api/auth/logout` | POST | Cerrar sesión |
| `/api/flightPlans` | GET, POST, PUT, DELETE | CRUD de planes (bulk support) |
| `/api/flightPlans/[id]` | GET, PUT, DELETE | Operaciones individuales |
| `/api/flightPlans/[id]/reset` | POST | Resetear plan |
| `/api/flightPlans/[id]/uplan` | POST | Generar y enviar U-Plan |
| `/api/folders` | GET, POST | Gestión de carpetas |
| `/api/folders/[id]` | GET, PUT, DELETE | Operaciones de carpeta |
| `/api/csvResult` | GET, POST, DELETE | Resultados de trayectorias |
| `/api/fas/[externalResponseNumber]` | PUT | Callback de FAS |

## 🚀 Funcionalidades de Rendimiento (v1.1.0)

### **Sistema de API Unificado**
- **Endpoint único** para todas las operaciones de flight plans (`/api/flightPlans`)
- **Operaciones bulk** para manejar miles de planes eficientemente
- **Limpieza automática** de CSV results al eliminar flight plans
- **Transacciones seguras** para mantener consistencia de datos

### **Optimizaciones para Grandes Volúmenes**
- **Subida masiva**: Hasta 2500+ planes sin errores de red
- **Procesamiento en lotes**: 500 planes por operación API
- **Descargas optimizadas**: Generación automática de múltiples archivos ZIP
- **Gestión de memoria**: Chunking automático para operaciones grandes

## Instalación

1. Clona este repositorio:
   ```bash
   git clone git@github.com:0xMastxr/uas-planner.git
   cd uas-planner
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno:
   ```bash
   cp .env.example .env.local
   # Edita .env.local con tus credenciales
   ```

4. Ejecuta las migraciones de base de datos:
   ```bash
   npx prisma migrate dev
   ```

## Uso

Para ejecutar la aplicación en modo desarrollo:
```bash
npm run dev
```

Para producción:
```bash
npm run build
npm run start
```

También debes ejecutar el manejador de solicitudes:
```bash
node traj-assigner
```

Luego, abre tu navegador y dirígete a http://localhost:3000.

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Generar reporte de cobertura
npm run test:coverage
```

### Tests disponibles:
- `lib/__tests__/auth.test.ts` - Utilidades de autenticación
- `lib/__tests__/validators.test.ts` - Schemas de validación Zod
- `lib/__tests__/scan-generator.test.ts` - Algoritmo de generación SCAN
- `lib/__tests__/date-utils.test.ts` - Utilidades de fecha/timezone

## Componentes principales

### PlanGenerator.tsx
Permite crear planes de vuelo desde cero, definiendo waypoints, detalles del vuelo y características del UAS. Incluye:
- Mapa interactivo Leaflet para colocación de waypoints
- Configuración fly-by/fly-over por waypoint
- Pausas configurables en cada waypoint
- Visualización de área de servicio con límites

### ScanPatternGenerator.tsx
Genera patrones de escaneo automáticos:
- Dibujo de polígono sobre el mapa
- Configuración de ángulo y espaciado
- Vista previa en tiempo real
- Estadísticas de vuelo estimadas

### FlightPlansUploader.tsx
Permite subir, organizar y procesar planes de vuelo:
- Gestión de carpetas con renombrado inline
- Workflow guiado de 5 pasos
- Polling automático de estados (5s)
- Visualización de trayectorias con playback

### Navegación y páginas
- **/plan-definition**: Generador de planes de vuelo
- **/plan-authorization**: Procesador y visualizador de trayectorias
- **/how-it-works**: Explicación del funcionamiento
- **/contact-us**: Formulario de contacto
- **/login**: Autenticación

## 📚 Documentación

- **`README.md`**: Este archivo - visión general del proyecto
- **`API_DOCUMENTATION.md`**: Documentación completa de la API
- **`CONTRIBUTING.md`**: Guía para contribuidores
- **`.env.example`**: Variables de entorno documentadas

## 🔧 Variables de Entorno

Ver `.env.example` para la lista completa de variables:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | ✅ | Conexión MySQL para Prisma |
| `JWT_SECRET` | ✅ | Secreto para tokens JWT |
| `FAS_API_URL` | ❌ | URL de la API de autorización |
| `NEXT_PUBLIC_PRODUCTION_MODE` | ❌ | Flag para modo producción |

---

© 2026 U-PLAN PREPARATION SERVICE (UPPS) - SNA Lab, UPV. Todos los derechos reservados.