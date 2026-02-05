@echo off
:: Aseguramos que la carpeta de logs exista para evitar errores de escritura
if not exist "D:\SPIRIT\LOGS" mkdir "D:\SPIRIT\LOGS"

cd /d "D:\SPIRIT\APPS\UPPS SERVICE"

:: Usamos >> para modo "append" (añadir al final)
:: Agregamos una línea de separación para identificar reinicios en el log
echo. >> "D:\SPIRIT\LOGS\UPPS.log"
echo --- INICIO DE SERVICIO / REINICIO [%DATE% %TIME%] --- >> "D:\SPIRIT\LOGS\UPPS.log"

call npm start 2>&1 | powershell -Command "$Input | ForEach-Object { \"[{0:yyyy-MM-dd HH:mm:ss}] {1}\" -f (Get-Date), $_ }" >> "D:\SPIRIT\LOGS\UPPS.log"