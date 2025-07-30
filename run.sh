#!/bin/bash

echo "🚀 Запуск TG Screenshot..."

# Запуск с docker-compose
docker-compose up -d

echo "✅ Приложение запущено!"
echo "🌐 Откройте: http://localhost:3000"
echo "📊 Логи: docker-compose logs -f" 