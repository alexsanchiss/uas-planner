@echo off
setlocal enabledelayedexpansion

:: -------- CONFIGURACIÓN --------
set "PROJECT_DIR_WIN=C:\Users\asanmar4\Desktop\traj-runner"
set "PROJECT_DIR_WSL=/mnt/c/Users/asanmar4/Desktop/traj-runner"
set "PLANNER_DIR=D:\SPIRIT\APPS\UPPS SERVICE"
set "NODE_SCRIPT=traj-assigner.js"
set "NODE_MACHINE_SCRIPT=machine-cleaner.js"
set "WSL_DISTRO=Ubuntu-24.04"

:: -------- VERIFICAR ADMINISTRADOR --------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: -------- FASE DE INICIALIZACIÓN --------
:initPhase
echo.
echo ---------- Apagando procesos Node (Windows) ----------
taskkill /F /IM node.exe >nul 2>&1

echo.
echo ---------- Limpiando base de datos de maquinas (Windows) ----------
if exist "%PLANNER_DIR%\%NODE_MACHINE_SCRIPT%" (
    cd /d "%PLANNER_DIR%"
    node %NODE_MACHINE_SCRIPT%
)

echo.
echo ---------- Purgando contenedores Docker ----------
wsl -d %WSL_DISTRO% bash -c "docker ps -a --format '{{.Names}}' | grep -v '^portainer$' | xargs -I {} docker stop {} 2>/dev/null"
wsl -d %WSL_DISTRO% bash -c "docker ps -a --format '{{.Names}}' | grep -v '^portainer$' | xargs -I {} docker rm -f {} 2>/dev/null"
wsl -d %WSL_DISTRO% bash -c "docker system prune -f --volumes"

echo.
echo ---------- Apagando distribucion WSL ----------
wsl --terminate %WSL_DISTRO%
timeout /t 5 /nobreak >nul

echo.
echo ---------- Compactando disco virtual (VHDX) ----------
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-ChildItem -Path '%LOCALAPPDATA%\Packages' -Filter 'ext4.vhdx' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'Ubuntu' }).FullName | Select-Object -First 1"') do set "UBUNTU_VHDX=%%i"

if defined UBUNTU_VHDX (
    echo select vdisk file="!UBUNTU_VHDX!" > diskpart_script.txt
    echo compact vdisk >> diskpart_script.txt
    diskpart /s diskpart_script.txt >nul 2>&1
    del diskpart_script.txt
) else (
    echo Disco virtual no encontrado. Omitiendo compactacion.
)

echo.
echo ---------- Iniciando motor Docker (WSL) ----------
wsl -d %WSL_DISTRO% -u root service docker start

:: Mantener WSL encendido
start "WSL_KeepAlive" /MIN wsl -d %WSL_DISTRO% bash -c "sleep infinity"

echo Esperando a que el motor responda...
:waitDockerWsl
wsl -d %WSL_DISTRO% bash -c "docker info >/dev/null 2>&1"
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto waitDockerWsl
)
echo Docker operativo.

echo.
echo ---------- Verificando Portainer ----------
wsl -d %WSL_DISTRO% bash -c "docker start portainer >/dev/null 2>&1"
if %errorlevel% neq 0 (
    echo Instalando contenedor Portainer...
    wsl -d %WSL_DISTRO% bash -c "docker run -d -p 9000:9000 --name=portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest"
)

echo.
echo ---------- Levantando Docker Compose ----------
wsl -d %WSL_DISTRO% bash -c "cd '%PROJECT_DIR_WSL%' && docker compose up -d"

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
    set "freememMB=%%m"
)

echo [%date% %time%] Espacio libre actual: !freespaceGB! GB
echo [%date% %time%] Memoria libre actual: !freememMB! GB

:: Guardar en log
echo [%date% %time%] Espacio libre actual: !freespaceGB! GB >> "%~dp0ultimatum.log"
echo [%date% %time%] Memoria libre actual: !freememMB! GB >> "%~dp0ultimatum.log"

:: Comprobar disco (< 200 GB libres)
powershell -NoLogo -NoProfile -Command "if ((Get-PSDrive C).Free / 1GB -lt 200) { exit 1 } else { exit 0 }"
set ps_exit=%errorlevel%

:: Comprobar RAM (< 2 GB libres)
powershell -NoLogo -NoProfile -Command "if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB -lt 2000) { exit 1 } else { exit 0 }"
set mem_exit=%errorlevel%

if !ps_exit! equ 1 (
    echo -------------------------------
    echo ALERTA: Espacio libre menor a 200 GB
    echo -------------------------------
    goto cleanup
)

if !mem_exit! equ 1 (
    echo -------------------------------
    echo ALERTA: Memoria libre menor a 2000 MB
    echo -------------------------------
    goto cleanup
)

echo OK, esperando 5 min
timeout /t 300 /nobreak >nul
goto monitorLoop

:: -------- LIMPIEZA Y REINICIO --------
:cleanup
echo Iniciando protocolo de emergencia...
goto initPhase