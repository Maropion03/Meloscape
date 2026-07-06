#!/bin/bash
# Meloscape — one-click launcher with API proxy
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
echo "🎵 Meloscape starting"
echo "   Open in browser → http://localhost:$PORT"
echo ""
cd "$DIR" && exec node server.js
