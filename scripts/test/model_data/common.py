"""Shared helpers for data-model integration scripts."""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = REPO_ROOT / "src"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_CREDENTIALS_PATH = OUTPUT_DIR / "credentials.json"


def bootstrap_settings(env: str | None) -> None:
    if str(SRC_ROOT) not in sys.path:
        sys.path.insert(0, str(SRC_ROOT))
    from core.settings import auto_load_settings

    auto_load_settings(env)


def load_settings():
    bootstrap_settings(None)
    from core.settings import get_settings

    return get_settings()


def make_code_data(content: str, tab_name: str = "Main") -> dict[str, Any]:
    return {"tabs": [{"name": tab_name, "content": content}]}


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass
class ServiceUrls:
    control_plane: str
    developer_api: str


@dataclass
class AuthContext:
    token: str
    email: str


class ControlPlaneClient:
    def __init__(self, base_url: str, token: str):
        self.base = base_url.rstrip("/")
        self.client = httpx.Client(
            timeout=120.0,
            headers={"Authorization": f"Bearer {token}"},
        )

    def close(self) -> None:
        self.client.close()

    def __enter__(self) -> ControlPlaneClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _url(self, path: str) -> str:
        return f"{self.base}{path}"

    def create_model(self, name: str, description: str) -> dict[str, Any]:
        resp = self.client.post(
            self._url("/api/data-models/"),
            json={
                "name": name,
                "description": description,
                "is_public": False,
                "is_active": True,
                "formulas": {},
                "filters": {},
                "relationships": {},
                "processing_config": {},
            },
        )
        resp.raise_for_status()
        return resp.json()

    def create_widget(self, model_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        body = {"data_model_id": model_id, **payload}
        resp = self.client.post(self._url(f"/api/data-models/{model_id}/widgets"), json=body)
        resp.raise_for_status()
        return resp.json()

    def save_widget_code(self, model_id: int, widget_id: int, code: str) -> None:
        resp = self.client.post(
            self._url(f"/api/data-models/{model_id}/code"),
            json={
                "widget_id": widget_id,
                "code_data": make_code_data(code),
                "increment_version": True,
            },
        )
        resp.raise_for_status()

    def update_relationships(self, model_id: int, relationships: dict[str, Any]) -> None:
        resp = self.client.put(
            self._url(f"/api/data-models/{model_id}/relationships"),
            json={"relationships": relationships},
        )
        resp.raise_for_status()

    def configure_ingest(self, model_id: int, table: str, config: dict[str, Any]) -> None:
        resp = self.client.post(
            self._url(f"/api/api-keys/ingest-config/{model_id}/tables/{table}"),
            json=config,
        )
        resp.raise_for_status()

    def create_api_key(
        self,
        *,
        name: str,
        scope_type: str,
        data_model_id: int | None = None,
        allowed_tables: list[str] | None = None,
        access_level: str = "ingest",
        ingest_config: dict[str, Any] | None = None,
        rate_limit_per_min: int = 15,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "name": name,
            "scope_type": scope_type,
            "access_level": access_level,
            "rate_limit_per_min": rate_limit_per_min,
        }
        if data_model_id is not None:
            body["data_model_id"] = data_model_id
        if allowed_tables is not None:
            body["allowed_tables"] = allowed_tables
        if ingest_config is not None:
            body["ingest_config"] = ingest_config
        resp = self.client.post(self._url("/api/api-keys/"), json=body)
        resp.raise_for_status()
        return resp.json()

    def compile_model(self, model_id: int) -> dict[str, Any]:
        resp = self.client.post(
            self._url(f"/api/data-models/{model_id}/compile-model"),
            json={"files": [], "smb_connections": []},
        )
        resp.raise_for_status()
        return resp.json()

    def compile_preview(self, model_id: int) -> dict[str, Any]:
        resp = self.client.get(self._url(f"/api/data-models/{model_id}/compile-model/preview"))
        resp.raise_for_status()
        return resp.json()

    def sqlite_schema(self, model_id: int) -> dict[str, Any]:
        resp = self.client.get(self._url(f"/api/data-models/{model_id}/sqlite-db/schema"))
        resp.raise_for_status()
        return resp.json()

    def export_model(self, model_id: int) -> dict[str, Any]:
        resp = self.client.get(self._url(f"/api/data-models/{model_id}/export-json"))
        resp.raise_for_status()
        return resp.json()


class DeveloperApiClient:
    def __init__(self, base_url: str, api_key: str):
        self.base = base_url.rstrip("/")
        self.api_key = api_key
        self.client = httpx.Client(
            timeout=120.0,
            headers={"X-API-Key": api_key},
        )

    def close(self) -> None:
        self.client.close()

    def __enter__(self) -> DeveloperApiClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _url(self, path: str) -> str:
        return f"{self.base}{path}"

    def ingest_json(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        mode: str | None = None,
        max_retries: int = 5,
    ) -> dict[str, Any]:
        params = {"mode": mode} if mode else None
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            resp = self.client.post(
                self._url(f"/api/v1/ingest/tables/{table}"),
                params=params,
                json=rows,
            )
            if resp.status_code == 429 and attempt < max_retries - 1:
                wait_sec = _retry_after_seconds(resp)
                time.sleep(wait_sec)
                continue
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                raise
            return resp.json()
        if last_exc:
            raise last_exc
        raise RuntimeError("ingest_json failed without response")

    def ingest_status(self, max_retries: int = 5) -> dict[str, Any]:
        return self._get_json("/api/v1/ingest/status", max_retries=max_retries)

    def table_rows(self, table: str, row_id: str | None = None, limit: int = 100) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if row_id is not None:
            params["id"] = row_id
        return self._get_json(f"/api/v1/ingest/tables/{table}/rows", params=params)

    def compile(self) -> dict[str, Any]:
        resp = self.client.post(self._url("/api/v1/models/compile"), json={})
        resp.raise_for_status()
        return resp.json()

    def model_detail(self) -> dict[str, Any]:
        return self._get_json("/api/v1/models/detail")

    def _get_json(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        max_retries: int = 5,
    ) -> dict[str, Any]:
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            resp = self.client.get(self._url(path), params=params)
            if resp.status_code == 429 and attempt < max_retries - 1:
                time.sleep(_retry_after_seconds(resp))
                continue
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                raise
            return resp.json()
        if last_exc:
            raise last_exc
        raise RuntimeError(f"GET {path} failed without response")


def login_control_plane(base_url: str, email: str, password: str) -> AuthContext:
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            f"{base_url.rstrip('/')}/auth/login_user/",
            json={"email": email, "password": password},
        )
        resp.raise_for_status()
        token = resp.json()["access_token"]
    return AuthContext(token=token, email=email)


