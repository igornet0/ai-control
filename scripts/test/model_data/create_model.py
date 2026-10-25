#!/usr/bin/env python3
"""
Создаёт демо-модель данных с API-источниками, обработкой и связями.

Создаёт:
  - 9 API-таблиц: regions, warehouses, customers, customer_profiles, products,
    orders, order_items, payments, events
  - processing: filter → transform → formula → aggregate (+ aggregate by region)
  - transform на customers
  - relationship widgets: 1:1, 1:N, N:M + DataCode relate / joins
  - canvas relationships между виджетами
  - API-ключи и ingest-config

Результат сохраняется в scripts/test/model_data/output/credentials.json

Пример:
  cd py-worm && poetry run python ../scripts/test/model_data/create_model.py --env dev
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
    DEFAULT_CREDENTIALS_PATH,
    ControlPlaneClient,
    ServiceUrls,
    bootstrap_settings,
    load_settings,
    login_control_plane,
    save_json,
)
from fixtures import (  # noqa: E402
    AGGREGATE_BY_REGION_DATACODE,
    AGGREGATE_DATACODE,
    FILTER_DATACODE,
    FORMULA_DATACODE,
    MODEL_VARIABLES,
    RELATIONSHIP_DATACODE,
    RELATIONSHIP_ORDER_ITEMS_DATACODE,
    RELATIONSHIP_PAYMENTS_DATACODE,
    RELATIONSHIP_PRODUCTS_DATACODE,
    RELATIONSHIP_PROFILES_DATACODE,
    RELATIONSHIP_REGIONS_DATACODE,
    TABLES,
    TRANSFORM_CUSTOMERS_DATACODE,
    TRANSFORM_ORDERS_DATACODE,
    aggregate_by_region_widget,
    aggregate_widget,
    api_source_widget,
    build_relationships,
    dataset_fingerprint,
    filter_widget,
    formula_widget,
    ingest_config_for_table,
    model_variable_datacode,
    model_variable_widget,
    relationship_order_items_widget,
    relationship_payments_widget,
    relationship_products_widget,
    relationship_profiles_widget,
    relationship_regions_widget,
    relationship_widget,
    source_datacode,
    transform_customers_widget,
    transform_orders_widget,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--control-plane", default="http://127.0.0.1:8000")
    p.add_argument("--developer-api", default="http://127.0.0.1:8002")
    p.add_argument("--admin-email", default=None)
    p.add_argument("--admin-password", default=None)
    p.add_argument("--model-name", default=None, help="Имя модели (по умолчанию с timestamp)")
    p.add_argument("--output", default=str(DEFAULT_CREDENTIALS_PATH), help="Путь для credentials.json")
    return p.parse_args()


def _default_model_name() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"Demo commerce model {ts}"


def create_test_model(args: argparse.Namespace) -> dict:
    settings = load_settings()
    email = args.admin_email or settings.app.first_superuser
    password = args.admin_password or settings.app.first_superuser_password
    model_name = args.model_name or _default_model_name()

    auth = login_control_plane(args.control_plane, email, password)
    urls = ServiceUrls(control_plane=args.control_plane, developer_api=args.developer_api)

    with ControlPlaneClient(urls.control_plane, auth.token) as cp:
        model = cp.create_model(
            model_name,
            "Platform demo model (scripts/test/model_data) — e-commerce + events",
        )
        model_id = model["id"]

        table_names = [t.name for t in TABLES]
        for spec in TABLES:
            cp.configure_ingest(model_id, spec.name, ingest_config_for_table(spec))

        key_data = cp.create_api_key(
            name="model-data-demo-ingest",
            scope_type="model",
            data_model_id=model_id,
            allowed_tables=table_names,
            access_level="ingest",
            ingest_config={"mode": "stream", "upsert_keys": ["id"], "min_interval_sec": 1},
            rate_limit_per_min=1000,
        )
        read_key_data = cp.create_api_key(
            name="model-data-demo-read",
            scope_type="model",
            data_model_id=model_id,
            allowed_tables=table_names,
            access_level="read",
            rate_limit_per_min=1000,
        )

        widget_ids: dict[str, int] = {}
        order = 0

        # --- API sources in a left column grid (5 rows) ---
        for idx, spec in enumerate(TABLES):
            col = idx // 5
            row = idx % 5
            created = cp.create_widget(
                model_id,
                api_source_widget(
                    spec,
                    x=40 + col * 280,
                    y=40 + row * 130,
                    order_index=order,
                ),
            )
            widget_ids[spec.name] = created["id"]
            cp.save_widget_code(model_id, created["id"], source_datacode(spec))
            order += 1

        # --- orders pipeline: filter → transform → formula → aggregates ---
        pipeline_y = 40
        pipeline_x0 = 640

        filter_created = cp.create_widget(
            model_id,
            filter_widget(x=pipeline_x0, y=pipeline_y, order_index=order),
        )
        widget_ids["filter"] = filter_created["id"]
        cp.save_widget_code(model_id, filter_created["id"], FILTER_DATACODE)
        order += 1

        transform_orders = cp.create_widget(
            model_id,
            transform_orders_widget(x=pipeline_x0 + 280, y=pipeline_y, order_index=order),
        )
        widget_ids["transform_orders"] = transform_orders["id"]
        cp.save_widget_code(model_id, transform_orders["id"], TRANSFORM_ORDERS_DATACODE)
        order += 1

        formula = cp.create_widget(
            model_id,
            formula_widget(
                x=pipeline_x0 + 560,
                y=pipeline_y,
                order_index=order,
                input_source_id=widget_ids["orders"],
            ),
        )
        widget_ids["formula"] = formula["id"]
        cp.save_widget_code(model_id, formula["id"], FORMULA_DATACODE)
        order += 1

        aggregate = cp.create_widget(
            model_id,
            aggregate_widget(x=pipeline_x0 + 940, y=pipeline_y, order_index=order),
        )
        widget_ids["aggregate"] = aggregate["id"]
        cp.save_widget_code(model_id, aggregate["id"], AGGREGATE_DATACODE)
        order += 1

        aggregate_region = cp.create_widget(
            model_id,
            aggregate_by_region_widget(x=pipeline_x0 + 940, y=pipeline_y + 160, order_index=order),
        )
        widget_ids["aggregate_region"] = aggregate_region["id"]
        cp.save_widget_code(model_id, aggregate_region["id"], AGGREGATE_BY_REGION_DATACODE)
        order += 1

        # --- customers transform ---
        transform_customers = cp.create_widget(
            model_id,
            transform_customers_widget(x=pipeline_x0, y=pipeline_y + 200, order_index=order),
        )
        widget_ids["transform_customers"] = transform_customers["id"]
        cp.save_widget_code(model_id, transform_customers["id"], TRANSFORM_CUSTOMERS_DATACODE)
        order += 1

        # --- relationships ---
        relationship = cp.create_widget(
            model_id,
            relationship_widget(x=pipeline_x0 + 280, y=pipeline_y + 200, order_index=order),
        )
        widget_ids["relationship"] = relationship["id"]
        cp.save_widget_code(model_id, relationship["id"], RELATIONSHIP_DATACODE)
        order += 1

        relationship_products = cp.create_widget(
            model_id,
            relationship_products_widget(x=pipeline_x0 + 520, y=pipeline_y + 200, order_index=order),
        )
        widget_ids["relationship_products"] = relationship_products["id"]
        cp.save_widget_code(model_id, relationship_products["id"], RELATIONSHIP_PRODUCTS_DATACODE)
        order += 1

        relationship_payments = cp.create_widget(
            model_id,
            relationship_payments_widget(x=pipeline_x0 + 760, y=pipeline_y + 200, order_index=order),
        )
        widget_ids["relationship_payments"] = relationship_payments["id"]
        cp.save_widget_code(model_id, relationship_payments["id"], RELATIONSHIP_PAYMENTS_DATACODE)
        order += 1

        relationship_profiles = cp.create_widget(
            model_id,
            relationship_profiles_widget(x=pipeline_x0 + 280, y=pipeline_y + 360, order_index=order),
        )
        widget_ids["relationship_profiles"] = relationship_profiles["id"]
        cp.save_widget_code(model_id, relationship_profiles["id"], RELATIONSHIP_PROFILES_DATACODE)
        order += 1

        relationship_order_items = cp.create_widget(
            model_id,
            relationship_order_items_widget(x=pipeline_x0 + 520, y=pipeline_y + 360, order_index=order),
        )
        widget_ids["relationship_order_items"] = relationship_order_items["id"]
        cp.save_widget_code(model_id, relationship_order_items["id"], RELATIONSHIP_ORDER_ITEMS_DATACODE)
        order += 1

        relationship_regions = cp.create_widget(
            model_id,
            relationship_regions_widget(x=pipeline_x0 + 760, y=pipeline_y + 360, order_index=order),
        )
        widget_ids["relationship_regions"] = relationship_regions["id"]
        cp.save_widget_code(model_id, relationship_regions["id"], RELATIONSHIP_REGIONS_DATACODE)
        order += 1

        for idx, var in enumerate(MODEL_VARIABLES):
            created = cp.create_widget(
                model_id,
                model_variable_widget(var, x=pipeline_x0 + 1220, y=pipeline_y + idx * 140, order_index=order),
            )
            widget_ids[f"var_{var['name']}"] = created["id"]
            cp.save_widget_code(model_id, created["id"], model_variable_datacode(var))
            order += 1

        relationships = build_relationships(widget_ids)
        cp.update_relationships(model_id, relationships)

        preview = cp.compile_preview(model_id)

    widget_pipeline = [
        *[spec.name for spec in TABLES],
        "filter",
        "transform_orders",
        "formula",
        "aggregate",
        "aggregate_region",
        "transform_customers",
        "relationship",
        "relationship_products",
        "relationship_payments",
        "relationship_profiles",
        "relationship_order_items",
        "relationship_regions",
        *[f"var_{var['name']}" for var in MODEL_VARIABLES],
    ]

    result = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "control_plane_url": urls.control_plane,
        "developer_api_url": urls.developer_api,
        "admin_email": email,
        "model_id": model_id,
        "model_name": model_name,
        "dataset_fingerprint": dataset_fingerprint(),
        "tables": {spec.name: ingest_config_for_table(spec) for spec in TABLES},
        "widget_ids": widget_ids,
        "widget_pipeline": widget_pipeline,
        "relationships": relationships,
        "api_key_id": key_data["id"],
        "api_key": key_data["api_key"],
        "read_api_key_id": read_key_data["id"],
        "read_api_key": read_key_data["api_key"],
        "merged_code_preview": preview.get("merged_code", ""),
        "merged_widget_ids": preview.get("merged_widget_ids", []),
    }
    return result


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)
    try:
        result = create_test_model(args)
    except Exception as exc:
        print(f"create_model: FAILED — {exc}", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    save_json(output_path, result)

    print("create_model: OK")
    print(f"  model_id={result['model_id']}")
    print(f"  model_name={result['model_name']}")
    print(f"  tables={list(result['tables'].keys())}")
    print(f"  widgets={len(result['widget_pipeline'])}")
    print(f"  relationships={len(result['relationships'])}")
    print(f"  dataset_fingerprint={result['dataset_fingerprint']}")
    print(f"  credentials={output_path}")
    print(f"  api_key={result['api_key'][:24]}...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
