#!/bin/bash

echo "🐳 Сборка Docker образа для TG Screenshot..."

# Сборка образа
docker build -t tg-screenshot:latest .

echo "✅ Образ собран успешно!"
echo "🚀 Для запуска используйте: docker-compose up" 