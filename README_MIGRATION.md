# AI Control System - Руководство по миграции

## Обзор

Проект AI Control System был успешно рефакторирован с применением принципов Clean Architecture и Domain-Driven Design. Ключевые компоненты из папок `core/` и `backend/` были мигрированы в новую структуру `src/`.

## Новая структура

```
src/
├── domain/                   # Доменная логика
│   ├── user_management/      # ✅ Управление пользователями
│   ├── task_management/      # 🔄 В процессе
│   ├── dashboard/            # ⏳ Планируется
│   ├── kpi/                  # ⏳ Планируется
│   └── ...
├── application/              # Слой приложения
│   ├── use_cases/            # ✅ Use cases для User Management
│   ├── dto/                  # ✅ DTO модели
│   └── interfaces/           # ✅ Интерфейсы
├── infrastructure/           # Инфраструктурный слой
│   ├── database/             # ✅ База данных и репозитории
│   ├── external_services/    # ✅ DataCode сервис
│   ├── config/               # ✅ Настройки и логирование
│   └── utils/                # ✅ Утилиты
└── presentation/             # Слой представления
    ├── api/                  # ✅ REST API контроллеры
    ├── middleware/           # ✅ Middleware аутентификации
    └── dependencies/         # ✅ Dependency injection
```

## Мигрированные компоненты

### ✅ Завершено

#### 1. Слой базы данных
- **Base** - базовый класс для SQLAlchemy моделей
- **Database** - управление подключениями и сессиями
- **UserModel** - SQLAlchemy модель пользователя
- **UserRepositoryImpl** - реализация репозитория пользователей

#### 2. Настройки и конфигурация
- **Settings** - главный класс настроек с Pydantic
- **DatabaseSettings** - настройки базы данных
- **SecuritySettings** - настройки безопасности
- **LoggingSettings** - настройки логирования
- **Structured Logging** - JSON логирование с контекстом

#### 3. Утилиты
- **Case Converter** - преобразование регистра строк
- **Database Engine** - асинхронный движок базы данных
- **Connection Management** - управление подключениями

#### 4. Middleware
- **AuthMiddleware** - аутентификация и авторизация
- **PermissionMiddleware** - проверка разрешений
- **CORS** - настройки CORS

#### 5. Сервисы
- **DataCodeService** - интеграция с DataCode интерпретатором
- **DataCode API** - REST API для DataCode операций

#### 6. Dependency Injection
- **Repository Dependencies** - инъекция репозиториев
- **Use Case Dependencies** - инъекция use cases
- **Database Session** - управление сессиями БД

### 🔄 В процессе
- **Task Management** - миграция логики задач
- **Тестирование** - написание тестов для новых компонентов

### ⏳ Планируется
- **Dashboard** - миграция дашбордов
- **KPI** - миграция KPI системы
- **Document Management** - миграция документооборота
- **Communication** - миграция коммуникаций
- **Calendar** - миграция календаря
- **Notification** - миграция уведомлений
- **Search** - миграция поиска

## Как использовать

### 1. Установка зависимостей

```bash
# Установка основных зависимостей
pip install -e .

# Установка зависимостей для разработки
pip install -e ".[dev]"

# Установка зависимостей для продакшна
pip install -e ".[prod]"
```

### 2. Запуск приложения

```bash
# Запуск через uvicorn
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Или через Python модуль
python -m src.main
```

### 3. Тестирование

```bash
# Запуск всех тестов
pytest tests_new/

# Запуск unit тестов
pytest tests_new/unit/

# Запуск интеграционных тестов
pytest tests_new/integration/

# Запуск с покрытием
pytest tests_new/ --cov=src --cov-report=html
```

### 4. Проверка качества кода

```bash
# Форматирование кода
black src/ tests_new/

# Сортировка импортов
isort src/ tests_new/

# Линтинг
flake8 src/ tests_new/

# Проверка типов
mypy src/

# Pre-commit hooks
pre-commit run --all-files
```

## API Endpoints

### User Management
- `POST /api/v1/users/` - Создание пользователя
- `GET /api/v1/users/{user_id}` - Получение пользователя
- `GET /api/v1/users/` - Получение списка пользователей
- `PUT /api/v1/users/{user_id}` - Обновление пользователя
- `DELETE /api/v1/users/{user_id}` - Удаление пользователя

### DataCode
- `POST /api/v1/datacode/execute` - Выполнение скрипта
- `POST /api/v1/datacode/validate` - Валидация скрипта
- `GET /api/v1/datacode/functions` - Получение доступных функций
- `POST /api/v1/datacode/process-csv` - Обработка CSV файла
- `GET /api/v1/datacode/health` - Проверка здоровья сервиса

### Health Check
- `GET /health` - Проверка здоровья приложения
- `GET /` - Корневой endpoint

## Конфигурация

### Переменные окружения

Основные переменные в `.env`:

