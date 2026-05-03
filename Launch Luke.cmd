@echo off
setlocal EnableExtensions

title Luke Launcher
set "ROOT=%~dp0"

cd /d "%ROOT%" || (
  echo Could not enter the Luke folder.
  pause
  exit /b 1
)

if not exist "%ROOT%package.json" (
  echo Luke launcher error: package.json was not found in this folder.
  pause
  exit /b 1
)

if not exist "%ROOT%electron.js" (
  echo Luke launcher error: electron.js was not found in this folder.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules\.bin\electron.cmd" (
  echo Luke dependencies are not installed.
  echo.
  echo Run this from the Luke folder:
  echo   npm install
  echo.
  pause
  exit /b 1
)

echo Starting Luke...
echo Dashboard: http://localhost:3000/shell
echo Close the Luke window to end this desktop session.
echo.

call "%ROOT%node_modules\.bin\electron.cmd" "%ROOT%electron.js"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Luke exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
