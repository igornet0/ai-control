# 🎯 Drag and Drop Feature для страницы "Обзор"

## 📋 Описание функциональности

Реализована возможность перетаскивания карточек на странице "Обзор" для персонализации интерфейса пользователем.

### ✨ Возможности:
- **Drag & Drop**: Перетаскивание карточек мышью для изменения их расположения
- **Автосохранение**: Layout автоматически сохраняется в базе данных
- **Персонализация**: Каждый пользователь имеет свой уникальный layout
- **Восстановление**: При повторном входе layout восстанавливается из БД
- **Fallback**: При ошибках используется дефолтный layout

## 🏗️ Архитектура

### Backend компоненты:

#### 1. **API Endpoints** (`backend/api/routers/personal_dashboard/router.py`)
```python
GET  /api/personal-dashboard/overview-layout     # Получить layout
POST /api/personal-dashboard/overview-layout     # Сохранить layout
```

#### 2. **Модели данных**
- **UserPreference** - хранит layout в поле `dashboard_layout` как JSON
- **OverviewCardLayoutRequest** - модель для одной карточки
- **OverviewLayoutUpdateRequest** - модель для всего layout

#### 3. **Хранение данных**
Layout сохраняется в таблице `user_preferences`:
```json
{
  "overview_cards": {
    "priorities": {"position": 0, "visible": true},
    "overdue": {"position": 1, "visible": true},
    "upcoming": {"position": 2, "visible": true},
    "projects": {"position": 3, "visible": true},
    "notes": {"position": 4, "visible": true},
    "checklist": {"position": 5, "visible": true},
    "time-management": {"position": 6, "visible": true}
  }
}
```

### Frontend компоненты:

#### 1. **DraggableGrid** (`src/components/DraggableGrid.jsx`)
- Основной компонент для drag & drop
- Использует библиотеку `@dnd-kit`
- Управляет состоянием карточек и их позициями
- Автоматически сохраняет изменения в API

#### 2. **DraggableCard** (`src/components/DraggableCard.jsx`)
- Компонент отдельной перетаскиваемой карточки
- Показывает иконку drag handle при hover
- Применяет визуальные эффекты при перетаскивании

#### 3. **OverviewLayoutService** (`src/services/overviewLayoutService.js`)
- Сервис для работы с API layout
- Методы для получения, сохранения и конвертации layout
- Обработка ошибок и fallback логика

## 🎮 Использование

### Для пользователя:
1. Откройте страницу "Обзор"
2. Наведите курсор на любую карточку
3. Появится иконка перетаскивания ✚
4. Зажмите и перетащите карточку в новое место
5. Layout автоматически сохранится

### Визуальные подсказки:
- **Иконка перетаскивания**: Показывается при hover на карточке
- **Прозрачность**: Карточка становится полупрозрачной при перетаскивании
- **Курсор**: Меняется на `cursor-grab` / `cursor-grabbing`
- **Индикатор сохранения**: Показывается в правом нижнем углу

## 🔧 Технические детали

### Библиотеки:
- **@dnd-kit/core** - основная библиотека drag & drop
- **@dnd-kit/sortable** - сортируемые списки
- **@dnd-kit/utilities** - вспомогательные утилиты

### Карточки по умолчанию:
1. **priorities** - "Мои приоритеты на сегодня"
2. **overdue** - "Просроченные задачи" 
3. **upcoming** - "Предстоящие дедлайны"
4. **projects** - "Статусы проектов"
5. **notes** - "Заметки"
6. **checklist** - "Чек-лист"
7. **time-management** - "Тайм-менеджмент на сегодня"

### API Responses:

**GET /api/personal-dashboard/overview-layout**
```json
{
  "layout": {
    "priorities": {"position": 0, "visible": true},
    "overdue": {"position": 1, "visible": true}
  }
}
```

**POST /api/personal-dashboard/overview-layout**
```json
{
  "cards": [
    {"card_id": "priorities", "position": 0, "visible": true},
    {"card_id": "overdue", "position": 1, "visible": true}
  ]
}
```

## 🧪 Тестирование

### Frontend тесты:
- **DraggableGrid**: 8 тестов (компонент, API взаимодействие, error handling)
- **OverviewLayoutService**: 11 тестов (CRUD операции, конвертация данных)

### Команды для запуска:
```bash
make test-frontend              # Все frontend тесты
make test                      # Все тесты (backend + frontend)
```

## 🚀 Развертывание

```bash
# Пересборка и запуск
make dev-build && make dev

# Доступ к приложению
http://localhost:3000
```

## 🔮 Будущие улучшения

- **Скрытие карточек**: Возможность скрывать ненужные карточки
- **Группировка**: Создание групп карточек
- **Анимации**: Более плавные переходы при перестановке
- **Мобильная версия**: Оптимизация для touch устройств
- **Шаблоны layout**: Предустановленные варианты расположения

## 📊 Производительность

- **Автосохранение**: Дебаунс 500мс для снижения нагрузки на API
- **Ленивая загрузка**: Layout загружается только при необходимости  
- **Fallback**: Быстрый откат к дефолтному layout при ошибках
- **Кэширование**: Локальное кэширование состояния для быстрого отклика

---

**Автор**: AI Assistant  
**Дата**: $(date)  
**Версия**: 1.0.0