def _retry_after_seconds(resp: httpx.Response) -> float:
    header = resp.headers.get("Retry-After")
    if header:
        try:
            return max(float(header), 1.0)
        except ValueError:
            pass
    detail = ""
    try:
        detail = str(resp.json().get("detail", ""))
    except Exception:
        detail = resp.text
    import re

    match = re.search(r"retry in (\d+)s", detail, re.IGNORECASE)
    if match:
        return max(float(match.group(1)), 1.0)
    return 2.0


def wait_deploy(
    dev: DeveloperApiClient,
    tables: list[str],
    *,
    timeout_sec: float = 120.0,
    poll_sec: float = 3.0,
    accept_statuses: tuple[str, ...] = ("deployed", "stored"),
) -> dict[str, str]:
    deadline = time.time() + timeout_sec
    last_status: dict[str, str] = {}
    while time.time() < deadline:
        status = dev.ingest_status()
        tables_info = status.get("tables") or {}
        all_done = True
        for table in tables:
            info = tables_info.get(table) or {}
            deploy_status = info.get("deploy_status") or "unknown"
            last_status[table] = deploy_status
            if deploy_status not in accept_statuses:
                all_done = False
            if deploy_status == "failed":
                raise RuntimeError(f"Deploy failed for table {table!r}: {info.get('deploy_error')}")
        if all_done:
            return last_status
        time.sleep(poll_sec)
    raise TimeoutError(
        f"Deploy timeout after {timeout_sec}s; last status: {last_status}"
    )
