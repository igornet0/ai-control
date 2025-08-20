import pytest
import uuid
from fastapi import status
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.api.routers.auth.router import router as auth_router


class TestPermissionsAPI:
    """Тесты API разрешений"""
    
    @pytest.fixture
    def app(self):
        """Создаем FastAPI приложение с роутером аутентификации"""
        app = FastAPI()
        app.include_router(auth_router)
        return app
    
    @pytest.fixture
    def client(self, app):
        """Создаем тестовый клиент"""
        return TestClient(app)

    def test_create_permission_as_admin(self, client):
        """Тест создания разрешения админом"""
        # Создаем админа
        admin_login = f"admin_{uuid.uuid4().hex[:8]}"
        
        admin_data = {
            "login": admin_login,
            "username": "Admin User",
            "email": f"{admin_login}@test.com",
            "password": "admin123",
            "role": "admin"
        }
        
        # Регистрируем админа
        register_response = client.post("/auth/register/", json=admin_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как админ
        login_data = {
            "username": admin_login,
            "password": "admin123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Создаем разрешение
        permission_data = {
            "name": "read_users",
            "description": "Permission to read users",
            "resource": "users",
            "action": "read"
        }
        
        permission_response = client.post("/auth/permissions/", json=permission_data, headers=headers)
        assert permission_response.status_code == status.HTTP_200_OK
        
        permission = permission_response.json()
        assert permission["name"] == "read_users"
        assert permission["resource"] == "users"
        assert permission["action"] == "read"

    def test_get_permissions_as_admin(self, client):
        """Тест получения списка разрешений админом"""
        # Создаем админа
        admin_login = f"admin_{uuid.uuid4().hex[:8]}"
        
        admin_data = {
            "login": admin_login,
            "username": "Admin User",
            "email": f"{admin_login}@test.com",
            "password": "admin123",
            "role": "admin"
        }
        
        # Регистрируем админа
        register_response = client.post("/auth/register/", json=admin_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как админ
        login_data = {
            "username": admin_login,
            "password": "admin123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Получаем список разрешений
        permissions_response = client.get("/auth/permissions/", headers=headers)
        assert permissions_response.status_code == status.HTTP_200_OK
        
        permissions = permissions_response.json()
        assert isinstance(permissions, list)

    def test_assign_permission_to_role(self, client):
        """Тест назначения разрешения роли"""
        # Создаем админа
        admin_login = f"admin_{uuid.uuid4().hex[:8]}"
        
        admin_data = {
            "login": admin_login,
            "username": "Admin User",
            "email": f"{admin_login}@test.com",
            "password": "admin123",
            "role": "admin"
        }
        
        # Регистрируем админа
        register_response = client.post("/auth/register/", json=admin_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как админ
        login_data = {
            "username": admin_login,
            "password": "admin123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Сначала создаем разрешение
        permission_data = {
            "name": "write_departments",
            "description": "Permission to write departments",
            "resource": "departments",
            "action": "write"
        }
        
        permission_response = client.post("/auth/permissions/", json=permission_data, headers=headers)
        assert permission_response.status_code == status.HTTP_200_OK
        permission_id = permission_response.json()["id"]
        
        # Назначаем разрешение роли
        role_permission_data = {
            "role_id": 1,  # Предполагаем, что роль с ID 1 существует
            "permission_id": permission_id
        }
        
        role_permission_response = client.post("/auth/role-permissions/", json=role_permission_data, headers=headers)
        assert role_permission_response.status_code == status.HTTP_200_OK
        
        role_permission = role_permission_response.json()
        assert role_permission["role_id"] == 1
        assert role_permission["permission_id"] == permission_id

    def test_get_user_permissions(self, client):
        """Тест получения разрешений пользователя"""
        # Создаем пользователя
        user_login = f"user_{uuid.uuid4().hex[:8]}"
        
        user_data = {
            "login": user_login,
            "username": "Test User",
            "email": f"{user_login}@test.com",
            "password": "user123",
            "role": "employee"
        }
        
        # Регистрируем пользователя
        register_response = client.post("/auth/register/", json=user_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как пользователь
        login_data = {
            "username": user_login,
            "password": "user123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Получаем разрешения пользователя
        permissions_response = client.get("/auth/users/1/permissions/", headers=headers)
        assert permissions_response.status_code == status.HTTP_200_OK
        
        permissions = permissions_response.json()
        assert isinstance(permissions, list)
