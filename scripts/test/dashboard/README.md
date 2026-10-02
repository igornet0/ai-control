# Dashboard demo / test scripts

Создание **демо-дашборда** с несколькими листами и разнообразными виджетами на данных из `scripts/test/model_data`.

## Предусловия

1. Control-plane (`:8000`) запущен
2. Модель данных создана и (желательно) скомпилирована:

```bash
cd src
poetry run python ../scripts/test/model_data/create_model.py --env dev
# из корня репо:
./scripts/test/model_data/compile_and_stream.sh
```

Нужен файл `scripts/test/model_data/output/credentials.json` с `model_id`.

## Быстрый старт

```bash
# Из корня репо:
./scripts/test/dashboard/create_dashboard.sh --env dev
./scripts/test/dashboard/create_dashboard.sh --env dev --verify

cd src

# Только дашборд (модель уже есть)
poetry run python ../scripts/test/dashboard/create_dashboard.py --env dev
poetry run python ../scripts/test/dashboard/verify_dashboard.py --env dev

# Полный прогон: model + stream/compile + dashboard + verify
poetry run python ../scripts/test/dashboard/run_full_test.py --env dev --with-model
```

## Что создаётся

| Лист | Виджеты |
|------|---------|
| **Overview** | `text`, `html`×2, `kpi`×4, `gauge`×2, `filter`, `button-widget` |
| **QA Expected** | guide `html`, `filter` (order_status / region_id / channel), `kpi`×4, recipe `html`, `table`×5 |
| **Sales** | `bar-chart`×3 (palette/solid/gradient), `line-chart`×2 (area+gradient / spline+points), `pie-chart`×3 (classic + donut) |
| **Operations** | time `line-chart`, `kpi`×2, warehouse `bar-chart`, payments charts + `table` |
| **Catalog** | `table`×4 (products / order_items / orders / customers), `data_input`, `container` |
| **Events** | `text`, `html`, event `pie`/`bar`, `table`×2 |

Привязки к **скомпилированным** колонкам: `orders.order_status` (не `status`), `orders.amount_vat`, `customers.email_address` (не `email`). Таблицы: `orders`, `customers`, `products`, `payments`, `order_items`, `warehouses`, `events`, `regions`, `orders_by_region`, `orders_by_customer`.

### Вкладка QA Expected

Эталон для seed (`build_demo_dataset(seed=42)`) **без** доп. stream. Текст на листе перечисляет сценарии фильтра:

| Фильтр | COUNT | SUM amount |
|--------|------:|-----------:|
| без фильтра / `order_status = active` | 174 | 211157.46 |
| `order_status = pending` | 0 | 0 |
| `region_id = r_nw` | 25 | 24454.83 |
| `channel = web` | 37 | 46075.56 |

AVG amount = 1213.55, SUM amount_vat = 253388.95. Если перед compile гоняли `compile_and_stream.sh`, COUNT будет чуть больше (stream пишет только `status=active`).

Дашборд линкуется к модели: `POST /api/dashboards/{id}/data-models/{model_id}`.

## Файлы

```
scripts/test/dashboard/
  common.py
  fixtures.py            # листы + payload виджетов (styles / chart modes)
  create_dashboard.py
  create_dashboard.sh
  verify_dashboard.py
  run_full_test.py
  output/credentials.json  # gitignored
```

## Результат

`output/credentials.json` содержит `dashboard_id`, `sheet_ids`, `widget_ids`, `model_id`.
