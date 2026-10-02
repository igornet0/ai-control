#!/bin/bash

# Скрипт для локального запуска frontend и backend
# Автор: Ai-control Team
# Описание: Запускает frontend (Vite) и backend (Python) параллельно

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "🎨 Запуск Ai-control в dev режиме..."
echo "=================================="

if [ ! -d "front-ai-control" ]; then
    echo "❌ Ошибка: Папка front-ai-control не найдена"
    echo "Убедитесь, что вы находитесь в корневой директории проекта"
    exit 1
fi

if [ ! -d "src" ]; then
    echo "❌ Ошибка: Папка src не найдена"
    exit 1
fi

if [ ! -d "front-ai-control/node_modules" ]; then
    echo "📦 Установка зависимостей frontend..."
    (cd front-ai-control && npm install) || exit 1
fi

cleanup() {
    echo ""
    echo "⏹  Остановка серверов..."
    kill "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🚀 Запуск frontend..."
(cd front-ai-control && npm run dev) &
FRONTEND_PID=$!

echo "🚀 Запуск backend..."
(cd src && poetry run python run_app.py --env=dev) &
BACKEND_PID=$!

echo ""
echo "✅ Frontend (PID $FRONTEND_PID) и Backend (PID $BACKEND_PID) запущены"
echo "Нажмите Ctrl+C для остановки обоих процессов"
echo ""

wait "$FRONTEND_PID" "$BACKEND_PID"
