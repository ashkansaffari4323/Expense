@echo off
cd /d "%~dp0"
if not exist server.js (
  echo Copy install-v100.cmd and apply-v100.js into the Forma Expense project root.
  pause
  exit /b 1
)
node apply-v100.js
if errorlevel 1 (
  echo Installation failed. Backups were created before changes.
  pause
  exit /b 1
)
node --check server.js
node --check public\app.js
node --check src\aps.js
node --check src\cost.js
echo.
echo v100 installed successfully.
pause
