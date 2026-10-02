#!/usr/bin/env python3
"""
Полный прогон: (опционально) model_data → create_dashboard → verify_dashboard.

Пример:
  cd src && poetry run python ../scripts/test/dashboard/run_full_test.py --env dev
  cd src && poetry run python ../scripts/test/dashboard/run_full_test.py --env dev --with-model
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
MODEL_DATA_DIR = SCRIPT_DIR.parent / "model_data"
SRC_DIR = REPO_ROOT / "src"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--env", choices=("dev", "prod"), default="dev")
    p.add_argument(
        "--with-model",
        action="store_true",
        help="Сначала create_model + stream + compile для model_data",
    )
    p.add_argument("--skip-verify", action="store_true")
    return p.parse_args()


def _run(name: str, cmd: list[str]) -> int:
    print(f"\n=== {name} ===")
    print(" ".join(cmd))
    result = subprocess.run(cmd, cwd=SRC_DIR)
    if result.returncode != 0:
        print(f"\nrun_full_test: step {name!r} failed (exit {result.returncode})", file=sys.stderr)
    return result.returncode


def main() -> int:
    args = parse_args()
    py = sys.executable

    if args.with_model:
        if _run(
            "model create",
            [py, str(MODEL_DATA_DIR / "create_model.py"), "--env", args.env],
        ):
            return 1
        if _run(
            "model stream+compile",
            ["bash", str(MODEL_DATA_DIR / "compile_and_stream.sh"), "--env", args.env],
        ):
            return 1

    if _run(
        "create_dashboard",
        [py, str(SCRIPT_DIR / "create_dashboard.py"), "--env", args.env],
    ):
        return 1

    if not args.skip_verify:
        if _run(
            "verify_dashboard",
            [py, str(SCRIPT_DIR / "verify_dashboard.py"), "--env", args.env],
        ):
            return 1

    print("\nrun_full_test: ALL PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
