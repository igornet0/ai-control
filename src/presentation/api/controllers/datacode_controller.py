"""
DataCode API controller.
Handles HTTP requests for DataCode operations.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field

from src.infrastructure.external_services.datacode_service import datacode_service
from src.infrastructure.config.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/datacode", tags=["datacode"])


class ExecuteScriptRequest(BaseModel):
    """Request model for executing DataCode script."""
    
    script: str = Field(..., description="DataCode script to execute")
    input_file: Optional[str] = Field(default=None, description="Path to input file")
    output_format: str = Field(default="json", description="Output format (json, csv, table)")


class ExecuteScriptResponse(BaseModel):
    """Response model for executing DataCode script."""
    
    success: bool = Field(..., description="Whether execution was successful")
    result: Dict[str, Any] = Field(..., description="Execution result")
    error: Optional[str] = Field(default=None, description="Error message if failed")


class ValidateScriptRequest(BaseModel):
    """Request model for validating DataCode script."""
    
    script: str = Field(..., description="DataCode script to validate")


class ValidateScriptResponse(BaseModel):
    """Response model for validating DataCode script."""
    
    valid: bool = Field(..., description="Whether script is valid")
    error: Optional[str] = Field(default=None, description="Error message if invalid")


class FunctionInfo(BaseModel):
    """DataCode function information."""
    
    name: str = Field(..., description="Function name")
    type: str = Field(..., description="Function type")
    description: str = Field(..., description="Function description")


@router.post(
    "/execute",
    response_model=ExecuteScriptResponse,
    summary="Execute DataCode script",
    description="Execute a DataCode script and return the result.",
)
async def execute_script(request: ExecuteScriptRequest):
    """
    Execute DataCode script.
    
    Args:
        request: Script execution request
        
    Returns:
        ExecuteScriptResponse: Execution result
        
    Raises:
        HTTPException: If script execution fails
    """
    try:
        logger.info("Executing DataCode script", extra={
            "script_length": len(request.script),
            "output_format": request.output_format,
        })
        
        result = await datacode_service.execute_script(
            script=request.script,
            input_file=request.input_file,
            output_format=request.output_format,
        )
        
        logger.info("DataCode script executed successfully")
        
        return ExecuteScriptResponse(
            success=True,
            result=result,
        )
        
    except Exception as e:
        logger.error("DataCode script execution failed", extra={
            "error": str(e),
            "script_length": len(request.script),
        })
        
        return ExecuteScriptResponse(
            success=False,
            result={},
            error=str(e),
        )


@router.post(
    "/validate",
    response_model=ValidateScriptResponse,
    summary="Validate DataCode script",
    description="Validate a DataCode script syntax.",
)
async def validate_script(request: ValidateScriptRequest):
    """
    Validate DataCode script.
    
    Args:
        request: Script validation request
        
    Returns:
        ValidateScriptResponse: Validation result
    """
    try:
        logger.info("Validating DataCode script", extra={
            "script_length": len(request.script),
        })
        
        result = await datacode_service.validate_script(request.script)
        
        logger.info("DataCode script validation completed", extra={
            "valid": result["valid"],
        })
        
        return ValidateScriptResponse(
            valid=result["valid"],
            error=result.get("error"),
        )
        
    except Exception as e:
        logger.error("DataCode script validation failed", extra={
            "error": str(e),
            "script_length": len(request.script),
        })
        
        return ValidateScriptResponse(
            valid=False,
            error=str(e),
        )


@router.get(
    "/functions",
    response_model=List[FunctionInfo],
    summary="Get available functions",
    description="Get list of available DataCode functions.",
)
async def get_available_functions():
    """
    Get available DataCode functions.
    
    Returns:
        List[FunctionInfo]: List of available functions
    """
    try:
        logger.info("Getting available DataCode functions")
        
        functions = await datacode_service.get_available_functions()
        
        logger.info("Retrieved available DataCode functions", extra={
            "function_count": len(functions),
        })
        
        return [
            FunctionInfo(
                name=func["name"],
                type=func["type"],
                description=func["description"],
            )
            for func in functions
        ]
        
    except Exception as e:
        logger.error("Error getting available functions", extra={
            "error": str(e),
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available functions"
        )


@router.post(
    "/process-csv",
    response_model=ExecuteScriptResponse,
    summary="Process CSV file",
    description="Process a CSV file using DataCode script.",
)
async def process_csv_file(
    file: UploadFile = File(..., description="CSV file to process"),
    script: str = Field(..., description="DataCode script for processing"),
    output_format: str = Field(default="json", description="Output format"),
):
    """
    Process CSV file with DataCode script.
    
    Args:
        file: Uploaded CSV file
        script: DataCode script for processing
        output_format: Output format
        
    Returns:
        ExecuteScriptResponse: Processing result
        
    Raises:
        HTTPException: If processing fails
    """
    try:
        logger.info("Processing CSV file with DataCode", extra={
            "filename": file.filename,
            "script_length": len(script),
            "output_format": output_format,
        })
        
        # Save uploaded file temporarily
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            result = await datacode_service.process_csv_file(
                file_path=temp_file_path,
                script=script,
                output_format=output_format,
            )
            
            logger.info("CSV file processed successfully", extra={
                "filename": file.filename,
            })
            
            return ExecuteScriptResponse(
                success=True,
                result=result,
            )
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
        
    except Exception as e:
        logger.error("CSV file processing failed", extra={
            "error": str(e),
            "filename": file.filename,
        })
        
        return ExecuteScriptResponse(
            success=False,
            result={},
            error=str(e),
        )


@router.get(
    "/health",
    summary="DataCode service health check",
    description="Check if DataCode service is available.",
)
async def health_check():
    """
    Check DataCode service health.
    
    Returns:
        Dict: Health status
    """
    try:
        # Try to get available functions as a health check
        functions = await datacode_service.get_available_functions()
        
        return {
            "status": "healthy",
            "service": "datacode",
            "available_functions": len(functions),
            "executable_path": datacode_service.datacode_path,
        }
        
    except Exception as e:
        logger.error("DataCode service health check failed", extra={
            "error": str(e),
        })
        
        return {
            "status": "unhealthy",
            "service": "datacode",
            "error": str(e),
        }
