# Инвентаризация CPU-heavy путей (Python) для будущего offload в Rust

Документ поддерживает план модульного переноса: кандидаты — **детерминированные**, **масштабируемые по данным** или **парсинг бинарных форматов**. CRUD и простые `select` по ORM остаются в FastAPI до появления узких мест в профилировщике.

## Уже вынесено в Rust

| Область | Python | Rust |
|--------|--------|------|
| SQLite для дашбордов / виджетов | [`src/app/services/sqlite_dashboard_query.py`](../../src/app/services/sqlite_dashboard_query.py) (fallback) | [`rust/dashboard-query/`](../../rust/dashboard-query/) + [`sqlite_query_rust_gateway.py`](../../src/app/services/sqlite_query_rust_gateway.py) |
| Превью табличных файлов (CSV/XLSX/ODS) | — | [`rust/file-pipeline/`](../../rust/file-pipeline/) + [`file_pipeline_rust_gateway.py`](../../src/app/services/file_pipeline_rust_gateway.py) + [`workers/file_import_consumer.py`](../../src/workers/file_import_consumer.py) (`kind: tabular_preview`) |
| Allowlisted отчёты Postgres (сводка time logs по команде) | SQLAlchemy fallback в [`tasks/router.py`](../../src/app/routers/tasks/router.py) | [`rust/task-reporting/`](../../rust/task-reporting/) + [`task_reporting_rust_gateway.py`](../../src/app/services/task_reporting_rust_gateway.py) |
| Очистка моделей (DROP SCHEMA `model_{id}`, rmtree, TTL `files`) | [`delete_data_model`](../../src/core/database/orm/data_model.py) (ORM + fallback rmtree) | [`rust/ScheduleSystem/`](../../rust/ScheduleSystem/) + [`schedule_system_gateway.py`](../../src/app/services/schedule_system_gateway.py) |

## Задачи и учёт времени (teams / tasks / time logs)

**Текущее состояние:** преимущественно ORM-запросы без тяжёлых агрегаций в одном запросе.

| Компонент | Файл | Заметки |
|-----------|------|---------|
| HTTP API | [`src/app/routers/tasks/router.py`](../../src/app/routers/tasks/router.py) | Списки команд, задач, комментариев, CRUD time logs — типичный I/O и простые фильтры. |
| Запросы задач | [`src/core/database/orm/orm_query_task.py`](../../src/core/database/orm/orm_query_task.py) | `get_tasks_by_user` / `get_tasks_by_team` и т.д.; кандидат на Rust **только после** появления отчётов «сводка по N пользователям за период», экспорт в CSV/XLSX с большими выборками. |
| Time logs | [`src/core/database/orm/orm_query_task_time_log.py`](../../src/core/database/orm/orm_query_task_time_log.py) | `GET .../reports/time-logs-summary` при `TASK_REPORTING_RUST__ENABLED` уходит в Rust allowlisted SQL; иначе ORM. Дальнейшие rollup — новые ключи в реестре `task-reporting`. |

**Риск переноса рано:** дублирование правил доступа (команда/менеджер/superuser), см. [`router.py`](../../src/app/routers/tasks/router.py). Rust-сервис отчётов должен получать либо уже **авторизованный** набор параметров (tenant/user scope) из Python, либо дублировать проверки с parity-тестами.

## Импорт файлов и таблицы (data models / documents)

| Компонент | Файл | Заметки |
|-----------|------|---------|
| Загрузка в модель данных | [`src/app/services/data_model_upload_service.py`](../../src/app/services/data_model_upload_service.py) | SHA-256 dedup, транзакции Postgres — остаётся в Python; тяжёлый **парсинг исходного файла** (если делается pandas/openpyxl на больших XLSX) — кандидат в [`rust/file-pipeline/`](../../rust/file-pipeline/). |
| Очередь импорта | [`src/workers/file_import_consumer.py`](../../src/workers/file_import_consumer.py) | При `kind: "tabular_preview"` и `FILE_PIPELINE_RUST__ENABLED` вызывается `normalize_tabular_maybe_rust` (путь к файлу на диске, доступном контейнеру). |
| Маршруты документов | [`src/app/routers/documents/router.py`](../../src/app/routers/documents/router.py) | Метаданные и шаблоны в БД; тяжёлая генерация/конвертация — оценивать по мере появления операций над большими документами. |

## Профилирование (обновлять по мере замеров)

- Backend: `pytest --durations=25`; Prometheus (в т.ч. fallback-метрики gateway).
- Python CPU: при необходимости [py-spy](https://github.com/benfred/py-spy) на долгих запросах (`data_models`, `documents`, `datacode`).
- Кандидаты **после профиля**: [`documents/router.py`](../../src/app/routers/documents/router.py), [`datacode/router.py`](../../src/app/routers/datacode/router.py), SMB.

## Практический порядок дальнейшего переноса

1. Профилировать прод/dev при типичных сценариях (большие дашборды уже закрыты Rust-SQLite).
2. Расширять реестр `task-reporting` только allowlisted SQL + параметры из Python после auth.
3. Углублять `file-pipeline` (стриминг, типы колонок) при росте файлов.

См. также: [`datacode-rust-strategy.md`](datacode-rust-strategy.md), [`rust-full-api-evaluation.md`](rust-full-api-evaluation.md).
