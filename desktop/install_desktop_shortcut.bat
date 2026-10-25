@echo off
echo ========================================================
echo   BillFlow - Create Windows Desktop Shortcut
echo ========================================================

powershell -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'BillFlow.lnk')); " ^
  "$Shortcut.TargetPath = (Resolve-Path '%~dp0BillFlow.exe').Path; " ^
  "$Shortcut.WorkingDirectory = (Resolve-Path '%~dp0').Path; " ^
  "$Shortcut.Description = 'BillFlow - Smart GST Invoicing, Inventory & Khata Ledger App'; " ^
  "$Shortcut.IconLocation = ((Resolve-Path '%~dp0BillFlow.exe').Path + ',0'); " ^
  "$Shortcut.Save();"

echo.
echo Shortcut 'BillFlow' successfully created on your Windows Desktop!
echo You can now launch BillFlow directly from your Desktop anytime.
echo.
pause
