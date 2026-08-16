@echo off
cd /d "%~dp0"
rem close previous NAI Studio server windows (avoid attaching to an old server)
taskkill /F /FI "WINDOWTITLE eq NAI Studio Server*" /T >nul 2>&1
title NAI Studio Server
where py >nul 2>nul
if %errorlevel%==0 (
  py "%~dp0server.py"
) else (
  python "%~dp0server.py"
)
echo.
echo [NAI Studio] server stopped. Close this window or press any key.
pause >nul
