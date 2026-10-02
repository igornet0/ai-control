"""Shared helpers for dashboard integration scripts."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
MODEL_DATA_DIR = SCRIPT_DIR.parent / "model_data"
OUTPUT_DIR = SCRIPT_DIR / "output"
DEFAULT_DASHBOARD_CREDENTIALS = OUTPUT_DIR / "credentials.json"
DEFAULT_MODEL_CREDENTIALS = MODEL_DATA_DIR / "output" / "credentials.json"


def _load_model_data_common():
    path = MODEL_DATA_DIR / "common.py"
    spec = importlib.util.spec_from_file_location("model_data_common", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["model_data_common"] = mod
    spec.loader.exec_module(mod)
    return mod


_md = _load_model_data_common()
bootstrap_settings = _md.bootstrap_settings
load_json = _md.load_json
load_settings = _md.load_settings
login_control_plane = _md.login_control_plane
save_json = _md.save_json
_ModelControlPlaneClient = _md.ControlPlaneClient


class ControlPlaneClient(_ModelControlPlaneClient):
    """Control-plane client with dashboard / sheet / widget helpers."""

    def create_dashboard(
        self,
        name: str,
        *,
        description: str = "",
        refresh_interval: int = 300,
    ) -> dict[str, Any]:
        resp = self.client.post(
            self._url("/api/dashboards/"),
            json={
                "name": name,
                "description": description,
                "is_public": False,
                "is_template": False,
                "refresh_interval": refresh_interval,
            },
        )
        resp.raise_for_status()
        return resp.json()

    def create_sheet(
        self,
        dashboard_id: int,
        *,
        name: str,
        description: str = "",
        order_index: int = 0,
    ) -> dict[str, Any]:
        resp = self.client.post(
            self._url(f"/api/dashboards/{dashboard_id}/sheets"),
            json={
                "name": name,
                "description": description,
                "order_index": order_index,
                "is_active": True,
            },
        )
        resp.raise_for_status()
        return resp.json()

    def link_data_model(self, dashboard_id: int, model_id: int) -> dict[str, Any]:
        resp = self.client.post(
            self._url(f"/api/dashboards/{dashboard_id}/data-models/{model_id}"),
        )
        if resp.status_code == 400 and "already" in (resp.text or "").lower():
            return {"message": "already linked", "skipped": True}
        resp.raise_for_status()
        return resp.json()

    def list_dashboard_models(self, dashboard_id: int) -> list[dict[str, Any]]:
        resp = self.client.get(self._url(f"/api/dashboards/{dashboard_id}/data-models"))
        resp.raise_for_status()
        return resp.json()

    def get_dashboard(self, dashboard_id: int) -> dict[str, Any]:
        resp = self.client.get(self._url(f"/api/dashboards/{dashboard_id}"))
        resp.raise_for_status()
        return resp.json()

    def list_sheets(self, dashboard_id: int) -> list[dict[str, Any]]:
        resp = self.client.get(self._url(f"/api/dashboards/{dashboard_id}/sheets"))
        resp.raise_for_status()
        return resp.json()

    def create_dashboard_widget(self, sheet_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        body = {"sheet_id": sheet_id, **payload}
        resp = self.client.post(
            self._url(f"/api/dashboard-widgets/sheet/{sheet_id}/widgets"),
            json=body,
        )
        resp.raise_for_status()
        return resp.json()

    def list_sheet_widgets(self, sheet_id: int) -> list[dict[str, Any]]:
        resp = self.client.get(self._url(f"/api/dashboard-widgets/sheet/{sheet_id}/widgets"))
        resp.raise_for_status()
        return resp.json()

    def sqlite_query(self, model_id: int, body: dict[str, Any]) -> dict[str, Any]:
        resp = self.client.post(
            self._url(f"/api/data-models/{model_id}/sqlite/query"),
            json=body,
        )
        resp.raise_for_status()
        return resp.json()


def load_model_credentials(path: Path | None = None) -> dict[str, Any]:
    creds_path = Path(path) if path else DEFAULT_MODEL_CREDENTIALS
    if not creds_path.is_file():
        raise FileNotFoundError(
            f"Model credentials not found: {creds_path}. "
            "Run scripts/test/model_data/create_model.py (+ compile_and_stream) first."
        )
    return load_json(creds_path)
