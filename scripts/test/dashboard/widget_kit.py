"""Compact widget payload builders + layout grid for the demo dashboard.

Every builder returns a POST payload for ``/api/dashboard-widgets/sheet/{id}/widgets``.
Keys starting with ``_`` are instructions for ``create_dashboard.py`` and are stripped
before sending (e.g. ``_container_children`` — names of widgets placed into a container).
"""
from __future__ import annotations

from typing import Any

# ── Grid: 1520px content width starting at x=24, 24px gutters ──
X0 = 24
CONTENT_W = 1520
GAP = 24
TITLE_COLOR = "#94A3B8"
FONT_DISPLAY = "Space Grotesk"
# Headings sit directly on the canvas: no card chrome, compact padding.
BARE = {"appearance": {"variant": "minimal", "density": "compact"}}


def col(n: int, i: int, span: int = 1) -> tuple[int, int]:
    """(x, width) of column ``i`` (0-based) in an ``n``-column grid spanning ``span`` columns."""
    cw = (CONTENT_W - GAP * (n - 1)) / n
    x = X0 + i * (cw + GAP)
    return int(round(x)), int(round(cw * span + GAP * (span - 1)))


def _ref(model_id: int, table: str, field: str, ftype: str, formula: str) -> dict[str, Any]:
    return {"modelId": model_id, "table": table, "field": field, "type": ftype, "formula": formula}


def dim(model_id: int, table: str, field: str, ftype: str = "text") -> dict[str, Any]:
    return _ref(model_id, table, field, ftype, f"[{table}.{field}]")


def measure(model_id: int, table: str, field: str, agg: str = "SUM", ftype: str = "float") -> dict[str, Any]:
    return _ref(model_id, table, field, ftype, f"{agg}([{table}.{field}])")


def count(model_id: int, table: str, field: str = "id") -> dict[str, Any]:
    return _ref(model_id, table, field, "float", f"COUNT([{table}.{field}])")


def _w(
    name: str,
    wtype: str,
    geom: tuple[int, int, int, int],
    settings: dict[str, Any],
    *,
    styles: dict[str, Any] | None = None,
    data_source: dict[str, Any] | None = None,
    order: int = 0,
    **extra: Any,
) -> dict[str, Any]:
    x, y, w, h = geom
    payload = {
        "name": name,
        "widget_type": wtype,
        "data_source": data_source,
        "data_config": {"settings": settings, "styles": styles or {}},
        "position_x": x,
        "position_y": y,
        "width": w,
        "height": h,
        "order_index": order,
    }
    payload.update(extra)
    return payload


def title(name: str, text: str, geom, *, size: int = 26, color: str = "#F8FAFC", order: int = 0):
    return _w(
        name,
        "text",
        geom,
        {"mode": "static", "text": text, "fontSize": size},
        styles={**BARE, "typography": {"fontFamily": FONT_DISPLAY, "color": color, "fontWeight": "700", "lineHeight": 1.15}},
        order=order,
    )


def html(name: str, markup: str, geom, *, styles: dict[str, Any] | None = None, order: int = 0):
    return _w(name, "html", geom, {"html": markup}, styles=styles, order=order)


def subtitle(name: str, text: str, geom, *, accent: str = "#38BDF8", order: int = 0):
    markup = (
        "<div style=\"font:14px/1.5 Inter,system-ui,sans-serif;color:#94A3B8;"
        f"border-left:3px solid {accent};padding:2px 0 2px 12px\">{text}</div>"
    )
    return html(name, markup, geom, styles=BARE, order=order)


def kpi(
    model_id: int,
    name: str,
    label: str,
    table: str,
    field: str,
    geom,
    *,
    agg: str = "sum",
    color: str = "#F8FAFC",
    suffix: str = "",
    decimals: int = 0,
    order: int = 0,
    **settings: Any,
):
    return _w(
        name,
        "kpi",
        geom,
        {
            "title": label,
            "showTitle": True,
            "titleSize": 12,
            "titleColor": TITLE_COLOR,
            "kpiMode": "simple",
            "aggregation": agg,
            "format": "number",
            "decimals": decimals,
            "valueSuffix": suffix,
            **settings,
        },
        styles={"typography": {"color": color, "fontWeight": "700", "lineHeight": 1.15}},
        data_source={"modelId": model_id, "table": table, "field": field},
        order=order,
    )


