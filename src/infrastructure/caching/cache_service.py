"""
Cache service for managing application caching.
"""

import hashlib
from typing import Any, Optional, Callable, Dict, List
from functools import wraps
import asyncio

from src.infrastructure.caching.redis_client import redis_client
from src.infrastructure.config.logging import get_logger


class CacheService:
    """Service for managing application caching."""
    
    def __init__(self):
        self.logger = get_logger(__name__)
        self.default_ttl = 3600  # 1 hour
    
    def cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and arguments."""
        # Create a string representation of all arguments
        key_parts = [prefix]
        
        # Add positional arguments
        for arg in args:
            key_parts.append(str(arg))
        
        # Add keyword arguments (sorted for consistency)
        for key, value in sorted(kwargs.items()):
            key_parts.append(f"{key}:{value}")
        
        # Join and hash if too long
        key_string = ":".join(key_parts)
        if len(key_string) > 250:  # Redis key length limit
            key_hash = hashlib.md5(key_string.encode()).hexdigest()
            return f"{prefix}:hash:{key_hash}"
        
        return key_string
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        return await redis_client.get(key)
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache."""
        return await redis_client.set(key, value, expire=ttl or self.default_ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        return await redis_client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        return await redis_client.exists(key)
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern."""
        keys = await redis_client.keys(pattern)
        if not keys:
            return 0
        
        deleted_count = 0
        for key in keys:
            if await redis_client.delete(key):
                deleted_count += 1
        
        return deleted_count
    
    async def get_or_set(
        self,
        key: str,
        factory: Callable,
        ttl: Optional[int] = None,
        *args,
        **kwargs
    ) -> Any:
        """Get value from cache or set it using factory function."""
        # Try to get from cache
        cached_value = await self.get(key)
        if cached_value is not None:
            return cached_value
        
        # Generate value using factory
        if asyncio.iscoroutinefunction(factory):
            value = await factory(*args, **kwargs)
        else:
            value = factory(*args, **kwargs)
        
        # Cache the value
        await self.set(key, value, ttl)
        
        return value
    
    def cached(
        self,
        ttl: Optional[int] = None,
        key_prefix: str = "cache"
    ):
        """Decorator for caching function results."""
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key
                cache_key = self.cache_key(key_prefix, func.__name__, *args, **kwargs)
                
                # Try to get from cache
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    self.logger.debug(f"Cache hit for {cache_key}")
                    return cached_value
                
                # Execute function
                self.logger.debug(f"Cache miss for {cache_key}")
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                # Cache the result
                await self.set(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator
    
    # User-specific caching methods
    async def cache_user_data(self, user_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache user-specific data."""
        key = self.cache_key("user", user_id, "data")
        return await self.set(key, data, ttl)
    
    async def get_user_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user data."""
        key = self.cache_key("user", user_id, "data")
        return await self.get(key)
    
    async def invalidate_user_cache(self, user_id: str) -> int:
        """Invalidate all cache entries for a user."""
        pattern = self.cache_key("user", user_id, "*")
        return await self.invalidate_pattern(pattern)
    
    # Task-specific caching methods
    async def cache_task_data(self, task_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache task-specific data."""
        key = self.cache_key("task", task_id, "data")
        return await self.set(key, data, ttl)
    
    async def get_task_data(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get cached task data."""
        key = self.cache_key("task", task_id, "data")
        return await self.get(key)
    
    async def invalidate_task_cache(self, task_id: str) -> int:
        """Invalidate all cache entries for a task."""
        pattern = self.cache_key("task", task_id, "*")
        return await self.invalidate_pattern(pattern)
    
    # Dashboard-specific caching methods
    async def cache_dashboard_data(self, dashboard_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache dashboard-specific data."""
        key = self.cache_key("dashboard", dashboard_id, "data")
        return await self.set(key, data, ttl)
    
    async def get_dashboard_data(self, dashboard_id: str) -> Optional[Dict[str, Any]]:
        """Get cached dashboard data."""
        key = self.cache_key("dashboard", dashboard_id, "data")
        return await self.get(key)
    
    async def invalidate_dashboard_cache(self, dashboard_id: str) -> int:
        """Invalidate all cache entries for a dashboard."""
        pattern = self.cache_key("dashboard", dashboard_id, "*")
        return await self.invalidate_pattern(pattern)
    
    # KPI-specific caching methods
    async def cache_kpi_data(self, kpi_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache KPI-specific data."""
        key = self.cache_key("kpi", kpi_id, "data")
        return await self.set(key, data, ttl)
    
    async def get_kpi_data(self, kpi_id: str) -> Optional[Dict[str, Any]]:
        """Get cached KPI data."""
        key = self.cache_key("kpi", kpi_id, "data")
        return await self.get(key)
    
    async def invalidate_kpi_cache(self, kpi_id: str) -> int:
        """Invalidate all cache entries for a KPI."""
        pattern = self.cache_key("kpi", kpi_id, "*")
        return await self.invalidate_pattern(pattern)
    
    # Session caching methods
    async def cache_session(self, session_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache session data."""
        key = self.cache_key("session", session_id)
        return await self.set(key, data, ttl)
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get cached session data."""
        key = self.cache_key("session", session_id)
        return await self.get(key)
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete session from cache."""
        key = self.cache_key("session", session_id)
        return await self.delete(key)
    
    # Rate limiting methods
    async def increment_rate_limit(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        """Increment rate limit counter and check if limit exceeded."""
        current_count = await redis_client.get(key)
        if current_count is None:
            current_count = 0
        else:
            current_count = int(current_count)
        
        if current_count >= limit:
            return False, current_count
        
        # Increment counter
        new_count = current_count + 1
        await redis_client.set(key, new_count, expire=window)
        
        return True, new_count


# Global cache service instance
cache_service = CacheService()
