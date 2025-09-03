# UAS - PLANNER

## Versión

**v1.0.0 - Primera versión de producción**

- Fecha de lanzamiento: Junio 2024
- Estado: DEMO funcional

## Descripción

Esta aplicación es una interfaz de usuario para operadores de drones, diseñada para procesar planes de vuelo basados en waypoints. Los usuarios pueden cargar sus planes de vuelo desde QGroundControl y recibir trayectorias realistas y completas. Aunque actualmente la funcionalidad se centra en el procesamiento de planes de vuelo, el objetivo final es crear una aplicación completa que permita:

- Generar planes de vuelo.
- Procesar trayectorias.
- Enviar planes a las autoridades para la aprobación.

Las trayectorias se procesan en varias máquinas virtuales, cada una ejecutando el script [traj-runner](https://github.com/0xMastxr/traj-runner), que se encarga de recibir y procesar las trayectorias en orden.

## Funcionalidades incluidas en v1.0.0

- **Generador de Planes de Vuelo**: Permite crear planes de vuelo personalizados, definiendo waypoints, modos de vuelo, categorías, características del UAS y detalles del operador.
- **Procesador de Trayectorias**: Sube archivos de planes de vuelo (QGroundControl), procesa trayectorias y permite descargar los resultados en CSV.
- **Gestión de Carpetas y Planes**: Organización de planes en carpetas, filtrado y paginación.
- **Visualización de Trayectorias**: Muestra trayectorias en un mapa interactivo.
- **Gestión de Estado de Procesamiento**: Visualización del estado de cada plan (sin procesar, en cola, procesando, procesado, error).
- **Autenticación de Usuarios**: Registro, inicio de sesión y gestión de sesión.
- **Interfaz moderna y responsiva**: Navegación entre aplicaciones (Plan Generator, Trajectory Generator, Dataset Generator*), menú de información y contacto.
- **Soporte multiusuario**: Cada usuario gestiona sus propios planes y carpetas.

> *Nota: El generador de datasets está en desarrollo y aparecerá como próximamente.*

## 🚀 Nuevas Funcionalidades de Rendimiento (v1.1.0)

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

### **Beneficios del Nuevo Sistema**
- **Rendimiento**: 10x más rápido para operaciones masivas
- **Escalabilidad**: Maneja datasets de cualquier tamaño
- **Mantenibilidad**: Código unificado y consistente
- **Compatibilidad**: Funciona con código existente sin cambios

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
   cp .env.example .env
   # Edita .env con tus credenciales de base de datos
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

## 🧪 Testing del Sistema Unificado

Para verificar que la nueva funcionalidad funciona correctamente:

```bash
# Test de eliminación con limpieza de CSV
node test-deletion.js --create-data  # Crear datos de prueba
node test-deletion.js                # Ejecutar tests de eliminación
```

## Componentes principales

### PlanGenerator.tsx
Permite crear planes de vuelo desde cero, definiendo waypoints, detalles del vuelo y características del UAS.

### FlightPlansUploader.tsx
Permite subir, organizar y procesar planes de vuelo, así como visualizar y descargar trayectorias procesadas. **Ahora optimizado para grandes volúmenes** con operaciones bulk y manejo automático de CSV.

### Navegación y páginas
- **/plan-generator**: Generador de planes de vuelo.
- **/trajectory-generator**: Procesador y visualizador de trayectorias.
- **/dataset-generator**: (Próximamente) Generador de datasets.
- **/how-it-works**: Explicación del funcionamiento.
- **/contact-us**: Formulario de contacto.

## 📚 Documentación Técnica

Para desarrolladores que quieran entender el nuevo sistema de API:

- **`API_DOCUMENTATION.md`**: Documentación completa del sistema unificado
- **Comentarios inline**: Explicaciones detalladas en todos los archivos de API
- **Ejemplos de uso**: Código de ejemplo para todas las operaciones

## 🔧 Arquitectura del Sistema

### **Base de Datos**
- **flightPlan**: Planes de vuelo con estados y metadatos
- **csvResult**: Resultados de procesamiento de trayectorias
- **Relación**: csvResult.id y flightPlan.id comparten los mismos valores
- **Integridad**: Eliminación automática de CSV al eliminar flight plans (mismo ID)

### **API Endpoints**
- **`/api/flightPlans`**: CRUD unificado para flight plans
- **`/api/csvResult`**: Operaciones unificadas para CSV results
- **`/api/flightPlans/[id]/uplan`**: Generación de U-Plans (lógica especializada)

### **Frontend**
- **React + TypeScript**: Interfaz moderna y tipada
- **Operaciones Bulk**: Manejo eficiente de grandes datasets
- **Gestión de Estado**: Control de progreso para operaciones largas

---

© 2025 U-PLAN PREPARATION SERVICE (UPPS) - SNA Lab, UPV. Todos los derechos reservados.