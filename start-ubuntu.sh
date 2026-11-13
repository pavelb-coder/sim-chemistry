#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8081}"
URL="http://localhost:${PORT}"

echo "=================================================="
echo "  ХимЛаб 3D — запуск локального сервера (${URL})"
echo "=================================================="

if command -v node >/dev/null 2>&1; then
  exec node server.js --open
elif command -v nodejs >/dev/null 2>&1; then
  exec nodejs server.js --open
elif command -v python3 >/dev/null 2>&1; then
  echo "Node.js не найден — запускаем через встроенный Python 3 HTTP-сервер..."
  if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
    (sleep 1 && xdg-open "${URL}" >/dev/null 2>&1 || true) &
  fi
  exec python3 -m http.server "${PORT}" --bind 0.0.0.0
else
  echo "Ошибка: не найден ни Node.js, ни Python 3."
  echo "Установите Node.js на Ubuntu командой:"
  echo "  sudo apt update && sudo apt install -y nodejs"
  exit 1
fi
