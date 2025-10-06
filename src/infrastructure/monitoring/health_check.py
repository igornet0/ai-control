"""Health check service for monitoring system status."""

import asyncio
import time
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict

from src.infrastructure.config.logging import get_logger
from src.infrastructure.database.engine import get_database_engine
from src.infrastructure.external_services.datacode_service import DataCodeService

logger = get_logger(__name__)


@dataclass
class HealthStatus:
    """Health status information."""
    service: str
    status: str  # "healthy", "unhealthy", "degraded"
    message: str
    response_time_ms: Optional[float] = None
    last_check: Optional[datetime] = None
    details: Optional[Dict[str, Any]] = None


class HealthCheckService:
    """Service for performing health checks on system components."""

    def __init__(self):
        self.checks: Dict[str, callable] = {
            "database": self._check_database,
            "datacode": self._check_datacode,
            "memory": self._check_memory,
            "disk": self._check_disk,
        }
        self.cache: Dict[str, HealthStatus] = {}
        self.cache_ttl = timedelta(seconds=30)

    async def check_all(self) -> Dict[str, HealthStatus]:
        """Perform health checks on all services."""
        results = {}
        
        for service_name, check_func in self.checks.items():
            try:
                start_time = time.time()
                status = await check_func()
                response_time = (time.time() - start_time) * 1000
                
                status.response_time_ms = response_time
                status.last_check = datetime.utcnow()
                
                results[service_name] = status
                self.cache[service_name] = status
                
            except Exception as e:
                logger.error(f"Health check failed for {service_name}: {e}")
                results[service_name] = HealthStatus(
                    service=service_name,
                    status="unhealthy",
                    message=f"Health check failed: {str(e)}",
                    last_check=datetime.utcnow()
                )
        
        return results

    async def check_service(self, service_name: str) -> HealthStatus:
        """Perform health check on a specific service."""
        if service_name in self.cache:
            cached_status = self.cache[service_name]
            if (cached_status.last_check and 
                datetime.utcnow() - cached_status.last_check < self.cache_ttl):
                return cached_status

        if service_name not in self.checks:
            return HealthStatus(
                service=service_name,
                status="unhealthy",
                message=f"Unknown service: {service_name}",
                last_check=datetime.utcnow()
            )

        try:
            start_time = time.time()
            status = await self.checks[service_name]()
            response_time = (time.time() - start_time) * 1000
            
            status.response_time_ms = response_time
            status.last_check = datetime.utcnow()
            
            self.cache[service_name] = status
            return status
            
        except Exception as e:
            logger.error(f"Health check failed for {service_name}: {e}")
            return HealthStatus(
                service=service_name,
                status="unhealthy",
                message=f"Health check failed: {str(e)}",
                last_check=datetime.utcnow()
            )

    async def _check_database(self) -> HealthStatus:
        """Check database connectivity and performance."""
        try:
            engine = get_database_engine()
            
            # Test basic connectivity
            async with engine.begin() as conn:
                result = await conn.execute("SELECT 1")
                row = result.fetchone()
                
                if not row or row[0] != 1:
                    return HealthStatus(
                        service="database",
                        status="unhealthy",
                        message="Database query returned unexpected result"
                    )

            # Test connection pool
            pool_size = engine.pool.size()
            checked_out = engine.pool.checkedout()
            
            return HealthStatus(
                service="database",
                status="healthy",
                message="Database is accessible",
                details={
                    "pool_size": pool_size,
                    "checked_out": checked_out,
                    "available": pool_size - checked_out
                }
            )
            
        except Exception as e:
            return HealthStatus(
                service="database",
                status="unhealthy",
                message=f"Database connection failed: {str(e)}"
            )

    async def _check_datacode(self) -> HealthStatus:
        """Check DataCode service connectivity."""
        try:
            datacode_service = DataCodeService()
            
            # Test basic connectivity with a simple query
            result = await datacode_service.execute_query("SELECT 1")
            
            if result.get("success"):
                return HealthStatus(
                    service="datacode",
                    status="healthy",
                    message="DataCode service is accessible",
                    details={
                        "version": result.get("version"),
                        "response_time": result.get("execution_time")
                    }
                )
            else:
                return HealthStatus(
                    service="datacode",
                    status="degraded",
                    message=f"DataCode service returned error: {result.get('error')}"
                )
                
        except Exception as e:
            return HealthStatus(
                service="datacode",
                status="unhealthy",
                message=f"DataCode service connection failed: {str(e)}"
            )

    async def _check_memory(self) -> HealthStatus:
        """Check system memory usage."""
        try:
            import psutil
            
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            if memory_percent < 80:
                status = "healthy"
                message = f"Memory usage: {memory_percent:.1f}%"
            elif memory_percent < 90:
                status = "degraded"
                message = f"High memory usage: {memory_percent:.1f}%"
            else:
                status = "unhealthy"
                message = f"Critical memory usage: {memory_percent:.1f}%"
            
            return HealthStatus(
                service="memory",
                status=status,
                message=message,
                details={
                    "total": memory.total,
                    "available": memory.available,
                    "used": memory.used,
                    "percent": memory_percent
                }
            )
            
        except ImportError:
            return HealthStatus(
                service="memory",
                status="degraded",
                message="psutil not available for memory monitoring"
            )
        except Exception as e:
            return HealthStatus(
                service="memory",
                status="unhealthy",
                message=f"Memory check failed: {str(e)}"
            )

    async def _check_disk(self) -> HealthStatus:
        """Check disk space usage."""
        try:
            import psutil
            
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            if disk_percent < 80:
                status = "healthy"
                message = f"Disk usage: {disk_percent:.1f}%"
            elif disk_percent < 90:
                status = "degraded"
                message = f"High disk usage: {disk_percent:.1f}%"
            else:
                status = "unhealthy"
                message = f"Critical disk usage: {disk_percent:.1f}%"
            
            return HealthStatus(
                service="disk",
                status=status,
                message=message,
                details={
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": disk_percent
                }
            )
            
        except ImportError:
            return HealthStatus(
                service="disk",
                status="degraded",
                message="psutil not available for disk monitoring"
            )
        except Exception as e:
            return HealthStatus(
                service="disk",
                status="unhealthy",
                message=f"Disk check failed: {str(e)}"
            )

    def get_overall_status(self, results: Dict[str, HealthStatus]) -> str:
        """Determine overall system health status."""
        if not results:
            return "unknown"
        
        statuses = [status.status for status in results.values()]
        
        if "unhealthy" in statuses:
            return "unhealthy"
        elif "degraded" in statuses:
            return "degraded"
        else:
            return "healthy"

    def get_summary(self, results: Dict[str, HealthStatus]) -> Dict[str, Any]:
        """Get health check summary."""
        overall_status = self.get_overall_status(results)
        
        healthy_count = sum(1 for status in results.values() if status.status == "healthy")
        degraded_count = sum(1 for status in results.values() if status.status == "degraded")
        unhealthy_count = sum(1 for status in results.values() if status.status == "unhealthy")
        
        return {
            "overall_status": overall_status,
            "total_services": len(results),
            "healthy": healthy_count,
            "degraded": degraded_count,
            "unhealthy": unhealthy_count,
            "last_check": datetime.utcnow().isoformat(),
            "services": {name: asdict(status) for name, status in results.items()}
        }
