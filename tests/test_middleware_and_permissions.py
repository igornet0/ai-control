import pytest
import uuid
from fastapi import status
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.api.routers.auth.router import router as auth_router


class TestMiddlewareAndPermissions:
    """Тесты middleware и системы разрешений"""
    
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

    def test_public_endpoints_no_auth_required(self, client):
        """Тест что публичные endpoints не требуют аутентификации"""
        # Тест регистрации
        user_data = {
            "login": f"testuser_{uuid.uuid4().hex[:8]}",
            "username": "Test User",
            "email": f"testuser_{uuid.uuid4().hex[:8]}@test.com",
            "password": "testpass123",
            "role": "employee"
        }
        
        response = client.post("/auth/register/", json=user_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Тест входа
        login_data = {
            "username": user_data["login"],
            "password": "testpass123"
        }
        
        response = client.post("/auth/login_user/", data=login_data)
        assert response.status_code == status.HTTP_200_OK

    def test_protected_endpoints_require_auth(self, client):
        """Тест что защищенные endpoints требуют аутентификации"""
        # Попытка получить список пользователей без аутентификации
        response = client.get("/auth/users/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Попытка создать организацию без аутентификации
        org_data = {"name": "Test Org", "description": "Test"}
        response = client.post("/auth/organizations/", json=org_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_role_based_access_control(self, client):
        """Тест контроля доступа на основе ролей"""
        # Создаем сотрудника
        employee_login = f"employee_{uuid.uuid4().hex[:8]}"
        
        employee_data = {
            "login": employee_login,
            "username": "Employee User",
            "email": f"{employee_login}@test.com",
            "password": "employee123",
            "role": "employee"
        }
        
        # Регистрируем сотрудника
        register_response = client.post("/auth/register/", json=employee_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как сотрудник
        login_data = {
            "username": employee_login,
            "password": "employee123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Сотрудник не должен иметь доступ к админским функциям
        users_response = client.get("/auth/users/", headers=headers)
        assert users_response.status_code == status.HTTP_403_FORBIDDEN
        
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
        
        # Админ должен иметь доступ к админским функциям
        users_response = client.get("/auth/users/", headers=headers)
        assert users_response.status_code == status.HTTP_200_OK

    def test_permission_management(self, client):
        """Тест управления разрешениями"""
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
        
        # Получаем список разрешений
        permissions_response = client.get("/auth/permissions/", headers=headers)
        assert permissions_response.status_code == status.HTTP_200_OK
        
        permissions = permissions_response.json()
        assert len(permissions) >= 1

    def test_employee_cannot_access_permissions(self, client):
        """Тест что сотрудники не могут управлять разрешениями"""
        # Создаем сотрудника
        employee_login = f"employee_{uuid.uuid4().hex[:8]}"
        
        employee_data = {
            "login": employee_login,
            "username": "Employee User",
            "email": f"{employee_login}@test.com",
            "password": "employee123",
            "role": "employee"
        }
        
        # Регистрируем сотрудника
        register_response = client.post("/auth/register/", json=employee_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как сотрудник
        login_data = {
            "username": employee_login,
            "password": "employee123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Сотрудник не должен иметь доступ к управлению разрешениями
        permission_data = {
            "name": "test_permission",
            "description": "Test permission",
            "resource": "test",
            "action": "read"
        }
        
        response = client.post("/auth/permissions/", json=permission_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        response = client.get("/auth/permissions/", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
