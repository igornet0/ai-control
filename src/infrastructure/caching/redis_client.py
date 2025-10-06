"""
Redis client for caching and session management.
"""

import json
import pickle
from typing import Any, Optional, Union, Dict, List
import redis.asyncio as redis
from redis.asyncio import Redis

from src.infrastructure.config.settings import get_settings
from src.infrastructure.config.logging import get_logger


class RedisClient:
    """Redis client wrapper for caching operations."""
    
    def __init__(self):
        self.settings = get_settings()
        self.logger = get_logger(__name__)
        self._client: Optional[Redis] = None
    
    async def connect(self) -> None:
        """Connect to Redis server."""
        try:
            self._client = redis.from_url(
                self.settings.redis.url,
                encoding="utf-8",
                decode_responses=False,  # We'll handle encoding manually
                max_connections=self.settings.redis.max_connections
            )
            
            # Test connection
            await self._client.ping()
            self.logger.info("Connected to Redis successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Disconnect from Redis server."""
        if self._client:
            await self._client.close()
            self.logger.info("Disconnected from Redis")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self._client:
            return None
        
        try:
            value = await self._client.get(key)
            if value is None:
                return None
            
            # Try to deserialize as JSON first, then pickle
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return pickle.loads(value)
                
        except Exception as e:
            self.logger.error(f"Error getting key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None,
        serialize_json: bool = True
    ) -> bool:
        """Set value in cache."""
        if not self._client:
            return False
        
        try:
            # Serialize value
            if serialize_json:
                try:
                    serialized_value = json.dumps(value, default=str)
                except (TypeError, ValueError):
                    serialized_value = pickle.dumps(value)
            else:
                serialized_value = pickle.dumps(value)
            
            # Set with optional expiration
            if expire:
                await self._client.setex(key, expire, serialized_value)
            else:
                await self._client.set(key, serialized_value)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error setting key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self._client:
            return False
        
        try:
            result = await self._client.delete(key)
            return result > 0
        except Exception as e:
            self.logger.error(f"Error deleting key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        if not self._client:
            return False
        
        try:
            result = await self._client.exists(key)
            return result > 0
        except Exception as e:
            self.logger.error(f"Error checking key {key}: {e}")
            return False
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration for key."""
        if not self._client:
            return False
        
        try:
            result = await self._client.expire(key, seconds)
            return result
        except Exception as e:
            self.logger.error(f"Error setting expiration for key {key}: {e}")
            return False
    
    async def ttl(self, key: str) -> int:
        """Get time to live for key."""
        if not self._client:
            return -1
        
        try:
            return await self._client.ttl(key)
        except Exception as e:
            self.logger.error(f"Error getting TTL for key {key}: {e}")
            return -1
    
    async def keys(self, pattern: str = "*") -> List[str]:
        """Get keys matching pattern."""
        if not self._client:
            return []
        
        try:
            keys = await self._client.keys(pattern)
            return [key.decode('utf-8') if isinstance(key, bytes) else key for key in keys]
        except Exception as e:
            self.logger.error(f"Error getting keys with pattern {pattern}: {e}")
            return []
    
    async def flushdb(self) -> bool:
        """Flush current database."""
        if not self._client:
            return False
        
        try:
            await self._client.flushdb()
            return True
        except Exception as e:
            self.logger.error(f"Error flushing database: {e}")
            return False
    
    async def hget(self, name: str, key: str) -> Optional[Any]:
        """Get hash field value."""
        if not self._client:
            return None
        
        try:
            value = await self._client.hget(name, key)
            if value is None:
                return None
            
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return pickle.loads(value)
                
        except Exception as e:
            self.logger.error(f"Error getting hash field {name}:{key}: {e}")
            return None
    
    async def hset(self, name: str, key: str, value: Any) -> bool:
        """Set hash field value."""
        if not self._client:
            return False
        
        try:
            if isinstance(value, (dict, list)):
                serialized_value = json.dumps(value, default=str)
            else:
                serialized_value = pickle.dumps(value)
            
            await self._client.hset(name, key, serialized_value)
            return True
            
        except Exception as e:
            self.logger.error(f"Error setting hash field {name}:{key}: {e}")
            return False
    
    async def hgetall(self, name: str) -> Dict[str, Any]:
        """Get all hash fields."""
        if not self._client:
            return {}
        
        try:
            data = await self._client.hgetall(name)
            result = {}
            
            for key, value in data.items():
                key_str = key.decode('utf-8') if isinstance(key, bytes) else key
                try:
                    result[key_str] = json.loads(value.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    result[key_str] = pickle.loads(value)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error getting all hash fields {name}: {e}")
            return {}
    
    async def hdel(self, name: str, *keys: str) -> int:
        """Delete hash fields."""
        if not self._client:
            return 0
        
        try:
            return await self._client.hdel(name, *keys)
        except Exception as e:
            self.logger.error(f"Error deleting hash fields {name}:{keys}: {e}")
            return 0
    
    async def lpush(self, name: str, *values: Any) -> int:
        """Push values to list."""
        if not self._client:
            return 0
        
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list)):
                    serialized_values.append(json.dumps(value, default=str))
                else:
                    serialized_values.append(pickle.dumps(value))
            
            return await self._client.lpush(name, *serialized_values)
        except Exception as e:
            self.logger.error(f"Error pushing to list {name}: {e}")
            return 0
    
    async def rpop(self, name: str) -> Optional[Any]:
        """Pop value from list."""
        if not self._client:
            return None
        
        try:
            value = await self._client.rpop(name)
            if value is None:
                return None
            
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return pickle.loads(value)
                
        except Exception as e:
            self.logger.error(f"Error popping from list {name}: {e}")
            return None
    
    async def llen(self, name: str) -> int:
        """Get list length."""
        if not self._client:
            return 0
        
        try:
            return await self._client.llen(name)
        except Exception as e:
            self.logger.error(f"Error getting list length {name}: {e}")
            return 0


# Global Redis client instance
redis_client = RedisClient()
