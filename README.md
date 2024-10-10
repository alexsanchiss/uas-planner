# UAS - PLANNER

## Descripción

Esta aplicación es una interfaz de usuario para operadores de drones, diseñada para procesar planes de vuelo basados en waypoints. Los usuarios pueden cargar sus planes de vuelo desde QGroundControl y recibir trayectorias realistas y completas. Aunque actualmente la funcionalidad se centra en el procesamiento de planes de vuelo, el objetivo final es crear una aplicación completa que permita:

- Generar planes de vuelo.
- Procesar trayectorias.
- Enviar planes a las autoridades para la aprobación.

Las trayectorias se procesarán en varias máquinas virtuales, cada una ejecutando el script [traj-runner](https://github.com/0xMastxr/traj-runner), que se encarga de recibir y procesar las trayectorias en orden.

## Instalación

1. Clona este repositorio:
   ```bash
   git clone git@github.com:0xMastxr/uas-planner.git
   cd uas-planner

2. Instala las dependencias:
    ```bash
    npm install

3. Crea un archivo .env en la raíz del proyecto y define las direcciones de las máquinas virtuales, asegurándote de que los puertos están configurados correctamente. Ejemplo:
    ```env
    VM01_ADDRESS=http://192.168.1.10:4000
    VM02_ADDRESS=http://192.168.1.11:4000
    VM03_ADDRESS=http://192.168.1.12:4000

## Uso

Para ejecutar la aplicación, utiliza el siguiente comando:
    ```bash
    npm run dev
    ```
Luego, abre tu navegador y dirígete a http://localhost:3000.

## Componentes

### FlightUploader.tsx
Este es el componente principal que permite a los usuarios subir planes de vuelo, asignar nombres personalizados y procesar las trayectorias. El estado de cada plan se muestra en función de su proceso actual: sin procesar, en cola, procesado, o error. Los resultados se pueden descargar como archivos CSV una vez procesados.

### API
La API se encuentra en pages/api/traj-assigner.ts. Esta maneja las solicitudes de procesamiento de los planes de vuelo. Cuando se recibe un POST, se agrega el plan a una cola y se procesa en una máquina virtual disponible. Se maneja la posibilidad de errores y se notifica el resultado al usuario.
