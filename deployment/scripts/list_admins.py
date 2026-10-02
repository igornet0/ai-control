#!/usr/bin/env python3
"""
Скрипт для просмотра списка администраторов системы AI Control
Использование: python scripts/list_admins.py
"""

import asyncio
import sys
from pathlib import Path

# Добавляем корневую директорию проекта в путь
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.database.engine import get_db_helper
from core.database.models import User
from sqlalchemy import select


async def list_admin_users():
    """Выводит список всех администраторов системы"""
    
    db_helper = get_db_helper()
    async with db_helper.get_session() as session:
        try:
            # Получаем всех пользователей с ролью admin
            query = select(User).where(User.role == "admin").order_by(User.created_at)
            result = await session.execute(query)
            admin_users = result.scalars().all()
            
            if not admin_users:
                print("❌ Администраторы не найдены в системе.")
                print("💡 Для создания администратора используйте: make create-admin")
                return
            
            print(f"👥 Найдено администраторов: {len(admin_users)}")
            print("=" * 80)
            
            for i, user in enumerate(admin_users, 1):
                print(f"{i}. ID: {user.id}")
                print(f"   Логин: {user.login}")
                print(f"   Email: {user.email}")
                print(f"   Имя: {user.username}")
                print(f"   Роль: {user.role}")
                print(f"   Статус: {'✅ Активен' if user.is_active else '❌ Неактивен'}")
                print(f"   Создан: {user.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                if user.last_login:
                    print(f"   Последний вход: {user.last_login.strftime('%Y-%m-%d %H:%M:%S')}")
                else:
                    print(f"   Последний вход: Никогда")
                print("-" * 40)
            
        except Exception as e:
            print(f"❌ Ошибка при получении списка администраторов: {e}")


async def main():
    """Основная функция скрипта"""
    print("👥 Список администраторов системы AI Control")
    print("=" * 50)
    
    await list_admin_users()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Операция прервана пользователем.")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Критическая ошибка: {e}")
        sys.exit(1)
