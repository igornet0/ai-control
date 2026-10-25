# Dashboard demo / test scripts

Создание **демо-дашборда** с несколькими листами и разнообразными виджетами на данных из `scripts/test/model_data`.

## Предусловия

1. Control-plane (`:8000`) запущен
2. Модель данных создана и (желательно) скомпилирована:

```bash
cd py-worm
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

cd py-worm

# Только дашборд (модель уже есть)
poetry run python ../scripts/test/dashboard/create_dashboard.py --env dev
poetry run python ../scripts/test/dashboard/verify_dashboard.py --env dev

# Полный прогон: model + stream/compile + dashboard + verify
poetry run python ../scripts/test/dashboard/run_full_test.py --env dev --with-model
```

## Что создаётся

Дашборд из 7 листов и ~95 виджетов, тема `ocean` (`DASHBOARD_THEME` в `fixtures.py`). На каждом листе есть шапка: заголовок `text`, подзаголовок `html` и кнопки навигации и обновления (`button-widget`). У фильтра на каждом листе свой `filterStyle`.

| Лист | Виджеты | Особенности |
|------|---------|-------------|
| **Overview** | `text`, `html`, `button-widget`, `filter`, `kpi`×4, `gauge`×2, `image`, `line-chart`, `pie-chart` | 3 простых KPI и 1 formula KPI с фоном по rules; area line; donut; фильтр **glass** |
| **QA Expected** | `text`, `html`×2, `filter`, `kpi`×4, `table`×5 | эталонные значения (см. ниже) |
| **Sales** | `text`, `html`, `button-widget`, `filter`, `kpi`×4, `bar-chart`×3, `line-chart`×2, `pie-chart`×2 | bar: palette / solid / gradient; line: area / spline; pie: classic / donut; фильтр **outline** |
| **Operations** | `text`, `html`, `button-widget`, `filter`, `kpi`×4, `line-chart`, `bar-chart`×2, `pie-chart`, `table` | time series line (zoom + crosshair); фильтр **filled** |
| **Catalog** | `text`, `html`×2, `button-widget`, `filter`, `kpi`×4, `table`, `data_input`, `container`, `bar-chart`, `pie-chart` | `container` с реальными детьми во вкладках; gradient bar с сортировкой `value_desc`; фильтр **underline** (lg) |
| **Events** | `text`, `html`, `button-widget`, `filter`, `kpi`×4, `line-chart`, `pie-chart`, `bar-chart`×2 | spline line; donut; фильтр **pill** (sm) |
| **BI Features** | `text`, formula `kpi`×8, `gauge` (цели из переменных), `bar-chart`×2, `filter`, explainer `html` | формулы, переменные модели и дашборда, rules |

Какие возможности платформы покрыты:

- **KPI**: простой (`kpiMode: simple`), формульный (`formula`) и с условным фоном по `rules`.
- **Gauge**: цели и пороги, в том числе из переменных.
- **Filter**: варианты `filterStyle` glass / outline / filled / underline / pill.
- **Bar**: palette / solid / gradient.
- **Line**: area / spline / time series.
- **Pie**: classic / donut.
- **Таблицы и ввод данных**: `table`, `data_input`.
- **Контент**: `text`, `html`, `image`.
- **Кнопки**: `navigate` и `refresh`.
- **Container** с дочерними виджетами.
- **Переменные** модели и дашборда.
- **Тема**: `ocean`.

### Вкладка BI Features

Показывает язык формул и переменные. Переменные модели (`create_model.py`): `vat_rate=1.2`, `revenue_target=250000`, `focus_region="r_nw"`. Переменные дашборда (`layout_config.dashboard_variables`): `target_margin=15`, `revenue_target=220000` — перекрывает одноимённую переменную модели.

| KPI | Формула | Что демонстрирует |
|-----|---------|-------------------|
| Revenue incl. VAT | `SUM([orders.amount]) * @vat_rate` | переменная модели |
| SUM WHERE r_nw | `SUM([orders.amount] WHERE [orders.region_id] = 'r_nw')` | локальный WHERE (24454.83 без фильтров) |
| Share, % | `SUM([orders.amount]) / SUM($[orders.amount]) * 100` | `$[...]` — игнор фильтров дашборда |
| Total (ignore filters) | `SUM($[orders.amount])` | не меняется при фильтрах |
| Margin | `SUM([orders.amount]) * @target_margin / 100` | переменная дашборда |
| Revenue vs target | `SUM([orders.amount])` + rules | условные цвета от `@revenue_target` |
| IF progress | `IF(SUM >= @revenue_target, 100, SUM / @revenue_target * 100)` | `IF`, сравнения |
| COUNT web + r_nw | `COUNT([orders.id] WHERE channel = 'web' AND region_id = 'r_nw')` | WHERE с `AND` |

Ограничения языка (на момент написания): `$[...]` принимает только поле; значения в WHERE — только литералы (не `@var`); серия bar/line — один агрегат; деление на 0 роняет всю формулу; неустановленная переменная → «—»; оператора `NOT` нет.

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
  widget_kit.py          # сетка (X0/CONTENT_W/GAP, col()) + билдеры payload виджетов
  demo_sheets.py         # листы Overview / Sales / Operations / Catalog / Events
  fixtures.py            # тема, переменные, листы QA + BI, сборка всех листов
  create_dashboard.py
  create_dashboard.sh
  verify_dashboard.py
  run_full_test.py
  output/credentials.json  # gitignored
```

## Результат

`output/credentials.json` содержит `dashboard_id`, `sheet_ids`, `widget_ids`, `model_id`.
