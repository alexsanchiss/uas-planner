@echo off
:: NSSM service UPPS_TP: runs ONLY the trajectory assigner (traj-assigner.js).
:: The traj-runner containers and machine-cleaner are launched by hand with ultimatum_v2.bat.
:: This service never kills node and never touches Docker.
if not exist "D:\SPIRIT\LOGS" mkdir "D:\SPIRIT\LOGS"

cd /d "D:\SPIRIT\APPS\UPPS SERVICE"

:: >> appends; the separator line marks service starts / restarts in the log
echo. >> "D:\SPIRIT\LOGS\UPPS_TP.log"
echo --- INICIO DE SERVICIO / REINICIO [%DATE% %TIME%] --- >> "D:\SPIRIT\LOGS\UPPS_TP.log"

call node traj-assigner.js 2>&1 | powershell -Command "$Input | ForEach-Object { \"[{0:yyyy-MM-dd HH:mm:ss}] {1}\" -f (Get-Date), $_ }" >> "D:\SPIRIT\LOGS\UPPS_TP.log"
