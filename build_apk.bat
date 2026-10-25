@echo off
echo ========================================================
echo   BillFlow - Build Latest APK & Place into apk/ Folder
echo ========================================================
node "%~dp0build_apk.js"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Latest APK is ready in: %~dp0apk\BillFlow.apk
    echo.
) else (
    echo.
    echo [ERROR] Build failed! Check the output above.
    echo.
)
pause