```bash
# База данных
POSTGRES__USER=ai_control_user
POSTGRES__PASSWORD=ai_control_password
POSTGRES__HOST=localhost
POSTGRES__DB_NAME=ai_control_dev
POSTGRES__PORT=5432

# Безопасность
SECURITY__SECRET_KEY=your-secret-key
SECURITY__ALGORITHM=HS256
SECURITY__ACCESS_TOKEN_EXPIRE_MINUTES=30

# API
API__TITLE=AI Control System
API__VERSION=1.0.0
API__CORS_ORIGINS=http://localhost:3000

# Логирование
LOG__LEVEL=INFO
LOG__FORMAT=json
```

### Настройки базы данных

```python
# src/infrastructure/config/settings.py
class DatabaseSettings(BaseSettings):
    host: str = "localhost"
    port: int = 5432
    name: str = "ai_control_dev"
    user: str = "ai_control_user"
    password: str = "ai_control_password"
    pool_size: int = 10
    max_overflow: int = 20
    echo: bool = False
```

## Разработка

### Добавление нового домена

1. Создать структуру домена:
```bash
mkdir -p src/domain/new_domain/{entities,value_objects,repositories,services}
```

2. Создать сущности в `src/domain/new_domain/entities/`
3. Создать репозитории в `src/domain/new_domain/repositories/`
4. Создать use cases в `src/application/use_cases/new_domain/`
5. Создать DTO в `src/application/dto/`
6. Создать API контроллеры в `src/presentation/api/controllers/`
7. Добавить dependency injection в `src/presentation/api/dependencies.py`
8. Написать тесты в `tests_new/`

### Добавление нового API endpoint

1. Создать DTO модели в `src/application/dto/`
2. Создать use case в `src/application/use_cases/`
3. Создать API контроллер в `src/presentation/api/controllers/`
4. Добавить dependency injection
5. Зарегистрировать роутер в `src/main.py`
6. Написать тесты

### Добавление нового сервиса

1. Создать интерфейс в `src/domain/`
2. Создать реализацию в `src/infrastructure/external_services/`
3. Добавить dependency injection
4. Создать API контроллер если нужен
5. Написать тесты

## Миграция существующего кода

### 1. Поэтапная миграция

Рекомендуется мигрировать по одному домену за раз:

1. **User Management** ✅ - уже мигрирован
2. **Task Management** 🔄 - в процессе
3. **Dashboard** ⏳ - следующий
4. **KPI** ⏳ - следующий
5. И так далее...

### 2. Совместимость

- Старый код остается в папках `core/`, `backend/`, `tests/`
- Новая структура работает параллельно
- API endpoints доступны по пути `/api/v1/`
- Старые endpoints остаются без изменений

### 3. Тестирование миграции

```bash
# Тестирование новых компонентов
pytest tests_new/

# Тестирование старых компонентов
pytest tests/

# Интеграционное тестирование
pytest tests_new/integration/
```

## Мониторинг и логирование

### Структурированное логирование

```python
from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)

# Логирование с контекстом
logger.info("User created", extra={
    "user_id": str(user.id),
    "username": user.username,
    "created_by": str(current_user_id),
})
```

### Метрики

```python
# Логирование бизнес-событий
logger.info("business_event", extra={
    "event_type": "user_created",
    "user_id": str(user.id),
    "timestamp": datetime.utcnow().isoformat(),
})
```

## Безопасность

### Аутентификация

```python
# Middleware автоматически проверяет аутентификацию
# для всех защищенных endpoints
```

### Авторизация

```python
# Проверка ролей и разрешений
# настраивается в AuthMiddleware
```

### Валидация данных

```python
# Pydantic модели автоматически валидируют
# входящие данные
```

## Производительность

### Асинхронность

```python
# Все операции с базой данных асинхронные
async def get_user(user_id: UUID) -> Optional[User]:
    return await user_repository.get_by_id(user_id)
```

### Connection Pooling

```python
# Автоматическое управление пулом соединений
# в Database классе
```

### Кэширование

```python
# Готовность к добавлению Redis кэширования
# в репозиториях
```

## Troubleshooting

### Частые проблемы

1. **Импорты не найдены**
   - Убедитесь, что установлены все зависимости
   - Проверьте PYTHONPATH

2. **Ошибки базы данных**
   - Проверьте подключение к PostgreSQL
   - Убедитесь, что миграции применены

3. **Ошибки аутентификации**
   - Проверьте JWT токены
   - Убедитесь, что middleware настроен правильно

### Логи

```bash
# Просмотр логов приложения
tail -f logs/app.log

# Логи в JSON формате
jq '.' logs/app.log
```

## Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Изучите документацию в `docs/`
3. Посмотрите примеры в `tests_new/`
4. Создайте issue в репозитории

## Заключение

Миграция ключевых компонентов успешно завершена. Проект теперь имеет:

- **Профессиональную архитектуру** с четким разделением слоев
- **Высокое качество кода** с автоматической проверкой
- **Масштабируемость** для добавления новых доменов
- **Поддерживаемость** с подробной документацией

Готов к дальнейшему развитию и добавлению новых функций!
