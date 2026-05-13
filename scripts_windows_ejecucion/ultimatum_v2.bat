@echo off
setlocal enabledelayedexpansion

:: -------- CONFIGURACIÓN --------
set "PROJECT_DIR_WIN=C:\Users\asanmar4\Desktop\traj-runner"
set "PROJECT_DIR_WSL=/mnt/c/Users/asanmar4/Desktop/traj-runner"
set "PLANNER_DIR=D:\SPIRIT\APPS\UPPS SERVICE"
set "NODE_SCRIPT=traj-assigner.js"
set "NODE_MACHINE_SCRIPT=machine-cleaner.js"
set "WSL_DISTRO=Ubuntu-24.04"
:: Ruta del disco virtual para compactación
set "WSL_VHDX_PATH=C:\Users\ASANMAR4\AppData\Local\wsl\{4265a47d-e2e5-4006-8ee5-ab7d6e6c1177}\ext4.vhdx"

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
wsl -d %WSL_DISTRO% -u root bash -c "docker ps -a --format '{{.Names}}' | grep -v '^portainer$' | xargs -r docker stop 2>/dev/null"
wsl -d %WSL_DISTRO% -u root bash -c "docker ps -a --format '{{.Names}}' | grep -v '^portainer$' | xargs -r docker rm -f 2>/dev/null"
wsl -d %WSL_DISTRO% -u root bash -c "docker system prune -f --volumes"

echo.
echo ---------- Liberando bloques del sistema de archivos ----------
wsl -d %WSL_DISTRO% -u root fstrim -av

echo.
echo ---------- Reiniciando y apagando WSL ----------
:: Se requiere shutdown total para liberar el bloqueo del archivo .vhdx
wsl --shutdown
timeout /t 5 /nobreak >nul

echo.
echo ---------- Compactando disco virtual (VHDX) ----------
set "DP_SCRIPT=%TEMP%\wsl_compact.txt"
echo select vdisk file="%WSL_VHDX_PATH%" > "!DP_SCRIPT!"
echo attach vdisk readonly >> "!DP_SCRIPT!"
echo compact vdisk >> "!DP_SCRIPT!"
echo detach vdisk >> "!DP_SCRIPT!"

echo Ejecutando Diskpart (esto tardara varios minutos, espere por favor)...
diskpart /s "!DP_SCRIPT!" >nul
del "!DP_SCRIPT!"
echo Compactacion finalizada con exito.

echo.
echo ---------- Iniciando motor Docker (WSL) ----------
:: 1. Provocar el arranque de la máquina virtual con el usuario estándar
wsl -d %WSL_DISTRO% bash -c "exit"

:: 2. Esperar a que la inicialización de systemd finalice
timeout /t 5 /nobreak >nul

:: 3. Iniciar el demonio de Docker mediante systemctl
wsl -d %WSL_DISTRO% -u root bash -c "systemctl start docker"

:: Mantener WSL encendido en segundo plano
start "WSL_KeepAlive" /MIN wsl -d %WSL_DISTRO% -u root bash -c "sleep infinity"

echo Esperando a que el motor responda...
:waitDockerWsl
wsl -d %WSL_DISTRO% -u root bash -c "docker info >/dev/null 2>&1"
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto waitDockerWsl
)
echo Docker operativo.

echo.
echo ---------- Verificando Portainer ----------
wsl -d %WSL_DISTRO% -u root bash -c "docker start portainer >/dev/null 2>&1"
if %errorlevel% neq 0 (
    echo Instalando contenedor Portainer...
    wsl -d %WSL_DISTRO% -u root bash -c "docker run -d -p 9000:9000 --name=portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest"
)

echo.
echo ---------- Levantando Docker Compose ----------
wsl -d %WSL_DISTRO% -u root bash -c "cd '%PROJECT_DIR_WSL%' && docker compose up -d"

echo.
echo ---------- Ejecutando Node ----------
cd /d "%PLANNER_DIR%"
start "" node %NODE_SCRIPT%

goto monitorLoop

:: -------- BUCLE DE MONITORIZACIÓN --------
:monitorLoop
echo.
echo -------------------------------
echo Monitorizando espacio en disco C y RAM disponible:
echo -------------------------------

for /f %%f in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-PSDrive C).Free / 1GB)"') do set "freespaceGB=%%f"
for /f %%m in ('powershell -NoLogo -NoProfile -Command "[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)"') do set "freememMB=%%m"

echo [%date% %time%] Espacio libre actual: !freespaceGB! GB
echo [%date% %time%] Memoria libre actual: !freememMB! MB

echo [%date% %time%] Espacio libre actual: !freespaceGB! GB >> "%~dp0ultimatum.log"
echo [%date% %time%] Memoria libre actual: !freememMB! MB >> "%~dp0ultimatum.log"

powershell -NoLogo -NoProfile -Command "if ((Get-PSDrive C).Free / 1GB -lt 50) { exit 1 } else { exit 0 }"
set ps_exit=%errorlevel%

powershell -NoLogo -NoProfile -Command "if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024 -lt 10000) { exit 1 } else { exit 0 }"
set mem_exit=%errorlevel%

if !ps_exit! equ 1 (
    echo ALERTA: Espacio libre menor a 50 GB
    goto cleanup
)

if !mem_exit! equ 1 (
    echo ALERTA: Memoria libre menor a 10000 MB
    goto cleanup
)

echo OK, esperando 5 min
timeout /t 300 /nobreak >nul
goto monitorLoop

:: -------- LIMPIEZA Y REINICIO --------
:cleanup
echo Iniciando protocolo de emergencia...
goto initPhase