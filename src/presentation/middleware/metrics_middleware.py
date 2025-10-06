"""
Metrics middleware for collecting HTTP request metrics.
"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.infrastructure.monitoring.metrics import MetricsCollector


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware for collecting HTTP request metrics."""
    
    def __init__(self, app, metrics_collector: MetricsCollector):
        super().__init__(app)
        self.metrics_collector = metrics_collector
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and collect metrics."""
        start_time = time.time()
        
        # Extract request information
        method = request.method
        path = request.url.path
        user_agent = request.headers.get("user-agent", "")
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Collect metrics
        self.metrics_collector.record_http_request(
            method=method,
            path=path,
            status_code=response.status_code,
            process_time=process_time,
            user_agent=user_agent
        )
        
        return response
