@echo off
cd /d "%~dp0"
if not exist src\aps.js (
  echo Copy this extracted src folder and install-v101.cmd into the Forma Expense project root.
  pause
  exit /b 1
)
copy /y src\aps.js src\aps.js.v101.tmp >nul
copy /y src\aps.js.v101.tmp src\aps.js >nul
del src\aps.js.v101.tmp
node --check src\aps.js
if errorlevel 1 (
  echo Validation failed.
  pause
  exit /b 1
)
echo v101 APS rate limiter installed successfully.
pause
