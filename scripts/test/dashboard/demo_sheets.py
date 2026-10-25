"""Showcase sheets of the demo dashboard: Overview, Sales, Operations, Catalog, Events.

Layout: 1520px grid from x=24 (see ``widget_kit.col``). Every sheet has a header
(title + subtitle + navigation), a filter with its own ``filterStyle`` variant,
a KPI row and chart rows of equal height.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from widget_kit import (
    CONTENT_W,
    X0,
    bar,
    buttons,
    col,
    container,
    count,
    dim,
    filter_widget,
    formula_kpi,
    gauge,
    html,
    image,
    kpi,
    line,
    measure,
    nav_button,
    pie,
    refresh_button,
    subtitle,
    table,
    title,
)

PALETTE_OCEAN = ["#0ea5e9", "#22d3ee", "#38bdf8", "#67e8f9", "#a5f3fc", "#0284c7"]
PALETTE_SUNSET = ["#f97316", "#fb923c", "#fbbf24", "#ef4444", "#ec4899", "#a855f7"]
PALETTE_FOREST = ["#10b981", "#34d399", "#059669", "#84cc16", "#14b8a6", "#0d9488"]

# ── vertical rhythm ──
Y_TITLE, H_TITLE = 16, 64
Y_SUB, H_SUB = 84, 60
Y_FILTER, H_FILTER = 160, 96
Y_KPI, H_KPI = 280, 140
Y_ROW1 = 444
H_CHART = 340
Y_ROW2 = Y_ROW1 + H_CHART + 24
Y_ROW3 = Y_ROW2 + H_CHART + 24

NAV = (
    ("overview", "Обзор"),
    ("sales", "Продажи"),
    ("operations", "Операции"),
    ("catalog", "Каталог"),
    ("events", "События"),
    ("qa", "QA"),
    ("bi_features", "BI-формулы"),
)


def _header(key: str, text: str, sub: str, accent: str, sheet_ids: dict[str, int]) -> list[dict[str, Any]]:
    nav_x, nav_w = col(3, 1, span=2)
    items = [nav_button(f"nav_{k}", label, sheet_ids.get(k)) for k, label in NAV if k != key]
    items.append(refresh_button())
    tx, tw = col(3, 0)
    return [
        title("Title", text, (tx, Y_TITLE, tw + 200, H_TITLE), order=0),
        subtitle("Subtitle", sub, (tx, Y_SUB, tw + 200, H_SUB), accent=accent, order=1),
        buttons("Navigation", items, (nav_x + 200, Y_TITLE, nav_w - 200, 88), order=2),
    ]


def _kpi_geom(i: int) -> tuple[int, int, int, int]:
    x, w = col(4, i)
    return x, Y_KPI, w, H_KPI


def _banner_svg() -> str:
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 340'>"
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
        "<stop offset='0' stop-color='#0B1E3F'/><stop offset='1' stop-color='#0E7490'/></linearGradient>"
        "<linearGradient id='l' x1='0' y1='0' x2='1' y2='0'>"
        "<stop offset='0' stop-color='#38BDF8'/><stop offset='1' stop-color='#A5F3FC'/></linearGradient></defs>"
        "<rect width='480' height='340' fill='url(#g)'/>"
        "<g fill='none' stroke='#38BDF8' stroke-opacity='.15'>"
        "<path d='M0 260h480M0 200h480M0 140h480M0 80h480'/></g>"
        "<path d='M24 270 L90 230 L150 245 L210 180 L270 195 L330 120 L390 140 L456 70' "
        "fill='none' stroke='url(#l)' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>"
        "<g fill='#A5F3FC'><circle cx='210' cy='180' r='6'/><circle cx='330' cy='120' r='6'/>"
        "<circle cx='456' cy='70' r='7'/></g>"
        "<text x='24' y='48' font-family='Inter,Arial' font-size='22' font-weight='700' fill='#F8FAFC'>"
        "AI Control · Demo</text>"
        "<text x='24' y='76' font-family='Inter,Arial' font-size='14' fill='#94A3B8'>"
        "Commerce analytics showcase</text></svg>"
    )
    return "data:image/svg+xml;charset=utf-8," + quote(svg)


# ─────────────────────────── Overview ───────────────────────────


def overview_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    ids = sheet_ids or {}
    revenue_src = {"modelId": model_id, "table": "orders", "field": "amount"}
    fx, fw = col(4, 0, span=4)
    out = _header(
        "overview",
        "Commerce Command Center",
        "Ключевые показатели магазина: выручка, заказы, цель и структура продаж. Тема «Ocean», переменные дашборда.",
        "#38BDF8",
        ids,
    )
    out += [
        filter_widget(
            model_id,
            "Global filter",
            "Фильтры",
            [("orders", "channel"), ("orders", "region_id")],
            (fx, Y_FILTER, fw, H_FILTER),
            style={"variant": "glass", "size": "md", "radius": 12, "accent": "#38BDF8", "gap": 12, "layout": "row"},
            order=3,
        ),
        kpi(model_id, "KPI revenue", "Выручка", "orders", "amount", _kpi_geom(0), color="#38BDF8", suffix=" ₽", order=4),
        kpi(model_id, "KPI orders", "Заказы", "orders", "id", _kpi_geom(1), agg="count", color="#F8FAFC", order=5),
        kpi(
            model_id, "KPI avg check", "Средний чек", "orders", "amount", _kpi_geom(2),
            agg="avg", color="#A5F3FC", suffix=" ₽", decimals=1, order=6,
        ),
        formula_kpi(
            "KPI target", "Выполнение плана",
            "SUM([orders.amount]) / @revenue_target * 100", _kpi_geom(3),
            color="#FFFFFF", suffix=" %", decimals=1, data_source=revenue_src, order=7,
            kpiBackgroundMode="rules",
            kpiBackgroundDefaultColor="#1E293B",
            kpiBackgroundRules=[
                {"op": "gte", "valueFormula": "100", "color": "#047857"},
                {"op": "lt", "valueFormula": "100", "color": "#B45309"},
            ],
        ),
    ]
    gx0, gw = col(3, 0)
    gx1, _ = col(3, 1)
    ix, iw = col(3, 2)
    out += [
        gauge(
            "Gauge revenue", "Выручка vs цель", (gx0, Y_ROW1, gw, H_CHART), data_source=revenue_src, order=8,
            valueSource="formula_value", valueFormula="SUM([orders.amount])",
            min=0, max=400000, valueSuffix=" ₽",
            targets=[
                {"id": "t_target", "label": "Цель", "value": 0, "formula": "@revenue_target", "color": "#F59E0B"},
                {"id": "t_stretch", "label": "Stretch", "value": 0, "formula": "@revenue_target * 1.3", "color": "#EF4444"},
            ],
        ),
        gauge(
            "Gauge avg qty", "Среднее кол-во в заказе", (gx1, Y_ROW1, gw, H_CHART),
            data_source={"modelId": model_id, "table": "orders", "field": "qty"}, order=9,
            valueSource="aggregated_value", aggregation="avg", min=0, max=8, valueSuffix=" шт",
        ),
        image("Hero image", _banner_svg(), (ix, Y_ROW1, iw, H_CHART), alt="AI Control demo", fit="cover", order=10),
    ]
    lx, lw = col(3, 0, span=2)
    px, pw = col(3, 2)
    out += [
        line(
            "Revenue trend", "Выручка по дням",
            dim(model_id, "orders", "created_at", "datetime"), measure(model_id, "orders", "amount"),
            (lx, Y_ROW2, lw, H_CHART), order=11,
            chartType="area",
            line={"color": "#38BDF8", "width": 2, "smooth": True,
                  "gradient": {"enabled": True, "from": "#005DFF", "to": "#00E0FF", "mode": "x"}},
            points={"enabled": False},
            crosshair={"enabled": True},
        ),
        pie(
            "Channel donut", "Выручка по каналам",
            dim(model_id, "orders", "channel"), measure(model_id, "orders", "amount"),
            (px, Y_ROW2, pw, H_CHART), order=12,
            donut=True, innerRadius=0.6, legend={"enabled": True},
        ),
    ]
    return out


# ─────────────────────────── Sales ───────────────────────────


def sales_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    revenue_src = {"modelId": model_id, "table": "orders", "field": "amount"}
    fx, fw = col(4, 0, span=4)
    out = _header(
        "sales",
        "Продажи",
        "Три режима цвета столбцов (палитра, сплошной, градиент), area / spline линии, круговая и кольцевая диаграммы.",
        "#F97316",
        sheet_ids or {},
    )
    out += [
        filter_widget(
            model_id, "Sales filter", "Срез продаж",
            [("orders", "channel"), ("orders", "region_id")],
            (fx, Y_FILTER, fw, H_FILTER),
            style={"variant": "outline", "size": "md", "radius": 8, "accent": "#F97316", "gap": 12, "layout": "row"},
            order=3,
        ),
        kpi(model_id, "KPI revenue", "Выручка", "orders", "amount", _kpi_geom(0), color="#F97316", suffix=" ₽", order=4),
        kpi(model_id, "KPI revenue vat", "Выручка с НДС", "orders", "amount_vat", _kpi_geom(1), color="#FBBF24", suffix=" ₽", order=5),
        formula_kpi(
            "KPI vs target", "Выручка vs план", "SUM([orders.amount])", _kpi_geom(2),
            color="#FFFFFF", data_source=revenue_src, order=6,
            kpiBackgroundMode="rules",
            kpiBackgroundDefaultColor="#334155",
            kpiBackgroundRules=[
                {"op": "gte", "valueFormula": "@revenue_target", "color": "#15803D"},
                {"op": "lt", "valueFormula": "@revenue_target", "color": "#B91C1C"},
            ],
        ),
        formula_kpi(
            "KPI web share", "Доля web-канала",
            "SUM([orders.amount] WHERE [orders.channel] = 'web') / SUM([orders.amount]) * 100",
            _kpi_geom(3), color="#EC4899", suffix=" %", decimals=1, data_source=revenue_src, order=7,
        ),
    ]
    amount = measure(model_id, "orders", "amount")
    b = [col(3, i) for i in range(3)]
    out += [
        bar("Bar region", "Выручка по регионам · палитра", dim(model_id, "orders", "region_id"), amount,
            (b[0][0], Y_ROW1, b[0][1], H_CHART), order=8, barColorMode="palette", barPalette=PALETTE_OCEAN),
        bar("Bar channel", "Заказы по каналам · сплошной", dim(model_id, "orders", "channel"), count(model_id, "orders"),
            (b[1][0], Y_ROW1, b[1][1], H_CHART), order=9, barColorMode="solid", barSolidColor="#F97316"),
        bar("Bar avg check", "Средний чек по каналам · градиент", dim(model_id, "orders", "channel"),
            measure(model_id, "orders", "amount", "AVG"),
            (b[2][0], Y_ROW1, b[2][1], H_CHART), order=10, barColorMode="gradient", barPalette=PALETTE_SUNSET),
    ]
    lx, lw = col(2, 0)
    rx, rw = col(2, 1)
    out += [
        line("Area customers", "Выручка по клиентам · area", dim(model_id, "orders", "customer_id"), amount,
             (lx, Y_ROW2, lw, H_CHART), order=11, chartType="area",
             line={"color": "#4DA3FF", "width": 2, "smooth": True,
                   "gradient": {"enabled": True, "from": "#005DFF", "to": "#00E0FF", "mode": "x"}},
             points={"enabled": False}),
        line("Spline category", "Средняя цена по категориям · spline",
             dim(model_id, "products", "category"), measure(model_id, "products", "price", "AVG"),
             (rx, Y_ROW2, rw, H_CHART), order=12, chartType="spline",
             line={"color": "#A78BFA", "width": 3, "smooth": True, "gradient": {"enabled": False}},
             points={"enabled": True, "radius": 4, "color": "#C4B5FD"}),
        pie("Pie method", "Платежи по способам · pie", dim(model_id, "payments", "method"),
            measure(model_id, "payments", "amount"), (lx, Y_ROW3, lw, H_CHART), order=13,
            donut=False, legend={"enabled": True}),
        pie("Donut segment", "Клиенты по сегментам · donut", dim(model_id, "customers", "segment"),
            count(model_id, "customers"), (rx, Y_ROW3, rw, H_CHART), order=14,
            donut=True, innerRadius=0.55, legend={"enabled": True}),
    ]
    return out


# ─────────────────────────── Operations ───────────────────────────


def operations_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    fx, fw = col(4, 0, span=4)
    out = _header(
        "operations",
        "Операции",
        "Временной ряд с зумом и перекрестием, загрузка складов, статусы оплат и журнал платежей.",
        "#10B981",
        sheet_ids or {},
    )
    out += [
        filter_widget(
            model_id, "Payments filter", "Оплаты",
            [("payments", "status"), ("payments", "method")],
            (fx, Y_FILTER, fw, H_FILTER),
            style={"variant": "filled", "size": "md", "radius": 10, "accent": "#10B981", "gap": 12, "layout": "row"},
            order=3,
        ),
        kpi(model_id, "KPI paid", "Сумма платежей", "payments", "amount", _kpi_geom(0), color="#10B981", suffix=" ₽", order=4),
        kpi(model_id, "KPI payments", "Платежей", "payments", "id", _kpi_geom(1), agg="count", order=5),
        kpi(model_id, "KPI qty", "Единиц продано", "orders", "qty", _kpi_geom(2), color="#34D399", suffix=" шт", order=6),
        kpi(model_id, "KPI capacity", "Ёмкость складов", "warehouses", "capacity", _kpi_geom(3), color="#84CC16", order=7),
    ]
    ax, aw = col(1, 0)
    out.append(
        line("Revenue timeline", "Выручка во времени · zoom + crosshair",
             dim(model_id, "orders", "created_at", "datetime"), measure(model_id, "orders", "amount"),
             (ax, Y_ROW1, aw, H_CHART), order=8, chartType="line",
             line={"color": "#22D3EE", "width": 2, "smooth": False, "style": "solid",
                   "gradient": {"enabled": True, "from": "#0891B2", "to": "#67E8F9", "mode": "y"}},
             points={"enabled": False},
             zoom={"enabled": True, "x": True, "y": False},
             crosshair={"enabled": True})
    )
    b = [col(3, i) for i in range(3)]
    out += [
        bar("Bar regions", "Сумма по регионам (view)", dim(model_id, "orders_by_region", "region_id"),
            measure(model_id, "orders_by_region", "region_amount"),
            (b[0][0], Y_ROW2, b[0][1], H_CHART), order=9, barColorMode="palette", barPalette=PALETTE_FOREST),
        bar("Bar warehouses", "Ёмкость складов", dim(model_id, "warehouses", "name"),
            measure(model_id, "warehouses", "capacity"),
            (b[1][0], Y_ROW2, b[1][1], H_CHART), order=10, barColorMode="solid", barSolidColor="#10B981"),
        pie("Donut pay status", "Статусы оплат", dim(model_id, "payments", "status"),
            measure(model_id, "payments", "amount"), (b[2][0], Y_ROW2, b[2][1], H_CHART), order=11,
            donut=True, innerRadius=0.58, legend={"enabled": True}),
        table(model_id, "Payments table", "Журнал платежей", "payments",
              ["id", "order_id", "method", "amount", "status", "paid_at"],
              (X0, Y_ROW3, CONTENT_W, 380), order=12),
    ]
    return out


# ─────────────────────────── Catalog ───────────────────────────

_DATA_INPUT_FIELDS = [
    ("id", "text", True),
    ("customer_id", "text", True),
    ("product_id", "text", True),
    ("qty", "int", True),
    ("amount", "float", True),
    ("status", "text", False),
    ("region_id", "text", False),
    ("channel", "text", False),
    ("created_at", "text", False),
]


def _data_input(model_id: int, geom, order: int) -> dict[str, Any]:
    x, y, w, h = geom
    return {
        "name": "Add order",
        "widget_type": "data_input",
        "data_source": None,
        "data_config": {
            "settings": {
                "title": "Новый заказ",
                "showTitle": True,
                "table": "orders",
                "modelId": model_id,
                "submitLabel": "Сохранить",
                "permissions": {"insert_roles": ["CEO", "Manager"]},
                "fields": [
                    {"name": n, "type": t, "label": n, "required": r} for n, t, r in _DATA_INPUT_FIELDS
                ],
            },
            "styles": {},
        },
        "position_x": x,
        "position_y": y,
        "width": w,
        "height": h,
        "order_index": order,
    }


def catalog_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    fx, fw = col(4, 0, span=4)
    out = _header(
        "catalog",
        "Каталог",
        "Товары и позиции заказов, контейнер с вкладками и форма ввода данных прямо в таблицу модели.",
        "#A855F7",
        sheet_ids or {},
    )
    out += [
        filter_widget(
            model_id, "Catalog filter", "Категория",
            [("products", "category")],
            (fx, Y_FILTER, fw, H_FILTER),
            style={"variant": "underline", "size": "lg", "radius": 0, "accent": "#A855F7", "gap": 16, "layout": "row"},
            order=3,
        ),
        kpi(model_id, "KPI products", "Товаров", "products", "id", _kpi_geom(0), agg="count", order=4),
        kpi(model_id, "KPI avg price", "Средняя цена", "products", "price", _kpi_geom(1),
            agg="avg", color="#C084FC", suffix=" ₽", decimals=1, order=5),
        kpi(model_id, "KPI avg cost", "Средняя себестоимость", "products", "cost", _kpi_geom(2),
            agg="avg", color="#E879F9", suffix=" ₽", decimals=1, order=6),
        kpi(model_id, "KPI lines", "Сумма позиций", "order_items", "line_total", _kpi_geom(3),
            color="#F0ABFC", suffix=" ₽", order=7),
    ]
    tx, tw = col(3, 0, span=2)
    dx, dw = col(3, 2)
    out += [
        table(model_id, "Products table", "Товары", "products", ["id", "name", "category", "price", "cost"],
              (tx, Y_ROW1, tw, 420), order=8),
        _data_input(model_id, (dx, Y_ROW1, dw, 560), order=9),
    ]
    # Container: children live inside the container slots (wired by create_dashboard.py).
    cy = Y_ROW1 + 420 + 24
    cx, cw = col(3, 0, span=2)
    out += [
        container("Catalog tabs", "Структура каталога", ["Bar category", "Donut category", "Catalog note"],
                  (cx, cy, cw, 420), slots_per_tab=1, tab_labels=["Цены", "Категории", "Справка"], order=10),
        bar("Bar category", "Цена товаров", dim(model_id, "products", "name"),
            measure(model_id, "products", "price", "AVG"), (cx, cy + 48, cw, 360), order=11,
            barColorMode="gradient", barPalette=PALETTE_SUNSET, barSort="value_desc"),
        pie("Donut category", "Товары по категориям", dim(model_id, "products", "category"),
            count(model_id, "products"), (cx, cy + 48, cw, 360), order=12,
            donut=True, innerRadius=0.5, legend={"enabled": True}),
        html("Catalog note",
             "<div style=\"font:14px/1.6 Inter,system-ui,sans-serif;color:#CBD5E1;padding:8px 4px\">"
             "<b style=\"color:#F8FAFC\">Как устроен контейнер</b><br>"
             "Виджеты-вкладки живут внутри контейнера: переключайтесь между ними, "
             "а форма справа добавляет заказы в таблицу <code>orders</code> с проверкой ролей."
             "</div>",
             (cx, cy + 48, cw, 360), order=13),
    ]
    return out


# ─────────────────────────── Events ───────────────────────────


def events_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    fx, fw = col(4, 0, span=4)
    out = _header(
        "events",
        "События",
        "Поток событий по типам и каналам, клиенты по регионам и сырые данные событий.",
        "#EC4899",
        sheet_ids or {},
    )
    out += [
        filter_widget(
            model_id, "Events filter", "События",
            [("events", "event_type"), ("events", "channel")],
            (fx, Y_FILTER, fw, H_FILTER),
            style={"variant": "pill", "size": "sm", "radius": 24, "accent": "#EC4899", "gap": 10, "layout": "row"},
            order=3,
        ),
        kpi(model_id, "KPI events", "Событий", "events", "entity_id", _kpi_geom(0), agg="count", color="#EC4899", order=4),
        kpi(model_id, "KPI customers", "Клиентов", "customers", "id", _kpi_geom(1), agg="count", order=5),
        kpi(model_id, "KPI regions", "Регионов", "regions", "id", _kpi_geom(2), agg="count", color="#F9A8D4", order=6),
        kpi(model_id, "KPI order count", "Заказов (view)", "orders_by_customer", "order_count", _kpi_geom(3),
            color="#FBCFE8", order=7),
    ]
    lx, lw = col(3, 0, span=2)
    px, pw = col(3, 2)
    out += [
        line("Events timeline", "События во времени", dim(model_id, "events", "ts", "datetime"),
             count(model_id, "events", "entity_id"), (lx, Y_ROW1, lw, H_CHART), order=8, chartType="spline",
             line={"color": "#EC4899", "width": 2, "smooth": True, "gradient": {"enabled": False}},
             points={"enabled": True, "radius": 3, "color": "#F9A8D4"},
             timeframe={"enabled": True, "id": "1d", "aggregation": "count", "availableIds": ["1h", "1d", "1w"],
                      "barLayout": "row", "barDensity": "compact"},
             crosshair={"enabled": True}),
        pie("Donut channel", "События по каналам", dim(model_id, "events", "channel"),
            count(model_id, "events", "entity_id"), (px, Y_ROW1, pw, H_CHART), order=9,
            donut=True, innerRadius=0.58, legend={"enabled": True}),
    ]
    b0x, b0w = col(2, 0)
    b1x, b1w = col(2, 1)
    out += [
        bar("Bar event type", "События по типам", dim(model_id, "events", "event_type"),
            count(model_id, "events", "entity_id"), (b0x, Y_ROW2, b0w, H_CHART), order=10,
            barColorMode="palette", barPalette=PALETTE_SUNSET),
        bar("Bar customer region", "Клиенты по регионам", dim(model_id, "customers", "region"),
            count(model_id, "customers"), (b1x, Y_ROW2, b1w, H_CHART), order=11,
            barColorMode="solid", barSolidColor="#EC4899"),
        table(model_id, "Events table", "Лента событий", "events",
              ["ts", "event_type", "entity_id", "channel", "payload"],
              (X0, Y_ROW3, CONTENT_W, 380), order=12),
    ]
    return out
