@echo off
cd /d "%~dp0"
if not exist server.js (
  echo Copy this installer into the Forma Expense project root first.
  pause
  exit /b 1
)
node apply-v90.js
if errorlevel 1 (
  echo Installation failed. Your original files were not replaced.
  pause
  exit /b 1
)
node --check server.js
node --check public\app.js
echo.
echo v90 installed successfully.
pause
