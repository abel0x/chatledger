@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo chatledger needs Node.js 20 or newer. Install it from https://nodejs.org and open this file again.
  echo chatledger icin Node.js 20 veya daha yenisi gerekiyor. https://nodejs.org adresinden kurup bu dosyayi yeniden acin.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
node scripts\start.mjs %*
if errorlevel 1 pause
