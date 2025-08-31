#!/usr/bin/env python3
"""
Простой FastAPI сервер для локального тестирования без базы данных
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Создаем простое приложение
app = FastAPI(
    title="AI Control - Simple Backend",
    version="1.0.0",
    description="Упрощенный бэкенд для локального тестирования"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "AI Control Backend is running!"}

@app.get("/health")
async def health():
    return {"status": "ok", "message": "Backend is healthy"}

# Эмуляция auth endpoints
@app.get("/auth/user/me/")
async def get_current_user():
    # Возвращаем тестового пользователя
    return {
        "id": 1,
        "username": "test_user",
        "email": "test@example.com",
        "is_active": True
    }

@app.post("/auth/login")
async def login():
    return {
        "access_token": "test_token",
        "token_type": "bearer",
        "user": {
            "id": 1,
            "username": "test_user",
            "email": "test@example.com"
        }
    }

# Эмуляция основных API endpoints
@app.get("/api/tasks")
async def get_tasks():
    return []

@app.get("/api/projects")
async def get_projects():
    return []

@app.get("/api/teams")
async def get_teams():
    return []

@app.get("/api/statistics")
async def get_statistics():
    return {
        "completed": {"day": 0, "week": 0, "month": 0, "all_time": 0},
        "overdue_in_period": 0,
        "teams_count": 0,
        "projects_count": 0
    }

if __name__ == "__main__":
    print("🚀 Запуск упрощенного бэкенда для локального тестирования...")
    print("📍 Сервер будет доступен по адресу: http://localhost:8000")
    print("📖 Документация API: http://localhost:8000/docs")
    
    uvicorn.run(
        "run_simple_backend:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
