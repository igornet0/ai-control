import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

# from .tasks import tasks
from .rabbitmq_server import rabbit
from core.database import db_helper
from backend.api.services.rabbitmq_consumer import start_code_execution_consumer, stop_code_execution_consumer

import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    """Менеджер жизненного цикла приложения"""
    consumer_task = None
    try:
        logger.info("Initializing database...")
        await db_helper.init_db()
        logger.info("Starting application...")

        # Setup RabbitMQ
        await rabbit.setup_dlx()

        # Start code execution consumer in background
        logger.info("Starting code execution consumer...")
        consumer_task = asyncio.create_task(start_code_execution_consumer())

        logger.info("Application startup complete")
        yield
    finally:
        logger.info("Shutting down application...")

        # Stop the consumer
        if consumer_task and not consumer_task.done():
            logger.info("Stopping code execution consumer...")
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass

        await stop_code_execution_consumer()
        await db_helper.dispose()
        await rabbit.close()
        logger.info("Application shutdown complete")