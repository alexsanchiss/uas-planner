@echo off
setlocal enabledelayedexpansion

:: Configuración
set "VHDX_PATH=C:\Users\ASANMAR4\AppData\Local\Docker\wsl\disk\docker_data.vhdx"

:: Verificar privilegios
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo [1/3] 🔻 Apagando WSL...
wsl --terminate docker-desktop
echo.
echo Unregister docker-desktop
wsl --unregister docker-desktop
echo.
echo [2/3] 💾 Compactando disco virtual...
(
    echo select vdisk file="%VHDX_PATH%"
    echo compact vdisk
) > diskpart_script.txt

echo Ejecutando diskpart...
diskpart /s diskpart_script.txt

:: Comprobar si falló por bloqueo
findstr /C:"requiere que el disco virtual esté conectado como de solo lectura" diskpart_script.txt >nul
if %errorlevel%==0 (
    echo.
    echo ❌ El disco está bloqueado. Docker Desktop probablemente está corriendo.
    echo 🔁 Reinicia tu equipo y vuelve a ejecutar este script.
    del diskpart_script.txt
    pause
    exit /b
)

del diskpart_script.txt

echo.
echo [3/3] ✅ Disco compactado (si no hubo errores arriba).
pause
endlocal