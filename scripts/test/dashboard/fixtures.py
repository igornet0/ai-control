"""Demo dashboard sheets and widget fixtures bound to model_data tables."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

_MODEL_DATA_FIXTURES = Path(__file__).resolve().parent.parent / "model_data" / "fixtures.py"
_model_data_mod = None


def _model_data_fixtures():
    global _model_data_mod
    if _model_data_mod is not None:
        return _model_data_mod
    spec = importlib.util.spec_from_file_location("model_data_seed_fixtures", _MODEL_DATA_FIXTURES)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {_MODEL_DATA_FIXTURES}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    _model_data_mod = mod
    return mod


def _fmt_num(value: float | int) -> str:
    if isinstance(value, int) or (isinstance(value, float) and value == int(value)):
        return f"{int(value):,}".replace(",", " ")
    return f"{value:,.2f}".replace(",", " ")


def _qa_guide_html(snap: dict[str, Any]) -> str:
    orders = snap["orders"]
    none = snap["filters"]["none"]
    nw = snap["filters"]["region_r_nw"]
    web = snap["filters"]["channel_web"]
    pending = snap["filters"]["order_status_pending"]
    active = snap["filters"]["order_status_active"]
    cols = ", ".join(snap["orders_columns"])
    return (
        "<div style='padding:16px 18px;color:#e2e8f0;font:13px/1.55 \"IBM Plex Sans\",sans-serif'>"
        "<div style='font:700 16px/1.3 Space Grotesk,sans-serif;color:#FBBF24;margin-bottom:8px'>"
        "После компиляции модели (seed, без доп. stream)</div>"
        "<p style='margin:0 0 10px;color:#cbd5e1'>"
        "Фильтр DataCode оставляет только <code>status == active</code>, затем "
        "<code>status → order_status</code>, добавляется <code>amount_vat = amount * 1.2</code>. "
        f"Исходных заказов {snap['seed_orders']}, в SQLite таблице <code>orders</code> — "
        f"<b>{orders['count']}</b> строк. Колонки: <code>{cols}</code>."
        "</p>"
        "<p style='margin:0 0 8px;color:#94a3b8'>Справа фильтры крутят KPI и таблицу Orders. Сценарии:</p>"
        "<ol style='margin:0 0 0 18px;color:#e2e8f0'>"
        f"<li><b>Без фильтра</b> — COUNT = {_fmt_num(none['count'])}, "
        f"SUM amount = {_fmt_num(none['sum_amount'])}, "
        f"AVG = {_fmt_num(none['avg_amount'])}, "
        f"SUM amount_vat = {_fmt_num(none['sum_amount_vat'])}.</li>"
        f"<li><b>order_status = active</b> — то же самое "
        f"(COUNT {_fmt_num(active['count'])}): в скомпилированной таблице другого статуса нет.</li>"
        f"<li><b>order_status = pending</b> — COUNT = 0, SUM = 0. "
        f"{pending.get('note') or 'pending вырезан на compile.'}</li>"
        f"<li><b>region_id = r_nw</b> — COUNT = {_fmt_num(nw['count'])}, "
        f"SUM amount = {_fmt_num(nw['sum_amount'])}.</li>"
        f"<li><b>channel = web</b> — COUNT = {_fmt_num(web['count'])}, "
        f"SUM amount = {_fmt_num(web['sum_amount'])}.</li>"
        "</ol>"
        "<p style='margin:10px 0 0;color:#64748b;font-size:12px'>"
        "Если перед compile гоняли stream, числа будут чуть больше (новые active-заказы). "
        "Эта вкладка рассчитана на seed ingest + compile."
        "</p></div>"
    )


def _field_ref(model_id: int, table: str, field: str, *, ftype: str = "text") -> dict[str, Any]:
    return {
        "modelId": model_id,
        "table": table,
        "field": field,
        "type": ftype,
        "formula": f"[{table}.{field}]",
    }


def _measure_ref(model_id: int, table: str, field: str, *, agg: str = "SUM", ftype: str = "float") -> dict[str, Any]:
    return {
        "modelId": model_id,
        "table": table,
        "field": field,
        "type": ftype,
        "formula": f"{agg}([{table}.{field}])",
    }


def _count_ref(model_id: int, table: str, field: str = "id") -> dict[str, Any]:
    return {
        "modelId": model_id,
        "table": table,
        "field": field,
        "type": "float",
        "formula": f"COUNT([{table}.{field}])",
    }


PALETTE_OCEAN = ["#0ea5e9", "#22d3ee", "#38bdf8", "#67e8f9", "#a5f3fc", "#0284c7"]
PALETTE_SUNSET = ["#f97316", "#fb923c", "#fbbf24", "#ef4444", "#ec4899", "#a855f7"]
PALETTE_FOREST = ["#10b981", "#34d399", "#059669", "#84cc16", "#14b8a6", "#0d9488"]


if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from demo_sheets import (  # noqa: E402
    catalog_widgets,
    events_widgets,
    operations_widgets,
    overview_widgets,
    sales_widgets,
)

DASHBOARD_THEME = {"preset": "ocean", "overrides": {}}

def qa_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet: tables + KPIs + filters + expected values after compile."""
    snap = _model_data_fixtures().expected_compiled_snapshot()
    orders = snap["orders"]
    nw = snap["filters"]["region_r_nw"]
    web = snap["filters"]["channel_web"]
    pending = snap["filters"]["order_status_pending"]

    return [
        {
            "name": "QA title",
            "widget_type": "text",
            "data_source": None,
            "data_config": {
                "settings": {
                    "mode": "static",
                    "text": "QA · expected after compile",
                    "fontSize": 24,
                    "color": "#F8FAFC",
                    "fontWeight": "700",
                },
                "styles": {},
            },
            "position_x": 24,
            "position_y": 16,
            "width": 520,
            "height": 52,
            "order_index": 0,
        },
        {
            "name": "QA guide",
            "widget_type": "html",
            "data_source": None,
            "data_config": {
                "settings": {"html": _qa_guide_html(snap)},
                "styles": {},
            },
            "position_x": 24,
            "position_y": 76,
            "width": 1520,
            "height": 340,
            "order_index": 1,
        },
        {
            "name": "QA filters",
            "widget_type": "filter",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Filters (orders)",
                    "showTitle": True,
                    "filters": [
                        {
                            "id": "qa_status",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "order_status",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                        {
                            "id": "qa_region",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "region_id",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                        {
                            "id": "qa_channel",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "channel",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                    ],
                },
                "styles": {},
            },
            "position_x": 24,
            "position_y": 430,
            "width": 320,
            "height": 350,
            "order_index": 2,
        },
        {
            "name": "QA KPI count",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "id"},
            "data_config": {
                "settings": {
                    "title": f"Orders COUNT  (expect {orders['count']})",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "count",
                    "format": "number",
                    "decimals": 0,
                },
                "styles": {"typography": {"color": "#A78BFA"}},
            },
            "position_x": 364,
            "position_y": 430,
            "width": 280,
            "height": 140,
            "order_index": 3,
        },
        {
            "name": "QA KPI sum",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": f"SUM amount  (expect {_fmt_num(orders['sum_amount'])})",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 2,
                },
                "styles": {"typography": {"color": "#38BDF8"}},
            },
            "position_x": 664,
            "position_y": 430,
            "width": 280,
            "height": 140,
            "order_index": 4,
        },
        {
            "name": "QA KPI avg",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": f"AVG amount  (expect {_fmt_num(orders['avg_amount'])})",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "avg",
                    "format": "number",
                    "decimals": 2,
                },
                "styles": {"typography": {"color": "#34D399"}},
            },
            "position_x": 964,
            "position_y": 430,
            "width": 280,
            "height": 140,
            "order_index": 5,
        },
        {
            "name": "QA KPI vat",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount_vat"},
            "data_config": {
                "settings": {
                    "title": f"SUM amount_vat  (expect {_fmt_num(orders['sum_amount_vat'])})",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 2,
                },
                "styles": {"typography": {"color": "#FBBF24"}},
            },
            "position_x": 1264,
            "position_y": 430,
            "width": 280,
            "height": 140,
            "order_index": 6,
        },
        {
            "name": "QA filter recipes",
            "widget_type": "html",
            "data_source": None,
            "data_config": {
                "settings": {
                    "html": (
                        "<div style='padding:12px 14px;color:#e2e8f0;font:12.5px/1.5 \"IBM Plex Sans\",sans-serif'>"
                        "<b style='color:#67e8f9'>Что выбрать в фильтре → что ждать в KPI</b>"
                        "<table style='width:100%;margin-top:8px;border-collapse:collapse;color:#cbd5e1'>"
                        "<tr style='color:#94a3b8'><th align='left'>Фильтр</th><th align='right'>COUNT</th>"
                        "<th align='right'>SUM amount</th></tr>"
                        f"<tr><td>region_id = r_nw</td><td align='right'>{nw['count']}</td>"
                        f"<td align='right'>{_fmt_num(nw['sum_amount'])}</td></tr>"
                        f"<tr><td>channel = web</td><td align='right'>{web['count']}</td>"
                        f"<td align='right'>{_fmt_num(web['sum_amount'])}</td></tr>"
                        f"<tr><td>order_status = pending</td><td align='right'>{pending['count']}</td>"
                        f"<td align='right'>{_fmt_num(pending['sum_amount'])}</td></tr>"
                        "</table>"
                        "<p style='margin:8px 0 0;color:#64748b'>Снимите фильтр — KPI снова как в заголовках карточек.</p>"
                        "</div>"
                    ),
                },
                "styles": {},
            },
            "position_x": 364,
            "position_y": 590,
            "width": 1180,
            "height": 212,
            "order_index": 7,
        },
        {
            "name": "QA orders table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "orders"},
            "data_config": {
                "settings": {
                    "title": "orders (compiled)",
                    "showTitle": True,
                    "maxRows": 80,
                    "bindingFields": [
                        {"modelId": model_id, "table": "orders", "field": "id"},
                        {"modelId": model_id, "table": "orders", "field": "customer_id"},
                        {"modelId": model_id, "table": "orders", "field": "amount"},
                        {"modelId": model_id, "table": "orders", "field": "order_status"},
                        {"modelId": model_id, "table": "orders", "field": "region_id"},
                        {"modelId": model_id, "table": "orders", "field": "channel"},
                        {"modelId": model_id, "table": "orders", "field": "amount_vat"},
                    ],
                },
                "styles": {},
            },
            "position_x": 24,
            "position_y": 822,
            "width": 760,
            "height": 340,
            "order_index": 8,
        },
        {
            "name": "QA by region table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "orders_by_region"},
            "data_config": {
                "settings": {
                    "title": "orders_by_region (aggregate)",
                    "showTitle": True,
                    "maxRows": 50,
                    "bindingFields": [
                        {"modelId": model_id, "table": "orders_by_region", "field": "region_id"},
                        {"modelId": model_id, "table": "orders_by_region", "field": "region_amount"},
                        {"modelId": model_id, "table": "orders_by_region", "field": "region_orders"},
                    ],
                },
                "styles": {},
            },
            "position_x": 804,
            "position_y": 822,
            "width": 360,
            "height": 340,
            "order_index": 9,
        },
        {
            "name": "QA by customer table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "orders_by_customer"},
            "data_config": {
                "settings": {
                    "title": "orders_by_customer (aggregate)",
                    "showTitle": True,
                    "maxRows": 50,
                    "bindingFields": [
                        {"modelId": model_id, "table": "orders_by_customer", "field": "customer_id"},
                        {"modelId": model_id, "table": "orders_by_customer", "field": "total_amount"},
                        {"modelId": model_id, "table": "orders_by_customer", "field": "order_count"},
                    ],
                },
                "styles": {},
            },
            "position_x": 1184,
            "position_y": 822,
            "width": 360,
            "height": 340,
            "order_index": 10,
        },
        {
            "name": "QA customers table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "customers"},
            "data_config": {
                "settings": {
                    "title": "customers (name UPPER, email_address)",
                    "showTitle": True,
                    "maxRows": 50,
                    "bindingFields": [
                        {"modelId": model_id, "table": "customers", "field": "id"},
                        {"modelId": model_id, "table": "customers", "field": "name"},
                        {"modelId": model_id, "table": "customers", "field": "email_address"},
                        {"modelId": model_id, "table": "customers", "field": "segment"},
                        {"modelId": model_id, "table": "customers", "field": "region"},
                    ],
                },
                "styles": {},
            },
            "position_x": 24,
            "position_y": 1182,
            "width": 760,
            "height": 280,
            "order_index": 11,
        },
        {
            "name": "QA products table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "products"},
            "data_config": {
                "settings": {
                    "title": "products (25 rows, 5 categories)",
                    "showTitle": True,
                    "maxRows": 50,
                    "bindingFields": [
                        {"modelId": model_id, "table": "products", "field": "id"},
                        {"modelId": model_id, "table": "products", "field": "name"},
                        {"modelId": model_id, "table": "products", "field": "category"},
                        {"modelId": model_id, "table": "products", "field": "price"},
                    ],
                },
                "styles": {},
            },
            "position_x": 804,
            "position_y": 1182,
            "width": 740,
            "height": 280,
            "order_index": 12,
        },
    ]


