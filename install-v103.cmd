@echo off
cd /d "%~dp0"
if not exist server.js (
  echo Copy install-v103.cmd and apply-v103.js into the Forma Expense project root.
  pause
  exit /b 1
)
node apply-v103.js
if errorlevel 1 (
  echo Installation failed. No project files were replaced unless validation passed.
  pause
  exit /b 1
)
node --check server.js
node --check public\app.js
node --check src\aps.js
node --check src\cost.js
node --check src\auth.js
echo.
echo v103 installed successfully.
pause
