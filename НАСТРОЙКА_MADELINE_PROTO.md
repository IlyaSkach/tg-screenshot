# Настройка MadelineProto для реальных постов

## 🔍 **Как реализовано на боевом сервере**

На боевом сервере `dev2.ds.studio` используется **MadelineProto** - PHP библиотека для работы с официальным Telegram API. Это позволяет получать **реальные посты** из любых каналов.

## 🚀 **Пошаговая настройка**

### **Шаг 1: Установка зависимостей**

```bash
cd tg-screenshot/backend

# Установка Composer (если не установлен)
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# Установка MadelineProto
composer require danog/madelineproto
```

### **Шаг 2: Получение API ключей**

1. Перейдите на https://my.telegram.org/auth
2. Войдите в свой аккаунт Telegram
3. Перейдите в "API development tools"
4. Создайте новое приложение:

   - **App title**: TG Screenshot
   - **Short name**: tgscreenshot
   - **Platform**: Desktop
   - **Description**: Screenshot generator for Telegram channels

5. Скопируйте **API ID** и **API Hash**

### **Шаг 3: Настройка переменных окружения**

Создайте файл `.env` в папке `backend`:

```bash
# Telegram API
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
```

### **Шаг 4: Авторизация в Telegram**

Создайте скрипт авторизации:

```bash
# Создаем файл auth.php
cat > auth.php << 'EOF'
<?php
require_once __DIR__ . '/vendor/autoload.php';

$apiId = getenv('TELEGRAM_API_ID');
$apiHash = getenv('TELEGRAM_API_HASH');

if (!$apiId || !$apiHash) {
    echo "❌ ОШИБКА: API ключи не настроены!\n";
    exit(1);
}

try {
    $sessionPath = __DIR__ . '/telegram-sessions/user.madeline';

    if (!is_dir(dirname($sessionPath))) {
        mkdir(dirname($sessionPath), 0755, true);
    }

    $settings = [
        'app_info' => [
            'api_id' => (int)$apiId,
            'api_hash' => $apiHash,
        ],
        'logger' => [
            'level' => 1, // DEBUG
        ],
    ];

    $api = new \danog\MadelineProto\API($sessionPath, $settings);
    $api->start();

    if ($api->getSelf()) {
        echo "✅ Уже авторизован!\n";
        $self = $api->getSelf();
        echo "Пользователь: " . ($self['first_name'] ?? '') . " " . ($self['last_name'] ?? '') . "\n";
    } else {
        echo "Введите номер телефона (+7XXXXXXXXXX): ";
        $phone = trim(fgets(STDIN));

        echo "Введите код подтверждения: ";
        $code = trim(fgets(STDIN));

        $api->phone_login($phone);
        $api->complete_phone_login($code);

        echo "✅ Авторизация завершена!\n";
    }

} catch (Exception $e) {
    echo "❌ ОШИБКА: " . $e->getMessage() . "\n";
}
EOF

# Запускаем авторизацию
php auth.php
```

### **Шаг 5: Запуск сервера**

```bash
# Запускаем MadelineProto сервер
node madeline-proto-solution.js
```

## 📊 **Что дает MadelineProto**

### **✅ Возможности:**

- 📱 **Реальные посты** из любых каналов
- 📅 **Точная фильтрация** по датам
- 📝 **Полный текст** постов
- 🖼️ **Медиафайлы** (фото, видео)
- 📊 **Метаданные** (просмотры, пересылки)
- 🔒 **Приватные каналы** (если подписаны)

### **📋 Пример результата:**

```json
{
  "id": 12345,
  "date": "2024-07-28 15:30:00",
  "text": "Полный текст поста с реальными данными",
  "views": 1500,
  "forwards": 25,
  "has_media": true
}
```

## 🔧 **Структура проекта**

```
tg-screenshot/
├── backend/
│   ├── madeline-proto-solution.js    # Основной сервер
│   ├── vendor/                       # Composer зависимости
│   ├── telegram-sessions/            # Сессии Telegram
│   ├── uploads/                      # Скриншоты
│   └── composer.json                 # PHP зависимости
├── frontend/                         # React приложение
└── .env                             # Переменные окружения
```

## 🎯 **Использование**

### **1. Через API:**

```bash
curl -X POST http://localhost:3009/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "channelUrl": "https://t.me/durov",
    "startDate": "2024-07-28",
    "endDate": "2024-07-28"
  }'
```

### **2. Через веб-интерфейс:**

1. Откройте http://localhost:3001
2. Введите URL канала
3. Выберите даты
4. Нажмите "Создать отчет"

## 🚨 **Важные замечания**

### **Безопасность:**

- 🔐 **API ключи** - держите в секрете
- 📱 **Сессии** - не передавайте другим
- ⚡ **Лимиты** - соблюдайте ограничения API

### **Ограничения:**

- 📊 **100 запросов/сек** - лимит API
- 📅 **История** - ограничена доступностью
- 🔒 **Приватные каналы** - нужна подписка

## 🔍 **Отладка**

### **Проверка подключения:**

```bash
curl http://localhost:3009/api/health
```

### **Проверка авторизации:**

```bash
php -r "
require_once 'vendor/autoload.php';
\$api = new \danog\MadelineProto\API('telegram-sessions/user.madeline');
\$api->start();
echo '✅ Авторизован: ' . (\$api->getSelf() ? 'ДА' : 'НЕТ') . PHP_EOL;
"
```

### **Логи:**

```bash
# Просмотр логов сервера
tail -f logs/server.log

# Просмотр логов MadelineProto
tail -f telegram-sessions/user.madeline.log
```

## 💡 **Советы**

1. **Начните с публичных каналов** для тестирования
2. **Используйте реальные API ключи** для продакшена
3. **Сохраняйте сессии** для быстрого доступа
4. **Мониторьте лимиты** API
5. **Обрабатывайте ошибки** авторизации

## 🎉 **Результат**

После настройки вы получите:

- ✅ **Реальные посты** из любых каналов
- ✅ **Красивые скриншоты** в стиле Telegram
- ✅ **Точную фильтрацию** по датам
- ✅ **Полные метаданные** постов

**Это именно то, что используется на боевом сервере!** 🚀
