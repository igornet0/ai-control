#!/usr/bin/env python3
"""Light synthetic bench for dashboard-query-server: latency + Prometheus /metrics scrape.

Uses env:
  DASHBOARD_QUERY_URL — base URL, default http://127.0.0.1:8787
  DASHBOARD_QUERY_DB  — absolute path inside container/host to SQLite file used for probe

Runs a few noop-friendly requests where possible (health always; metrics always).
Other routes require a real DB path compatible with dashboard_query fixtures.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request


def get(url: str, timeout: float = 5.0) -> tuple[float, int]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read()
    finally:
        dt = time.perf_counter() - t0
    return dt, len(body)


def post_json(url: str, payload: dict, timeout: float = 30.0) -> tuple[float, int, int]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            _ = r.read()
            status = r.getcode()
    except urllib.error.HTTPError as e:
        status = e.code
        _ = e.read()
    dt = time.perf_counter() - t0
    return dt, status, len(data)


def main() -> int:
    base = os.environ.get("DASHBOARD_QUERY_URL", "http://127.0.0.1:8787").rstrip("/")
    db = os.environ.get("DASHBOARD_QUERY_DB")

    rows = []
    d, nbytes = get(f"{base}/health")
    rows.append(("GET /health", d, nbytes, 200))

    d, nbytes = get(f"{base}/metrics")
    rows.append(("GET /metrics", d, nbytes, 200))

    if db:
        body = {"database_path": db, "model_id": 1, "execution_id": "bench", "include_row_count": False}
        d, st, _ = post_json(f"{base}/internal/v1/sqlite/schema", body)
        rows.append(("POST /sqlite/schema", d, 0, st))

    print("dashboard_query_hotpath_bench")
    print(f"{'op':<32} {'sec':>10} {'note':>6}")
    for name, dt, nbytes, meta in rows:
        note = f"{meta}" if isinstance(meta, int) and nbytes == 0 else f"{meta} nbytes={nbytes}"
        print(f"{name:<32} {dt:10.4f} {note}")

    snap = urllib.request.urlopen(f"{base}/metrics", timeout=5).read().decode("utf-8", "replace")
    wanted = ("dashboard_sqlite_query_inflight", "dashboard_sqlite_distinct_inflight")
    for line in snap.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        for w in wanted:
            if line.startswith(w):
                print(line)
                break

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
