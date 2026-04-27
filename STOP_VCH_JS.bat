@echo off
TITLE Stop VCH Dashboard
echo =======================================
echo   Stopping VCH Dashboard Services...
echo =======================================

:: Kill Node.js (Next.js)
echo [1/2] Stopping Frontend (Node)...
taskkill /F /IM node.exe /T >nul 2>&1

:: Kill Python (FastAPI)
echo [2/2] Stopping Backend (Python)...
:: We try to kill the one running fastapi_server specifically
wmic process where "commandline like '%%fastapi_server%%'" delete >nul 2>&1

echo =======================================
echo   ALL SERVICES STOPPED.
echo =======================================
pause
