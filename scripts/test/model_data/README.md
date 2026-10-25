# Data Model Integration / Demo Fixtures

Скрипты для программного создания **демо-модели** с API-источниками, стриминга данных и проверки пайплайна (ingest → deploy → compile → SQLite).

## Что покрывается

| Компонент | Покрытие |
|-----------|----------|
| API-источники | `regions`, `warehouses`, `customers`, `customer_profiles`, `products` (snapshot); `orders`, `payments` (stream); `order_items` (snapshot); `events` (append) |
| Seed | детерминированный `build_demo_dataset()` (~40 customers + 1:1 profiles, ~25 products, ~400 orders, ~600 line items, ~350 payments, ~80 events) |
| Виджеты | 9× `data-source`, filter, transform×2, formula, aggregate×2, relationship×6 (1:1, 1:N, N:M) |
| DataCode | `source_table`, filter, `.map`/`.rename`, `add_column`, `aggregate_group`, `primary_key`/`relate`/`left_join` |
| Связи | canvas edges + join metadata + relationship widgets: 1:1, 1:N, N:M |
| Developer API | `/api/v1/ingest`, status, detail |
| Control plane | widgets, code, relationships, compile-model, sqlite schema |

## Pipeline модели

```
orders ──► filter ──► transform ──► formula ──► aggregate (by customer)
  │                                    │
  │                                    └──► aggregate (by region)
  │
  ├──── products ──► relationship 1:N (orders_products)
  ├──── payments ──► relationship 1:N (orders_payments)
  ├──── products + order_items ──► relationship N:M (orders ↔ products via order_items)
  │
customers ──► transform ──► relationship 1:N (orders_customers)
                     └──► relationship 1:1 (customer_profiles)
customer_profiles ──► relationship 1:1
regions + warehouses ──► relationship 1:N
events (append, parallel)
```

## Типы связей (relationship widgets)

| Тип | Виджет | DataCode |
|-----|--------|----------|
| 1:1 | Customers → Profiles | `relate(customers["id"], customer_profiles["customer_id"])` |
| 1:N | Customers → Orders, Products → Orders, Orders → Payments, Regions → Warehouses | `relate(PK, FK…)` |
| N:M | Orders ↔ Products | два блока через junction `order_items`: `relate(orders["id"], order_items["order_id"])` и `relate(products["id"], order_items["product_id"])` |

N:M в настройках виджета: левый PK, правый PK, промежуточная таблица и два FK на неё.

## Предусловия

1. Запущены сервисы:
   - `run_app.py` — control-plane (порт **8000**)
   - `run_api.py` — developer API (порт **8002**)
2. DataCode engine (WebSocket) доступен
3. PostgreSQL + API persistent store настроены
4. Admin-пользователь из `APP__FIRST_SUPERUSER` / `APP__FIRST_SUPERUSER_PASSWORD`

## Быстрый старт

```bash
cd py-worm

# Полный прогон: create → ingest → verify
poetry run python ../scripts/test/model_data/run_full_test.py --env dev

# Или по шагам:
poetry run python ../scripts/test/model_data/create_model.py --env dev
poetry run python ../scripts/test/model_data/stream_data.py --env dev
poetry run python ../scripts/test/model_data/verify_model.py --env dev
```

### `compile_and_stream.sh`

Сначала **ingest**, потом **compile** (нужен `output/credentials.json`).

```bash
./scripts/test/model_data/compile_and_stream.sh
./scripts/test/model_data/compile_and_stream.sh --stream --iterations 10
```

## Файлы

```
scripts/test/model_data/
  common.py
  fixtures.py         # схема, seed, виджеты, DataCode
  create_model.py
  stream_data.py
  verify_model.py
  run_full_test.py
  output/             # credentials.json (gitignored)
```

## После компиляции (seed, без extra stream)

DataCode:

1. `orders = orders[("status" == "active")]` — в SQLite остаются только active
2. transform: `amount` → float, `status` → `order_status`
3. formula: `amount_vat = amount * 1.2`
4. customers: `name` trim+upper, `email` → `email_address`

| Таблица | Колонки после compile | Seed rows |
|---------|----------------------|----------:|
| `orders` | id, customer_id, product_id, qty, amount, **order_status**, region_id, channel, created_at, **amount_vat** | 174 (из 400) |
| `customers` | id, name, **email_address**, segment, region, created_at | 40 |

Эталон KPI (см. `expected_compiled_snapshot()`): COUNT 174, SUM amount 211157.46, AVG 1213.55, SUM amount_vat 253388.95.

Фильтры для вкладки QA дашборда: `region_id=r_nw` → 25 / 24454.83; `channel=web` → 37 / 46075.56; `order_status=pending` → 0 (вырезан на compile).

`fk_check=warn`: `order_items` не фильтруется вместе с `orders`, поэтому orphans `order_items.order_id → orders(id)` — ожидаемое предупреждение, не ошибка.

## Связанные скрипты

- `scripts/test/dashboard/` — демо-дашборд на этой модели (вкладка **QA Expected**)
- `src/scripts/seed_api_model_and_keys.py` — минимальный seed одной таблицы
