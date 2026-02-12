@echo off
setlocal enabledelayedexpansion

:: -------- CONFIGURACIÓN --------
set "VHDX_PATH=C:\Users\ASANMAR4\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
set "DOCKER_PATH=C:\Program Files\Docker\Docker\Docker Desktop.exe"
set "PROJECT_DIR=D:\SPIRIT\APPS\UPPS SERVICE\Traj-runner"
set "PLANNER_DIR=D:\SPIRIT\APPS\UPPS SERVICE"
set "NODE_SCRIPT=traj-assigner.js"
set "NODE_MACHINE_SCRIPT=machine-cleaner.js"
set "LOG_FILE=D:\SPIRIT\LOGS\UPPS_TP.log"

:: Crear carpeta de logs si no existe
if not exist "D:\SPIRIT\LOGS" mkdir "D:\SPIRIT\LOGS"

echo [%date% %time%] --- INICIANDO SCRIPT DE MANTENIMIENTO UPPS_TP --- >> "%LOG_FILE%"

:: -------- FASE DE INICIALIZACIÓN --------
:initPhase
echo [%date% %time%] Iniciando fase de inicialización y compactación... >> "%LOG_FILE%"

:: 1. Limpiar contenedores
for /f "tokens=*" %%c in ('docker ps -aq') do docker rm -f %%c >> "%LOG_FILE%" 2>&1

:: 2. Limpiar DB (proceso síncrono, no hace falta killear)
cd /d "%PLANNER_DIR%"
node "%NODE_MACHINE_SCRIPT%" >> "%LOG_FILE%" 2>&1

:: 3. Killear SOLO el traj-assigner si ya estaba corriendo (usando el título de ventana)
taskkill /FI "WINDOWTITLE eq TRAJ_ASSIGNER_PROC*" /F /T >nul 2>&1

:: 4. Reset Docker/WSL
wsl --terminate docker-desktop >> "%LOG_FILE%" 2>&1
taskkill /F /IM "Docker Desktop.exe" /FI "STATUS eq RUNNING" >nul 2>&1
timeout /t 5 /nobreak >nul

:: 5. Compactar VHDX
echo select vdisk file="%VHDX_PATH%" > diskpart_script.txt
echo compact vdisk >> diskpart_script.txt
diskpart /s diskpart_script.txt >> "%LOG_FILE%" 2>&1
del diskpart_script.txt

:: 6. Levantar Docker y esperar
start "" "%DOCKER_PATH%"
:waitDocker
docker info >nul 2>&1
if errorlevel 1 (
    timeout /t 10 /nobreak >nul
    goto waitDocker
)

:: 7. Levantar Compose
cd /d "%PROJECT_DIR%"
docker compose up -d >> "%LOG_FILE%" 2>&1

:: 8. Ejecutar Node con un TÍTULO ÚNICO para identificarlo después
cd /d "%PLANNER_DIR%"
start "TRAJ_ASSIGNER_PROC" node "%NODE_SCRIPT%"
echo [%date% %time%] Proceso %NODE_SCRIPT% lanzado con exito. >> "%LOG_FILE%"

goto monitorLoop

:: -------- BUCLE DE MONITORIZACIÓN --------
:monitorLoop
:: (Mantenemos tu lógica de PowerShell para disco y RAM)
for /f %%f in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-PSDrive C).Free / 1GB)"') do set "freespaceGB=%%f"
for /f %%m in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB)"') do set "freememGB=%%m"

echo [%date% %time%] DISCO: !freespaceGB!GB | RAM: !freememGB!MB >> "%LOG_FILE%"

:: Comprobaciones (Umbrales)
if !freespaceGB! LSS 200 goto cleanup
if !freememGB! LSS 2048 goto cleanup

timeout /t 300 /nobreak >nul
goto monitorLoop

:cleanup
echo [%date% %time%] ⚠️ UMBRAL ALCANZADO. Reiniciando servicios... >> "%LOG_FILE%"
:: Matamos solo nuestro proceso por su título
taskkill /FI "WINDOWTITLE eq TRAJ_ASSIGNER_PROC*" /F /T >nul 2>&1
goto initPhase