# TG Screenshot - Отчеты каналов Telegram

Приложение для создания отчетов по каналам Telegram с автоматическим скриншотированием постов.

## 🚀 Быстрый старт с Docker

### Предварительные требования

- Docker
- Docker Compose

### Запуск приложения

1. **Клонируйте репозиторий:**

```bash
git clone <your-repo-url>
cd tg-screenshot
```

2. **Соберите Docker образ:**

```bash
./build.sh
```

3. **Запустите приложение:**

```bash
./run.sh
```

4. **Откройте в браузере:**

```
http://localhost:3000
```

## 🐳 Docker команды

### Сборка образа

```bash
docker build -t tg-screenshot:latest .
```

### Запуск с docker-compose

```bash
docker-compose up -d
```

### Просмотр логов

```bash
docker-compose logs -f
```

### Остановка

```bash
docker-compose down
```

### Пересборка и запуск

```bash
docker-compose up --build -d
```

## 📋 Использование

1. **Введите имя канала** (например: `@egyptticket`)
2. **Выберите дату** для отчета
3. **Нажмите "Создать отчет"**
4. **Дождитесь загрузки** постов и скриншотов
5. **Просматривайте отчет** с полной информацией о постах

## ✨ Возможности

- 📊 **Статистика постов**: просмотры, пересылки, ответы
- 📸 **Автоматические скриншоты** каждого поста
- 📋 **Копирование текста** в буфер обмена
- 📅 **Фильтрация по датам**
- 🔄 **Умная прокрутка** для загрузки старых постов
- 📱 **Адаптивный дизайн**

## 🏗️ Архитектура

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Web Scraping**: Puppeteer + Chromium
- **Containerization**: Docker + Docker Compose

## 🔧 Разработка

### Локальная разработка без Docker

1. **Установите зависимости:**

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

2. **Запустите серверы:**

```bash
./start-servers.sh
```

### Переменные окружения

- `PORT` - порт сервера (по умолчанию: 3000)
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` - пропустить загрузку Chromium
- `PUPPETEER_EXECUTABLE_PATH` - путь к Chromium

## 🚀 Развертывание

### Railway

1. Подключите GitHub репозиторий
2. Railway автоматически обнаружит Dockerfile
3. Приложение будет доступно по URL Railway

### Render

1. Создайте новый Web Service
2. Подключите GitHub репозиторий
3. Укажите команду: `docker build -t tg-screenshot . && docker run -p 3000:3000 tg-screenshot`

### Fly.io

```bash
fly auth login
fly launch
fly deploy
```

## 📁 Структура проекта

```
tg-screenshot/
├── backend/                 # Node.js сервер
│   ├── simple-count-server.js
│   └── package.json
├── frontend/               # React приложение
│   ├── src/
│   └── package.json
├── uploads/               # Загруженные файлы
├── Dockerfile            # Docker конфигурация
├── docker-compose.yml    # Docker Compose
├── build.sh             # Скрипт сборки
├── run.sh               # Скрипт запуска
└── README.md
```

## 🐛 Устранение неполадок

### Проблемы с Docker

- **Ошибка порта**: убедитесь, что порт 3000 свободен
- **Проблемы с памятью**: увеличьте лимиты Docker
- **Медленная сборка**: используйте Docker BuildKit

### Проблемы с Puppeteer

- **Ошибки Chromium**: проверьте переменные окружения
- **Таймауты**: увеличьте таймауты в коде

## 📄 Лицензия

MIT License
