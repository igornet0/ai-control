import argparse
import json
import os
import random
import time

import dotenv
import requests

dotenv.load_dotenv()

API_URL = os.getenv("API__URL", "http://127.0.0.1:8002").rstrip("/")
API_KEY = os.getenv("API__KEY_STREAM")
TABLE_NAME = os.getenv("API__TABLE_NAME_STREAM", "source_66")

# Stable entity ids for stream upsert (upsert_keys=["id"] in control-plane).
DEFAULT_ENTITY_IDS = ["sensor_1", "sensor_2"]

POLL_INTERVAL_SEC = 2
DEPLOY_TIMEOUT_SEC = 120
MAX_RATE_LIMIT_RETRIES = 8


def _post_with_retry(url: str, **kwargs) -> requests.Response:
    """POST with sleep/retry on HTTP 429."""
    response: requests.Response | None = None
    for attempt in range(MAX_RATE_LIMIT_RETRIES):
        response = requests.post(url, **kwargs)
        if response.status_code != 429:
            return response
        retry_after = response.headers.get("Retry-After")
        try:
            wait_sec = max(1, int(retry_after)) if retry_after else POLL_INTERVAL_SEC * (attempt + 1)
        except ValueError:
            wait_sec = POLL_INTERVAL_SEC * (attempt + 1)
        print(f"Rate limited (429), retry in {wait_sec}s (attempt {attempt + 1}/{MAX_RATE_LIMIT_RETRIES})")
        time.sleep(wait_sec)
    assert response is not None
    return response


class Sensor:
    def __init__(self, initial: int = 0) -> None:
        self.parametr = initial

    def get_parametr(self) -> int:
        self.parametr += random.randint(1, 10) * random.choice([-1, 1])
        if self.parametr < 0:
            self.parametr = abs(self.parametr)
        elif self.parametr >= 100:
            self.parametr = 99
        return self.parametr


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {API_KEY}"}


def _ingest_url(mode: str | None = None) -> str:
    url = f"{API_URL}/api/v1/ingest/tables/{TABLE_NAME}"
    if mode:
        return f"{url}?mode={mode}"
    return url


def _rows_url(entity_id: str | None = None) -> str:
    url = f"{API_URL}/api/v1/ingest/tables/{TABLE_NAME}/rows"
    if entity_id:
        return f"{url}?id={requests.utils.quote(entity_id)}"
    return url


def init_stream_table(entity_ids: list[str] | None = None) -> None:
    """Seed rows via stream upsert (source must be configured as stream)."""
    ids = entity_ids or DEFAULT_ENTITY_IDS
    seed = [{"id": eid, "value": 0} for eid in ids]
    response = _post_with_retry(
        _ingest_url("stream"),
        json=seed,
        headers=_auth_headers(),
        timeout=60,
    )
    if response.status_code == 200:
        print("Stream table initialized:", json.dumps(response.json(), ensure_ascii=False))
    else:
        print("Failed to initialize stream table:", response.status_code, response.text)
        raise SystemExit(1)


def wait_for_deploy(table_name: str | None = None) -> None:
    """Poll ingest status until table is deployed or timeout."""
    table = table_name or TABLE_NAME
    deadline = time.time() + DEPLOY_TIMEOUT_SEC
    status_url = f"{API_URL}/api/v1/ingest/status"

    while time.time() < deadline:
        response = requests.get(status_url, headers=_auth_headers(), timeout=30)
        if response.status_code != 200:
            print("Status poll failed:", response.status_code, response.text)
            time.sleep(POLL_INTERVAL_SEC)
            continue

        body = response.json()
        table_status = (body.get("tables") or {}).get(table) or {}
        deploy_status = table_status.get("deploy_status")
        if deploy_status == "deployed":
            print(f"Deploy complete for {table!r}")
            return
        if deploy_status == "stored":
            print(f"Data stored in Persistent Store for {table!r} (latest.db pending compile)")
            return
        if deploy_status == "failed":
            err = table_status.get("deploy_error") or "unknown"
            print(f"Deploy failed for {table!r}: {err}")
            raise SystemExit(1)

        time.sleep(POLL_INTERVAL_SEC)

    print(f"Timed out waiting for deploy of {table!r}")
    raise SystemExit(1)


def fetch_entity_ids() -> list[str]:
    """Read existing ids from latest.db via Developer API."""
    response = requests.get(_rows_url(), headers=_auth_headers(), timeout=60)
    if response.status_code != 200:
        print("Failed to fetch rows:", response.status_code, response.text)
        return []

    body = response.json()
    rows = body.get("rows") or []
    ids = [str(row["id"]) for row in rows if row.get("id") not in (None, "")]
    if ids:
        print(f"Existing entity ids from server: {ids}")
    return ids


def fetch_row_by_id(entity_id: str) -> dict | None:
    response = requests.get(_rows_url(entity_id), headers=_auth_headers(), timeout=60)
    if response.status_code != 200:
        return None
    rows = response.json().get("rows") or []
    return rows[0] if rows else None


def stream_data(
    sensors: dict[str, Sensor],
    entity_ids: list[str],
    *,
    test: bool = False,
    interval_sec: float = 10,
) -> None:
    url = _ingest_url("stream")
    idx = 0
    while True:
        entity_id = entity_ids[idx % len(entity_ids)]
        idx += 1
        sensor = sensors[entity_id]
        value = sensor.get_parametr()
        payload = {"id": entity_id, "value": value}

        if test:
            print(f"Stream payload: {payload}")
            time.sleep(interval_sec)
            continue

        response = _post_with_retry(url, json=[payload], headers=_auth_headers(), timeout=60)
        if response.status_code == 200:
            body = response.json()
            print("Data accepted:", json.dumps(body, ensure_ascii=False))
            wait_for_deploy()
            current = fetch_row_by_id(entity_id)
            if current:
                print(f"  current row {entity_id!r}: {current}")
        else:
            print("Failed to send data:", response.status_code, response.text)
        time.sleep(interval_sec)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream ingest harness with snapshot init")
    parser.add_argument("--test", action="store_true", help="Print payloads only, no HTTP POST loop")
    parser.add_argument("--init-only", action="store_true", help="Only snapshot-init the table")
    parser.add_argument(
        "--stream-only",
        action="store_true",
        help="Skip init; assume table exists (reads ids from server when possible)",
    )
    args = parser.parse_args()

    if not API_KEY:
        print("API__KEY_STREAM is not set")
        raise SystemExit(1)

    if args.test:
        print("Test mode enabled")
        print(f"API URL: {API_URL}")
        print(f"Table: {TABLE_NAME}")

    entity_ids = list(DEFAULT_ENTITY_IDS)

    if not args.stream_only:
        init_stream_table(entity_ids)
        if not args.test:
            wait_for_deploy()
        if args.init_only:
            raise SystemExit(0)

    if not args.init_only:
        if not args.test and args.stream_only:
            server_ids = fetch_entity_ids()
            if server_ids:
                entity_ids = server_ids

        sensors = {eid: Sensor(initial=0) for eid in entity_ids}
        stream_data(sensors, entity_ids, test=args.test)
