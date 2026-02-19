@echo off
if not exist "D:\SPIRIT\LOGS" mkdir "D:\SPIRIT\LOGS"

cd /d "C:\Caddy"

echo. >> "D:\SPIRIT\LOGS\UPPS_CADDY.log"
echo --- INICIO DE SERVICIO CADDY / REINICIO [%DATE% %TIME%] --- >> "D:\SPIRIT\LOGS\UPPS_CADDY.log"

caddy run 2>&1 | powershell -Command "$Input | ForEach-Object { \"[{0:yyyy-MM-dd HH:mm:ss}] {1}\" -f (Get-Date), $_ }" >> "D:\SPIRIT\LOGS\UPPS_CADDY.log"