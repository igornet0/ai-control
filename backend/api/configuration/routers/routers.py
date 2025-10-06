from dataclasses import dataclass
from fastapi import FastAPI, APIRouter
from typing import Tuple
import importlib
from pathlib import Path

import logging

logger = logging.getLogger("app_fastapi.routers")

@dataclass(frozen=True)
class Routers:

    routers: tuple

    def register(self, app: FastAPI):
        for router in self.routers:
            app.include_router(router)

    @classmethod
    def _discover_routers(cls) -> Tuple[APIRouter, ...]:
        routers = []
        try:
            # Сначала загружаем API v1 роутеры
            cls._load_v1_routers(routers)
            
            # Затем загружаем старые роутеры для обратной совместимости
            cls._load_legacy_routers(routers)

        except Exception as e:
            logger.error(f"Error discovering routes: {e}")

        return tuple(routers)
    
    @classmethod
    def _load_v1_routers(cls, routers: list):
        """Загружает роутеры API v1"""
        try:
            # Загружаем роутер задач v1
            from backend.api.v1.endpoints.tasks import router as tasks_router
            routers.append(tasks_router)
            logger.info("Loaded API v1 tasks router")
        except ImportError as e:
            logger.error(f"Error importing API v1 tasks router: {e}")
    
    @classmethod
    def _load_legacy_routers(cls, routers: list):
        """Загружает старые роутеры для обратной совместимости"""
        try:
            # Получаем абсолютный путь к папке routers
            routers_dir = Path(__file__).parent.parent.parent / 'routers'

            # Ищем все подпапки в routers
            for subdir in routers_dir.iterdir():
                if subdir.is_dir():
                    router_file = subdir / 'router.py'
                    if router_file.exists():
                        module_name = f'backend.api.routers.{subdir.name}.router'
                        try:
                            module = importlib.import_module(module_name)
                            if hasattr(module, 'router'):
                                router = getattr(module, 'router')
                                if isinstance(router, APIRouter):
                                    routers.append(router)
                                    logger.info(f"Loaded legacy router from {module_name}")
                        except ImportError as e:
                            logger.error(f"Error importing {module_name}: {e}")

            # Also look for direct router files in the routers directory
            for file_path in routers_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.py' and file_path.name != '__init__.py':
                    module_name = f'backend.api.routers.{file_path.stem}'
                    try:
                        module = importlib.import_module(module_name)
                        if hasattr(module, 'router'):
                            router = getattr(module, 'router')
                            if isinstance(router, APIRouter):
                                routers.append(router)
                                logger.info(f"Loaded legacy router from {module_name}")
                    except ImportError as e:
                        logger.error(f"Error importing {module_name}: {e}")
        except Exception as e:
            logger.error(f"Error loading legacy routers: {e}")