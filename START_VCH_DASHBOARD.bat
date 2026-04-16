@echo off
TITLE VCH Dashboard - Automated Startup
echo =======================================
echo   VCH Dashboard Startup Sequence
echo =======================================

cd /d "d:\Hare Karthik\Dashboard\Streamlit\VCH_Streamlit_Project - ML Based"

echo [1/2] Starting FastAPI Backend on Port 8001...
start /min "VCH-Backend" cmd /k "python -m uvicorn fastapi_server:app --host 0.0.0.0 --port 8001 --reload"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Next.js Frontend on Port 3000...
cd vch-next-frontend
start /min "VCH-Frontend" cmd /k "npm run dev:network"

echo =======================================
echo   Dashboard is now starting up!
echo   Access on this PC: http://localhost:3000
echo   Access on Network: http://DESKTOP-L8TBN87:3000
echo =======================================
timeout /t 10
