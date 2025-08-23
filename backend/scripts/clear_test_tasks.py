#!/usr/bin/env python3
"""
Скрипт для очистки тестовых задач из базы данных
"""

import asyncio
import sys
import os

# Добавляем корневую директорию в путь
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from core.database.models.task_model import Task
from core.settings.config import get_settings

async def clear_test_tasks():
    """Очищает тестовые задачи из базы данных"""
    
    # Получаем настройки
    settings = get_settings()
    
    # Создаем подключение к базе данных
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Находим тестовые задачи
            test_tasks_query = select(Task).where(
                (Task.title.contains('Test Task')) |
                (Task.title.contains('Test')) |
                (Task.description.contains('test')) |
                (Task.description.contains('Test'))
            )
            
            result = await session.execute(test_tasks_query)
            test_tasks = result.scalars().all()
            
            if not test_tasks:
                print("No test tasks found in database.")
                return
            
            print(f"Found {len(test_tasks)} test tasks:")
            for task in test_tasks:
                print(f"  - ID: {task.id}, Title: {task.title}")
            
            # Удаляем тестовые задачи
            delete_query = delete(Task).where(
                (Task.title.contains('Test Task')) |
                (Task.title.contains('Test')) |
                (Task.description.contains('test')) |
                (Task.description.contains('Test'))
            )
            
            result = await session.execute(delete_query)
            await session.commit()
            
            print(f"Successfully deleted {len(test_tasks)} test tasks from database.")
            
        except Exception as e:
            print(f"Error clearing test tasks: {e}")
            await session.rollback()
        finally:
            await engine.dispose()

if __name__ == "__main__":
    print("Clearing test tasks from database...")
    asyncio.run(clear_test_tasks())
    print("Done.")