# Dashboard-level variables (layout_config.dashboard_variables); override model vars with the same name.
DASHBOARD_VARIABLES = [
    {
        "name": "target_margin",
        "type": "Number",
        "value": 15,
        "description": "Target margin, % (dashboard variable)",
    },
    {
        "name": "revenue_target",
        "type": "Number",
        "value": 220000,
        "description": "Overrides model variable revenue_target=250000",
    },
]


def _formula_kpi(
    model_id: int,
    *,
    name: str,
    title: str,
    formula: str,
    color: str,
    x: int,
    y: int,
    order: int,
    decimals: int = 0,
    suffix: str = " ₽",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings: dict[str, Any] = {
        "title": title,
        "showTitle": True,
        "titleSize": 12,
        "titleColor": "#94A3B8",
        "kpiMode": "formula",
        "valueFormula": formula,
        "format": "number",
        "decimals": decimals,
        "valueSuffix": suffix,
    }
    if extra:
        settings.update(extra)
    return {
        "name": name,
        "widget_type": "kpi",
        "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
        "data_config": {
            "settings": settings,
            "styles": {"typography": {"color": color, "fontWeight": "700"}},
        },
        "position_x": x,
        "position_y": y,
        "width": 290,
        "height": 140,
        "order_index": order,
    }


def bi_features_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet: formula language, model/dashboard variables, conditional colors, gauge targets."""
    dim_region = _field_ref(model_id, "orders", "region_id")
    dim_channel = _field_ref(model_id, "orders", "channel")
    meas_vat = {
        **_measure_ref(model_id, "orders", "amount_vat", agg="SUM"),
        "formula": "SUM([orders.amount_vat])",
    }
    # Bar-chart series accept only a single aggregate; composite formulas
    # (SUM(a) * @var, SUM(a) / SUM($[a])) are for KPI / Gauge / Reference.
    meas_orders = _measure_ref(model_id, "orders", "id", agg="COUNT")
    explainer = (
        "<div style='padding:12px 16px;color:#e2e8f0;font:13px/1.55 \"IBM Plex Sans\",sans-serif'>"
        "<b style='color:#FBBF24'>Как это устроено</b>"
        "<ul style='margin:6px 0 0 18px;color:#cbd5e1'>"
        "<li><code>[orders.amount]</code> — поле модели; <code>SUM/AVG/COUNT</code> — агрегаты</li>"
        "<li><code>@vat_rate</code> — переменная модели; "
        "<code>@target_margin</code> — переменная дашборда</li>"
        "<li><code>@revenue_target</code> задан в модели (250 000) и переопределён дашбордом (220 000)</li>"
        "<li><code>SUM($[orders.amount])</code> — поле в <code>$[...]</code> считается без учёта фильтров</li>"
        "<li><code>SUM(x WHERE a = 'v' AND c = 'w')</code>, <code>IF(cond, a, b)</code>; "
        "в WHERE — только литералы (число или строка в кавычках)</li>"
        "<li>Серия bar/line — одно поле или один агрегат; составные формулы — в KPI / Gauge</li>"
        "<li>Фон KPI «vs target» — правила по формуле; на gauge — цель из переменной</li>"
        "</ul>"
        "<div style='margin-top:6px;color:#64748b;font-size:12px'>"
        "Выберите регион/канал в фильтре: обычные KPI меняются, «Share of total» — тоже, "
        "а «Total (ignore filters)» остаётся неизменным.</div></div>"
    )

    return [
        {
            "name": "BI title",
            "widget_type": "text",
            "data_source": None,
            "data_config": {
                "settings": {
                    "mode": "static",
                    "text": "BI Features: formulas & variables",
                    "fontSize": 26,
                    "color": "#F8FAFC",
                    "fontWeight": "700",
                },
                "styles": {"typography": {"fontFamily": "Space Grotesk", "color": "#F8FAFC"}},
            },
            "position_x": 24,
            "position_y": 20,
            "width": 620,
            "height": 60,
            "order_index": 0,
        },
        _formula_kpi(
            model_id,
            name="Revenue incl. VAT (formula)",
            title="SUM(amount) * @vat_rate",
            formula="SUM([orders.amount]) * @vat_rate",
            color="#38BDF8",
            x=40,
            y=100,
            order=1,
        ),
        _formula_kpi(
            model_id,
            name="Focus region revenue",
            title="SUM(amount WHERE region = 'r_nw')",
            formula="SUM([orders.amount] WHERE [orders.region_id] = 'r_nw')",
            color="#A78BFA",
            x=350,
            y=100,
            order=2,
        ),
        _formula_kpi(
            model_id,
            name="Share of total",
            title="Share of total, % (SUM / SUM($[amount]))",
            formula="SUM([orders.amount]) / SUM($[orders.amount]) * 100",
            color="#34D399",
            x=660,
            y=100,
            order=3,
            decimals=1,
            suffix=" %",
        ),
        _formula_kpi(
            model_id,
            name="Total ignore filters",
            title="Total (ignore filters)",
            formula="SUM($[orders.amount])",
            color="#F8FAFC",
            x=970,
            y=100,
            order=4,
        ),
        _formula_kpi(
            model_id,
            name="Margin (dashboard var)",
            title="Margin = SUM * @target_margin / 100",
            formula="SUM([orders.amount]) * @target_margin / 100",
            color="#FBBF24",
            x=40,
            y=260,
            order=5,
        ),
        _formula_kpi(
            model_id,
            name="Revenue vs target",
            title="Revenue vs @revenue_target (rules)",
            formula="SUM([orders.amount])",
            color="#FFFFFF",
            x=350,
            y=260,
            order=6,
            extra={
                "kpiBackgroundMode": "rules",
                "kpiBackgroundDefaultColor": "#334155",
                "kpiBackgroundRules": [
                    {"op": "gte", "valueFormula": "@revenue_target", "color": "#15803d"},
                    {"op": "lt", "valueFormula": "@revenue_target", "color": "#b91c1c"},
                ],
            },
        ),
        _formula_kpi(
            model_id,
            name="Target attainment",
            title="IF(SUM >= target, 100, SUM / target * 100)",
            formula=(
                "IF(SUM([orders.amount]) >= @revenue_target, 100, "
                "SUM([orders.amount]) / @revenue_target * 100)"
            ),
            color="#F472B6",
            x=660,
            y=260,
            order=7,
            decimals=1,
            suffix=" %",
        ),
        _formula_kpi(
            model_id,
            name="Web + focus region",
            title="COUNT(id WHERE channel = 'web' AND region = 'r_nw')",
            formula=(
                "COUNT([orders.id] WHERE [orders.channel] = 'web' "
                "AND [orders.region_id] = 'r_nw')"
            ),
            color="#22D3EE",
            x=970,
            y=260,
            order=8,
            suffix="",
        ),
        {
            "name": "Revenue vs target gauge",
            "widget_type": "gauge",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Revenue vs target (@revenue_target)",
                    "showTitle": True,
                    "valueSource": "formula_value",
                    "valueFormula": "SUM([orders.amount])",
                    "min": 0,
                    "max": 400000,
                    "valueFormat": "number",
                    "valueSuffix": " ₽",
                    "targets": [
                        {
                            "id": "t_target",
                            "label": "Target",
                            "value": 0,
                            "formula": "@revenue_target",
                            "color": "#F59E0B",
                        },
                        {
                            "id": "t_vat",
                            "label": "Target × VAT",
                            "value": 0,
                            "formula": "@revenue_target * @vat_rate",
                            "color": "#EF4444",
                        },
                    ],
                },
                "styles": {},
            },
            "position_x": 24,
            "position_y": 420,
            "width": 320,
            "height": 260,
            "order_index": 9,
        },
        {
            "name": "Revenue incl. VAT by region",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "SUM(amount_vat) by region",
                    "showTitle": True,
                    "titleColor": "#67E8F9",
                    "bindingDimension": dim_region,
                    "bindingMeasure": meas_vat,
                    "barColorMode": "palette",
                    "barPalette": PALETTE_FOREST,
                },
                "styles": {},
            },
            "position_x": 364,
            "position_y": 420,
            "width": 440,
            "height": 260,
            "order_index": 10,
        },
        {
            "name": "Orders by channel",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Orders by channel (COUNT)",
                    "showTitle": True,
                    "bindingDimension": dim_channel,
                    "bindingMeasure": meas_orders,
                    "barColorMode": "gradient",
                    "barPalette": PALETTE_SUNSET,
                },
                "styles": {},
            },
            "position_x": 824,
            "position_y": 420,
            "width": 720,
            "height": 260,
            "order_index": 11,
        },
        {
            "name": "BI filters",
            "widget_type": "filter",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Filters (try region / channel)",
                    "showTitle": True,
                    "filters": [
                        {
                            "id": "bi_region",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "region_id",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                        {
                            "id": "bi_channel",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "channel",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                    ],
                },
                "styles": {},
            },
            "position_x": 1264,
            "position_y": 100,
            "width": 300,
            "height": 300,
            "order_index": 12,
        },
        {
            "name": "BI explainer",
            "widget_type": "html",
            "data_source": None,
            "data_config": {"settings": {"html": explainer}, "styles": {}},
            "position_x": 24,
            "position_y": 704,
            "width": 1520,
            "height": 270,
            "order_index": 13,
        },
    ]


# Backward-compatible aliases used by older create_dashboard imports
def charts_widgets(model_id: int) -> list[dict[str, Any]]:
    return sales_widgets(model_id)


def data_widgets(model_id: int) -> list[dict[str, Any]]:
    return catalog_widgets(model_id)


def expected_compiled_snapshot() -> dict[str, Any]:
    return _model_data_fixtures().expected_compiled_snapshot()


def expected_widget_types() -> set[str]:
    return {
        "text",
        "kpi",
        "gauge",
        "filter",
        "html",
        "button-widget",
        "bar-chart",
        "line-chart",
        "pie-chart",
        "table",
        "data_input",
        "container",
        "image",
    }


SHEET_SPECS = (
    {"key": "overview", "name": "Overview", "description": "Hero KPIs, formula targets on gauges, glass filter, revenue trend"},
    {"key": "qa", "name": "QA Expected", "description": "Tables, KPIs, filters and expected values after compile"},
    {"key": "sales", "name": "Sales", "description": "Palette / solid / gradient bars, area + spline lines, pie and donut"},
    {"key": "operations", "name": "Operations", "description": "Zoomable time series, regions, warehouses, payments table"},
    {"key": "catalog", "name": "Catalog", "description": "Products table, data input form, tabbed container"},
    {"key": "events", "name": "Events", "description": "Event stream over time, sources and regions"},
    {"key": "bi_features", "name": "BI Features", "description": "Formulas, model/dashboard variables, rules, targets"},
)