def formula_kpi(
    name: str,
    label: str,
    formula: str,
    geom,
    *,
    color: str = "#F8FAFC",
    suffix: str = " ₽",
    decimals: int = 0,
    data_source: dict[str, Any] | None = None,
    order: int = 0,
    **settings: Any,
):
    return _w(
        name,
        "kpi",
        geom,
        {
            "title": label,
            "showTitle": True,
            "titleSize": 12,
            "titleColor": TITLE_COLOR,
            "kpiMode": "formula",
            "valueFormula": formula,
            "format": "number",
            "decimals": decimals,
            "valueSuffix": suffix,
            **settings,
        },
        styles={"typography": {"color": color, "fontWeight": "700", "lineHeight": 1.15}},
        data_source=data_source,
        order=order,
    )


def gauge(name: str, label: str, geom, *, data_source=None, order: int = 0, **settings: Any):
    return _w(
        name,
        "gauge",
        geom,
        {"title": label, "showTitle": True, "valueFormat": "number", **settings},
        data_source=data_source,
        order=order,
    )


def filter_widget(
    model_id: int,
    name: str,
    label: str,
    fields: list[tuple[str, str]],
    geom,
    *,
    style: dict[str, Any],
    order: int = 0,
):
    filters = [
        {
            "id": f"f_{table}_{field}",
            "modelId": model_id,
            "table": table,
            "field": field,
            "op": "in",
            "selectedValues": [],
            "excludedValues": [],
            "pattern": "",
        }
        for table, field in fields
    ]
    return _w(
        name,
        "filter",
        geom,
        {"title": label, "showTitle": True, "filters": filters, "filterStyle": style},
        order=order,
    )


def bar(name: str, label: str, dimension, measure_ref, geom, *, order: int = 0, **settings: Any):
    return _w(
        name,
        "bar-chart",
        geom,
        {
            "title": label,
            "showTitle": True,
            "titleColor": TITLE_COLOR,
            "bindingDimension": dimension,
            "bindingMeasure": measure_ref,
            **settings,
        },
        order=order,
    )


def line(name: str, label: str, dimension, measure_ref, geom, *, order: int = 0, **settings: Any):
    return _w(
        name,
        "line-chart",
        geom,
        {
            "title": label,
            "showTitle": True,
            "titleColor": TITLE_COLOR,
            "bindingDimension": dimension,
            "bindingMeasure": measure_ref,
            "legend": {"enabled": False},
            "grid": {"enabled": True, "opacity": 0.12},
            **settings,
        },
        order=order,
    )


def pie(name: str, label: str, dimension, measure_ref, geom, *, order: int = 0, **settings: Any):
    return _w(
        name,
        "pie-chart",
        geom,
        {
            "title": label,
            "showTitle": True,
            "titleColor": TITLE_COLOR,
            "bindingDimension": dimension,
            "bindingMeasure": measure_ref,
            "colorMode": "auto",
            **settings,
        },
        order=order,
    )


def table(model_id: int, name: str, label: str, tbl: str, fields: list[str], geom, *, max_rows=100, order=0):
    return _w(
        name,
        "table",
        geom,
        {
            "title": label,
            "showTitle": True,
            "maxRows": max_rows,
            "bindingFields": [{"modelId": model_id, "table": tbl, "field": f} for f in fields],
        },
        data_source={"modelId": model_id, "table": tbl},
        order=order,
    )


def buttons(name: str, items: list[dict[str, Any]], geom, *, order: int = 0):
    return _w(
        name,
        "button-widget",
        geom,
        {"layout": {"direction": "row", "wrap": True, "gap": 10}, "buttons": items},
        order=order,
    )


def nav_button(bid: str, label: str, sheet_id: int | None) -> dict[str, Any]:
    return {
        "id": bid,
        "label": label,
        "icon": "arrow",
        "action": {"type": "navigate", "target": str(sheet_id or ""), "payload": {}},
    }


def refresh_button(bid: str = "btn_refresh", label: str = "Обновить данные") -> dict[str, Any]:
    return {"id": bid, "label": label, "icon": "refresh", "action": {"type": "refresh", "target": "", "payload": {}}}


def image(name: str, src: str, geom, *, alt: str = "", fit: str = "cover", order: int = 0):
    return _w(name, "image", geom, {"staticSrc": src, "objectFit": fit, "alt": alt}, order=order)


def container(
    name: str,
    label: str,
    children: list[str],
    geom,
    *,
    slots_per_tab: int = 1,
    tab_labels: list[str] | None = None,
    order: int = 0,
):
    """Children are widget *names* on the same sheet; ids are wired after creation.

    ``tab_labels`` — one caption per tab (group of ``slots_per_tab`` children).
    """
    return _w(
        name,
        "container",
        geom,
        {"title": label, "showTitle": True, "slotsPerTab": slots_per_tab, "containerTabGroups": []},
        order=order,
        _container_children=children,
        _container_tab_labels=tab_labels or [],
    )
