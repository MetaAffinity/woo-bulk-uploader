@echo off
echo Starting WooCommerce Bulk Uploader...
echo.

REM Start backend
start "Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait a moment then start frontend
timeout /t 3 /nobreak >nul
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

REM Wait for frontend to start then open browser
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo App is running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo.
echo Close this window anytime. The two CMD windows keep the app running.
