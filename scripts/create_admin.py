#!/usr/bin/env python3
"""
Скрипт для создания администратора системы AI Control
Использование: python scripts/create_admin.py [--login LOGIN] [--email EMAIL] [--password PASSWORD] [--username USERNAME]
"""

import asyncio
import argparse
import sys
import os
from pathlib import Path

# Добавляем корневую директорию проекта в путь
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.database.engine import get_db_helper
from core.database.orm.orm_query_user import orm_add_user
from backend.api.configuration.auth import get_password_hash
from core.database.models import User


async def create_admin_user(
    login: str,
    email: str,
    password: str,
    username: str = None
) -> bool:
    """
    Создает администратора в системе
    
    Args:
        login: Логин администратора
        email: Email администратора
        password: Пароль администратора
        username: Имя пользователя (по умолчанию = login)
    
    Returns:
        bool: True если админ создан успешно, False если уже существует
    """
    if username is None:
        username = login
    
    # Хешируем пароль
    hashed_password = get_password_hash(password)
    
    db_helper = get_db_helper()
    async with db_helper.get_session() as session:
        try:
            # Проверяем, существует ли уже пользователь с таким логином или email
            from sqlalchemy import select
            query = select(User).where(
                (User.login == login) | (User.email == email)
            )
            result = await session.execute(query)
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"❌ Пользователь с логином '{login}' или email '{email}' уже существует!")
                print(f"   ID: {existing_user.id}, Роль: {existing_user.role}")
                return False
            
            # Создаем администратора
            admin_user = await orm_add_user(
                session=session,
                username=username,
                login=login,
                hashed_password=hashed_password,
                email=email,
                role="admin",
                position="System Administrator",
                phone=None,
                manager_id=None,
                department_id=None,
                organization_id=None
            )
            
            print(f"✅ Администратор успешно создан!")
            print(f"   ID: {admin_user.id}")
            print(f"   Логин: {admin_user.login}")
            print(f"   Email: {admin_user.email}")
            print(f"   Имя: {admin_user.username}")
            print(f"   Роль: {admin_user.role}")
            print(f"   Статус: {'Активен' if admin_user.is_active else 'Неактивен'}")
            
            return True
            
        except Exception as e:
            print(f"❌ Ошибка при создании администратора: {e}")
            return False


def get_user_input(prompt: str, default: str = None) -> str:
    """Получает ввод от пользователя с возможностью значения по умолчанию"""
    if default:
        user_input = input(f"{prompt} [{default}]: ").strip()
        return user_input if user_input else default
    else:
        while True:
            user_input = input(f"{prompt}: ").strip()
            if user_input:
                return user_input
            print("❌ Поле не может быть пустым!")


def validate_email(email: str) -> bool:
    """Простая валидация email"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


async def main():
    """Основная функция скрипта"""
    parser = argparse.ArgumentParser(
        description="Создание администратора системы AI Control",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  python scripts/create_admin.py
  python scripts/create_admin.py --login admin --email admin@company.com --password admin123
  python scripts/create_admin.py --login superadmin --email admin@example.com --password MySecurePass123 --username "Super Admin"
        """
    )
    
    parser.add_argument("--login", help="Логин администратора")
    parser.add_argument("--email", help="Email администратора")
    parser.add_argument("--password", help="Пароль администратора")
    parser.add_argument("--username", help="Имя пользователя (по умолчанию = логин)")
    
    args = parser.parse_args()
    
    print("🔧 Создание администратора системы AI Control")
    print("=" * 50)
    
    # Получаем данные от пользователя
    if args.login:
        login = args.login
    else:
        login = get_user_input("Введите логин администратора", "admin")
    
    if args.email:
        email = args.email
    else:
        while True:
            email = get_user_input("Введите email администратора", "admin@localhost")
            if validate_email(email):
                break
            print("❌ Неверный формат email!")
    
    if args.password:
        password = args.password
    else:
        import getpass
        while True:
            password = getpass.getpass("Введите пароль администратора: ")
            if len(password) >= 6:
                break
            print("❌ Пароль должен содержать минимум 6 символов!")
    
    if args.username:
        username = args.username
    else:
        username = get_user_input("Введите имя пользователя", login)
    
    print("\n📋 Данные для создания администратора:")
    print(f"   Логин: {login}")
    print(f"   Email: {email}")
    print(f"   Имя: {username}")
    print(f"   Пароль: {'*' * len(password)}")
    
    # Подтверждение только в интерактивном режиме
    if not (args.login and args.email and args.password):
        confirm = input("\n❓ Создать администратора с указанными данными? (y/N): ").strip().lower()
        if confirm not in ['y', 'yes', 'да', 'д']:
            print("❌ Создание администратора отменено.")
            return
    
    # Создаем администратора
    print("\n🔄 Создание администратора...")
    success = await create_admin_user(login, email, password, username)
    
    if success:
        print("\n🎉 Администратор успешно создан!")
        print("Теперь вы можете войти в систему используя указанные данные.")
    else:
        print("\n💥 Не удалось создать администратора.")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Операция прервана пользователем.")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Критическая ошибка: {e}")
        sys.exit(1)
