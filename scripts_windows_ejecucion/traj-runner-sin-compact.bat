set "PROJECT_DIR=C:\Users\asanmar4\Desktop\traj-runner"
set "PLANNER_DIR=C:\Users\asanmar4\Desktop\uas-planner"

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
