#!/usr/bin/env python3
"""
Удаляет из БД и с диска записи ``files``, у которых истёк срок soft-delete (purge_after <= now).

Запуск из корня репозитория:
  PYTHONPATH=src python deployment/scripts/purge_deleted_files.py

Или:
  cd src && PYTHONPATH=. python ../deployment/scripts/purge_deleted_files.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select

# Репозиторий: .../AiControl
REPO_ROOT = Path(__file__).resolve().parents[2]
SRC = REPO_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from core.database import get_db_helper, load_database  # noqa: E402
from core.database.models import DataModelFile, File  # noqa: E402


async def purge_expired_files() -> int:
    load_database()
    now = datetime.now(timezone.utc)
    removed = 0

    async with get_db_helper().get_session() as session:
        result = await session.execute(
            select(File).where(
                File.deleted_at.is_not(None),
                File.purge_after.is_not(None),
                File.purge_after <= now,
            )
        )
        rows = list(result.scalars().all())

        for file_row in rows:
            cnt = int(
                await session.scalar(
                    select(func.count()).select_from(DataModelFile).where(
                        DataModelFile.file_id == file_row.id
                    )
                )
                or 0
            )
            if cnt > 0:
                continue

            if file_row.file_path:
                p = Path(file_row.file_path)
                if p.is_absolute() and p.exists():
                    try:
                        os.remove(p)
                    except OSError:
                        pass

            await session.delete(file_row)
            removed += 1

        await session.commit()

    return removed


def main() -> None:
    n = asyncio.run(purge_expired_files())
    print(f"Purged {n} file record(s).")


if __name__ == "__main__":
    main()
