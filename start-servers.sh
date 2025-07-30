#!/bin/bash

echo "🚀 Запуск серверов..."

# Останавливаем все процессы node
echo "🛑 Останавливаем старые процессы..."
pkill -f node 2>/dev/null || true
sleep 2

# Запускаем бэкенд
echo "🔧 Запускаем бэкенд на порту 3012..."
cd backend
node simple-count-server.js &
BACKEND_PID=$!
cd ..

# Ждем запуска бэкенда
sleep 3

# Проверяем бэкенд
echo "🔍 Проверяем бэкенд..."
curl -s http://localhost:3012/api/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Бэкенд запущен"
else
    echo "❌ Бэкенд не запустился"
    exit 1
fi

# Запускаем фронтенд
echo "🎨 Запускаем фронтенд на порту 3002..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "🎉 Серверы запущены!"
echo "📱 Frontend: http://localhost:3002"
echo "🔧 Backend: http://localhost:3012"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Ждем сигнала для остановки
trap "echo '🛑 Останавливаем серверы...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait 