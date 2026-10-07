@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or later is required.
  pause
  exit /b 1
)
if not exist "node_modules\typescript\bin\tsc" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd start -- --open
pause
