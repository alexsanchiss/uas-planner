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

## Componentes principales

### PlanGenerator.tsx
Permite crear planes de vuelo desde cero, definiendo waypoints, detalles del vuelo y características del UAS.

### FlightPlansUploader.tsx
Permite subir, organizar y procesar planes de vuelo, así como visualizar y descargar trayectorias procesadas.

### Navegación y páginas
- **/plan-generator**: Generador de planes de vuelo.
- **/trajectory-generator**: Procesador y visualizador de trayectorias.
- **/dataset-generator**: (Próximamente) Generador de datasets.
- **/how-it-works**: Explicación del funcionamiento.
- **/contact-us**: Formulario de contacto.

---

© 2024 U-PLAN PREPARATION SERVICE (UPPS) - SNA Lab, UPV. Todos los derechos reservados.