#!/usr/bin/env python3
"""
Создаёт демо-дашборд с листами и разнообразными виджетами на основе model_data.

Предусловие:
  scripts/test/model_data/output/credentials.json (модель создана и желательно скомпилирована)

Пример:
  cd src && poetry run python ../scripts/test/dashboard/create_dashboard.py --env dev
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    DEFAULT_DASHBOARD_CREDENTIALS,
    DEFAULT_MODEL_CREDENTIALS,
    ControlPlaneClient,
    bootstrap_settings,
    load_model_credentials,
    load_settings,
    login_control_plane,
    save_json,
)
from fixtures import (  # noqa: E402
    SHEET_SPECS,
    catalog_widgets,
    events_widgets,
    operations_widgets,
    overview_widgets,
    qa_widgets,
    sales_widgets,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--model-credentials", default=str(DEFAULT_MODEL_CREDENTIALS))
    p.add_argument("--output", default=str(DEFAULT_DASHBOARD_CREDENTIALS))
    p.add_argument("--admin-email", default=None)
    p.add_argument("--admin-password", default=None)
    p.add_argument("--dashboard-name", default=None)
    p.add_argument("--model-id", type=int, default=None, help="Override model_id from credentials")
    return p.parse_args()


def _default_name() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"Commerce demo dashboard {ts}"


def create_dashboard(args: argparse.Namespace) -> dict:
    model_creds = load_model_credentials(Path(args.model_credentials))
    model_id = args.model_id or int(model_creds["model_id"])
    control_plane = model_creds.get("control_plane_url", "http://127.0.0.1:8000")

    settings = load_settings()
    email = args.admin_email or model_creds.get("admin_email") or settings.app.first_superuser
    password = args.admin_password or settings.app.first_superuser_password
    dash_name = args.dashboard_name or _default_name()

    auth = login_control_plane(control_plane, email, password)

    sheet_ids: dict[str, int] = {}
    widget_ids: dict[str, list[int]] = {}
    widget_types_created: list[str] = []

    with ControlPlaneClient(control_plane, auth.token) as cp:
        try:
            cp.sqlite_schema(model_id)
        except Exception as exc:
            print(
                f"Warning: sqlite schema for model {model_id} unavailable ({exc}). "
                "Compile model first for live widget data.",
                file=sys.stderr,
            )

        dash = cp.create_dashboard(
            dash_name,
            description=(
                f"Platform demo dashboard for data model {model_id} "
                "(scripts/test/dashboard/create_dashboard.py)"
            ),
        )
        dashboard_id = dash["id"]
        cp.link_data_model(dashboard_id, model_id)

        for idx, spec in enumerate(SHEET_SPECS):
            sheet = cp.create_sheet(
                dashboard_id,
                name=spec["name"],
                description=spec["description"],
                order_index=idx,
            )
            sheet_ids[spec["key"]] = sheet["id"]

        sheet_builders = {
            "overview": lambda: overview_widgets(model_id, sheet_ids=sheet_ids),
            "qa": lambda: qa_widgets(model_id),
            "sales": lambda: sales_widgets(model_id),
            "operations": lambda: operations_widgets(model_id),
            "catalog": lambda: catalog_widgets(model_id),
            "events": lambda: events_widgets(model_id),
        }

        for key, builder in sheet_builders.items():
            sid = sheet_ids[key]
            created_ids: list[int] = []
            for payload in builder():
                created = cp.create_dashboard_widget(sid, payload)
                created_ids.append(created["id"])
                widget_types_created.append(created["widget_type"])
            widget_ids[key] = created_ids

        linked = cp.list_dashboard_models(dashboard_id)

    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "control_plane_url": control_plane,
        "admin_email": email,
        "model_id": model_id,
        "model_name": model_creds.get("model_name"),
        "model_credentials": str(Path(args.model_credentials).resolve()),
        "dashboard_id": dashboard_id,
        "dashboard_name": dash_name,
        "sheet_ids": sheet_ids,
        "widget_ids": widget_ids,
        "widget_types": sorted(set(widget_types_created)),
        "widget_count": len(widget_types_created),
        "linked_model_ids": [m.get("id") for m in linked],
    }


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)
    try:
        result = create_dashboard(args)
    except FileNotFoundError as exc:
        print(f"create_dashboard: FAILED — {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"create_dashboard: FAILED — {exc}", file=sys.stderr)
        return 1

    out = Path(args.output)
    save_json(out, result)

    print("create_dashboard: OK")
    print(f"  dashboard_id={result['dashboard_id']}")
    print(f"  dashboard_name={result['dashboard_name']}")
    print(f"  model_id={result['model_id']}")
    print(f"  sheets={result['sheet_ids']}")
    print(f"  widget_count={result['widget_count']}")
    print(f"  widget_types={result['widget_types']}")
    print(f"  credentials={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
