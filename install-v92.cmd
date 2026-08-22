@echo off
cd /d "%~dp0"
if not exist server.js (
  echo Copy install-v92.cmd and apply-v92.js into the Forma Expense project root.
  pause
  exit /b 1
)
node apply-v92.js
if errorlevel 1 (
  echo Installation failed. Original files were backed up before changes.
  pause
  exit /b 1
)
node --check server.js
node --check public\app.js
node --check src\aps.js
echo.
echo v92 installed successfully.
pause
