# DataModelEngine ↔ сервис Datacode (WebSocket)

Версионированный «контракт» на стороне Python задаёт клиент в [src/data_model_engine/engine.py](../../src/data_model_engine/engine.py), сборку DCP-пакетов — [src/data_model_engine/dcp_builder.py](../../src/data_model_engine/dcp_builder.py), конфигурация `DC__*` — [core/settings/config.py](../../src/core/settings/config.py) (`DatacodeConfig`).

## Transport

| Параметр | Значение |
|----------|-----------|
| URL | `ws://{DC__HOST}:{DC__PORT}/` |
| Протокол | `websockets`: **бинарные** кадры для выполнения кода (DCP), **текстовые JSON** для SMB |
| Лимит кадра | `DC__WS_MAX_MESSAGE_BYTES` (переменная в настройках: `ws_max_message_bytes`) |

## Совместимость

- Сервер образа задаётся в [deployment/docker/Dockerfile.datacode-runner](../../../deployment/docker/Dockerfile.datacode-runner): бинарь `datacode`, аргументы в [docker-compose.dev.yml](../../../docker-compose.dev.yml).
- Для экспорта `sqlite_db` в ответе сервер должен запускаться с `--build_model`.
- При смене major-версии бинаря фиксируйте её в этом файле и в changelog образа.

## Протокол выполнения кода (DCP)

JSON-сообщения `execute` и `upload_file` **удалены** на стороне DataCode. Клиент AiControl собирает DCP-пакет через [`datacode-dcp`](https://github.com/igornet0/DCP-python) (`DCPEncoder`) и отправляет его **одним бинарным WebSocket-кадром**.

### Запрос (клиент → сервер)

1. Опционально: JSON text `{"type":"smb_connect", ...}` — подключение к SMB (без изменений).
2. Binary frame: raw `.dcp` bytes (magic `DCPK`):
   - секция **CODE** — Datacode-скрипт;
   - секции **ASSET** — path-based файлы из `files` (пути совпадают с `path("...")` в коде);
   - content-addressed **ASSET** (`assets/{sha256}`) через `DCPEncoder.put_asset` / `content_assets`;
   - метаданные assets в `__asset_index__`; в таблицах — UTF-8 значения `asset://{sha256}`;
   - опционально **ARROW_TABLE** / **SQL** для `source_table` materialize;
   - опционально **METADATA** (`{"source": "aicontrol"}`);
   - при сборке модели — **CONFIG** (`__config__`, `{"fk_check":"warn"}`). Без секции сервер `--build_model` остаётся в `strict`.

Сборка: `build_dcp_package(code, files, sql_scripts=..., tables=..., content_assets=..., fk_check=...)` в [dcp_builder.py](../../src/data_model_engine/dcp_builder.py).

### FK check (`__config__`)

Режим проверки FK задаётся в DCP, флаг сервера не меняется.

| режим | FK в DDL | сироты | экспорт |
|-------|----------|--------|---------|
| `strict` (по умолчанию, нет секции) | все `relate` | нет | fail |
| `warn` | только выполняемые | да, без сломанного FK | ok + `warning` |
| `skip` | все `relate` | да | ok, БД с нарушениями |

`compile-model` / smart compile всегда кодируют `fk_check=warn`. В JSON-ответе при `success: true` может быть поле `warning` (sqlite всё равно сохраняется). Редактор / widget execute секцию не добавляет.

### Content-addressed assets (`asset://`)

Общие бинарные ресурсы (image / pdf / audio / video / file), id = SHA-256 hex содержимого.
Хранилище модели: `{DATA_MODELS_DIR}/{model_id}/assets/{sha}` + `index.json`.

| API | Путь |
|-----|------|
| Control plane | `POST/GET /api/data-models/{id}/assets`, `GET .../assets/{sha}` |
| Developer API | `POST/GET /api/v1/assets`, `GET /api/v1/assets/{sha}` |

При compile ссылки `asset://` из кода/SQL/Arrow и DataBridge (avatars) собираются в `content_assets` → `put_asset`. Лимит размера одного asset ≈ 10 МБ (`MAX_DATACODE_FILE_UPLOAD_BYTES`).

Эталонный клиент: [external/DataCode/examples/en/07-websocket/python/test_dcp_run.py](../../../external/DataCode/examples/en/07-websocket/python/test_dcp_run.py).

### Ответ (сервер → клиент)

JSON text:

```json
{
  "success": true,
  "output": "...",
  "error": null,
  "sqlite_db": "<base64, optional>"
}
```

Метод `execute_code(code, files=...)` возвращает этот dict; [data_model_compile_service.py](../../src/app/services/data_model_compile_service.py) извлекает `sqlite_db` при сборке модели дашборда.

## Материализация источников в DCP

API / JSON / DataBridge источники для `source_table(...)` передаются в DCP **только как Arrow tables**.
SQL-скрипты (`CREATE TABLE` / `INSERT`) для этих источников **не** инжектятся: при расхождении схемы
`CREATE TABLE IF NOT EXISTS` ломал компиляцию (например `table customers has no column named email`).

Сборщики:

| Источник | Модуль |
|----------|--------|
| API ingest | [api_rehydrate_service.py](../../src/app/services/api_rehydrate_service.py) `build_dcp_api_source_payload` |
| JSON widget | [json_source_dcp.py](../../src/app/services/json_source_dcp.py) |
| DataBridge `platform_*` | [databridge/dcp_payload.py](../../src/app/services/databridge/dcp_payload.py) |
| Виджет «Модель данных» (таблицы другой модели) | [linked_model_dcp.py](../../src/app/services/linked_model_dcp.py) `build_dcp_linked_model_payload` |

Виджет `data-model` больше не sink и не обязателен для compile. Он импортирует выбранные таблицы из личной или опубликованной модели (`source_table` + Arrow из `latest.db` той модели).

Порядок merge Datacode виджетов — по DAG связей модели (`data_model.relationships`), см.
[widget_dependency_graph.py](../../src/app/services/widget_dependency_graph.py).

## Умная компиляция после ingest

После успешного deploy ingest в `latest.db` ([ingest_deploy_queue.py](../../src/app/services/ingest_deploy_queue.py)):

1. Если у таблицы **нет** downstream processing/formula/relationship — только ingest (как раньше).
2. Если есть зависимости — задача в [smart_compile_queue.py](../../src/app/services/smart_compile_queue.py):
   - подграф виджетов ([widget_table_graph.py](../../src/app/services/widget_table_graph.py));
   - partial DataCode + Arrow DCP;
   - замена **только затронутых таблиц** в `latest.db` ([sqlite_table_merge.py](../../src/app/services/sqlite_table_merge.py)).

Полная сборка по кнопке («Собрать модель») по-прежнему перезаписывает `latest.db` целиком и делает post-compile rehydrate API-таблиц.

Настройки очереди: `API_SERVICE__SMART_COMPILE_WORKER_COUNT`, `API_SERVICE__SMART_COMPILE_QUEUE_MAX_SIZE`.

## SMB (без изменений)

Текстовые JSON-кадры: `smb_connect`, `smb_list_files`, `smb_read_file`. Перед DCP-выполнением при compile-model вызывается `smb_connect` для каждой настроенной SMB-шары.

## Зависимости

| Пакет | Назначение |
|-------|------------|
| `websockets` | WebSocket-клиент |
| `datacode-dcp` | Кодирование DCP-пакетов (`DCPEncoder`) |

Декодирование DCP на сервере выполняет Rust-модуль `data_code::dcp` внутри бинаря `datacode`.
