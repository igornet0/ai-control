#!/usr/bin/env python3
"""
Стримит / пушит демо-данные в API-источники модели.

Использует credentials.json из create_model.py.

Режимы:
  --once       один проход: все snapshot + seed stream/append (по умолчанию)
  --stream     циклически обновляет orders (+ payments)
  --append     циклически добавляет events

Пример:
  cd src && poetry run python ../scripts/test/model_data/stream_data.py --env dev
  cd src && poetry run python ../scripts/test/model_data/stream_data.py --stream --iterations 5
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    DEFAULT_CREDENTIALS_PATH,
    DeveloperApiClient,
    bootstrap_settings,
    load_json,
    wait_deploy,
)
from fixtures import (  # noqa: E402
    APPEND_EVENTS,
    INITIAL_CUSTOMER_PROFILES,
    INITIAL_CUSTOMERS,
    INITIAL_ORDER_ITEMS,
    INITIAL_ORDERS,
    INITIAL_PAYMENTS,
    INITIAL_PRODUCTS,
    INITIAL_REGIONS,
    INITIAL_WAREHOUSES,
    STREAM_ORDER_UPDATES,
    STREAM_PAYMENT_UPDATES,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--credentials", default=str(DEFAULT_CREDENTIALS_PATH))
    p.add_argument("--skip-initial", action="store_true", help="Не делать начальный ingest")
    p.add_argument("--stream", action="store_true", help="Цикл stream-обновлений orders/payments")
    p.add_argument("--append", action="store_true", help="Цикл append events")
    p.add_argument("--iterations", type=int, default=3, help="Число итераций для --stream/--append")
    p.add_argument("--interval-sec", type=float, default=2.5, help="Пауза между итерациями stream/append")
    p.add_argument("--chunk-size", type=int, default=100, help="Размер батча для bulk ingest")
    p.add_argument("--wait-deploy", action="store_true", default=True, help="Ждать deploy после каждого шага")
    p.add_argument("--no-wait-deploy", dest="wait_deploy", action="store_false")
    p.add_argument("--timeout-sec", type=float, default=180.0)
    return p.parse_args()


def _print_step(label: str, resp: dict) -> None:
    skipped = resp.get("skipped")
    status = resp.get("deploy_status")
    req_id = resp.get("request_id")
    suffix = " (skipped)" if skipped else ""
    print(f"  {label}: request_id={req_id} deploy_status={status}{suffix}")


def _chunked(rows: list, size: int) -> list[list]:
    if size <= 0:
        return [rows]
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def _ingest_chunks(
    dev: DeveloperApiClient,
    table: str,
    rows: list,
    *,
    mode: str,
    chunk_size: int,
    wait: bool,
    timeout: float,
) -> None:
    chunks = _chunked(rows, chunk_size)
    for i, chunk in enumerate(chunks):
        resp = dev.ingest_json(table, chunk, mode=mode)
        label = f"{table} {mode}" if len(chunks) == 1 else f"{table} {mode} [{i + 1}/{len(chunks)}]"
        _print_step(label, resp)
        if wait:
            wait_deploy(dev, [table], timeout_sec=timeout)


def push_initial_data(
    dev: DeveloperApiClient,
    *,
    wait: bool,
    timeout: float,
    chunk_size: int,
) -> None:
    print("stream_data: initial ingest (demo dataset)")

    # Dimension / catalog snapshots first
    _ingest_chunks(
        dev, "regions", INITIAL_REGIONS, mode="snapshot", chunk_size=chunk_size, wait=wait, timeout=timeout
    )
    _ingest_chunks(
        dev,
        "warehouses",
        INITIAL_WAREHOUSES,
        mode="snapshot",
        chunk_size=chunk_size,
        wait=wait,
        timeout=timeout,
    )
    _ingest_chunks(
        dev,
        "customers",
        INITIAL_CUSTOMERS,
        mode="snapshot",
        chunk_size=chunk_size,
        wait=wait,
        timeout=timeout,
    )
    _ingest_chunks(
        dev,
        "customer_profiles",
        INITIAL_CUSTOMER_PROFILES,
        mode="snapshot",
        chunk_size=chunk_size,
        wait=wait,
        timeout=timeout,
    )
    _ingest_chunks(
        dev, "products", INITIAL_PRODUCTS, mode="snapshot", chunk_size=chunk_size, wait=wait, timeout=timeout
    )
    _ingest_chunks(
        dev,
        "order_items",
        INITIAL_ORDER_ITEMS,
        mode="snapshot",
        chunk_size=chunk_size,
        wait=wait,
        timeout=timeout,
    )

    # Facts
    _ingest_chunks(
        dev, "orders", INITIAL_ORDERS, mode="stream", chunk_size=chunk_size, wait=wait, timeout=timeout
    )
    _ingest_chunks(
        dev, "payments", INITIAL_PAYMENTS, mode="stream", chunk_size=chunk_size, wait=wait, timeout=timeout
    )
    _ingest_chunks(
        dev, "events", APPEND_EVENTS, mode="append", chunk_size=chunk_size, wait=wait, timeout=timeout
    )

    rows = dev.table_rows("orders", limit=20)
    total = rows.get("total_count", 0)
    if total > 0:
        print(f"  orders rows in latest.db: {rows.get('row_count', 0)}/{total}")
    else:
        print("  orders rows in latest.db: pending (compile will materialize from persistent store)")

    print(
        "  seed sizes: "
        f"regions={len(INITIAL_REGIONS)} warehouses={len(INITIAL_WAREHOUSES)} "
        f"customers={len(INITIAL_CUSTOMERS)} profiles={len(INITIAL_CUSTOMER_PROFILES)} "
        f"products={len(INITIAL_PRODUCTS)} "
        f"orders={len(INITIAL_ORDERS)} order_items={len(INITIAL_ORDER_ITEMS)} "
        f"payments={len(INITIAL_PAYMENTS)} events={len(APPEND_EVENTS)}"
    )


def stream_orders_loop(
    dev: DeveloperApiClient,
    *,
    iterations: int,
    interval_sec: float,
    wait: bool,
    timeout: float,
) -> None:
    print(f"stream_data: stream loop ({iterations} iterations)")
    customer_ids = [c["id"] for c in INITIAL_CUSTOMERS]
    product_ids = [p["id"] for p in INITIAL_PRODUCTS]
    region_ids = [r["id"] for r in INITIAL_REGIONS]
    channels = ["web", "mobile", "partner", "store"]

    for i in range(iterations):
        order_id = f"o_stream_{i}"
        created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        amount = float(random.randint(10, 500))
        row = {
            "id": order_id,
            "customer_id": random.choice(customer_ids),
            "product_id": random.choice(product_ids),
            "qty": random.randint(1, 5),
            "amount": amount,
            "status": "active",
            "region_id": random.choice(region_ids),
            "channel": random.choice(channels),
            "created_at": created,
        }
        resp = dev.ingest_json("orders", [row], mode="stream")
        _print_step(f"orders stream [{i + 1}/{iterations}]", resp)

        pay = {
            "id": f"pay_stream_{i}",
            "order_id": order_id,
            "method": random.choice(["card", "wallet", "invoice"]),
            "amount": amount,
            "paid_at": created,
            "status": "paid",
        }
        resp_p = dev.ingest_json("payments", [pay], mode="stream")
        _print_step(f"payments stream [{i + 1}/{iterations}]", resp_p)

        if wait:
            wait_deploy(dev, ["orders", "payments"], timeout_sec=timeout)
        if i < iterations - 1:
            time.sleep(interval_sec)

    time.sleep(max(interval_sec, 1.5))
    resp = dev.ingest_json("orders", STREAM_ORDER_UPDATES, mode="stream")
    _print_step("orders stream updates", resp)
    resp = dev.ingest_json("payments", STREAM_PAYMENT_UPDATES, mode="stream")
    _print_step("payments stream updates", resp)
    if wait:
        wait_deploy(dev, ["orders", "payments"], timeout_sec=timeout)


def append_events_loop(
    dev: DeveloperApiClient,
    *,
    iterations: int,
    interval_sec: float,
    wait: bool,
    timeout: float,
) -> None:
    print(f"stream_data: append loop ({iterations} iterations)")
    channels = ["web", "mobile", "partner", "store"]
    for i in range(iterations):
        row = {
            "event_type": "heartbeat",
            "entity_id": f"loop_{i}",
            "payload": f"tick_{i}",
            "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "channel": random.choice(channels),
        }
        resp = dev.ingest_json("events", [row], mode="append")
        _print_step(f"events append [{i + 1}/{iterations}]", resp)
        if wait:
            wait_deploy(dev, ["events"], timeout_sec=timeout)
        if i < iterations - 1:
            time.sleep(interval_sec)


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)

    creds_path = Path(args.credentials)
    if not creds_path.is_file():
        print(f"stream_data: credentials not found: {creds_path}", file=sys.stderr)
        print("Run create_model.py first.", file=sys.stderr)
        return 1

    creds = load_json(creds_path)
    dev_url = creds["developer_api_url"]
    api_key = creds["api_key"]

    with DeveloperApiClient(dev_url, api_key) as dev:
        if not args.skip_initial:
            push_initial_data(
                dev,
                wait=args.wait_deploy,
                timeout=args.timeout_sec,
                chunk_size=args.chunk_size,
            )

        if args.stream:
            stream_orders_loop(
                dev,
                iterations=args.iterations,
                interval_sec=args.interval_sec,
                wait=args.wait_deploy,
                timeout=args.timeout_sec,
            )
        if args.append:
            append_events_loop(
                dev,
                iterations=args.iterations,
                interval_sec=args.interval_sec,
                wait=args.wait_deploy,
                timeout=args.timeout_sec,
            )

        status = dev.ingest_status()
        print("stream_data: final ingest status")
        for table, info in (status.get("tables") or {}).items():
            print(
                f"  {table}: mode={info.get('mode')} "
                f"deploy={info.get('deploy_status')} rows={info.get('last_row_count')}"
            )

    print("stream_data: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
