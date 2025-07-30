# TG Screenshot Backend

Backend для получения скриншотов каналов Telegram с использованием MadelineProto.

## 🚀 Быстрый старт

### 1. Настройка API ключей

1. Перейдите на https://my.telegram.org/auth
2. Войдите в свой аккаунт Telegram
3. Перейдите в "API development tools"
4. Создайте новое приложение:

   - **App title**: TG Screenshot
   - **Short name**: tgscreenshot
   - **Platform**: Desktop
   - **Description**: Screenshot generator for Telegram channels

5. Скопируйте **API ID** и **API Hash**

### 2. Обновление .env файла

Отредактируйте файл `.env`:

```bash
# Замените на ваши реальные ключи
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

### 3. Авторизация в Telegram

```bash
# Запустите скрипт авторизации
php auth.php
```

Следуйте инструкциям на экране. Вам потребуется:

- Номер телефона (с кодом страны, например +7)
- Код подтверждения из Telegram

### 4. Запуск сервера

```bash
# Запустите основной сервер
node madeline-proto-solution.js
```

Сервер будет доступен на http://localhost:3009

## 📊 Возможности

- ✅ **Реальные посты** из любых каналов
- ✅ **Точная фильтрация** по датам
- ✅ **Полные метаданные** (просмотры, пересылки)
- ✅ **Красивые скриншоты** в стиле Telegram
- ✅ **Приватные каналы** (если подписаны)

## 🔧 API Endpoints

### Создание отчета

```bash
POST /api/reports
Content-Type: application/json

{
  "channelUrl": "https://t.me/durov",
  "startDate": "2024-07-28",
  "endDate": "2024-07-28"
}
```

### Получение отчета

```bash
GET /api/reports/{id}
```

### Проверка здоровья

```bash
GET /api/health
```

## 📁 Структура проекта

```
backend/
├── madeline-proto-solution.js    # Основной сервер
├── auth.php                      # Скрипт авторизации
├── vendor/                       # Composer зависимости
├── telegram-sessions/            # Сессии Telegram
├── uploads/                      # Скриншоты
├── .env                         # Переменные окружения
└── composer.json                # PHP зависимости
```

## 🚨 Важные замечания

- 🔐 **API ключи** - держите в секрете
- 📱 **Сессии** - не передавайте другим
- ⚡ **Лимиты** - соблюдайте ограничения API (100 запросов/сек)
- 🔒 **Приватные каналы** - нужна подписка

## 🔍 Отладка

### Проверка подключения

```bash
curl http://localhost:3009/api/health
```

### Проверка авторизации

```bash
php -r "
require_once 'vendor/autoload.php';
\$api = new \danog\MadelineProto\API('telegram-sessions/user.madeline');
\$api->start();
echo '✅ Авторизован: ' . (\$api->getSelf() ? 'ДА' : 'НЕТ') . PHP_EOL;
"
```

## 🎉 Результат

После настройки вы получите:

- ✅ **Реальные посты** из любых каналов
- ✅ **Красивые скриншоты** в стиле Telegram
- ✅ **Точную фильтрацию** по датам
- ✅ **Полные метаданные** постов

**Это именно то, что используется на боевом сервере!** 🚀
