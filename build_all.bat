@echo off
echo ========================================================
echo   BillFlow - Update BOTH APK and Desktop Software
echo ========================================================
node "%~dp0build_all.js"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   Both APK and Desktop software are ready and updated!
    echo   - APK:     %~dp0apk\BillFlow.apk
    echo   - Desktop: %~dp0desktop\BillFlow.exe
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed! Check the output above.
)
pause
