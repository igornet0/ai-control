#!/usr/bin/env python3
"""
Компилирует модель данных (merge DataCode → SQLite).

Использует credentials.json из create_model.py.

Пример:
  cd src && poetry run python ../scripts/test/model_data/compile_model.py --env dev
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import (  # noqa: E402
    DEFAULT_CREDENTIALS_PATH,
    ControlPlaneClient,
    bootstrap_settings,
    load_json,
    load_settings,
    login_control_plane,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default=None)
    p.add_argument("--credentials", default=str(DEFAULT_CREDENTIALS_PATH))
    p.add_argument("--admin-email", default=None)
    p.add_argument("--admin-password", default=None)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    bootstrap_settings(args.env)

    creds_path = Path(args.credentials)
    if not creds_path.is_file():
        print(f"compile_model: credentials not found: {creds_path}", file=sys.stderr)
        print("Run create_model.py first.", file=sys.stderr)
        return 1

    creds = load_json(creds_path)
    model_id = creds["model_id"]
    settings = load_settings()
    email = args.admin_email or creds.get("admin_email") or settings.app.first_superuser
    password = args.admin_password or settings.app.first_superuser_password

    auth = login_control_plane(creds["control_plane_url"], email, password)
    with ControlPlaneClient(creds["control_plane_url"], auth.token) as cp:
        result = cp.compile_model(model_id)

    if not result.get("success"):
        err = result.get("error", result)
        print(f"compile_model: FAILED — {err}", file=sys.stderr)
        err_text = str(err)
        if "not found in DCP" in err_text or "source_table" in err_text:
            print(
                "Hint: ingest data first (stream_data.py / compile_and_stream.sh), "
                "then compile — API tables are injected into DCP from the persistent store.",
                file=sys.stderr,
            )
        return 1

    sqlite_saved = (result.get("data") or {}).get("sqlite_saved")
    print("compile_model: OK")
    print(f"  model_id={model_id}")
    print(f"  execution_id={result.get('execution_id')}")
    if sqlite_saved is not None:
        print(f"  sqlite_saved={sqlite_saved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
