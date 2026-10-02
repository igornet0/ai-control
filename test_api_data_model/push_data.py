import argparse
import json
import os
import random
import time

import dotenv
import requests

dotenv.load_dotenv()

API_KEY = os.getenv("API__KEY_SNAPSHOT")
API_URL = os.getenv("API__URL", "http://127.0.0.1:8002").rstrip("/")
TABLE_NAME = os.getenv("API__TABLE_NAME_SNAPSHOT", "source_66")

columns = ["A", "B", "C", "D", "E"]


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {API_KEY}"}


def _random_payload() -> dict[str, list[int]]:
    return {column: [random.randint(0, 100) for _ in range(100)] for column in columns}


def init_source() -> None:
    """First snapshot: creates the table. Re-running with the same body is skipped server-side."""
    url = f"{API_URL}/api/v1/ingest/tables/{TABLE_NAME}"
    data = _random_payload()
    response = requests.post(url, json=data, headers=_auth_headers(), timeout=60)
    if response.status_code == 200:
        body = response.json()
        print("Source initialized:", json.dumps(body, ensure_ascii=False))
    else:
        print("Failed to initialize source:", response.status_code, response.text)


def push_data() -> None:
    """New snapshot with fresh values → replaces previous ingest row after deploy."""
    url = f"{API_URL}/api/v1/ingest/tables/{TABLE_NAME}?mode=snapshot"
    data = _random_payload()
    response = requests.post(url, json=data, headers=_auth_headers(), timeout=60)
    if response.status_code == 200:
        body = response.json()
        print("Data accepted:", json.dumps(body, ensure_ascii=False))
    else:
        print("Failed to send data:", response.status_code, response.text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--push-only",
        action="store_true",
        help="Skip init; only send a new snapshot payload",
    )
    args = parser.parse_args()

    if not API_KEY:
        print("API__KEY is not set")
        raise SystemExit(1)
    if not args.push_only:
        init_source()
        time.sleep(1)
    push_data()
