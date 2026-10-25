@echo off
echo ========================================================
echo   BillFlow - Build Windows Desktop Software (Win 10/11)
echo ========================================================
node "%~dp0build_desktop.js"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Desktop software is ready in: %~dp0desktop\BillFlow.exe
    echo.
) else (
    echo.
    echo [ERROR] Desktop build failed! Check the output above.
    echo.
)
pause
