# Скрипты управления системой AI Control

## create_admin.py

Скрипт для создания администратора системы AI Control.

## list_admins.py

Скрипт для просмотра списка всех администраторов системы.

### Использование

#### Через Makefile (рекомендуется)

```bash
# Интерактивное создание администратора
make create-admin

# Быстрое создание с дефолтными данными
make create-admin-quick

# Просмотр списка администраторов
make list-admins
```

#### Прямое выполнение

```bash
# Интерактивный режим
python scripts/create_admin.py

# С параметрами командной строки
python scripts/create_admin.py --login admin --email admin@company.com --password MySecurePass123 --username "System Administrator"
```

### Параметры

- `--login` - Логин администратора (обязательный)
- `--email` - Email администратора (обязательный)
- `--password` - Пароль администратора (обязательный, минимум 6 символов)
- `--username` - Отображаемое имя пользователя (опционально, по умолчанию = логин)

### Примеры

```bash
# Создание админа с кастомными данными
python scripts/create_admin.py --login superadmin --email admin@example.com --password SecurePass123 --username "Super Administrator"

# Создание админа с минимальными данными
python scripts/create_admin.py --login admin --email admin@localhost --password admin123

# Просмотр списка администраторов
python scripts/list_admins.py
```

### Требования

- Запущенная система (Docker контейнеры)
- Выполненные миграции базы данных
- Python 3.8+

### Безопасность

⚠️ **Важно**: 
- Используйте сложные пароли в продакшене
- Не используйте дефолтные данные в продакшене
- Регулярно меняйте пароли администраторов

### Устранение неполадок

1. **Ошибка подключения к БД**: Убедитесь, что контейнеры запущены и миграции выполнены
2. **Пользователь уже существует**: Скрипт проверит существование пользователя по логину и email
3. **Неверный формат email**: Используйте корректный формат email адреса

### Интеграция с Docker

Скрипт автоматически работает в Docker окружении через Makefile команды. При прямом запуске убедитесь, что переменные окружения настроены корректно.

## purge_deleted_files.py

Удаляет просроченные soft-delete записи таблицы `files` (`purge_after <= now`) и соответствующие файлы на диске (только если нет ссылок в `data_model_files`).

```bash
PYTHONPATH=src python deployment/scripts/purge_deleted_files.py
```

Рекомендуется запускать по cron (например, раз в сутки).

