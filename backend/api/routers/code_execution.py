from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import logging

from backend.api.configuration.rabbitmq_server import rabbit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/code-execution", tags=["code-execution"])

class TabData(BaseModel):
    """Model for individual tab data"""
    name: str = Field(..., description="Name of the tab")
    content: str = Field(..., description="Code content of the tab")

class CodeExecutionRequest(BaseModel):
    """Model for code execution request"""
    code: Optional[str] = Field(None, description="Direct code to execute (alternative to tabs)")
    language: str = Field(default="python", description="Programming language")
    tabs: Optional[List[TabData]] = Field(None, description="List of tabs with code content")
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    execution_id: Optional[str] = Field(None, description="Optional custom execution ID")

class CodeExecutionResponse(BaseModel):
    """Model for code execution response"""
    execution_id: str = Field(..., description="Unique execution identifier")
    status: str = Field(..., description="Request status")
    message: str = Field(..., description="Status message")
    websocket_url: str = Field(..., description="WebSocket URL for real-time updates")

@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Submit code for execution
    
    This endpoint accepts code (either directly or from tabs) and queues it for execution.
    Real-time results are available via WebSocket connection.
    """
    try:
        # Generate execution ID if not provided
        execution_id = request.execution_id or str(uuid.uuid4())
        
        # Validate request
        if not request.code and not request.tabs:
            raise HTTPException(
                status_code=400,
                detail="Either 'code' or 'tabs' must be provided"
            )
        
        if request.tabs and not any(tab.content.strip() for tab in request.tabs):
            raise HTTPException(
                status_code=400,
                detail="At least one tab must contain code"
            )
        
        # Prepare message for RabbitMQ
        message_data = {
            "execution_id": execution_id,
            "code": request.code or "",
            "language": request.language,
            "tabs": [{"name": tab.name, "content": tab.content} for tab in request.tabs] if request.tabs else [],
            "user_id": request.user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "request_source": "api"
        }
        
        # Send to RabbitMQ queue
        await rabbit.send_message("code_execution_queue", message_data)
        
        logger.info(f"Code execution request queued: {execution_id}")
        
        return CodeExecutionResponse(
            execution_id=execution_id,
            status="queued",
            message="Code execution request has been queued for processing",
            websocket_url=f"/ws/code-execution/{execution_id}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting code execution request: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while processing request"
        )

@router.get("/status/{execution_id}")
async def get_execution_status(execution_id: str):
    """
    Get the current status of a code execution
    
    Note: This is a basic endpoint. Real-time updates are available via WebSocket.
    """
    # For now, this is a placeholder. In a production system, you might want to
    # store execution status in a database or cache
    return {
        "execution_id": execution_id,
        "message": "Use WebSocket connection for real-time status updates",
        "websocket_url": f"/ws/code-execution/{execution_id}"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint for the code execution service"""
    try:
        # Check RabbitMQ connection
        connection = await rabbit.get_connection()
        rabbitmq_status = "healthy" if not connection.is_closed else "unhealthy"
        
        return {
            "status": "healthy",
            "services": {
                "rabbitmq": rabbitmq_status,
                "code_execution": "healthy"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# Additional utility endpoints

@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported programming languages"""
    return {
        "languages": [
            {
                "name": "Python",
                "key": "python",
                "description": "Python 3.x execution",
                "file_extension": ".py"
            },
            {
                "name": "JavaScript",
                "key": "javascript",
                "description": "Node.js JavaScript execution",
                "file_extension": ".js"
            }
        ]
    }

@router.post("/validate")
async def validate_code(request: CodeExecutionRequest):
    """
    Validate code syntax without executing it
    
    This endpoint performs basic syntax validation for the provided code.
    """
    try:
        if not request.code and not request.tabs:
            raise HTTPException(
                status_code=400,
                detail="Either 'code' or 'tabs' must be provided"
            )
        
        # Get the code to validate
        code_to_validate = request.code
        if request.tabs:
            # Combine tab content for validation
            combined_parts = []
            for tab in request.tabs:
                if tab.content.strip():
                    combined_parts.append(tab.content)
            code_to_validate = "\n\n".join(combined_parts)
        
        if not code_to_validate.strip():
            raise HTTPException(
                status_code=400,
                detail="No code content found to validate"
            )
        
        # Basic syntax validation based on language
        validation_result = {"valid": True, "errors": []}
        
        if request.language.lower() == "python":
            try:
                compile(code_to_validate, '<string>', 'exec')
            except SyntaxError as e:
                validation_result = {
                    "valid": False,
                    "errors": [{
                        "type": "SyntaxError",
                        "message": str(e),
                        "line": getattr(e, 'lineno', None),
                        "column": getattr(e, 'offset', None)
                    }]
                }
        
        return {
            "language": request.language,
            "validation": validation_result,
            "code_length": len(code_to_validate),
            "line_count": len(code_to_validate.split('\n'))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating code: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during validation"
        )
