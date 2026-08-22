@echo off
cd /d "%~dp0"
if not exist server.js (
  echo Copy install-v96.cmd and apply-v96.js into the Forma Expense project root.
  pause
  exit /b 1
)
node apply-v96.js
if errorlevel 1 (
  echo Installation failed. Backups were created before changes.
  pause
  exit /b 1
)
node --check server.js
node --check public\app.js
node --check src\aps.js
node --check src\cost.js
node --check src\auth.js
echo.
echo v96 installed successfully.
pause
