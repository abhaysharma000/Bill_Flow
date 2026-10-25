@echo off
echo ========================================================
echo   BillFlow - One-Click Phone Installer / Updater
echo ========================================================
echo Waiting for device connection...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" wait-for-device
echo Device detected!
echo Installing updated BillFlow.apk from apk folder (preserving all your data)...
if exist "%~dp0apk\BillFlow.apk" (
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "%~dp0apk\BillFlow.apk"
) else (
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "%~dp0BillFlow.apk"
)
echo.
echo Launching BillFlow...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell monkey -p com.billflow.app -c android.intent.category.LAUNCHER 1
echo.
echo ========================================================
echo   BillFlow updated and launched successfully!
echo ========================================================
pause
