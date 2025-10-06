"""
Общие зависимости для API v1
"""

from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.configuration.auth import verify_authorization
from backend.api.configuration.server import Server

# Типы для аннотаций
UserDep = Annotated[dict, Depends(verify_authorization)]
SessionDep = Annotated[AsyncSession, Depends(Server.get_db)]
