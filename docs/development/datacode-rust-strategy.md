# Стратегия переноса DataCode / интерпретатора в Rust

## Текущая архитектура

- **Интерпретатор DSL** на Python: [`src/datacode_interpreter/interpreter.py`](../../src/datacode_interpreter/interpreter.py) — большой объём логики (циклы, вложенность, таблицы, файлы).
- **Клиент к внешнему процессу DataCode** по WebSocket: [`src/data_model_engine/engine.py`](../../src/data_model_engine/engine.py) — строит модели / SQLite; не заменяет интерпретатор целиком.

## Источник Rust: `external/DataCode`

В репозитории уже есть нативный интерпретатор **[`external/DataCode/`](../../external/DataCode/)** (workspace `datacode_abi`, `datacode_sdk`, бинарь `datacode`). Целевое направление интеграции:

| Подход | Когда выбирать |
|--------|----------------|
| **Подпроцесс / CLI** | Минимальный риск: Python вызывает собранный `datacode` с файлом сценария и аргументами; парсить stdout/JSON по контракту. |
| **Статическая линковка / cdylib** | Когда критична латентность и есть стабильный C ABI между версиями `datacode_abi`. |
| **Отдельный long-running сервис** | Если нужен тот же режим, что у текущего WebSocket DataCode runner — унифицировать протокол с [`data_model_engine/engine.py`](../../src/data_model_engine/engine.py). |

**Минимальный путь внедрения:**

1. Инвентаризация вызовов: [`src/app/routers/datacode/router.py`](../../src/app/routers/datacode/router.py), [`src/datacode_interpreter/`](../../src/datacode_interpreter/) — какие входы/выходы реально нужны фронту.
2. Зафиксировать контракт v1 (файл на диске, JSON payload или WS-совместимое сообщение) между Python и `external/DataCode`.
3. Добавить golden/parity-тесты: один и тот же `.dc` фрагмент через Python и через Rust — сравнение результата.
4. Не плодить второй интерпретатор внутри `rust/` рядом с `dashboard-query`.

## Принцип разделения с `dashboard-query`

**Не смешивать** движок DataCode с [`rust/dashboard-query/`](../../rust/dashboard-query/): разные контракты, циклы релиза и аудитории (BI-SQLite vs исполняемый DSL). Общий слой — только транспорт (например общие типы логирования/метрик), не общий крейт SQL дашбордов.

## Рекомендуемые этапы (оркестрация)

1. **Зафиксировать подмножество** конструкций DataCode, которые дают 80% времени исполнения (типовые `FileList`, простые циклы, операции над таблицами).
2. **Транспорт** «выполни шаг» между Python и **`external/DataCode`**: Python остаётся оркестратором сессий, Rust — исполнителем горячих участков.
3. **Parity-тесты** как у SQLite: golden-сценарии на входном `.dc` / фрагментах и ожидаемом выводе.
4. **Полная замена Python-интерпретатора** — только после стабильной parity; до тех пор Python-путь остаётся fallback.

## Неимперативное

Перенос формул KPI с браузера описан отдельно в [`rust/dashboard-query/FORMULA_PHASE.md`](../../rust/dashboard-query/FORMULA_PHASE.md) (ветки 4A / 4B); это не замена DataCode DSL.
