@echo off
chcp 65001 >nul 2>&1
title Audio Visualizer

cd /d "%~dp0docs"

echo.
echo  ============================================
echo   Audio Visualizer - ローカルサーバー起動中
echo  ============================================
echo.
echo   URL: http://localhost:8000
echo   終了: このウィンドウを閉じる か Ctrl+C
echo.

REM 2秒後にブラウザを自動で開く（並行実行）
start "" /MIN cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:8000"

REM Python HTTP サーバーを起動
python -m http.server 8000

REM サーバー終了後一時停止
echo.
echo  サーバーを停止しました。
pause
