@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%PORT%"=="" set PORT=8081
set URL=http://localhost:%PORT%

echo ==================================================
echo   ChemLab 3D / ХимЛаб 3D — %URL%
echo ==================================================

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  node server.js --open
  pause
  exit /b 0
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Node.js не найден — запускаем через Python Launcher...
  start "" "%URL%"
  py -m http.server %PORT% --bind 0.0.0.0
  pause
  exit /b 0
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Node.js не найден — запускаем через Python...
  start "" "%URL%"
  python -m http.server %PORT% --bind 0.0.0.0
  pause
  exit /b 0
)

echo [ОШИБКА] Не найден Node.js или Python!
echo Установите Node.js LTS с https://nodejs.org/ или командой:
echo   winget install OpenJS.NodeJS.LTS
pause
exit /b 1
