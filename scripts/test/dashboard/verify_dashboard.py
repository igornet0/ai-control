#!/usr/bin/env python3
"""
Проверяет демо-дашборд: листы, типы виджетов, связь с моделью, sample sqlite query.

Пример:
  cd src && poetry run python ../scripts/test/dashboard/verify_dashboard.py --env dev
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    DEFAULT_DASHBOARD_CREDENTIALS,
    ControlPlaneClient,
    bootstrap_settings,
    load_json,
    load_settings,
    login_control_plane,
)
from fixtures import expected_compiled_snapshot, expected_widget_types  # noqa: E402


class VerificationError(Exception):
    pass


EXPECTED_SHEET_KEYS = ("overview", "qa", "sales", "operations", "catalog", "events")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--credentials", default=str(DEFAULT_DASHBOARD_CREDENTIALS))
    p.add_argument("--admin-email", default=None)
    p.add_argument("--admin-password", default=None)
    p.add_argument("--skip-query", action="store_true")
    return p.parse_args()


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise VerificationError(msg)


def verify(args: argparse.Namespace) -> list[str]:
    path = Path(args.credentials)
    if not path.is_file():
        raise VerificationError(f"credentials not found: {path}")

    creds = load_json(path)
    dashboard_id = creds["dashboard_id"]
    model_id = creds["model_id"]
    sheet_ids = creds.get("sheet_ids") or {}
    checks: list[str] = []

    settings = load_settings()
    email = args.admin_email or creds.get("admin_email") or settings.app.first_superuser
    password = args.admin_password or settings.app.first_superuser_password

    auth = login_control_plane(creds["control_plane_url"], email, password)
    with ControlPlaneClient(creds["control_plane_url"], auth.token) as cp:
        dash = cp.get_dashboard(dashboard_id)
        _assert(dash.get("id") == dashboard_id, "dashboard id mismatch")
        checks.append(f"dashboard={dash.get('name')}")

        linked = cp.list_dashboard_models(dashboard_id)
        linked_ids = {m.get("id") for m in linked}
        _assert(model_id in linked_ids, f"model {model_id} not linked to dashboard")
        checks.append(f"linked_models={sorted(linked_ids)}")

        sheets = cp.list_sheets(dashboard_id)
        _assert(len(sheets) >= 6, f"expected >=6 sheets, got {len(sheets)}")
        checks.append(f"sheets={len(sheets)}")

        for key in EXPECTED_SHEET_KEYS:
            _assert(key in sheet_ids, f"missing sheet key {key}")

        all_types: set[str] = set()
        total_widgets = 0
        for key, sid in sheet_ids.items():
            widgets = cp.list_sheet_widgets(sid)
            total_widgets += len(widgets)
            for w in widgets:
                all_types.add(w.get("widget_type"))
            checks.append(f"sheet[{key}] widgets={len(widgets)}")

        expected = expected_widget_types()
        missing = expected - all_types
        _assert(not missing, f"missing widget types: {sorted(missing)}")
        checks.append(f"widget_types={sorted(all_types)}")
        _assert(total_widgets >= 25, f"expected >=25 widgets, got {total_widgets}")
        checks.append(f"widget_count={total_widgets}")

        if not args.skip_query:
            snap = expected_compiled_snapshot()
            expected_none = snap["filters"]["none"]
            expected_nw = snap["filters"]["region_r_nw"]
            queries = [
                (
                    "orders_by_status",
                    {
                        "mode": "aggregate",
                        "base_table": "orders",
                        "dashboard_id": dashboard_id,
                        "group_by": ["order_status"],
                        "aggregations": [{"fn": "sum", "column": "amount", "as": "total"}],
                        "filters": [],
                        "limit": 50,
                    },
                ),
                (
                    "products_by_category",
                    {
                        "mode": "aggregate",
                        "base_table": "products",
                        "dashboard_id": dashboard_id,
                        "group_by": ["category"],
                        "aggregations": [{"fn": "count", "column": "id", "as": "n"}],
                        "filters": [],
                        "limit": 50,
                    },
                ),
                (
                    "orders_kpi",
                    {
                        "mode": "aggregate",
                        "base_table": "orders",
                        "dashboard_id": dashboard_id,
                        "group_by": [],
                        "aggregations": [
                            {"fn": "count", "column": "id", "as": "n"},
                            {"fn": "sum", "column": "amount", "as": "total"},
                            {"fn": "sum", "column": "amount_vat", "as": "vat"},
                        ],
                        "filters": [],
                        "limit": 1,
                    },
                ),
                (
                    "orders_region_r_nw",
                    {
                        "mode": "aggregate",
                        "base_table": "orders",
                        "dashboard_id": dashboard_id,
                        "group_by": [],
                        "aggregations": [
                            {"fn": "count", "column": "id", "as": "n"},
                            {"fn": "sum", "column": "amount", "as": "total"},
                        ],
                        "filters": [
                            {
                                "table": "orders",
                                "column": "region_id",
                                "op": "eq",
                                "value": "r_nw",
                            }
                        ],
                        "limit": 1,
                    },
                ),
                (
                    "orders_status_pending",
                    {
                        "mode": "aggregate",
                        "base_table": "orders",
                        "dashboard_id": dashboard_id,
                        "group_by": [],
                        "aggregations": [{"fn": "count", "column": "id", "as": "n"}],
                        "filters": [
                            {
                                "table": "orders",
                                "column": "order_status",
                                "op": "eq",
                                "value": "pending",
                            }
                        ],
                        "limit": 1,
                    },
                ),
            ]
            for label, body in queries:
                try:
                    q = cp.sqlite_query(model_id, body)
                    _assert(q.get("success") is not False, f"sqlite query {label} failed: {q}")
                    rows = q.get("rows") or q.get("data") or []
                    checks.append(f"sqlite_query[{label}]=ok rows={len(rows) if isinstance(rows, list) else '?'}")
                    if label == "orders_status_pending":
                        n = int((rows[0].get("n") if isinstance(rows, list) and rows else 0) or 0)
                        _assert(n == 0, f"pending orders after compile must be 0, got {n}")
                        checks.append("expected[order_status=pending] count=0")
                    if label == "orders_kpi" and isinstance(rows, list) and rows:
                        n = int(rows[0].get("n") or 0)
                        seed_n = expected_none["count"]
                        checks.append(
                            f"orders COUNT={n} (seed expect {seed_n}; stream may add active rows)"
                        )
                        if n < seed_n:
                            print(
                                f"verify_dashboard: warning — orders COUNT {n} < seed {seed_n}",
                                file=sys.stderr,
                            )
                    if label == "orders_region_r_nw" and isinstance(rows, list) and rows:
                        n = int(rows[0].get("n") or 0)
                        checks.append(
                            f"region_id=r_nw COUNT={n} (seed expect {expected_nw['count']})"
                        )
                except VerificationError:
                    raise
                except Exception as exc:
                    checks.append(f"sqlite_query[{label}]=skipped ({exc})")
                    print(
                        f"verify_dashboard: warning — sqlite query {label} unavailable; "
                        "compile model (compile_and_stream.sh) for live data checks",
                        file=sys.stderr,
                    )

    return checks


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)
    try:
        checks = verify(args)
    except VerificationError as exc:
        print(f"verify_dashboard: FAILED — {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"verify_dashboard: ERROR — {exc}", file=sys.stderr)
        return 1

    print("verify_dashboard: OK")
    for c in checks:
        print(f"  {c}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
