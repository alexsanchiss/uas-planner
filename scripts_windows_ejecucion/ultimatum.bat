@echo off
setlocal enabledelayedexpansion

:: -------- CONFIGURACIÓN --------
set "VHDX_PATH=C:\Users\ASANMAR4\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
set "DOCKER_PATH=C:\Program Files\Docker\Docker\Docker Desktop.exe"
set "PROJECT_DIR=C:\Users\asanmar4\Desktop\traj-runner"
set "PLANNER_DIR=C:\Users\asanmar4\Desktop\uas-planner"
set "NODE_SCRIPT=traj-assigner.js"
set "NODE_MACHINE_SCRIPT=machine-cleaner.js"

:: -------- VERIFICAR ADMINISTRADOR --------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: -------- FASE DE INICIALIZACIÓN --------
:initPhase
echo .
echo ---------- Eliminando todos los contenedores ----------
for /f %%c in ('docker ps -aq') do docker rm -f %%c

echo.
echo ---------- Limpiando la base de datos de máquinas ----------
cd /d "%PLANNER_DIR%"
node %NODE_MACHINE_SCRIPT%

echo.
echo ---------- Apagando Node ----------
taskkill /F /IM node.exe >nul 2>&1

echo.
echo ---------- Apagando WSL ----------
wsl --terminate docker-desktop
	
echo.
echo ---------- Cerrando Docker Desktop ----------

taskkill /F /IM "Docker Desktop.exe" >nul 2>&1
powershell -NoLogo -NoProfile -Command "Get-Process -Name 'com.docker.backend','com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 5 /nobreak >nul

echo.
echo ---------- Eliminando distro docker-desktop ----------
wsl --unregister docker-desktop

echo.
echo ---------- Compactando disco virtual (.vhdx) ----------
echo select vdisk file="%VHDX_PATH%" > diskpart_script.txt
echo compact vdisk >> diskpart_script.txt
diskpart /s diskpart_script.txt
del diskpart_script.txt

echo.
echo ---------- Reiniciando Docker Desktop ----------
tasklist /FI "IMAGENAME eq Docker Desktop.exe" | find /I "Docker Desktop.exe" >nul
powershell -NoLogo -NoProfile -Command "Get-Process -Name 'com.docker.backend','com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
if %errorlevel% neq 0 (
    start "" "%DOCKER_PATH%"
    timeout /t 15 /nobreak >nul
)

echo.
echo ---------- Esperando a que Docker esté listo ----------
:waitDocker
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker no está listo, reintentando...
    tasklist /FI "IMAGENAME eq Docker Desktop.exe" | find /I "Docker Desktop.exe" >nul
	powershell -NoLogo -NoProfile -Command "Get-Process -Name 'com.docker.backend','com.docker.build' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
    if %errorlevel% neq 0 (
        echo Docker Desktop no se está ejecutando, volviendo a lanzarlo...
        start "" "%DOCKER_PATH%"
    )
    timeout /t 15 /nobreak >nul
    goto waitDocker
)
	
echo.
echo ---------- Ejecutando docker compose ----------
cd /d "%PROJECT_DIR%"
docker compose up -d

echo.
echo ---------- Ejecutando node %NODE_SCRIPT% ----------
cd /d "%PLANNER_DIR%"
start "" node %NODE_SCRIPT%

goto monitorLoop


:: -------- BUCLE DE MONITORIZACIÓN --------
:monitorLoop
echo.
echo -------------------------------
echo Monitorizando espacio en disco C y RAM disponible:
echo -------------------------------

:: Espacio libre en disco (GB)
for /f %%f in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-PSDrive C).Free / 1GB)"') do (
    set "freespaceGB=%%f"
)

:: RAM libre en GB
for /f %%m in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB)"') do (
    set "freememGB=%%m"
)

echo [%date% %time%] Espacio libre actual: !freespaceGB! GB
echo [%date% %time%] Memoria libre actual: !freememGB! GB

:: Guardar en log
echo [%date% %time%] Espacio libre actual: !freespaceGB! GB >> "%~dp0ultimatum.log"
echo [%date% %time%] Memoria libre actual: !freememGB! GB >> "%~dp0ultimatum.log"

:: Comprobar disco
powershell -NoLogo -NoProfile -Command "if ((Get-PSDrive C).Free / 1GB -lt 200) { exit 1 } else { exit 0 }"
set ps_exit=%errorlevel%

:: Comprobar RAM (< 2 GB libres)
powershell -NoLogo -NoProfile -Command "if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB -lt 2) { exit 1 } else { exit 0 }"
set mem_exit=%errorlevel%

if !ps_exit! equ 1 (
    echo -------------------------------
    echo ⚠️ Espacio libre menor a 200 GB
    echo -------------------------------
    goto cleanup
)

if !mem_exit! equ 1 (
    echo -------------------------------
    echo ⚠️ Memoria libre menor a 2 GB
    echo -------------------------------
    goto cleanup
)

echo OK, esperando 5 min
timeout /t 300 /nobreak >nul
goto monitorLoop

:: -------- LIMPIEZA Y REINICIO --------
:cleanup
echo Finalizando Node...
taskkill /F /IM node.exe >nul 2>&1

echo Limpiando la base de datos de máquinas...
cd /d "%PLANNER_DIR%"
node %NODE_MACHINE_SCRIPT%

echo Esperando 5 minutos para que Docker termine su trabajo...
timeout /t 300 /nobreak >nul

echo Eliminando todos los contenedores...
for /f %%c in ('docker ps -aq') do docker rm -f %%c

goto initPhase
