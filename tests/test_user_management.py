import pytest
import uuid
from fastapi import status
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.api.routers.auth.router import router as auth_router


class TestUserManagement:
    """Тесты управления пользователями"""
    
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

    def test_user_registration(self, client):
        """Тест регистрации пользователя"""
        unique_login = f"newuser_{uuid.uuid4().hex[:8]}"
        
        user_data = {
            "login": unique_login,
            "username": "New User",
            "email": f"{unique_login}@test.com",
            "password": "password123",
            "role": "employee"
        }
        
        response = client.post("/auth/register/", json=user_data)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["message"] == "User registered successfully"
    
    def test_user_login(self, client):
        """Тест входа пользователя"""
        # Сначала регистрируем пользователя
        unique_login = f"loginuser_{uuid.uuid4().hex[:8]}"
        
        user_data = {
            "login": unique_login,
            "username": "Login User",
            "email": f"{unique_login}@test.com",
            "password": "testpass",
            "role": "employee"
        }
        
        # Регистрируем пользователя
        register_response = client.post("/auth/register/", json=user_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим с тем же пользователем
        login_data = {
            "username": unique_login,
            "password": "testpass"
        }
        
        response = client.post("/auth/login_user/", data=login_data)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_create_organization_as_admin(self, client):
        """Тест создания организации админом"""
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
            "description": "Test organization",
            "domain": "test.com"
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post("/auth/organizations/", json=org_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["name"] == "Test Organization"
        assert data["domain"] == "test.com"

    def test_create_department_as_ceo(self, client):
        """Тест создания департамента CEO"""
        # Создаем CEO
        ceo_login = f"ceo_{uuid.uuid4().hex[:8]}"
        
        ceo_data = {
            "login": ceo_login,
            "username": "CEO User",
            "email": f"{ceo_login}@test.com",
            "password": "ceo123",
            "role": "CEO"
        }
        
        # Регистрируем CEO
        register_response = client.post("/auth/register/", json=ceo_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Входим как CEO
        login_data = {
            "username": ceo_login,
            "password": "ceo123"
        }
        login_response = client.post("/auth/login_user/", data=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        # Сначала создаем организацию
        org_data = {
            "name": "Test Organization",
            "description": "Test organization",
            "domain": "test.com"
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        org_response = client.post("/auth/organizations/", json=org_data, headers=headers)
        assert org_response.status_code == status.HTTP_200_OK
        org_id = org_response.json()["id"]
        
        # Создаем департамент
        dept_data = {
            "name": "Test Department",
            "description": "Test department",
            "organization_id": org_id
        }
        
        response = client.post("/auth/departments/", json=dept_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["name"] == "Test Department"
        assert data["organization_id"] == org_id

    def test_get_users_admin_access(self, client):
        """Тест получения списка пользователей (доступ админа)"""
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
        response = client.get("/auth/users/", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        
        users = response.json()
        assert len(users) >= 1  # Должен быть хотя бы админ

    def test_employee_access_denied(self, client):
        """Тест отказа в доступе для сотрудника"""
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
        
        # Пытаемся получить всех пользователей (должно быть запрещено)
        response = client.get("/auth/users/", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Пытаемся создать организацию (должно быть запрещено)
        org_data = {"name": "Test Org", "description": "Test"}
        response = client.post("/auth/organizations/", json=org_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
