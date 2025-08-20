"""
API для обработки данных через DataCode
"""

import os
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import logging
import asyncio
from datetime import datetime

from backend.api.configuration.auth import verify_authorization
from backend.api.configuration.server import Server
from core.database.orm.orm_query_user import orm_get_user_by_id
from backend.services.datacode_service import datacode_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data-processing", tags=["data-processing"])

# Поддерживаемые форматы файлов
SUPPORTED_FORMATS = {
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.json': 'application/json',
    '.txt': 'text/plain'
}

# Максимальный размер файла (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

class FileUploadResponse(BaseModel):
    """Ответ на загрузку файла"""
    file_id: str = Field(..., description="Уникальный идентификатор файла")
    filename: str = Field(..., description="Имя загруженного файла")
    file_size: int = Field(..., description="Размер файла в байтах")
    file_type: str = Field(..., description="Тип файла")
    upload_time: datetime = Field(..., description="Время загрузки")
    message: str = Field(..., description="Сообщение о результате")

class DataProcessingRequest(BaseModel):
    """Запрос на обработку данных"""
    file_id: str = Field(..., description="ID загруженного файла")
    datacode_script: str = Field(..., description="Скрипт DataCode для обработки")
    output_format: Optional[str] = Field(default="json", description="Формат выходных данных")
    cache_results: bool = Field(default=True, description="Кэшировать результаты")

class DataProcessingResponse(BaseModel):
    """Ответ на обработку данных"""
    processing_id: str = Field(..., description="Уникальный идентификатор обработки")
    status: str = Field(..., description="Статус обработки")
    message: str = Field(..., description="Сообщение о результате")
    results: Optional[Dict[str, Any]] = Field(None, description="Результаты обработки")
    processing_time: Optional[float] = Field(None, description="Время обработки в секундах")

class FileInfo(BaseModel):
    """Информация о файле"""
    file_id: str
    filename: str
    file_size: int
    file_type: str
    upload_time: datetime
    user_id: int
    file_path: Optional[str] = None

# Хранилище загруженных файлов (в продакшене использовать базу данных)
uploaded_files: Dict[str, FileInfo] = {}

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user = Depends(verify_authorization)
):
    """
    Загрузка файла для обработки
    
    Поддерживаемые форматы: CSV, Excel (xlsx, xls), JSON, TXT
    Максимальный размер: 50MB
    """
    try:
        # Проверка размера файла
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Проверка типа файла
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in SUPPORTED_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Supported formats: {', '.join(SUPPORTED_FORMATS.keys())}"
            )
        
        # Генерируем уникальный ID файла
        file_id = str(uuid.uuid4())
        
        # Создаем временную директорию для файлов пользователя
        user_files_dir = Path(f"temp_uploads/user_{user.id}")
        user_files_dir.mkdir(parents=True, exist_ok=True)
        
        # Сохраняем файл
        file_path = user_files_dir / f"{file_id}_{file.filename}"
        
        # Читаем содержимое файла
        content = await file.read()
        
        # Проверяем размер после чтения
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Сохраняем файл
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Сохраняем информацию о файле
        file_info = FileInfo(
            file_id=file_id,
            filename=file.filename,
            file_size=len(content),
            file_type=file_extension,
            upload_time=datetime.utcnow(),
            user_id=user.id
        )
        uploaded_files[file_id] = file_info
        
        # Сохраняем путь к файлу для обработки
        file_info.file_path = str(file_path)
        
        logger.info(f"File uploaded successfully: {file_id} ({file.filename}) by user {user.id}")
        
        return FileUploadResponse(
            file_id=file_id,
            filename=file.filename,
            file_size=len(content),
            file_type=file_extension,
            upload_time=file_info.upload_time,
            message="File uploaded successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while uploading file"
        )

