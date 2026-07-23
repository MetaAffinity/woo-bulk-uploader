@echo off
echo ========================================
echo   WooCommerce Bulk Uploader - SETUP
echo ========================================
echo.

echo [1/2] Installing Python packages...
cd /d "%~dp0backend"
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo [2/2] Installing frontend packages...
cd /d "%~dp0frontend"
npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo.
echo   [OK] Python packages installed successfully
echo   [OK] Frontend packages installed successfully
echo   [OK] All done - App is ready to use!
echo.
echo   To start the app, double-click: start.bat
echo.
echo ------------------------------------------------------------
echo   WooCommerce Bulk Uploader
echo   Developed by: Muhammad Imran
echo   Website: metaaffinity.net
echo ------------------------------------------------------------
echo.
pause
