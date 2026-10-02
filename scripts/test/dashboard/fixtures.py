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


def overview_widgets(model_id: int, sheet_ids: dict[str, int] | None = None) -> list[dict[str, Any]]:
    """Sheet 1: hero, KPIs, gauges, filter, html, navigation."""
    sheets = sheet_ids or {}
    nav_qa = str(sheets.get("qa", ""))
    nav_sales = str(sheets.get("sales", ""))
    nav_ops = str(sheets.get("operations", ""))
    nav_catalog = str(sheets.get("catalog", ""))
    nav_events = str(sheets.get("events", ""))

    return [
        {
            "name": "Title",
            "widget_type": "text",
            "data_source": None,
            "data_config": {
                "settings": {
                    "mode": "static",
                    "text": "Commerce Command Center",
                    "fontSize": 28,
                    "color": "#F8FAFC",
                    "fontWeight": "700",
                },
                "styles": {"typography": {"fontFamily": "Space Grotesk", "color": "#F8FAFC"}},
            },
            "position_x": 40,
            "position_y": 20,
            "width": 640,
            "height": 64,
            "order_index": 0,
        },
        {
            "name": "Subtitle",
            "widget_type": "html",
            "data_source": None,
            "data_config": {
                "settings": {
                    "html": (
                        "<div style='padding:10px 14px;color:#cbd5e1;font:500 13px/1.45 \"IBM Plex Sans\",sans-serif'>"
                        "Demo dashboard · orders · payments · catalog · events<br/>"
                        "<span style='color:#67e8f9'>Bound to compiled model_data · вкладка QA Expected — фильтры и эталонные KPI</span>"
                        "</div>"
                    ),
                },
                "styles": {},
            },
            "position_x": 700,
            "position_y": 20,
            "width": 520,
            "height": 64,
            "order_index": 1,
        },
        {
            "name": "Sum amount",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Revenue (SUM)",
                    "showTitle": True,
                    "titleSize": 12,
                    "titleColor": "#94A3B8",
                    "kpiMode": "simple",
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0,
                    "valueSuffix": " ₽",
                },
                "styles": {"typography": {"color": "#38BDF8", "fontWeight": "700"}},
            },
            "position_x": 40,
            "position_y": 110,
            "width": 260,
            "height": 140,
            "order_index": 2,
        },
        {
            "name": "Orders count",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "id"},
            "data_config": {
                "settings": {
                    "title": "Orders (COUNT)",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "count",
                    "format": "number",
                    "decimals": 0,
                },
                "styles": {"typography": {"color": "#A78BFA"}},
            },
            "position_x": 320,
            "position_y": 110,
            "width": 260,
            "height": 140,
            "order_index": 3,
        },
        {
            "name": "Avg check",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Avg check",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "avg",
                    "format": "number",
                    "decimals": 1,
                },
                "styles": {"typography": {"color": "#34D399"}},
            },
            "position_x": 600,
            "position_y": 110,
            "width": 260,
            "height": 140,
            "order_index": 4,
        },
        {
            "name": "Payments sum",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "payments", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Payments (SUM)",
                    "showTitle": True,
                    "titleSize": 12,
                    "kpiMode": "simple",
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0,
                },
                "styles": {"typography": {"color": "#FBBF24"}},
            },
            "position_x": 880,
            "position_y": 110,
            "width": 260,
            "height": 140,
            "order_index": 5,
        },
        {
            "name": "Avg amount gauge",
            "widget_type": "gauge",
            "data_source": {"modelId": model_id, "table": "orders", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Avg order",
                    "showTitle": True,
                    "valueSource": "aggregated_value",
                    "aggregation": "avg",
                    "min": 0,
                    "max": 800,
                    "valueFormat": "number",
                    "valueSuffix": "",
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 270,
            "width": 280,
            "height": 220,
            "order_index": 6,
        },
        {
            "name": "Qty gauge",
            "widget_type": "gauge",
            "data_source": {"modelId": model_id, "table": "orders", "field": "qty"},
            "data_config": {
                "settings": {
                    "title": "Avg qty / order",
                    "showTitle": True,
                    "valueSource": "aggregated_value",
                    "aggregation": "avg",
                    "min": 0,
                    "max": 8,
                    "valueFormat": "number",
                    "valueSuffix": " pcs",
                },
                "styles": {},
            },
            "position_x": 340,
            "position_y": 270,
            "width": 280,
            "height": 220,
            "order_index": 7,
        },
        {
            "name": "Status filter",
            "widget_type": "filter",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Filters",
                    "showTitle": True,
                    "filters": [
                        {
                            "id": "f_status",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "order_status",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                        {
                            "id": "f_region",
                            "modelId": model_id,
                            "table": "orders",
                            "field": "region_id",
                            "op": "in",
                            "selectedValues": [],
                            "excludedValues": [],
                            "pattern": "",
                        },
                        {
                            "id": "f_channel",
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
            "position_x": 640,
            "position_y": 270,
            "width": 300,
            "height": 320,
            "order_index": 8,
        },
        {
            "name": "Nav buttons",
            "widget_type": "button-widget",
            "data_source": None,
            "data_config": {
                "settings": {
                    "layout": {"direction": "row", "wrap": True, "gap": 10},
                    "buttons": [
                        {
                            "id": "btn_qa",
                            "label": "QA Expected",
                            "icon": "arrow",
                            "action": {"type": "navigate", "target": nav_qa, "payload": {}},
                        },
                        {
                            "id": "btn_sales",
                            "label": "Sales",
                            "icon": "arrow",
                            "action": {"type": "navigate", "target": nav_sales, "payload": {}},
                        },
                        {
                            "id": "btn_ops",
                            "label": "Operations",
                            "icon": "arrow",
                            "action": {"type": "navigate", "target": nav_ops, "payload": {}},
                        },
                        {
                            "id": "btn_catalog",
                            "label": "Catalog",
                            "icon": "arrow",
                            "action": {"type": "navigate", "target": nav_catalog, "payload": {}},
                        },
                        {
                            "id": "btn_events",
                            "label": "Events",
                            "icon": "arrow",
                            "action": {"type": "navigate", "target": nav_events, "payload": {}},
                        },
                        {
                            "id": "btn_refresh",
                            "label": "Refresh",
                            "icon": "refresh",
                            "action": {"type": "refresh", "target": "", "payload": {}},
                        },
                    ],
                },
                "styles": {},
            },
            "position_x": 960,
            "position_y": 270,
            "width": 280,
            "height": 220,
            "order_index": 9,
        },
        {
            "name": "HTML note",
            "widget_type": "html",
            "data_source": None,
            "data_config": {
                "settings": {
                    "html": (
                        "<div style='padding:14px;color:#e2e8f0;font-family:\"IBM Plex Sans\",sans-serif'>"
                        "<b style='color:#67e8f9'>Platform demo</b>"
                        "<ul style='margin:8px 0 0 18px;line-height:1.5;color:#94a3b8'>"
                        "<li>Compiled columns: orders.order_status, amount_vat; customers.email_address</li>"
                        "<li>QA Expected — tables + KPI + filters with expected values</li>"
                        "<li>Use sheet buttons to explore QA / Sales / Ops / Catalog / Events</li>"
                        "</ul></div>"
                    ),
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 520,
            "width": 580,
            "height": 140,
            "order_index": 10,
        },
    ]


def sales_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet 2: diverse chart designs on commerce facts."""
    dim_status = _field_ref(model_id, "orders", "order_status")
    dim_channel = _field_ref(model_id, "orders", "channel")
    dim_region = _field_ref(model_id, "orders", "region_id")
    dim_customer = _field_ref(model_id, "orders", "customer_id")
    meas_amount = _measure_ref(model_id, "orders", "amount", agg="SUM")
    meas_qty = _measure_ref(model_id, "orders", "qty", agg="SUM")
    dim_category = _field_ref(model_id, "products", "category")
    meas_price = _measure_ref(model_id, "products", "price", agg="AVG")

    return [
        {
            "name": "Amount by status",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Revenue by order_status",
                    "showTitle": True,
                    "titleColor": "#67E8F9",
                    "bindingDimension": dim_status,
                    "bindingMeasure": meas_amount,
                    "barColorMode": "palette",
                    "barPalette": PALETTE_OCEAN,
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 40,
            "width": 520,
            "height": 320,
            "order_index": 0,
        },
        {
            "name": "Amount by channel",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Revenue by channel (solid)",
                    "showTitle": True,
                    "bindingDimension": dim_channel,
                    "bindingMeasure": meas_amount,
                    "barColorMode": "solid",
                    "barSolidColor": "#F97316",
                },
                "styles": {},
            },
            "position_x": 580,
            "position_y": 40,
            "width": 520,
            "height": 320,
            "order_index": 1,
        },
        {
            "name": "Qty by region",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Qty by region (gradient)",
                    "showTitle": True,
                    "bindingDimension": dim_region,
                    "bindingMeasure": meas_qty,
                    "barColorMode": "gradient",
                    "barPalette": PALETTE_SUNSET,
                },
                "styles": {},
            },
            "position_x": 1120,
            "position_y": 40,
            "width": 420,
            "height": 320,
            "order_index": 2,
        },
        {
            "name": "Amount by customer",
            "widget_type": "line-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Amount by customer (area + gradient)",
                    "showTitle": True,
                    "bindingDimension": dim_customer,
                    "bindingMeasure": meas_amount,
                    "chartType": "area",
                    "line": {
                        "color": "#4DA3FF",
                        "width": 2,
                        "smooth": True,
                        "gradient": {"enabled": True, "from": "#005DFF", "to": "#00E0FF", "mode": "x"},
                    },
                    "points": {"enabled": False},
                    "legend": {"enabled": True},
                    "grid": {"enabled": True, "opacity": 0.12},
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 380,
            "width": 760,
            "height": 320,
            "order_index": 3,
        },
        {
            "name": "Avg price by category",
            "widget_type": "line-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Avg product price by category (spline)",
                    "showTitle": True,
                    "bindingDimension": dim_category,
                    "bindingMeasure": meas_price,
                    "chartType": "spline",
                    "line": {
                        "color": "#A78BFA",
                        "width": 3,
                        "smooth": True,
                        "gradient": {"enabled": False},
                    },
                    "points": {"enabled": True, "radius": 4, "color": "#C4B5FD"},
                    "legend": {"enabled": False},
                },
                "styles": {},
            },
            "position_x": 820,
            "position_y": 380,
            "width": 720,
            "height": 320,
            "order_index": 4,
        },
        {
            "name": "Status share",
            "widget_type": "pie-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Orders by order_status",
                    "showTitle": True,
                    "bindingDimension": dim_status,
                    "bindingMeasure": _count_ref(model_id, "orders", "id"),
                    "donut": False,
                    "colorMode": "auto",
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 720,
            "width": 420,
            "height": 300,
            "order_index": 5,
        },
        {
            "name": "Channel share donut",
            "widget_type": "pie-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Orders by channel (donut)",
                    "showTitle": True,
                    "bindingDimension": dim_channel,
                    "bindingMeasure": _count_ref(model_id, "orders", "id"),
                    "donut": True,
                    "innerRadius": 0.62,
                    "colorMode": "auto",
                },
                "styles": {},
            },
            "position_x": 480,
            "position_y": 720,
            "width": 420,
            "height": 300,
            "order_index": 6,
        },
        {
            "name": "Category count",
            "widget_type": "pie-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Products by category",
                    "showTitle": True,
                    "bindingDimension": dim_category,
                    "bindingMeasure": _count_ref(model_id, "products", "id"),
                    "donut": True,
                    "innerRadius": 0.5,
                },
                "styles": {},
            },
            "position_x": 920,
            "position_y": 720,
            "width": 420,
            "height": 300,
            "order_index": 7,
        },
    ]


def operations_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet 3: time-ish ops, warehouses, payments."""
    dim_created = _field_ref(model_id, "orders", "created_at", ftype="datetime")
    meas_amount = _measure_ref(model_id, "orders", "amount", agg="SUM")
    dim_wh = _field_ref(model_id, "warehouses", "name")
    meas_cap = _measure_ref(model_id, "warehouses", "capacity", agg="SUM")
    dim_method = _field_ref(model_id, "payments", "method")
    dim_pay_status = _field_ref(model_id, "payments", "status")
    meas_pay = _measure_ref(model_id, "payments", "amount", agg="SUM")

    return [
        {
            "name": "Revenue over time",
            "widget_type": "line-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Order amount over created_at",
                    "showTitle": True,
                    "bindingDimension": dim_created,
                    "bindingMeasure": meas_amount,
                    "chartType": "line",
                    "line": {
                        "color": "#22D3EE",
                        "width": 2,
                        "smooth": False,
                        "style": "solid",
                        "gradient": {"enabled": True, "from": "#0891B2", "to": "#67E8F9", "mode": "y"},
                    },
                    "points": {"enabled": False},
                    "zoom": {"enabled": True, "x": True, "y": False},
                    "crosshair": {"enabled": True},
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 40,
            "width": 900,
            "height": 340,
            "order_index": 0,
        },
        {
            "name": "Payments KPI",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "payments", "field": "id"},
            "data_config": {
                "settings": {
                    "title": "Payment rows",
                    "showTitle": True,
                    "kpiMode": "simple",
                    "aggregation": "count",
                    "format": "number",
                    "decimals": 0,
                },
                "styles": {"typography": {"color": "#F472B6"}},
            },
            "position_x": 960,
            "position_y": 40,
            "width": 280,
            "height": 150,
            "order_index": 1,
        },
        {
            "name": "Paid amount KPI",
            "widget_type": "kpi",
            "data_source": {"modelId": model_id, "table": "payments", "field": "amount"},
            "data_config": {
                "settings": {
                    "title": "Paid volume (SUM)",
                    "showTitle": True,
                    "kpiMode": "simple",
                    "aggregation": "sum",
                    "format": "number",
                    "decimals": 0,
                },
                "styles": {"typography": {"color": "#4ADE80"}},
            },
            "position_x": 1260,
            "position_y": 40,
            "width": 280,
            "height": 150,
            "order_index": 2,
        },
        {
            "name": "Warehouse capacity",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Warehouse capacity",
                    "showTitle": True,
                    "bindingDimension": dim_wh,
                    "bindingMeasure": meas_cap,
                    "barColorMode": "palette",
                    "barPalette": PALETTE_FOREST,
                },
                "styles": {},
            },
            "position_x": 960,
            "position_y": 210,
            "width": 580,
            "height": 170,
            "order_index": 3,
        },
        {
            "name": "Payments by method",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Payments by method",
                    "showTitle": True,
                    "bindingDimension": dim_method,
                    "bindingMeasure": meas_pay,
                    "barColorMode": "palette",
                    "barPalette": PALETTE_SUNSET,
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 400,
            "width": 520,
            "height": 300,
            "order_index": 4,
        },
        {
            "name": "Payment status pie",
            "widget_type": "pie-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Payment status",
                    "showTitle": True,
                    "bindingDimension": dim_pay_status,
                    "bindingMeasure": _count_ref(model_id, "payments", "id"),
                    "donut": True,
                    "innerRadius": 0.55,
                },
                "styles": {},
            },
            "position_x": 580,
            "position_y": 400,
            "width": 380,
            "height": 300,
            "order_index": 5,
        },
        {
            "name": "Payments table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "payments"},
            "data_config": {
                "settings": {
                    "title": "Payments",
                    "showTitle": True,
                    "maxRows": 100,
                    "bindingFields": [
                        {"modelId": model_id, "table": "payments", "field": "id"},
                        {"modelId": model_id, "table": "payments", "field": "order_id"},
                        {"modelId": model_id, "table": "payments", "field": "method"},
                        {"modelId": model_id, "table": "payments", "field": "amount"},
                        {"modelId": model_id, "table": "payments", "field": "status"},
                        {"modelId": model_id, "table": "payments", "field": "paid_at"},
                    ],
                },
                "styles": {},
            },
            "position_x": 980,
            "position_y": 400,
            "width": 560,
            "height": 300,
            "order_index": 6,
        },
    ]


