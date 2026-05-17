#!/usr/bin/env bash
# Audio Visualizer ローカル起動スクリプト (Mac / Linux)
set -e
cd "$(dirname "$0")/docs"

echo ""
echo "  ============================================"
echo "   Audio Visualizer - ローカルサーバー起動中"
echo "  ============================================"
echo ""
echo "   URL: http://localhost:8000"
echo "   終了: Ctrl+C"
echo ""

# 2秒後にブラウザを開く（バックグラウンド）
(sleep 2 && (open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null)) &

python3 -m http.server 8000
