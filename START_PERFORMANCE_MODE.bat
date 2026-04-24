@echo off
TITLE VCH Dashboard - PERFORMANCE MODE
echo =======================================
echo   VCH Dashboard - High Speed Mode
echo   (Optimized for Office WiFi)
echo =======================================

cd /d "d:\Hare Karthik\Dashboard\Streamlit\VCH_Streamlit_Project - ML Based"

echo [1/2] Building Optimized Frontend (One-time setup)...
echo This may take a minute but makes the dashboard 100x faster.
cd vch-next-frontend
call npm run build

echo [2/2] Starting Production Servers...

:: Start Backend (Production mode - no reload for max speed)
start /min "VCH-Backend-Prod" cmd /k "cd .. && python -m uvicorn fastapi_server:app --host 0.0.0.0 --port 8001"

:: Start Frontend (Production mode - optimized static serving)
start /min "VCH-Frontend-Prod" cmd /k "npm run start -- -H 0.0.0.0"

echo =======================================
echo   DASHBOARD RUNNING IN PERFORMANCE MODE!
echo   Access on this PC: http://localhost:3000
echo   Access on Network: http://DESKTOP-L8TBN87:3000
echo =======================================
pause
