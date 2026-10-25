#!/usr/bin/env python3
"""
Live path check for data-model 46: data-input insert → smart-compile queue → ok.

Exercises the real HTTP API against a running stack (localhost:8000 by default).

What it verifies
----------------
1. POST /api/data/insert into categories (widget 468) and transactions (widget 469)
2. processing_config.ingest.tables.<name>.smart_compile_status == ok
3. Prints which Datacode pieces belong to the transactions subgraph
   (filter 445 + aggregate 446 → transactions_category)

Usage
-----
  python scripts/test/model_data/verify_data_input_smart_compile_path.py \\
    --model-id 46 --email admin@example.com --password admin123

Env
---
  CONTROL_PLANE_URL   default http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "py-worm"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

DEFAULT_MODEL = 46
DEFAULT_CAT_WIDGET = 468
DEFAULT_TX_WIDGET = 469


def login(base: str, email: str, password: str) -> str:
    r = httpx.post(
        f"{base.rstrip('/')}/auth/login_user/",
        json={"email": email, "password": password},
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_json(client: httpx.Client, path: str):
    r = client.get(path)
    r.raise_for_status()
    return r.json()


def print_widget_codes(client: httpx.Client, model_id: int) -> None:
    widgets = get_json(client, f"/api/data-models/{model_id}/widgets")
    if isinstance(widgets, dict):
        widgets = widgets.get("widgets") or widgets.get("items") or []
    print("\n=== Model widgets / Datacode pieces ===")
    for w in widgets:
        wid = w.get("id")
        wtype = w.get("widget_type")
        settings = ((w.get("widget_config") or {}).get("settings")) or {}
        name = settings.get("name") or ""
        print(f"\n--- widget {wid} ({wtype}) {name!r} ---")
        try:
            code = get_json(client, f"/api/data-models/{model_id}/code?widget_id={wid}")
        except Exception as exc:
            print(f"  (no code: {exc})")
            continue
        cd = code.get("code_data") or code
        tabs = (cd.get("tabs") if isinstance(cd, dict) else None) or []
        for tab in tabs:
            content = (tab.get("content") or "").strip()
            if content:
                print(content[:600])
                if len(content) > 600:
                    print("  …")


def smart_status(model: dict, table: str) -> dict:
    pc = model.get("processing_config") or {}
    ingest = pc.get("ingest") or {}
    tables = ingest.get("tables") or ingest
    info = tables.get(table) if isinstance(tables, dict) else {}
    return info if isinstance(info, dict) else {}


def wait_smart_ok(
    client: httpx.Client,
    model_id: int,
    table: str,
    *,
    timeout_sec: float = 60.0,
) -> dict:
    deadline = time.time() + timeout_sec
    last = {}
    while time.time() < deadline:
        model = get_json(client, f"/api/data-models/{model_id}")
        last = smart_status(model, table)
        status = last.get("smart_compile_status")
        print(
            f"  poll {table}: status={status!r} "
            f"affected={last.get('smart_compile_affected_tables')} "
            f"exec={last.get('smart_compile_execution_id')}"
        )
        if status == "ok":
            return last
        if status == "failed":
            raise RuntimeError(f"smart compile failed for {table}: {last.get('smart_compile_error')}")
        time.sleep(1.5)
    raise TimeoutError(f"smart compile not ok for {table} within {timeout_sec}s; last={last}")


def read_latest_rows(model_id: int) -> None:
    link = SRC / "data_models" / str(model_id) / "sqlite_db" / "latest.db"
    if not link.exists():
        print(f"latest.db missing: {link}")
        return
    real = link.resolve()
    print(f"\n=== SQLite {real} ===")
    conn = sqlite3.connect(str(real))
    try:
        for table in ("categories", "transactions", "transactions_category"):
            try:
                rows = list(conn.execute(f'SELECT * FROM "{table}"'))
            except sqlite3.Error as exc:
                print(f"{table}: error {exc}")
                continue
            print(f"{table}: {len(rows)} row(s)")
            for row in rows[-5:]:
                print(f"  {row}")
    finally:
        conn.close()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", default=os.environ.get("CONTROL_PLANE_URL", "http://127.0.0.1:8000"))
    p.add_argument("--email", default="admin@example.com")
    p.add_argument("--password", default="admin123")
    p.add_argument("--model-id", type=int, default=DEFAULT_MODEL)
    p.add_argument("--categories-widget-id", type=int, default=DEFAULT_CAT_WIDGET)
    p.add_argument("--transactions-widget-id", type=int, default=DEFAULT_TX_WIDGET)
    p.add_argument("--skip-insert", action="store_true")
    args = p.parse_args()

    token = login(args.base_url, args.email, args.password)
    suffix = uuid.uuid4().hex[:8]
    cat_id = f"path-{suffix}"
    tx_id = f"tx-{suffix}"

    with httpx.Client(base_url=args.base_url, headers=auth_headers(token), timeout=60.0) as client:
        print_widget_codes(client, args.model_id)

        if not args.skip_insert:
            print("\n=== INSERT categories ===")
            cat_schema = get_json(client, f"/api/data/widgets/{args.categories_widget_id}/schema")
            r = client.post(
                "/api/data/insert",
                json={
                    "widget_id": args.categories_widget_id,
                    "data": {"id": cat_id, "name": f"Path {suffix}", "is_income": False},
                    "schema_hash": cat_schema.get("schema_hash"),
                },
            )
            print(r.status_code, r.text[:300])
            r.raise_for_status()
            cat_smart = wait_smart_ok(client, args.model_id, "categories")

            print("\n=== INSERT transactions ===")
            tx_schema = get_json(client, f"/api/data/widgets/{args.transactions_widget_id}/schema")
            r = client.post(
                "/api/data/insert",
                json={
                    "widget_id": args.transactions_widget_id,
                    "data": {
                        "id": tx_id,
                        "category_id": cat_id,
                        "type": "Расход",
                        "amount": 42.5,
                        "date": "2026-08-27T12:00:00",
                        "description": "path verify",
                    },
                    "schema_hash": tx_schema.get("schema_hash"),
                },
            )
            print(r.status_code, r.text[:300])
            r.raise_for_status()
            tx_smart = wait_smart_ok(client, args.model_id, "transactions")

            print("\n=== RESULT ===")
            print("categories smart_compile:", json.dumps(cat_smart, ensure_ascii=False, indent=2))
            print("transactions smart_compile:", json.dumps(tx_smart, ensure_ascii=False, indent=2))
            print(
                "\nExpected Datacode for transactions insert:\n"
                "  widget 443 source + 445 filter + 446 aggregate\n"
                "  affected: transactions, transactions_category"
            )
            if "transactions_category" not in (tx_smart.get("smart_compile_affected_tables") or []):
                print(
                    "WARNING: transactions_category missing from affected_tables — "
                    "check filter/aggregate Datacode on the model canvas."
                )

        read_latest_rows(args.model_id)

        # Fail the script if the insert was wiped by smart compile.
        link = SRC / "data_models" / str(args.model_id) / "sqlite_db" / "latest.db"
        if link.exists() and not args.skip_insert:
            conn = sqlite3.connect(str(link.resolve()))
            try:
                cat_n = conn.execute(
                    "SELECT COUNT(*) FROM categories WHERE id = ?", (cat_id,)
                ).fetchone()[0]
                tx_n = conn.execute(
                    "SELECT COUNT(*) FROM transactions WHERE id = ?", (tx_id,)
                ).fetchone()[0]
                agg_n = conn.execute(
                    "SELECT COUNT(*) FROM transactions_category WHERE category_id = ?",
                    (cat_id,),
                ).fetchone()[0]
            finally:
                conn.close()
            print(
                f"\n=== ASSERT rows cat={cat_n} tx={tx_n} agg={agg_n} ==="
            )
            if cat_n < 1:
                print("FAIL: category row missing after smart compile")
                return 1
            if tx_n < 1:
                print(
                    "FAIL: transaction row wiped (0 rows). "
                    "Likely interactive table([]) reset during smart compile."
                )
                return 1
            if agg_n < 1:
                print(
                    "FAIL: transactions_category missing aggregate for inserted category"
                )
                return 1
            print("PASS: data-input rows survived smart compile + aggregate updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
