#!/usr/bin/env python3
"""
Полный интеграционный прогон: create → stream → verify.

Пример:
  cd py-worm && poetry run python ../scripts/test/model_data/run_full_test.py --env dev

Предусловия:
  - run_app.py (control-plane :8000)
  - run_api.py (developer API :8002)
  - DataCode engine (WebSocket)
  - PostgreSQL + API persistent store
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default="dev")
    p.add_argument("--control-plane", default="http://127.0.0.1:8000")
    p.add_argument("--developer-api", default="http://127.0.0.1:8002")
    p.add_argument("--stream-iterations", type=int, default=2)
    p.add_argument("--skip-stream-loop", action="store_true", help="Только initial ingest, без stream/append loop")
    return p.parse_args()


def _run_step(name: str, cmd: list[str]) -> int:
    print(f"\n=== {name} ===")
    print(" ".join(cmd))
    result = subprocess.run(cmd, cwd=SCRIPT_DIR.parents[2] / "py-worm")
    if result.returncode != 0:
        print(f"\nrun_full_test: step {name!r} failed (exit {result.returncode})", file=sys.stderr)
    return result.returncode


def main() -> int:
    args = parse_args()
    py = sys.executable
    scripts = SCRIPT_DIR

    common = [
        py,
        str(scripts / "create_model.py"),
        "--env",
        args.env,
        "--control-plane",
        args.control_plane,
        "--developer-api",
        args.developer_api,
    ]

    if _run_step("create_model", common) != 0:
        return 1

    stream_cmd = [
        py,
        str(scripts / "stream_data.py"),
        "--env",
        args.env,
    ]
    if not args.skip_stream_loop:
        stream_cmd.extend(["--stream", "--append", "--iterations", str(args.stream_iterations)])

    if _run_step("stream_data", stream_cmd) != 0:
        return 1

    verify_cmd = [py, str(scripts / "verify_model.py"), "--env", args.env]
    if _run_step("verify_model", verify_cmd) != 0:
        return 1

    print("\nrun_full_test: ALL PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
