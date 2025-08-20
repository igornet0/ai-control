import asyncio
import json
import logging
from typing import Dict, Any
from backend.api.configuration.rabbitmq_server import rabbit
from backend.api.services.code_execution_service import code_execution_service
from backend.api.routers.websocket import connection_manager

logger = logging.getLogger(__name__)

class CodeExecutionConsumer:
    """RabbitMQ consumer for code execution requests"""
    
    def __init__(self):
        self.queue_name = "code_execution_queue"
        self.is_running = False
        
    async def start_consuming(self):
        """Start consuming messages from the code execution queue"""
        if self.is_running:
            logger.warning("Consumer is already running")
            return
            
        self.is_running = True
        logger.info(f"Starting RabbitMQ consumer for queue: {self.queue_name}")
        
        try:
            await rabbit.setup_dlx()
            await rabbit.consume_messages(
                queue=self.queue_name,
                callback=self.process_code_execution_request,
                prefetch_count=1  # Process one message at a time
            )
        except Exception as e:
            logger.error(f"Error in RabbitMQ consumer: {e}")
            self.is_running = False
            raise
    
    async def stop_consuming(self):
        """Stop consuming messages"""
        self.is_running = False
        logger.info("Stopping RabbitMQ consumer")
        await rabbit.close()
    
    async def process_code_execution_request(self, message_data: Dict[str, Any]):
        """
        Process a code execution request from RabbitMQ
        
        Expected message format:
        {
            "execution_id": "unique-id",
            "code": "print('Hello World')",
            "language": "python",
            "tabs": [
                {"name": "Tab 1", "content": "code1"},
                {"name": "Tab 2", "content": "code2"}
            ],
            "user_id": "optional-user-id",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        """
        logger.info(f"Processing code execution request: {message_data.get('execution_id', 'unknown')}")
        
        try:
            # Extract data from message
            execution_id = message_data.get("execution_id")
            code = message_data.get("code", "")
            language = message_data.get("language", "python")
            tabs = message_data.get("tabs", [])
            user_id = message_data.get("user_id")
            
            if not execution_id:
                logger.error("No execution_id provided in message")
                return
            
            if not code and not tabs:
                logger.error(f"No code provided for execution {execution_id}")
                await connection_manager.send_to_execution(execution_id, {
                    "type": "error",
                    "execution_id": execution_id,
                    "message": "No code provided for execution"
                })
                return
            
            # If tabs are provided, combine all tab content
            if tabs:
                combined_code = self._combine_tab_code(tabs)
                if combined_code:
                    code = combined_code
            
            # Send initial message to WebSocket clients
            await connection_manager.send_to_execution(execution_id, {
                "type": "execution_started",
                "execution_id": execution_id,
                "language": language,
                "message": "Code execution request received"
            })
            
            # Execute the code and stream results
            async for result in code_execution_service.execute_code(
                code=code,
                language=language,
                execution_id=execution_id
            ):
                # Forward each result to WebSocket clients
                await connection_manager.send_to_execution(execution_id, {
                    "type": "execution_update",
                    **result
                })
            
            # Send final completion message
            await connection_manager.send_to_execution(execution_id, {
                "type": "execution_finished",
                "execution_id": execution_id,
                "message": "Code execution completed"
            })
            
            logger.info(f"Code execution completed for {execution_id}")
            
        except Exception as e:
            logger.error(f"Error processing code execution request: {e}")
            
            # Send error to WebSocket clients
            if execution_id:
                await connection_manager.send_to_execution(execution_id, {
                    "type": "execution_error",
                    "execution_id": execution_id,
                    "error": str(e),
                    "message": "Code execution failed due to internal error"
                })
    
    def _combine_tab_code(self, tabs: list) -> str:
        """
        Combine code from multiple tabs into a single executable script
        
        Args:
            tabs: List of tab objects with 'name' and 'content' keys
            
        Returns:
            Combined code string
        """
        if not tabs:
            return ""
        
        combined_parts = []
        
        # Add header comment
        combined_parts.append("# Combined code from multiple tabs")
        combined_parts.append("# Generated automatically for execution")
        combined_parts.append("")
        
        for i, tab in enumerate(tabs):
            tab_name = tab.get("name", f"Tab {i+1}")
            tab_content = tab.get("content", "").strip()
            
            if tab_content:
                combined_parts.append(f"# === {tab_name} ===")
                combined_parts.append(tab_content)
                combined_parts.append("")  # Add blank line between tabs
        
        return "\n".join(combined_parts)

# Create singleton instance
code_execution_consumer = CodeExecutionConsumer()

async def start_code_execution_consumer():
    """Start the code execution consumer (for use in lifespan)"""
    try:
        await code_execution_consumer.start_consuming()
    except Exception as e:
        logger.error(f"Failed to start code execution consumer: {e}")
        raise

async def stop_code_execution_consumer():
    """Stop the code execution consumer (for use in lifespan)"""
    try:
        await code_execution_consumer.stop_consuming()
    except Exception as e:
        logger.error(f"Error stopping code execution consumer: {e}")

# Export for use in other modules
__all__ = [
    "code_execution_consumer", 
    "start_code_execution_consumer", 
    "stop_code_execution_consumer"
]
