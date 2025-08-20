import pytest
import uuid
from fastapi import status
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.api.routers.auth.router import router as auth_router


class TestBasicFunctionality:
    """Тесты основной функциональности системы"""
    
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

    def test_user_registration_and_login(self, client):
        """Тест регистрации и входа пользователя"""
        # Генерируем уникальный логин
        unique_login = f"testuser_{uuid.uuid4().hex[:8]}"
        
        # Данные для регистрации
        user_data = {
            "login": unique_login,
            "username": "Test User",
            "email": f"{unique_login}@test.com",
            "password": "testpass123",
            "role": "employee"
        }
        
        # Регистрируем пользователя
        register_response = client.post("/auth/register/", json=user_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        register_data = register_response.json()
        assert "access_token" in register_data
        assert register_data["token_type"] == "bearer"
        assert register_data["message"] == "User registered successfully"
        
        # Входим с тем же пользователем
        login_data = {
            "username": unique_login,
            "password": "testpass123"
        }
        
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["token_type"] == "bearer"

    def test_admin_organization_management(self, client):
        """Тест управления организациями админом"""
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
        
        # Создаем организацию
        org_data = {
            "name": "Test Organization",
            "description": "Test organization for testing",
            "domain": "test.com"
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        org_response = client.post("/auth/organizations/", json=org_data, headers=headers)
        assert org_response.status_code == status.HTTP_200_OK
        
        org_data = org_response.json()
        assert org_data["name"] == "Test Organization"
        assert org_data["domain"] == "test.com"
        
        # Получаем список организаций
        orgs_response = client.get("/auth/organizations/", headers=headers)
        assert orgs_response.status_code == status.HTTP_200_OK
        
        orgs = orgs_response.json()
        assert len(orgs) >= 1

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
        
        org_data = {"name": "Test Org", "description": "Test"}
        org_response = client.post("/auth/organizations/", json=org_data, headers=headers)
        assert org_response.status_code == status.HTTP_403_FORBIDDEN
