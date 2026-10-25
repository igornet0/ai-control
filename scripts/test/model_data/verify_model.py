#!/usr/bin/env python3
"""
Проверяет модель данных: ingest status, compile, sqlite schema, rows.

Пример:
  cd py-worm && poetry run python ../scripts/test/model_data/verify_model.py --env dev
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    DEFAULT_CREDENTIALS_PATH,
    ControlPlaneClient,
    DeveloperApiClient,
    bootstrap_settings,
    load_json,
    login_control_plane,
    load_settings,
)
from fixtures import (  # noqa: E402
    COMPILED_CUSTOMERS_COLUMNS,
    COMPILED_ORDERS_COLUMNS,
    MODEL_VARIABLES,
    TABLES,
    expected_compiled_snapshot,
)


class VerificationError(Exception):
    pass


EXPECTED_TABLES = [t.name for t in TABLES]
CORE_ROW_TABLES = ("orders", "customers", "products", "payments")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--credentials", default=str(DEFAULT_CREDENTIALS_PATH))
    p.add_argument("--skip-compile", action="store_true")
    p.add_argument("--admin-email", default=None)
    p.add_argument("--admin-password", default=None)
    return p.parse_args()


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def verify_model(args: argparse.Namespace) -> list[str]:
    creds_path = Path(args.credentials)
    if not creds_path.is_file():
        raise VerificationError(f"credentials not found: {creds_path}")

    creds = load_json(creds_path)
    model_id = creds["model_id"]
    tables = list((creds.get("tables") or {}).keys()) or list(EXPECTED_TABLES)
    checks: list[str] = []

    settings = load_settings()
    email = args.admin_email or creds.get("admin_email") or settings.app.first_superuser
    password = args.admin_password or settings.app.first_superuser_password
    auth = login_control_plane(creds["control_plane_url"], email, password)

    with DeveloperApiClient(creds["developer_api_url"], creds["api_key"]) as dev:
        status = dev.ingest_status()
        tables_info = status.get("tables") or {}
        for table in tables:
            info = tables_info.get(table) or {}
            deploy = info.get("deploy_status")
            _assert(
                deploy in ("deployed", "stored"),
                f"table {table!r} not ingested (status={deploy!r})",
            )
            checks.append(f"ingest[{table}]={deploy}")

        detail = dev.model_detail()
        widgets = detail.get("widgets") or []
        # 9 sources + filter + 2 transforms + formula + 2 aggregates + 6 relationships = 21
        _assert(len(widgets) >= 18, f"expected >=18 widgets, got {len(widgets)}")
        checks.append(f"widgets={len(widgets)}")

        types = sorted({w.get("widget_type") for w in widgets})
        for required in ("data-source", "processing-block", "formula", "relationship"):
            _assert(required in types, f"missing widget_type {required!r}, have {types}")
        checks.append(f"widget_types={types}")

        rel_types = {
            (w.get("widget_config") or {}).get("settings", {}).get("relationshipType")
            for w in widgets
            if w.get("widget_type") == "relationship"
        }
        for required in ("one-to-one", "one-to-many", "many-to-many"):
            _assert(required in rel_types, f"missing relationshipType {required!r}, have {rel_types}")
        checks.append(f"relationship_types={sorted(t for t in rel_types if t)}")

        block_types = {
            (w.get("widget_config") or {}).get("settings", {}).get("blockType")
            for w in widgets
            if w.get("widget_type") == "processing-block"
        }
        for required in ("filter", "transform", "aggregate"):
            _assert(required in block_types, f"missing blockType {required!r}, have {block_types}")
        checks.append(f"block_types={sorted(t for t in block_types if t)}")

        rel_count = len((detail.get("data_model") or {}).get("relationships") or {})
        _assert(rel_count >= 16, f"expected >=16 relationships, got {rel_count}")
        checks.append(f"relationships={rel_count}")

    with ControlPlaneClient(creds["control_plane_url"], auth.token) as cp:
        if not args.skip_compile:
            compile_resp = cp.compile_model(model_id)
            _assert(compile_resp.get("success") is True, f"compile failed: {compile_resp}")
            checks.append("compile=ok")

        schema = cp.sqlite_schema(model_id)
        tables_by_name = {t.get("name"): t for t in (schema.get("tables") or [])}
        table_names = set(tables_by_name)
        for expected in EXPECTED_TABLES:
            _assert(expected in table_names, f"sqlite missing table {expected!r}")
        orders_cols = {c.get("name") for c in (tables_by_name.get("orders") or {}).get("columns") or []}
        customers_cols = {c.get("name") for c in (tables_by_name.get("customers") or {}).get("columns") or []}
        for col in COMPILED_ORDERS_COLUMNS:
            _assert(col in orders_cols, f"orders missing compiled column {col!r}, have {sorted(orders_cols)}")
        _assert("status" not in orders_cols, "orders still has raw 'status'; expected rename to order_status")
        for col in COMPILED_CUSTOMERS_COLUMNS:
            _assert(
                col in customers_cols,
                f"customers missing compiled column {col!r}, have {sorted(customers_cols)}",
            )
        _assert("email" not in customers_cols, "customers still has raw 'email'; expected email_address")
        snap = expected_compiled_snapshot()
        checks.append(
            "compiled_seed_expect "
            f"orders={snap['orders']['count']} "
            f"sum_amount={snap['orders']['sum_amount']} "
            f"r_nw={snap['filters']['region_r_nw']['count']} "
            f"channel_web={snap['filters']['channel_web']['count']}"
        )
        for optional in (
            "orders_by_customer",
            "orders_by_region",
            "orders_customers",
            "orders_products",
            "orders_payments",
            "customer_profiles_joined",
            "warehouses_regions",
        ):
            if optional in table_names:
                checks.append(f"sqlite_optional[{optional}]=ok")
        checks.append(f"sqlite_tables={sorted(table_names)}")

        var_resp = cp.sqlite_query(
            model_id,
            {
                "mode": "select",
                "base_table": "_datacode_variables",
                "columns": ["variable_name", "variable_type", "value"],
                "filters": [],
                "limit": 200,
            },
        )
        var_rows = var_resp.get("rows") or var_resp.get("data") or []
        scalars = {r.get("variable_name"): r.get("value") for r in var_rows if r.get("variable_type") != "Table"}
        for var in MODEL_VARIABLES:
            _assert(var["name"] in scalars, f"scalar variable {var['name']!r} missing in _datacode_variables")
            _assert(
                str(scalars[var["name"]]) == str(var["value"]),
                f"variable {var['name']!r}={scalars[var['name']]!r}, expected {var['value']!r}",
            )
        checks.append(f"model_variables={dict(sorted(scalars.items()))}")

        export = cp.export_model(model_id)
        code_widgets = (export.get("code") or {}).get("widgets") or {}
        _assert(len(code_widgets) >= 18, f"export missing widget code ({len(code_widgets)})")
        checks.append(f"code_widgets={len(code_widgets)}")

    with DeveloperApiClient(creds["developer_api_url"], creds["read_api_key"]) as dev_read:
        for table in CORE_ROW_TABLES:
            rows = dev_read.table_rows(table, limit=50)
            _assert(rows.get("total_count", 0) > 0, f"table {table!r} has no rows after compile")
            checks.append(f"rows[{table}]={rows.get('total_count')}")

    return checks


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)
    try:
        checks = verify_model(args)
    except VerificationError as exc:
        print(f"verify_model: FAILED — {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"verify_model: ERROR — {exc}", file=sys.stderr)
        return 1

    print("verify_model: OK")
    for item in checks:
        print(f"  {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
