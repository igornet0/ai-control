#!/usr/bin/env python3
"""Remove legacy uploaded files from data_models/{id}/ (keep sqlite_db/ optional)."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_MODELS_DIR = REPO_ROOT / "src" / "data_models"


def cleanup_model_dir(model_dir: Path, dry_run: bool) -> int:
    removed = 0
    if not model_dir.is_dir():
        return 0
    for item in model_dir.iterdir():
        if item.name == "sqlite_db":
            continue
        removed += 1
        if dry_run:
            print(f"would remove: {item}")
        else:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
            print(f"removed: {item}")
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge legacy data model upload files")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--model-id", type=int, default=None)
    args = parser.parse_args()

    if not DATA_MODELS_DIR.is_dir():
        print(f"No directory: {DATA_MODELS_DIR}")
        sys.exit(0)

    total = 0
    if args.model_id is not None:
        total += cleanup_model_dir(DATA_MODELS_DIR / str(args.model_id), args.dry_run)
    else:
        for sub in sorted(DATA_MODELS_DIR.iterdir()):
            if sub.is_dir() and sub.name.isdigit():
                total += cleanup_model_dir(sub, args.dry_run)

    print(f"Done. Items processed: {total}")


if __name__ == "__main__":
    main()