def catalog_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet 4: products, order_items, data input, container."""
    return [
        {
            "name": "Products table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "products"},
            "data_config": {
                "settings": {
                    "title": "Products",
                    "showTitle": True,
                    "maxRows": 200,
                    "bindingFields": [
                        {"modelId": model_id, "table": "products", "field": "id"},
                        {"modelId": model_id, "table": "products", "field": "name"},
                        {"modelId": model_id, "table": "products", "field": "category"},
                        {"modelId": model_id, "table": "products", "field": "price"},
                        {"modelId": model_id, "table": "products", "field": "cost"},
                    ],
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 40,
            "width": 700,
            "height": 360,
            "order_index": 0,
        },
        {
            "name": "Order items table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "order_items"},
            "data_config": {
                "settings": {
                    "title": "Order lines",
                    "showTitle": True,
                    "maxRows": 150,
                    "bindingFields": [
                        {"modelId": model_id, "table": "order_items", "field": "id"},
                        {"modelId": model_id, "table": "order_items", "field": "order_id"},
                        {"modelId": model_id, "table": "order_items", "field": "product_id"},
                        {"modelId": model_id, "table": "order_items", "field": "qty"},
                        {"modelId": model_id, "table": "order_items", "field": "line_total"},
                    ],
                },
                "styles": {},
            },
            "position_x": 760,
            "position_y": 40,
            "width": 700,
            "height": 360,
            "order_index": 1,
        },
        {
            "name": "Orders table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "orders"},
            "data_config": {
                "settings": {
                    "title": "Orders",
                    "showTitle": True,
                    "maxRows": 100,
                    "bindingFields": [
                        {"modelId": model_id, "table": "orders", "field": "id"},
                        {"modelId": model_id, "table": "orders", "field": "customer_id"},
                        {"modelId": model_id, "table": "orders", "field": "product_id"},
                        {"modelId": model_id, "table": "orders", "field": "amount"},
                        {"modelId": model_id, "table": "orders", "field": "order_status"},
                        {"modelId": model_id, "table": "orders", "field": "amount_vat"},
                        {"modelId": model_id, "table": "orders", "field": "channel"},
                        {"modelId": model_id, "table": "orders", "field": "region_id"},
                        {"modelId": model_id, "table": "orders", "field": "created_at"},
                    ],
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 420,
            "width": 900,
            "height": 320,
            "order_index": 2,
        },
        {
            "name": "Add order",
            "widget_type": "data_input",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Add order",
                    "showTitle": True,
                    "table": "orders",
                    "modelId": model_id,
                    "submitLabel": "Save",
                    "permissions": {"insert_roles": ["CEO", "Manager"]},
                    "fields": [
                        {"name": "id", "type": "text", "label": "id", "required": True},
                        {"name": "customer_id", "type": "text", "label": "customer_id", "required": True},
                        {"name": "product_id", "type": "text", "label": "product_id", "required": True},
                        {"name": "qty", "type": "int", "label": "qty", "required": True},
                        {"name": "amount", "type": "float", "label": "amount", "required": True},
                        {"name": "status", "type": "text", "label": "status", "required": False},
                        {"name": "region_id", "type": "text", "label": "region_id", "required": False},
                        {"name": "channel", "type": "text", "label": "channel", "required": False},
                        {"name": "created_at", "type": "text", "label": "created_at", "required": False},
                    ],
                },
                "styles": {},
            },
            "position_x": 960,
            "position_y": 420,
            "width": 360,
            "height": 420,
            "order_index": 3,
        },
        {
            "name": "Layout container",
            "widget_type": "container",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Catalog notes",
                    "showTitle": True,
                    "containerTabGroups": [],
                },
                "styles": {},
                "containedWidgets": [],
                "containedWidgetNumericIds": [],
            },
            "position_x": 1340,
            "position_y": 420,
            "width": 280,
            "height": 280,
            "order_index": 4,
        },
        {
            "name": "Customers table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "customers"},
            "data_config": {
                "settings": {
                    "title": "Customers",
                    "showTitle": True,
                    "maxRows": 80,
                    "bindingFields": [
                        {"modelId": model_id, "table": "customers", "field": "id"},
                        {"modelId": model_id, "table": "customers", "field": "name"},
                        {"modelId": model_id, "table": "customers", "field": "segment"},
                        {"modelId": model_id, "table": "customers", "field": "region"},
                        {"modelId": model_id, "table": "customers", "field": "email_address"},
                    ],
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 760,
            "width": 900,
            "height": 280,
            "order_index": 5,
        },
    ]


def events_widgets(model_id: int) -> list[dict[str, Any]]:
    """Sheet 5: event stream visuals."""
    dim_type = _field_ref(model_id, "events", "event_type")
    dim_channel = _field_ref(model_id, "events", "channel")

    return [
        {
            "name": "Events title",
            "widget_type": "text",
            "data_source": None,
            "data_config": {
                "settings": {
                    "mode": "static",
                    "text": "Event stream",
                    "fontSize": 24,
                    "color": "#E2E8F0",
                    "fontWeight": "600",
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 24,
            "width": 400,
            "height": 56,
            "order_index": 0,
        },
        {
            "name": "Events legend",
            "widget_type": "html",
            "data_source": None,
            "data_config": {
                "settings": {
                    "html": (
                        "<div style='padding:12px;color:#94a3b8;font:13px/1.5 IBM Plex Sans,sans-serif'>"
                        "Append-mode <code>events</code> table — types include "
                        "order_created, payment_ok/fail, stock_low, shipment, heartbeat."
                        "</div>"
                    ),
                },
                "styles": {},
            },
            "position_x": 460,
            "position_y": 24,
            "width": 700,
            "height": 56,
            "order_index": 1,
        },
        {
            "name": "Event types pie",
            "widget_type": "pie-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Events by type",
                    "showTitle": True,
                    "bindingDimension": dim_type,
                    "bindingMeasure": _count_ref(model_id, "events", "entity_id"),
                    "donut": True,
                    "innerRadius": 0.58,
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 100,
            "width": 440,
            "height": 320,
            "order_index": 2,
        },
        {
            "name": "Events by channel",
            "widget_type": "bar-chart",
            "data_source": None,
            "data_config": {
                "settings": {
                    "title": "Events by channel",
                    "showTitle": True,
                    "bindingDimension": dim_channel,
                    "bindingMeasure": _count_ref(model_id, "events", "entity_id"),
                    "barColorMode": "palette",
                    "barPalette": PALETTE_OCEAN,
                },
                "styles": {},
            },
            "position_x": 500,
            "position_y": 100,
            "width": 520,
            "height": 320,
            "order_index": 3,
        },
        {
            "name": "Events table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "events"},
            "data_config": {
                "settings": {
                    "title": "Recent events",
                    "showTitle": True,
                    "maxRows": 120,
                    "bindingFields": [
                        {"modelId": model_id, "table": "events", "field": "event_type"},
                        {"modelId": model_id, "table": "events", "field": "entity_id"},
                        {"modelId": model_id, "table": "events", "field": "payload"},
                        {"modelId": model_id, "table": "events", "field": "ts"},
                        {"modelId": model_id, "table": "events", "field": "channel"},
                    ],
                },
                "styles": {},
            },
            "position_x": 40,
            "position_y": 440,
            "width": 980,
            "height": 360,
            "order_index": 4,
        },
        {
            "name": "Regions table",
            "widget_type": "table",
            "data_source": {"modelId": model_id, "table": "regions"},
            "data_config": {
                "settings": {
                    "title": "Regions",
                    "showTitle": True,
                    "maxRows": 50,
                    "bindingFields": [
                        {"modelId": model_id, "table": "regions", "field": "id"},
                        {"modelId": model_id, "table": "regions", "field": "name"},
                        {"modelId": model_id, "table": "regions", "field": "manager"},
                    ],
                },
                "styles": {},
            },
            "position_x": 1040,
            "position_y": 100,
            "width": 400,
            "height": 320,
            "order_index": 5,
        },
    ]


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
            "position_x": 40,
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
            "position_x": 40,
            "position_y": 76,
            "width": 1520,
            "height": 250,
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
            "position_x": 40,
            "position_y": 340,
            "width": 320,
            "height": 300,
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
            "position_x": 380,
            "position_y": 340,
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
            "position_x": 680,
            "position_y": 340,
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
            "position_x": 980,
            "position_y": 340,
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
            "position_x": 1280,
            "position_y": 340,
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
            "position_x": 380,
            "position_y": 500,
            "width": 1180,
            "height": 140,
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
            "position_x": 40,
            "position_y": 660,
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
            "position_x": 820,
            "position_y": 660,
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
            "position_x": 1200,
            "position_y": 660,
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
            "position_x": 40,
            "position_y": 1020,
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
            "position_x": 820,
            "position_y": 1020,
            "width": 740,
            "height": 280,
            "order_index": 12,
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
    }


SHEET_SPECS = (
    {"key": "overview", "name": "Overview", "description": "KPI, gauges, filters, navigation"},
    {"key": "qa", "name": "QA Expected", "description": "Tables, KPIs, filters and expected values after compile"},
    {"key": "sales", "name": "Sales", "description": "Bar / line / pie charts with varied styles"},
    {"key": "operations", "name": "Operations", "description": "Time series, warehouses, payments"},
    {"key": "catalog", "name": "Catalog", "description": "Products, orders, data input"},
    {"key": "events", "name": "Events", "description": "Event stream and regions"},
)
