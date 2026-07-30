@echo off
echo =========================================
echo    Account Manager Web Service Startup
echo =========================================
echo.
echo [1] Start local DEV server
echo [2] Build and Start PROD server
echo.
set /p choice="Please select mode (1 or 2): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod

echo Invalid input, exiting...
exit /b 1

:dev
echo Starting development server...
npm run dev
goto end

:prod
if "%INITIAL_ADMIN_USERNAME%"=="" (
    echo Production startup requires INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD.
    exit /b 1
)
if "%INITIAL_ADMIN_PASSWORD%"=="" (
    echo Production startup requires INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD.
    exit /b 1
)
if /I not "%AUTH_COOKIE_SECURE%"=="false" (
    echo LAN HTTP deployment requires AUTH_COOKIE_SECURE=false.
    exit /b 1
)
echo Building project...
call npm run build
if errorlevel 1 (
    echo Build failed. Production server was not started.
    exit /b 1
)
echo Build complete, starting production server...
echo LAN address: http://Server-LAN-IP:3000
call npm start
exit /b %errorlevel%

:end
