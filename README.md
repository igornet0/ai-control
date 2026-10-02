# AI Control System

Комплексная система управления предприятием с интеграцией искусственного интеллекта для автоматизации бизнес-процессов.

## 🚀 Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Make (опционально, для удобства)

### Запуск в режиме разработки

1. **Клонируйте репозиторий:**
   ```bash
   git clone <repository-url>
   cd ai-control
   ```

2. **Настройте переменные окружения:**
   ```bash
   cp deployment/docker/env.example deployment/docker/.env
# Отредактируйте deployment/docker/.env при необходимости
   ```

3. **Запустите проект:**
   ```bash
   make dev
   ```
   
   Или без Make:
   ```bash
   docker-compose -f deployment/docker/docker-compose.dev.yml up -d
   ```

4. **Откройте в браузере:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - RabbitMQ Management: http://localhost:15672
   - Flower (Celery): http://localhost:5555

### Запуск в продакшн режиме

```bash
make prod
```

## 📁 Структура проекта

```
ai-control/
├── src/                          # ✅ Основной код (Clean Architecture)
│   ├── domain/                   # Доменная логика
│   ├── application/              # Слой приложения
│   ├── infrastructure/           # Инфраструктура
│   └── presentation/             # API и веб-интерфейс
├── tests/                        # ✅ Тесты
│   ├── unit/                     # Unit тесты
│   ├── integration/              # Интеграционные тесты
│   └── e2e/                      # End-to-end тесты
├── front-ai-control/             # ✅ React frontend
├── external/                     # ✅ Внешние сервисы
│   ├── datacode/                 # DataCode интерпретатор
│   └── ai-models/                # AI модели
├── data/                         # ✅ Данные и ресурсы
│   ├── uploads/                  # Пользовательские загрузки
│   ├── analysis/                 # Данные для анализа
│   └── samples/                  # Примеры данных
├── deployment/                   # ✅ Развертывание
│   ├── docker/                   # Docker конфигурации
│   ├── k8s/                      # Kubernetes манифесты
│   ├── nginx/                    # Nginx конфигурации
│   ├── monitoring/               # Мониторинг (Prometheus, Grafana)
│   ├── ssl/                      # SSL сертификаты
│   └── scripts/                  # Скрипты развертывания
├── config/                       # ✅ Конфигурации
│   ├── environments/             # Файлы окружения
│   └── templates/                # Шаблоны конфигураций
├── docs/                         # ✅ Документация
│   ├── architecture/             # Архитектурная документация
│   ├── api/                      # API документация
│   ├── deployment/               # Документация развертывания
│   └── development/              # Документация для разработчиков
├── plugins/                      # ✅ Плагины и виджеты
├── pyproject.toml                # ✅ Конфигурация Python
├── pytest.ini                   # ✅ Конфигурация тестов
├── Makefile                      # ✅ Команды разработки
├── README.md                     # ✅ Основная документация
└── IMPLEMENTATION_REPORT.md      # ✅ Отчет о реализации
```

## 🛠 Команды Make

### Разработка
```bash
make dev          # Запуск dev окружения
make dev-build    # Сборка dev контейнеров
make dev-down     # Остановка dev окружения
make dev-logs     # Просмотр логов
make dev-shell    # Shell в backend контейнере
```

### Продакшн
```bash
make prod         # Запуск prod окружения
make prod-build   # Сборка prod контейнеров
make prod-down    # Остановка prod окружения
make prod-logs    # Просмотр логов
```

### Тестирование
```bash
make test         # Запуск всех тестов
make test-unit    # Unit тесты
make test-integration # Integration тесты
make test-coverage # Тесты с покрытием
```

### Качество кода
```bash
make lint         # Проверка стиля кода
make format       # Форматирование кода
make type-check   # Проверка типов
```

### База данных
```bash
make migrate      # Применение миграций
make migrate-create # Создание новой миграции
make db-reset     # Сброс БД
```

### Утилиты
```bash
make clean        # Очистка контейнеров и volumes
make logs         # Просмотр логов
make shell        # Shell в backend
make backup       # Резервная копия БД
make restore      # Восстановление БД
make health       # Проверка здоровья сервисов
```

## 🏗 Архитектура

### Микросервисы
- **Backend API** (FastAPI) - Основной API сервер
- **Frontend** (React) - Пользовательский интерфейс
- **PostgreSQL** - Основная база данных
- **Redis** - Кэширование и сессии
- **RabbitMQ** - Очереди сообщений
- **Celery** - Фоновые задачи
- **Nginx** - Обратный прокси

### Основные компоненты
- **Система пользователей и ролей** - Иерархия CEO → Менеджеры → Сотрудники
- **Система дашбордов** - Создание и настройка дашбордов
- **DataCode** - Интерактивный язык программирования для обработки данных
- **KPI система** - Расчет и отслеживание ключевых показателей
- **Система задач** - Управление задачами с иерархией
- **Документооборот** - Система документов с workflow
- **Корпоративная почта** - Внутренняя и внешняя почта
- **Система чатов** - Реальное время общение
- **Видеозвонки** - WebRTC интеграция
- **Единая система уведомлений** - Централизованные уведомления
- **Система поиска** - Поиск по всем данным
- **Единый календарь** - Управление событиями и встречами

## 🔧 Конфигурация

### Переменные окружения

Основные переменные в `aic_docker/.env`:

```bash
# База данных
POSTGRES_DB=ai_control_dev
POSTGRES_USER=ai_control_user
POSTGRES_PASSWORD=ai_control_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=ai_control_user
RABBITMQ_PASSWORD=ai_control_password

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## 🧪 Тестирование

### Запуск тестов
```bash
# Все тесты
make test

# Структурные тесты
python -m pytest tests/test_*_structure.py

# Функциональные тесты
python -m pytest tests/test_*_simple.py

# С покрытием
make test-coverage
```

### Типы тестов
- **Структурные тесты** - Проверка структуры моделей и сервисов
- **Функциональные тесты** - Проверка бизнес-логики
- **Интеграционные тесты** - Проверка взаимодействия компонентов

## 📊 Мониторинг

### Разработка
- **Flower** - Мониторинг Celery задач: http://localhost:5555

### Продакшн
- **Grafana** - Дашборды: http://localhost:3001
- **Prometheus** - Метрики: http://localhost:9090

## 🔒 Безопасность

- JWT аутентификация
- Role-Based Access Control (RBAC)
- CORS настройки
- Валидация входных данных
- SQL injection защита

## 📈 Производительность

- Redis кэширование
- Оптимизированные SQL запросы
- Индексы PostgreSQL
- Асинхронная обработка
- Load balancing

## 🤝 Разработка

### Добавление новых функций
1. Создайте модели в `core/database/models/`
2. Добавьте сервисы в `backend/api/services/`
3. Создайте API роутеры в `backend/api/routers/`
4. Напишите тесты в `tests/`
5. Обновите документацию

### Code Style
- Python: Black, Flake8, MyPy
- JavaScript: ESLint, Prettier
- SQL: SQLFluff

## 📝 Лицензия

MIT License

## 🆘 Поддержка

Для вопросов и предложений создавайте issues в репозитории.