@router.post("/process", response_model=DataProcessingResponse)
async def process_data(
    request: DataProcessingRequest,
    user = Depends(verify_authorization)
):
    """
    Обработка данных через DataCode
    
    Выполняет скрипт DataCode над загруженным файлом
    """
    try:
        # Проверяем существование файла
        if request.file_id not in uploaded_files:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        file_info = uploaded_files[request.file_id]
        
        # Проверяем права доступа к файлу
        if file_info.user_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this file"
            )
        
        # Генерируем ID обработки
        processing_id = str(uuid.uuid4())
        
        # Выполняем обработку через DataCode
        start_time = datetime.utcnow()
        
        try:
            # Валидируем скрипт
            validation_result = await datacode_service.validate_script(request.datacode_script)
            if not validation_result.get("valid", False):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid DataCode script: {validation_result.get('error', 'Unknown error')}"
                )
            
            # Обрабатываем файл через DataCode
            if file_info.file_type == '.csv':
                results = await datacode_service.process_csv_file(
                    file_info.file_path,
                    request.datacode_script,
                    request.output_format
                )
            else:
                # Для других форматов используем общий метод
                results = await datacode_service.execute_script(
                    request.datacode_script,
                    file_info.file_path,
                    request.output_format
                )
            
        except Exception as e:
            logger.error(f"Error processing data with DataCode: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing data: {str(e)}"
            )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        logger.info(f"Data processing completed: {processing_id} for file {request.file_id}")
        
        return DataProcessingResponse(
            processing_id=processing_id,
            status="completed",
            message="Data processing completed successfully",
            results=results,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while processing data"
        )

@router.get("/files", response_model=List[FileInfo])
async def list_user_files(
    user = Depends(verify_authorization)
):
    """
    Получение списка загруженных файлов пользователя
    """
    try:
        user_files = [
            file_info for file_info in uploaded_files.values()
            if file_info.user_id == user.id
        ]
        
        return user_files
        
    except Exception as e:
        logger.error(f"Error listing user files: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while listing files"
        )

@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    user = Depends(verify_authorization)
):
    """
    Удаление загруженного файла
    """
    try:
        if file_id not in uploaded_files:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        file_info = uploaded_files[file_id]
        
        # Проверяем права доступа
        if file_info.user_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this file"
            )
        
        # Удаляем файл с диска
        user_files_dir = Path(f"temp_uploads/user_{user.id}")
        file_path = user_files_dir / f"{file_id}_{file_info.filename}"
        
        if file_path.exists():
            file_path.unlink()
        
        # Удаляем информацию о файле
        del uploaded_files[file_id]
        
        logger.info(f"File deleted: {file_id} by user {user.id}")
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while deleting file"
        )

@router.get("/supported-formats")
async def get_supported_formats():
    """
    Получение списка поддерживаемых форматов файлов
    """
    return {
        "supported_formats": list(SUPPORTED_FORMATS.keys()),
        "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
        "mime_types": SUPPORTED_FORMATS
    }

@router.post("/validate-script")
async def validate_datacode_script(
    script: str = Form(...),
    user = Depends(verify_authorization)
):
    """
    Валидация скрипта DataCode
    
    Проверяет синтаксис и корректность скрипта
    """
    try:
        validation_result = await datacode_service.validate_script(script)
        
        return {
            "valid": validation_result.get("valid", False),
            "error": validation_result.get("error"),
            "details": validation_result.get("result")
        }
        
    except Exception as e:
        logger.error(f"Error validating script: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while validating script"
        )

@router.get("/datacode-functions")
async def get_datacode_functions(
    user = Depends(verify_authorization)
):
    """
    Получение списка доступных функций DataCode
    """
    try:
        functions = await datacode_service.get_available_functions()
        
        return {
            "functions": functions,
            "total_count": len(functions),
            "categories": {
                "builtin": len([f for f in functions if f.get("type") == "builtin"]),
                "math": len([f for f in functions if f.get("type") == "math"]),
                "string": len([f for f in functions if f.get("type") == "string"]),
                "array": len([f for f in functions if f.get("type") == "array"]),
                "file": len([f for f in functions if f.get("type") == "file"]),
                "table": len([f for f in functions if f.get("type") == "table"])
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting DataCode functions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting functions"
        )

@router.post("/execute-script")
async def execute_datacode_script(
    script: str = Form(...),
    output_format: str = Form(default="json"),
    user = Depends(verify_authorization)
):
    """
    Выполнение скрипта DataCode без файла
    
    Полезно для тестирования и выполнения вычислений
    """
    try:
        # Валидируем скрипт
        validation_result = await datacode_service.validate_script(script)
        if not validation_result.get("valid", False):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid DataCode script: {validation_result.get('error', 'Unknown error')}"
            )
        
        # Выполняем скрипт
        start_time = datetime.utcnow()
        result = await datacode_service.execute_script(script, output_format=output_format)
        end_time = datetime.utcnow()
        
        processing_time = (end_time - start_time).total_seconds()
        
        return {
            "execution_id": str(uuid.uuid4()),
            "status": "completed",
            "result": result,
            "processing_time": processing_time,
            "script": script,
            "output_format": output_format
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing DataCode script: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error executing script: {str(e)}"
        )
