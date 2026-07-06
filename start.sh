#!/bin/bash
# Audio Visualizer — 一键启动（含 API 代理）
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
echo "🎵 Audio Visualizer 启动"
echo "   浏览器打开 → http://localhost:$PORT"
echo ""
cd "$DIR" && exec node server.js
