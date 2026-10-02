# Dashboard query service — performance knobs

Rust `dashboard-query-server` exposes additional backpressure limits and Prometheus-style metrics (`GET /metrics`).

## Environment variables

| Variable | Default | Role |
|---------|---------|------|
| `DASHBOARD_QUERY_MAX_INFLIGHT_QUERY` | `16` | Cap concurrent `/sqlite/query` handlers |
| `DASHBOARD_QUERY_MAX_INFLIGHT_DISTINCT` | `8` | Cap concurrent `/sqlite/column-distinct` |
| `DASHBOARD_QUERY_MAX_INFLIGHT_SCHEMA` | `3` | Cap concurrent `/sqlite/schema` |
| `DASHBOARD_QUERY_MAX_INFLIGHT_BATCH` | `8` | Cap concurrent `/sqlite/query-batch` |
| `DASHBOARD_QUERY_BATCH_WORKERS` | `4` | Worker threads inside a batch |

When a limit is exceeded the service responds with **429 Too Many Requests** and a JSON `detail` string.

`/metrics` includes gauges (`*_inflight`) and coarse latency histogram buckets per route (`*_latency_hist{bucket="..."}`).

Interactive schema calls should pass `include_row_count: false` in the FastAPI/Python gateway unless row counts are required (avoids expensive `COUNT(*)` per table).

## Synthetic bench

```bash
# optional: point at a real SQLite file for schema probe
export DASHBOARD_QUERY_DB=/path/to/model.sqlite
export DASHBOARD_QUERY_URL=http://127.0.0.1:8787
python3 scripts/dashboard_query_hotpath_bench.py
```

## Frontend diagnostics

`getDashboardSqliteClientDiagnostics()` in `front-ai-control/src/services/dashboardQueryService.js` returns queue depth, average client-side wait before a request starts, and high-water concurrent runs (dev console).
