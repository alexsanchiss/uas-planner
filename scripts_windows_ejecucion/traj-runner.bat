@echo off
setlocal enabledelayedexpansion

:: -------- CONFIGURACIÓN --------
set "VHDX_PATH=C:\Users\ASANMAR4\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
set "DOCKER_PATH=C:\Program Files\Docker\Docker\Docker Desktop.exe"
set "PROJECT_DIR=C:\Users\asanmar4\Desktop\traj-runner"
set "PLANNER_DIR=C:\Users\asanmar4\Desktop\uas-planner"

:: -------- VERIFICAR ADMINISTRADOR --------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ---------- Apagando WSL ----------
wsl --terminate docker-desktop

echo.
echo ---------- Verificando estado de WSL ----------
wsl --list --verbose
timeout /t 2 >nul

echo.
echo Unregister docker-desktop
wsl --unregister docker-desktop

echo.
echo ---------- Compactando disco virtual (.vhdx) ----------
echo select vdisk file="%VHDX_PATH%" > diskpart_script.txt
echo compact vdisk >> diskpart_script.txt
diskpart /s diskpart_script.txt
del diskpart_script.txt

echo.
echo ---------- Verificando si Docker Desktop está en ejecución ----------
tasklist /FI "IMAGENAME eq Docker Desktop.exe" | find /I "Docker Desktop.exe" >nul
if %errorlevel% neq 0 (
    echo Docker Desktop no está corriendo. Iniciando...
    start "" "%DOCKER_PATH%"
    timeout /t 10 >nul
)

echo.
echo ---------- Esperando a que Docker esté listo ----------
:waitDocker
docker info >nul 2>&1
if errorlevel 1 (
    timeout /t 2 >nul
    goto waitDocker
)

echo.
echo ---------- Ejecutando docker compose ----------
cd /d "%PROJECT_DIR%"
docker compose up -d

echo.
echo ---------- Ejecutando node traj-assigner.js ----------
cd /d "%PLANNER_DIR%"
node traj-assigner.js

echo.
echo ✅ Script completado correctamente.
pause
endlocal