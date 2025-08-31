import asyncio

from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator

from backend.api.configuration.routers import Routers
from core import settings
from core.database import get_db_helper

class Server:

    __app: FastAPI

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
    http_bearer = HTTPBearer(auto_error=False)
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl=settings.security.secret_key)

    def __init__(self, app: FastAPI):

        self.__app = app
        self.__register_routers(app)
        self.__regist_middleware(app)

    @staticmethod
    async def get_db() -> AsyncGenerator[AsyncSession, None]:
        async with get_db_helper().get_session() as session:
            yield session

    def get_app(self) -> FastAPI:
        return self.__app

    @staticmethod
    def __register_routers(app: FastAPI):

        Routers(Routers._discover_routers()).register(app)

    @staticmethod
    def __regist_middleware(app: FastAPI):
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://localhost:3000",  # Явно разрешаем localhost:3000
                "http://127.0.0.1:3000",  # Альтернативный адрес
                settings.run.frontend_url,   
                settings.run.https_frontend_url,  
                settings.run.http_domain_frontend_url,
                settings.run.https_domain_frontend_url,
            ],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

