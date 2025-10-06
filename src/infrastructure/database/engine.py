"""
Database engine and session management.
Migrated from core/database/engine.py with improvements.
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sqlalchemy.exc import OperationalError, TimeoutError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    AsyncEngine,
    async_sessionmaker
)

from src.infrastructure.database.base import Base
from src.infrastructure.config.settings import get_settings
from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)


async def test_connection(url: str, timeout: float = 10.0, retries: int = 3) -> bool:
    """
    Test database connection with timeout and retries.
    
    Args:
        url: Database URL
        timeout: Connection timeout in seconds
        retries: Number of retry attempts
        
    Returns:
        True if connection successful, False otherwise
    """
    test_engine = create_async_engine(url, connect_args={"timeout": timeout})
    
    for attempt in range(1, retries + 1):
        try:
            async with test_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info(f"Connection to {url} successful (attempt {attempt}/{retries})")
            await test_engine.dispose()
            return True
        except (OperationalError, TimeoutError) as e:
            logger.warning(f"Connection attempt {attempt}/{retries} to {url} failed: {str(e)}")
            if attempt < retries:
                await asyncio.sleep(2)  # Delay between attempts
        except Exception as e:
            logger.error(f"Unexpected error during connection to {url}: {str(e)}")
            break
    
    await test_engine.dispose()
    return False


async def select_working_url() -> str:
    """
    Select working database URL from available options.
    
    Returns:
        Working database URL
        
    Raises:
        SystemExit: If all connections fail
    """
    settings = get_settings()
    
    urls = [
        ("primary", settings.database.url),
        # Add alternative URLs if needed
    ]
    
    for name, url in urls:
        logger.info(f"Testing {name} database connection: {url}")
        if await test_connection(url):
            logger.info(f"Using {name} database: {url}")
            return url
    
    logger.critical("All database connections failed. Exiting application.")
    sys.exit(1)


class Database:
    """Database connection and session management."""
    
    def __init__(
        self,
        url: str,
        echo: bool = False,
        echo_pool: bool = False,
        pool_size: int = 10,
        max_overflow: int = 20,
    ) -> None:
        """
        Initialize database connection.
        
        Args:
            url: Database URL
            echo: Echo SQL queries
            echo_pool: Echo connection pool events
            pool_size: Connection pool size
            max_overflow: Max overflow connections
        """
        self._url = url
        self._echo = echo
        self._echo_pool = echo_pool
        self._pool_size = pool_size
        self._max_overflow = max_overflow
        self._engine: Optional[AsyncEngine] = None
        self._async_session: Optional[async_sessionmaker[AsyncSession]] = None

    @property
    def engine(self) -> AsyncEngine:
        """Get database engine."""
        if self._engine is None:
            self._engine = create_async_engine(
                url=self._url,
                echo=self._echo,
                echo_pool=self._echo_pool,
                pool_size=self._pool_size,
                max_overflow=self._max_overflow,
                future=True
            )
        return self._engine

    @property
    def async_session(self) -> async_sessionmaker[AsyncSession]:
        """Get async session factory."""
        if self._async_session is None:
            self._async_session = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                autoflush=False,
                autocommit=False,
                expire_on_commit=False
            )
        return self._async_session

    def get_url(self) -> str:
        """Get database URL."""
        return self._url

    async def dispose(self) -> None:
        """Dispose database engine."""
        if self._engine:
            await self._engine.dispose()

    async def init_db(self) -> None:
        """Initialize database tables."""
        await self._create_tables()

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session context manager."""
        async with self.async_session() as session:
            try:
                yield session
            finally:
                await session.close()

    async def _create_tables(self) -> None:
        """Create database tables."""
        async with self.engine.begin() as conn:
            logger.info("Creating database tables")
            await conn.run_sync(Base.metadata.create_all)


# Global database instance
_db_instance: Optional[Database] = None


async def initialize_database() -> Database:
    """
    Initialize database connection.
    
    Returns:
        Database instance
    """
    global _db_instance
    
    if _db_instance is None:
        settings = get_settings()
        working_url = await select_working_url()
        
        _db_instance = Database(
            url=working_url,
            echo=settings.database.echo,
            echo_pool=settings.database.echo_pool,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
        )
        
        logger.info("Database initialized successfully")
    
    return _db_instance


def get_database() -> Database:
    """
    Get database instance (lazy initialization).
    
    Returns:
        Database instance
    """
    global _db_instance
    
    if _db_instance is None:
        settings = get_settings()
        _db_instance = Database(
            url=settings.database.url,
            echo=settings.database.echo,
            echo_pool=settings.database.echo_pool,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
        )
    
    return _db_instance


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session dependency for FastAPI.
    
    Yields:
        Database session
    """
    database = get_database()
    async with database.get_session() as session:
        yield session
