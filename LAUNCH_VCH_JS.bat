@echo off
TITLE VCH Unified Dashboard
echo =======================================
echo   VCH Dashboard - Unified Launcher
echo =======================================

cd /d "%~dp0vch-next-frontend"

echo [1/2] Building Optimized Dashboard...
echo (Ensuring all new UI changes are reflected)
call npm run build

echo [2/2] Starting Services in Background...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8001
echo Network:  Check your IP address (e.g., http://192.168.x.x:3000)

:: Automatically open browser
start "" "http://localhost:3000/"

:: Run services and save logs to a file
npm run prod > ..\dashboard_logs.txt 2>&1
