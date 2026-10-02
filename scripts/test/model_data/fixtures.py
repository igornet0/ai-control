"""Demo / test model layout: tables, widgets, seed payloads, DataCode fixtures.

Expanded e-commerce schema for platform demos while keeping the original
orders → filter → transform → formula → aggregate pipeline.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass(frozen=True)
class TableSpec:
    name: str
    mode: str
    columns: list[str]
    upsert_keys: list[str] = field(default_factory=list)
    min_interval_sec: int = 1


TABLES: list[TableSpec] = [
    TableSpec(
        name="regions",
        mode="snapshot",
        columns=["id", "name", "manager"],
    ),
    TableSpec(
        name="warehouses",
        mode="snapshot",
        columns=["id", "region_id", "name", "capacity"],
    ),
    TableSpec(
        name="customers",
        mode="snapshot",
        columns=["id", "name", "email", "segment", "region", "created_at"],
    ),
    TableSpec(
        name="customer_profiles",
        mode="snapshot",
        columns=["id", "customer_id", "phone", "loyalty_tier", "preferred_channel"],
    ),
    TableSpec(
        name="products",
        mode="snapshot",
        columns=["id", "name", "category", "price", "cost"],
    ),
    TableSpec(
        name="orders",
        mode="stream",
        columns=[
            "id",
            "customer_id",
            "product_id",
            "qty",
            "amount",
            "status",
            "region_id",
            "channel",
            "created_at",
        ],
        upsert_keys=["id"],
        min_interval_sec=1,
    ),
    TableSpec(
        name="order_items",
        mode="snapshot",
        columns=["id", "order_id", "product_id", "qty", "line_total"],
    ),
    TableSpec(
        name="payments",
        mode="stream",
        columns=["id", "order_id", "method", "amount", "paid_at", "status"],
        upsert_keys=["id"],
        min_interval_sec=1,
    ),
    TableSpec(
        name="events",
        mode="append",
        columns=["row_id", "event_type", "entity_id", "payload", "ts", "channel"],
    ),
]


def ingest_config_for_table(spec: TableSpec) -> dict[str, Any]:
    cfg: dict[str, Any] = {"mode": spec.mode}
    if spec.upsert_keys:
        cfg["upsert_keys"] = list(spec.upsert_keys)
    if spec.mode in ("stream", "append"):
        cfg["min_interval_sec"] = spec.min_interval_sec
    return cfg


# ---------------------------------------------------------------------------
# Deterministic demo seed
# ---------------------------------------------------------------------------

_FIRST = [
    "Alice", "Bob", "Carol", "Diana", "Evan", "Fay", "Gus", "Hana", "Ivan", "Jade",
    "Kyle", "Lena", "Mila", "Nate", "Olga", "Pete", "Quinn", "Rita", "Sam", "Tina",
]
_LAST = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore",
]
_SEGMENTS = ["enterprise", "smb", "startup", "consumer"]
_CHANNELS = ["web", "mobile", "partner", "store"]
_STATUSES = ["active", "active", "active", "pending", "cancelled", "shipped", "delivered"]
_PAY_METHODS = ["card", "card", "invoice", "wallet", "cash"]
_PAY_STATUSES = ["paid", "paid", "paid", "pending", "failed", "refunded"]
_EVENT_TYPES = [
    "order_created",
    "order_updated",
    "customer_viewed",
    "payment_ok",
    "payment_fail",
    "stock_low",
    "shipment",
]
_LOYALTY = ["bronze", "silver", "gold", "platinum"]
_PREF_CHANNELS = ["email", "sms", "push", "phone"]
_CATEGORIES = [
    ("Electronics", ["Phone X", "Laptop Pro", "Tablet Air", "Headphones", "Monitor 27"]),
    ("Home", ["Lamp Arc", "Chair Flex", "Desk Oak", "Shelf Mini", "Rug Soft"]),
    ("Apparel", ["Jacket North", "Sneaker Run", "Hoodie Soft", "Cap Classic", "Tee Basic"]),
    ("Food", ["Coffee Pack", "Tea Box", "Snack Mix", "Water Case", "Sauce Set"]),
    ("Services", ["Support Plus", "Cloud Starter", "Training Day", "Audit Pack", "SLA Gold"]),
]
_REGION_NAMES = [
    ("r_nw", "Northwest", "Anna K."),
    ("r_ne", "Northeast", "Boris L."),
    ("r_cw", "Central West", "Chris M."),
    ("r_ce", "Central East", "Dana N."),
    ("r_sw", "Southwest", "Elena O."),
    ("r_se", "Southeast", "Felix P."),
    ("r_ur", "Urals", "Gleb Q."),
    ("r_sib", "Siberia", "Hanna R."),
]


def _rng(seed: int = 42) -> random.Random:
    return random.Random(seed)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_demo_dataset(*, seed: int = 42) -> dict[str, list[dict[str, Any]]]:
    """Reproducible seed rows for all demo tables."""
    rng = _rng(seed)
    base = datetime(2025, 1, 1, 8, 0, 0, tzinfo=timezone.utc)

    regions = [
        {"id": rid, "name": name, "manager": mgr}
        for rid, name, mgr in _REGION_NAMES
    ]
    region_ids = [r["id"] for r in regions]

    warehouses: list[dict[str, Any]] = []
    for i, rid in enumerate(region_ids[:6]):
        warehouses.append(
            {
                "id": f"wh_{i + 1}",
                "region_id": rid,
                "name": f"Warehouse {i + 1}",
                "capacity": 800 + i * 150 + rng.randint(0, 200),
            }
        )

    customers: list[dict[str, Any]] = []
    for i in range(40):
        first = _FIRST[i % len(_FIRST)]
        last = _LAST[i % len(_LAST)]
        pad = "  " if i % 7 == 0 else (" " if i % 5 == 0 else "")
        customers.append(
            {
                "id": f"c{i + 1}",
                "name": f"{pad}{first} {last}{pad}",
                "email": f"{first.lower()}.{last.lower()}{i + 1}@example.com",
                "segment": _SEGMENTS[i % len(_SEGMENTS)],
                "region": region_ids[i % len(region_ids)],
                "created_at": _iso(base + timedelta(days=i * 3, hours=i % 12)),
            }
        )
    customer_ids = [c["id"] for c in customers]

    customer_profiles: list[dict[str, Any]] = []
    for i, cid in enumerate(customer_ids):
        customer_profiles.append(
            {
                "id": f"cp{i + 1}",
                "customer_id": cid,
                "phone": f"+1555{1000000 + i:07d}",
                "loyalty_tier": _LOYALTY[i % len(_LOYALTY)],
                "preferred_channel": _PREF_CHANNELS[i % len(_PREF_CHANNELS)],
            }
        )

    products: list[dict[str, Any]] = []
    pid = 1
    for cat, names in _CATEGORIES:
        for name in names:
            price = round(rng.uniform(12, 900), 2)
            cost = round(price * rng.uniform(0.35, 0.7), 2)
            products.append(
                {
                    "id": f"p{pid}",
                    "name": name,
                    "category": cat,
                    "price": price,
                    "cost": cost,
                }
            )
            pid += 1
    product_ids = [p["id"] for p in products]
    product_by_id = {p["id"]: p for p in products}

    orders: list[dict[str, Any]] = []
    order_items: list[dict[str, Any]] = []
    payments: list[dict[str, Any]] = []
    item_n = 1
    pay_n = 1

    for i in range(400):
        oid = f"o{i + 1}"
        cid = customer_ids[rng.randint(0, len(customer_ids) - 1)]
        pid_sel = product_ids[rng.randint(0, len(product_ids) - 1)]
        qty = rng.randint(1, 6)
        unit = float(product_by_id[pid_sel]["price"])
        amount = round(unit * qty * rng.uniform(0.9, 1.15), 2)
        status = _STATUSES[rng.randint(0, len(_STATUSES) - 1)]
        region_id = region_ids[rng.randint(0, len(region_ids) - 1)]
        channel = _CHANNELS[rng.randint(0, len(_CHANNELS) - 1)]
        created = base + timedelta(days=rng.randint(0, 200), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
        orders.append(
            {
                "id": oid,
                "customer_id": cid,
                "product_id": pid_sel,
                "qty": qty,
                "amount": amount,
                "status": status,
                "region_id": region_id,
                "channel": channel,
                "created_at": _iso(created),
            }
        )

        n_lines = 1 if rng.random() < 0.55 else 2
        for _ in range(n_lines):
            p2 = product_ids[rng.randint(0, len(product_ids) - 1)]
            q2 = rng.randint(1, 4)
            line_total = round(float(product_by_id[p2]["price"]) * q2, 2)
            order_items.append(
                {
                    "id": f"oi{item_n}",
                    "order_id": oid,
                    "product_id": p2,
                    "qty": q2,
                    "line_total": line_total,
                }
            )
            item_n += 1

        if status != "cancelled" and rng.random() < 0.88:
            pay_status = "paid" if status in ("shipped", "delivered", "active") else _PAY_STATUSES[rng.randint(0, len(_PAY_STATUSES) - 1)]
            payments.append(
                {
                    "id": f"pay{pay_n}",
                    "order_id": oid,
                    "method": _PAY_METHODS[rng.randint(0, len(_PAY_METHODS) - 1)],
                    "amount": amount if pay_status != "failed" else round(amount * 0.5, 2),
                    "paid_at": _iso(created + timedelta(hours=rng.randint(1, 48))),
                    "status": pay_status,
                }
            )
            pay_n += 1

    events: list[dict[str, Any]] = []
    for i in range(80):
        et = _EVENT_TYPES[i % len(_EVENT_TYPES)]
        entity = orders[i % len(orders)]["id"] if "order" in et or et == "shipment" else customers[i % len(customers)]["id"]
        events.append(
            {
                "event_type": et,
                "entity_id": entity,
                "payload": f"seed_{i}",
                "ts": _iso(base + timedelta(hours=i * 3)),
                "channel": _CHANNELS[i % len(_CHANNELS)],
            }
        )

    return {
        "regions": regions,
        "warehouses": warehouses,
        "customers": customers,
        "customer_profiles": customer_profiles,
        "products": products,
        "orders": orders,
        "order_items": order_items,
        "payments": payments,
        "events": events,
    }


DEMO_DATASET = build_demo_dataset()

INITIAL_REGIONS = DEMO_DATASET["regions"]
INITIAL_WAREHOUSES = DEMO_DATASET["warehouses"]
INITIAL_CUSTOMERS = DEMO_DATASET["customers"]
INITIAL_CUSTOMER_PROFILES = DEMO_DATASET["customer_profiles"]
INITIAL_PRODUCTS = DEMO_DATASET["products"]
INITIAL_ORDERS = DEMO_DATASET["orders"]
INITIAL_ORDER_ITEMS = DEMO_DATASET["order_items"]
INITIAL_PAYMENTS = DEMO_DATASET["payments"]
APPEND_EVENTS = DEMO_DATASET["events"]

# Small deterministic updates applied once after stream loop
STREAM_ORDER_UPDATES: list[dict[str, Any]] = [
    {
        "id": "o2",
        "customer_id": INITIAL_ORDERS[1]["customer_id"],
        "product_id": INITIAL_ORDERS[1]["product_id"],
        "qty": INITIAL_ORDERS[1]["qty"],
        "amount": round(float(INITIAL_ORDERS[1]["amount"]) * 1.1, 2),
        "status": "active",
        "region_id": INITIAL_ORDERS[1]["region_id"],
        "channel": INITIAL_ORDERS[1]["channel"],
        "created_at": INITIAL_ORDERS[1]["created_at"],
    },
    {
        "id": "o_stream_demo",
        "customer_id": "c1",
        "product_id": "p1",
        "qty": 2,
        "amount": 199.0,
        "status": "active",
        "region_id": "r_nw",
        "channel": "web",
        "created_at": _iso(datetime(2025, 8, 1, 12, 0, 0, tzinfo=timezone.utc)),
    },
]

STREAM_PAYMENT_UPDATES: list[dict[str, Any]] = [
    {
        "id": "pay_stream_demo",
        "order_id": "o_stream_demo",
        "method": "card",
        "amount": 199.0,
        "paid_at": _iso(datetime(2025, 8, 1, 13, 0, 0, tzinfo=timezone.utc)),
        "status": "paid",
    },
]


# ---------------------------------------------------------------------------
# Model canvas widgets
# ---------------------------------------------------------------------------


def api_source_widget(spec: TableSpec, *, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "data-source",
        "widget_config": {
            "settings": {
                "name": spec.name.replace("_", " ").title(),
                "sourceType": "api",
                "tableName": spec.name,
                "apiIngestMode": spec.mode,
                "selectedColumns": list(spec.columns),
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def filter_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "processing-block",
        "widget_config": {
            "settings": {
                "name": "Active orders",
                "blockType": "filter",
                "filterConditions": [
                    {"id": "c_status", "field": "status", "operator": "eq", "value": "active"}
                ],
                "filterLogic": "and",
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def transform_customers_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "processing-block",
        "widget_config": {
            "settings": {
                "name": "Clean customers",
                "blockType": "transform",
                "transformOperations": [
                    {
                        "id": "op_trim",
                        "type": "trim",
                        "enabled": True,
                        "params": {"columns": ["name"]},
                    },
                    {
                        "id": "op_upper",
                        "type": "upper",
                        "enabled": True,
                        "params": {"columns": ["name"]},
                    },
                    {
                        "id": "op_rename",
                        "type": "renameColumn",
                        "enabled": True,
                        "params": {"column": "email", "newName": "email_address"},
                    },
                ],
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def transform_orders_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "processing-block",
        "widget_config": {
            "settings": {
                "name": "Normalize orders",
                "blockType": "transform",
                "transformOperations": [
                    {
                        "id": "op_amount_float",
                        "type": "changeType",
                        "enabled": True,
                        "params": {"column": "amount", "targetType": "float"},
                    },
                    {
                        "id": "op_rename_status",
                        "type": "renameColumn",
                        "enabled": True,
                        "params": {"column": "status", "newName": "order_status"},
                    },
                ],
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def formula_widget(*, x: int, y: int, order_index: int, input_source_id: int | None = None) -> dict[str, Any]:
    return {
        "widget_type": "formula",
        "widget_config": {
            "settings": {
                "name": "Order VAT",
                "description": "amount_vat = amount * 1.2",
                "inputSourceId": input_source_id,
                "expressions": [
                    {"name": "amount_vat", "expression": "amount * 1.2"},
                ],
                "outputMode": "add",
                "availableFields": [
                    "id",
                    "customer_id",
                    "product_id",
                    "qty",
                    "amount",
                    "order_status",
                    "region_id",
                    "channel",
                    "created_at",
                ],
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 350,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def _relationship_widget(*, x: int, y: int, order_index: int, settings: dict[str, Any]) -> dict[str, Any]:
    return {
        "widget_type": "relationship",
        "widget_config": {"settings": settings},
        "position_x": x,
        "position_y": y,
        "width": 220,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def relationship_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """1:N customers.id ← orders.customer_id"""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Customers → Orders",
            "relationshipType": "one-to-many",
            "fromField": "customers.id",
            "toField": "orders.customer_id",
            "description": "FK: orders.customer_id → customers.id",
            "pk": {"tableVariable": "customers", "column": "id"},
            "foreignKeys": [
                {"id": "fk_orders_customer", "tableVariable": "orders", "column": "customer_id"},
            ],
        },
    )


def relationship_products_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """1:N products.id ← orders.product_id"""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Products → Orders",
            "relationshipType": "one-to-many",
            "fromField": "products.id",
            "toField": "orders.product_id",
            "description": "FK: orders.product_id → products.id",
            "pk": {"tableVariable": "products", "column": "id"},
            "foreignKeys": [
                {"id": "fk_orders_product", "tableVariable": "orders", "column": "product_id"},
            ],
        },
    )


def relationship_payments_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """1:N orders.id ← payments.order_id"""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Orders → Payments",
            "relationshipType": "one-to-many",
            "fromField": "orders.id",
            "toField": "payments.order_id",
            "description": "FK: payments.order_id → orders.id",
            "pk": {"tableVariable": "orders", "column": "id"},
            "foreignKeys": [
                {"id": "fk_payments_order", "tableVariable": "payments", "column": "order_id"},
            ],
        },
    )


def relationship_profiles_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """1:1 customers.id ← customer_profiles.customer_id (unique FK)."""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Customers → Profiles",
            "relationshipType": "one-to-one",
            "fromField": "customers.id",
            "toField": "customer_profiles.customer_id",
            "description": "1:1 FK: customer_profiles.customer_id → customers.id",
            "pk": {"tableVariable": "customers", "column": "id"},
            "foreignKeys": [
                {
                    "id": "fk_profile_customer",
                    "tableVariable": "customer_profiles",
                    "column": "customer_id",
                },
            ],
        },
    )


def relationship_order_items_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """N:M orders ↔ products via order_items (two 1:N relates)."""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Orders ↔ Products",
            "relationshipType": "many-to-many",
            "description": "orders ↔ products via order_items",
            "left": {"tableVariable": "orders", "column": "id"},
            "right": {"tableVariable": "products", "column": "id"},
            "junction": {
                "tableVariable": "order_items",
                "leftColumn": "order_id",
                "rightColumn": "product_id",
            },
        },
    )


def relationship_regions_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    """1:N regions.id ← warehouses.region_id"""
    return _relationship_widget(
        x=x,
        y=y,
        order_index=order_index,
        settings={
            "name": "Regions → Warehouses",
            "relationshipType": "one-to-many",
            "fromField": "regions.id",
            "toField": "warehouses.region_id",
            "description": "FK: warehouses.region_id → regions.id",
            "pk": {"tableVariable": "regions", "column": "id"},
            "foreignKeys": [
                {"id": "fk_wh_region", "tableVariable": "warehouses", "column": "region_id"},
            ],
        },
    )


def aggregate_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "processing-block",
        "widget_config": {
            "settings": {
                "name": "Orders by customer",
                "blockType": "aggregate",
                "aggregateGroupBy": [{"field": "customer_id"}],
                "aggregateMetrics": [
                    {"field": "amount", "func": "sum", "alias": "total_amount", "enabled": True},
                    {"func": "count", "alias": "order_count", "enabled": True},
                ],
                "aggregateSeparateOutput": True,
                "exportGlobal": True,
                "dataCodeVariableName": "orders_by_customer",
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def aggregate_by_region_widget(*, x: int, y: int, order_index: int) -> dict[str, Any]:
    return {
        "widget_type": "processing-block",
        "widget_config": {
            "settings": {
                "name": "Orders by region",
                "blockType": "aggregate",
                "aggregateGroupBy": [{"field": "region_id"}],
                "aggregateMetrics": [
                    {"field": "amount", "func": "sum", "alias": "region_amount", "enabled": True},
                    {"func": "count", "alias": "region_orders", "enabled": True},
                ],
                "aggregateSeparateOutput": True,
                "exportGlobal": True,
                "dataCodeVariableName": "orders_by_region",
            }
        },
        "position_x": x,
        "position_y": y,
        "width": 250,
        "order_index": order_index,
        "is_visible": True,
        "refresh_interval": 60,
    }


def source_datacode(spec: TableSpec) -> str:
    cols = ", ".join(f'"{c}"' for c in spec.columns)
    var_name = spec.name
    return (
        f'global {var_name} = source_table("{spec.name}", [{cols}])\n'
        f'print("{var_name}: ", table_info({var_name}))'
    )


FILTER_DATACODE = """# Filter: Active orders
# Input table: orders
orders = orders[("status" == "active")]
print("orders: ", table_info(orders))"""

TRANSFORM_CUSTOMERS_DATACODE = """# Transform: Clean customers
# Input table: customers
customers = customers.map("name", trim)
customers = customers.map("name", upper)
customers = customers.rename("email", "email_address")
print("customers: ", table_info(customers))"""

TRANSFORM_ORDERS_DATACODE = """# Transform: Normalize orders
# Input table: orders
orders = orders.map("amount", float)
orders = orders.rename("status", "order_status")
print("orders: ", table_info(orders))"""

FORMULA_DATACODE = """# Formula: Order VAT
# Input table: orders
# expressions: amount_vat = amount * 1.2 (outputMode=add)
orders!["amount_vat"] = orders["amount"].map(fn(v) => v * 1.2)
print("orders: ", table_info(orders))"""

RELATIONSHIP_DATACODE = """# Relationship: Customers → Orders
# 1:N — relate(PK, FK…) first arg is primary key, rest are foreign keys on it
primary_key(customers["id"])
relate(customers["id"], orders["customer_id"])
global orders_customers = left_join(orders, customers, "customer_id", "id")
print("orders_customers: ", table_info(orders_customers))"""

RELATIONSHIP_PRODUCTS_DATACODE = """# Relationship: Products → Orders
# 1:N — relate(PK, FK…) first arg is primary key, rest are foreign keys on it
primary_key(products["id"])
relate(products["id"], orders["product_id"])
global orders_products = left_join(orders, products, "product_id", "id")
print("orders_products: ", table_info(orders_products))"""

RELATIONSHIP_PAYMENTS_DATACODE = """# Relationship: Orders → Payments
# 1:N — relate(PK, FK…) first arg is primary key, rest are foreign keys on it
primary_key(orders["id"])
relate(orders["id"], payments["order_id"])
global orders_payments = left_join(payments, orders, "order_id", "id")
print("orders_payments: ", table_info(orders_payments))"""

RELATIONSHIP_PROFILES_DATACODE = """# Relationship: Customers → Profiles
# 1:1 — relate(PK, FK) first arg is primary key, rest are foreign keys on it
primary_key(customers["id"])
relate(customers["id"], customer_profiles["customer_id"])
global customer_profiles_joined = left_join(customer_profiles, customers, "customer_id", "id")
print("customer_profiles_joined: ", table_info(customer_profiles_joined))"""

RELATIONSHIP_ORDER_ITEMS_DATACODE = """# Relationship: Orders ↔ Products
# N:M — two 1:N relates through a junction table
primary_key(orders["id"])
primary_key(products["id"])
relate(orders["id"], order_items["order_id"])
relate(products["id"], order_items["product_id"])"""

RELATIONSHIP_REGIONS_DATACODE = """# Relationship: Regions → Warehouses
# 1:N — relate(PK, FK…) first arg is primary key, rest are foreign keys on it
primary_key(regions["id"])
relate(regions["id"], warehouses["region_id"])
global warehouses_regions = left_join(warehouses, regions, "region_id", "id")
print("warehouses_regions: ", table_info(warehouses_regions))"""

AGGREGATE_DATACODE = """# Aggregate: Orders by customer
# Input table: orders
global orders_by_customer = orders.aggregate_group({
  group: "customer_id",
  total_amount: { op: "sum", column: "amount" },
  order_count: "count"
})
print("orders_by_customer: ", table_info(orders_by_customer))"""

AGGREGATE_BY_REGION_DATACODE = """# Aggregate: Orders by region
# Input table: orders
global orders_by_region = orders.aggregate_group({
  group: "region_id",
  region_amount: { op: "sum", column: "amount" },
  region_orders: "count"
})
print("orders_by_region: ", table_info(orders_by_region))"""


def build_relationships(widget_ids: dict[str, int]) -> dict[str, Any]:
    """Canvas connections between sources and processing blocks."""
    orders_id = str(widget_ids["orders"])
    customers_id = str(widget_ids["customers"])
    products_id = str(widget_ids["products"])
    payments_id = str(widget_ids["payments"])
    filter_id = str(widget_ids["filter"])
    transform_orders_id = str(widget_ids["transform_orders"])
    formula_id = str(widget_ids["formula"])
    aggregate_id = str(widget_ids["aggregate"])
    aggregate_region_id = str(widget_ids["aggregate_region"])
    transform_customers_id = str(widget_ids["transform_customers"])
    relationship_id = str(widget_ids["relationship"])
    relationship_products_id = str(widget_ids["relationship_products"])
    relationship_payments_id = str(widget_ids["relationship_payments"])
    relationship_profiles_id = str(widget_ids["relationship_profiles"])
    relationship_order_items_id = str(widget_ids["relationship_order_items"])
    relationship_regions_id = str(widget_ids["relationship_regions"])
    profiles_id = str(widget_ids["customer_profiles"])
    order_items_id = str(widget_ids["order_items"])
    regions_id = str(widget_ids["regions"])
    warehouses_id = str(widget_ids["warehouses"])

    return {
        "conn_orders_filter": {
            "id": "conn_orders_filter",
            "from": orders_id,
            "to": filter_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_filter_transform_orders": {
            "id": "conn_filter_transform_orders",
            "from": filter_id,
            "to": transform_orders_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_transform_orders_formula": {
            "id": "conn_transform_orders_formula",
            "from": transform_orders_id,
            "to": formula_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_formula_aggregate": {
            "id": "conn_formula_aggregate",
            "from": formula_id,
            "to": aggregate_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_formula_aggregate_region": {
            "id": "conn_formula_aggregate_region",
            "from": formula_id,
            "to": aggregate_region_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_customers_transform": {
            "id": "conn_customers_transform",
            "from": customers_id,
            "to": transform_customers_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "customers",
                "dataCodeVariableName": "customers",
            },
        },
        "conn_orders_customers_join": {
            "id": "conn_orders_customers_join",
            "from": orders_id,
            "to": customers_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "orders",
                "toTable": "customers",
                "joinKeys": [{"from": "customer_id", "to": "id"}],
            },
        },
        "conn_orders_products_join": {
            "id": "conn_orders_products_join",
            "from": orders_id,
            "to": products_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "orders",
                "toTable": "products",
                "joinKeys": [{"from": "product_id", "to": "id"}],
            },
        },
        "conn_payments_orders_join": {
            "id": "conn_payments_orders_join",
            "from": payments_id,
            "to": orders_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "payments",
                "toTable": "orders",
                "joinKeys": [{"from": "order_id", "to": "id"}],
            },
        },
        "conn_transform_customers_relationship": {
            "id": "conn_transform_customers_relationship",
            "from": transform_customers_id,
            "to": relationship_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "customers",
                "dataCodeVariableName": "customers",
            },
        },
        "conn_formula_relationship": {
            "id": "conn_formula_relationship",
            "from": formula_id,
            "to": relationship_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_products_relationship": {
            "id": "conn_products_relationship",
            "from": products_id,
            "to": relationship_products_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "products",
                "dataCodeVariableName": "products",
            },
        },
        "conn_formula_relationship_products": {
            "id": "conn_formula_relationship_products",
            "from": formula_id,
            "to": relationship_products_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_orders_relationship_payments": {
            "id": "conn_orders_relationship_payments",
            "from": orders_id,
            "to": relationship_payments_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_payments_relationship": {
            "id": "conn_payments_relationship",
            "from": payments_id,
            "to": relationship_payments_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "payments",
                "dataCodeVariableName": "payments",
            },
        },
        "conn_profiles_customers_join": {
            "id": "conn_profiles_customers_join",
            "from": profiles_id,
            "to": customers_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "customer_profiles",
                "toTable": "customers",
                "joinKeys": [{"from": "customer_id", "to": "id"}],
            },
        },
        "conn_transform_customers_relationship_profiles": {
            "id": "conn_transform_customers_relationship_profiles",
            "from": transform_customers_id,
            "to": relationship_profiles_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "customers",
                "dataCodeVariableName": "customers",
            },
        },
        "conn_profiles_relationship": {
            "id": "conn_profiles_relationship",
            "from": profiles_id,
            "to": relationship_profiles_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "customer_profiles",
                "dataCodeVariableName": "customer_profiles",
            },
        },
        "conn_order_items_orders_join": {
            "id": "conn_order_items_orders_join",
            "from": order_items_id,
            "to": orders_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "order_items",
                "toTable": "orders",
                "joinKeys": [{"from": "order_id", "to": "id"}],
            },
        },
        "conn_order_items_products_join": {
            "id": "conn_order_items_products_join",
            "from": order_items_id,
            "to": products_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "order_items",
                "toTable": "products",
                "joinKeys": [{"from": "product_id", "to": "id"}],
            },
        },
        "conn_formula_relationship_nm": {
            "id": "conn_formula_relationship_nm",
            "from": formula_id,
            "to": relationship_order_items_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "orders",
                "dataCodeVariableName": "orders",
            },
        },
        "conn_products_relationship_nm": {
            "id": "conn_products_relationship_nm",
            "from": products_id,
            "to": relationship_order_items_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "products",
                "dataCodeVariableName": "products",
            },
        },
        "conn_order_items_relationship_nm": {
            "id": "conn_order_items_relationship_nm",
            "from": order_items_id,
            "to": relationship_order_items_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "order_items",
                "dataCodeVariableName": "order_items",
            },
        },
        "conn_warehouses_regions_join": {
            "id": "conn_warehouses_regions_join",
            "from": warehouses_id,
            "to": regions_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "fromTable": "warehouses",
                "toTable": "regions",
                "joinKeys": [{"from": "region_id", "to": "id"}],
            },
        },
        "conn_regions_relationship": {
            "id": "conn_regions_relationship",
            "from": regions_id,
            "to": relationship_regions_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "regions",
                "dataCodeVariableName": "regions",
            },
        },
        "conn_warehouses_relationship": {
            "id": "conn_warehouses_relationship",
            "from": warehouses_id,
            "to": relationship_regions_id,
            "fromType": "output",
            "toType": "input",
            "settings": {
                "inputVariable": "warehouses",
                "dataCodeVariableName": "warehouses",
            },
        },
    }


def dataset_fingerprint() -> str:
    """Stable hash of seed sizes for logs / verify hints."""
    parts = [f"{k}:{len(v)}" for k, v in sorted(DEMO_DATASET.items())]
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Compiled SQLite view (filter + transform + formula on seed, no extra stream)
# ---------------------------------------------------------------------------

COMPILED_ORDERS_COLUMNS = [
    "id",
    "customer_id",
    "product_id",
    "qty",
    "amount",
    "order_status",
    "region_id",
    "channel",
    "created_at",
    "amount_vat",
]
COMPILED_CUSTOMERS_COLUMNS = [
    "id",
    "name",
    "email_address",
    "segment",
    "region",
    "created_at",
]


def compiled_orders_rows(dataset: dict[str, list[dict[str, Any]]] | None = None) -> list[dict[str, Any]]:
    """Seed orders after in-place filter/transform/formula (what latest.db `orders` holds)."""
    data = dataset or DEMO_DATASET
    rows: list[dict[str, Any]] = []
    for order in data["orders"]:
        if order["status"] != "active":
            continue
        amount = float(order["amount"])
        rows.append(
            {
                "id": order["id"],
                "customer_id": order["customer_id"],
                "product_id": order["product_id"],
                "qty": int(order["qty"]),
                "amount": amount,
                "order_status": "active",
                "region_id": order["region_id"],
                "channel": order["channel"],
                "created_at": order["created_at"],
                "amount_vat": round(amount * 1.2, 2),
            }
        )
    return rows


def compiled_customers_rows(dataset: dict[str, list[dict[str, Any]]] | None = None) -> list[dict[str, Any]]:
    data = dataset or DEMO_DATASET
    rows: list[dict[str, Any]] = []
    for customer in data["customers"]:
        rows.append(
            {
                "id": customer["id"],
                "name": str(customer["name"]).strip().upper(),
                "email_address": customer["email"],
                "segment": customer["segment"],
                "region": customer["region"],
                "created_at": customer["created_at"],
            }
        )
    return rows


def _sum_amount(rows: list[dict[str, Any]]) -> float:
    return round(sum(float(r["amount"]) for r in rows), 2)


def _kpi_block(rows: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(rows)
    total = _sum_amount(rows)
    return {
        "count": n,
        "sum_amount": total,
        "avg_amount": round(total / n, 2) if n else 0.0,
        "sum_amount_vat": round(sum(float(r["amount_vat"]) for r in rows), 2),
    }


def expected_compiled_snapshot(dataset: dict[str, list[dict[str, Any]]] | None = None) -> dict[str, Any]:
    """Deterministic KPI / filter expectations for the seed after compile (no extra stream)."""
    data = dataset or DEMO_DATASET
    orders = compiled_orders_rows(data)
    customers = compiled_customers_rows(data)
    base = _kpi_block(orders)

    def slice_eq(field: str, value: str) -> dict[str, Any]:
        return _kpi_block([r for r in orders if r.get(field) == value])

    by_region = {
        rid: _kpi_block([r for r in orders if r["region_id"] == rid])
        for rid in sorted({r["region_id"] for r in orders})
    }
    by_channel = {
        ch: _kpi_block([r for r in orders if r["channel"] == ch])
        for ch in sorted({r["channel"] for r in orders})
    }
    by_customer: dict[str, dict[str, Any]] = {}
    for row in orders:
        bucket = by_customer.setdefault(row["customer_id"], {"order_count": 0, "total_amount": 0.0})
        bucket["order_count"] += 1
        bucket["total_amount"] = round(bucket["total_amount"] + float(row["amount"]), 2)

    return {
        "seed_orders": len(data["orders"]),
        "seed_customers": len(customers),
        "seed_products": len(data["products"]),
        "seed_order_items": len(data["order_items"]),
        "seed_payments": len(data["payments"]),
        "orders_columns": list(COMPILED_ORDERS_COLUMNS),
        "customers_columns": list(COMPILED_CUSTOMERS_COLUMNS),
        "orders": base,
        "by_region": by_region,
        "by_channel": by_channel,
        "orders_by_customer_rows": len(by_customer),
        "filters": {
            "none": {**base, "label": "без фильтра", "field": None, "value": None},
            "order_status_active": {
                **slice_eq("order_status", "active"),
                "label": "order_status = active",
                "field": "order_status",
                "value": "active",
            },
            "order_status_pending": {
                **_kpi_block([]),
                "label": "order_status = pending",
                "field": "order_status",
                "value": "pending",
                "note": "pending отфильтрован на этапе compile (остаются только active)",
            },
            "region_r_nw": {
                **slice_eq("region_id", "r_nw"),
                "label": "region_id = r_nw",
                "field": "region_id",
                "value": "r_nw",
            },
            "channel_web": {
                **slice_eq("channel", "web"),
                "label": "channel = web",
                "field": "channel",
                "value": "web",
            },
        },
    }
