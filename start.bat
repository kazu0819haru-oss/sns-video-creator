@echo off
title Audio Visualizer

cd /d "%~dp0docs"

echo.
echo  ============================================
echo   Audio Visualizer - Local Server
echo  ============================================
echo.
echo   URL: http://localhost:8000
echo   Stop: Close this window or press Ctrl+C
echo.

REM Open browser after 2 seconds (in parallel)
start "" /MIN cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:8000"

REM Start Python HTTP server (blocks until Ctrl+C)
python -m http.server 8000

echo.
echo  Server stopped.
pause
