# AI Control System Makefile
# Usage: make <target>

# Variables
PROJECT_NAME = ai-control
DOCKER_COMPOSE_DEV = aic_docker/docker-compose.dev.yml
DOCKER_COMPOSE_PROD = aic_docker/docker-compose.prod.yml
ENV_FILE = aic_docker/.env

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

.PHONY: help dev prod build clean logs shell test lint migrate create-admin create-admin-quick list-admins

# Default target
help:
	@echo "$(BLUE)AI Control System - Available Commands:$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build development containers"
	@echo "  make dev-down     - Stop development environment"
	@echo "  make dev-logs     - Show development logs"
	@echo "  make dev-shell    - Open shell in backend container"
	@echo ""
	@echo "$(GREEN)Production:$(NC)"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build production containers"
	@echo "  make prod-down    - Stop production environment"
	@echo "  make prod-logs    - Show production logs"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  make test         - Run all tests"
	@echo "  make test-unit    - Run unit tests"
	@echo "  make test-integration - Run integration tests"
	@echo "  make test-coverage - Run tests with coverage"
	@echo ""
	@echo "$(GREEN)Code Quality:$(NC)"
	@echo "  make lint         - Run linting"
	@echo "  make format       - Format code"
	@echo "  make type-check   - Run type checking"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make migrate      - Run database migrations"
	@echo "  make migrate-create - Create new migration"
	@echo "  make db-reset     - Reset database"
	@echo "  make create-admin - Create system administrator"
	@echo "  make create-admin-quick - Create admin with default credentials"
	@echo "  make list-admins - List all system administrators"
	@echo ""
	@echo "$(GREEN)Monitoring:$(NC)"
	@echo "  make monitoring   - Start monitoring stack"
	@echo "  make monitoring-down - Stop monitoring stack"
	@echo "  make monitoring-logs - Show monitoring logs"
	@echo "  make grafana      - Open Grafana dashboard"
	@echo "  make prometheus   - Open Prometheus dashboard"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make clean        - Clean up containers and volumes"
	@echo "  make logs         - Show all logs"
	@echo "  make shell        - Open shell in backend container"
	@echo "  make backup       - Backup database"
	@echo "  make restore      - Restore database"

# Development commands
dev: check-env
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) up -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:3000$(NC)"
	@echo "$(YELLOW)Backend API: http://localhost:8000$(NC)"
	@echo "$(YELLOW)API Docs: http://localhost:8000/docs$(NC)"
	@echo "$(YELLOW)RabbitMQ: http://localhost:15672$(NC)"
	@echo "$(YELLOW)Flower: http://localhost:5555$(NC)"

dev-build: check-env
	@echo "$(GREEN)Building development containers...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) build

dev-down:
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) down

dev-logs:
	docker-compose -f $(DOCKER_COMPOSE_DEV) logs -f

dev-shell:
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend bash

# Production commands
prod: check-env
	@echo "$(GREEN)Starting production environment...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_PROD) up -d
	@echo "$(GREEN)Production environment started!$(NC)"
	@echo "$(YELLOW)Frontend: https://localhost$(NC)"
	@echo "$(YELLOW)Backend API: https://localhost/api$(NC)"
	@echo "$(YELLOW)Grafana: http://localhost:3001$(NC)"
	@echo "$(YELLOW)Prometheus: http://localhost:9090$(NC)"

prod-build: check-env
	@echo "$(GREEN)Building production containers...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_PROD) build

prod-down:
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_PROD) down

prod-logs:
	docker-compose -f $(DOCKER_COMPOSE_PROD) logs -f

# Testing commands
test:
	@echo "$(GREEN)Running all tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python -m pytest

test-unit:
	@echo "$(GREEN)Running unit tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python -m pytest tests/unit/

test-integration:
	@echo "$(GREEN)Running integration tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python -m pytest tests/integration/

test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python -m pytest --cov=backend --cov=core --cov-report=html

# New test structure commands
test-new:
	@echo "$(GREEN)Running new test structure...$(NC)"
	python -m pytest -c pytest_new.ini

test-new-unit:
	@echo "$(GREEN)Running new unit tests...$(NC)"
	python -m pytest -c pytest_new.ini tests_new/unit/ -m unit

test-new-integration:
	@echo "$(GREEN)Running new integration tests...$(NC)"
	python -m pytest -c pytest_new.ini tests_new/integration/ -m integration

test-new-coverage:
	@echo "$(GREEN)Running new tests with coverage...$(NC)"
	python -m pytest -c pytest_new.ini --cov=src --cov-report=html --cov-report=term-missing

test-new-auth:
	@echo "$(GREEN)Running authentication tests...$(NC)"
	python -m pytest -c pytest_new.ini -m auth

test-new-api:
	@echo "$(GREEN)Running API tests...$(NC)"
	python -m pytest -c pytest_new.ini -m api

# Code quality commands
lint:
	@echo "$(GREEN)Running linting...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend flake8 backend core tests
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend black --check backend core tests

format:
	@echo "$(GREEN)Formatting code...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend black backend core tests
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend isort backend core tests

type-check:
	@echo "$(GREEN)Running type checking...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend mypy backend core

# Database commands
migrate:
	@echo "$(GREEN)Running database migrations...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend alembic upgrade head

migrate-create:
	@echo "$(GREEN)Creating new migration...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend alembic revision --autogenerate -m "$(message)"

db-reset:
	@echo "$(RED)Resetting database...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend alembic downgrade base
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend alembic upgrade head

create-admin:
	@echo "$(GREEN)Creating system administrator...$(NC)"
	@if [ -f scripts/create_admin.py ]; then \
		docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python /app/scripts/create_admin.py; \
	else \
		echo "$(RED)Error: scripts/create_admin.py not found!$(NC)"; \
		echo "$(YELLOW)Please ensure the script exists in the project root.$(NC)"; \
		exit 1; \
	fi

create-admin-quick:
	@echo "$(GREEN)Creating system administrator with default credentials...$(NC)"
	@if [ -f scripts/create_admin.py ]; then \
		docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python /app/scripts/create_admin.py --login admin --email admin@localhost --password admin123 --username "System Administrator"; \
	else \
		echo "$(RED)Error: scripts/create_admin.py not found!$(NC)"; \
		echo "$(YELLOW)Please ensure the script exists in the project root.$(NC)"; \
		exit 1; \
	fi

list-admins:
	@echo "$(GREEN)Listing system administrators...$(NC)"
	@if [ -f scripts/list_admins.py ]; then \
		docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python /app/scripts/list_admins.py; \
	else \
		echo "$(RED)Error: scripts/list_admins.py not found!$(NC)"; \
		echo "$(YELLOW)Please ensure the script exists in the project root.$(NC)"; \
		exit 1; \
	fi

# Utility commands
clean:
	@echo "$(YELLOW)Cleaning up containers and volumes...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) down -v
	docker-compose -f $(DOCKER_COMPOSE_PROD) down -v
	docker system prune -f
	docker volume prune -f

logs:
	docker-compose -f $(DOCKER_COMPOSE_DEV) logs -f

shell:
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend bash

backup:
	@echo "$(GREEN)Creating database backup...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec postgres pg_dump -U ai_control_user ai_control_dev > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore:
	@echo "$(GREEN)Restoring database from backup...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec -T postgres psql -U ai_control_user ai_control_dev < $(file)

# Helper functions
check-env:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "$(RED)Error: $(ENV_FILE) file not found!$(NC)"; \
		echo "$(YELLOW)Please copy aic_docker/env.example to aic_docker/.env and configure it.$(NC)"; \
		exit 1; \
	fi

# Health check
health:
	@echo "$(GREEN)Checking service health...$(NC)"
	@curl -f http://localhost:8000/health || echo "$(RED)Backend is not healthy$(NC)"
	@curl -f http://localhost:3000 || echo "$(RED)Frontend is not healthy$(NC)"
	@curl -f http://localhost:6379 || echo "$(RED)Redis is not healthy$(NC)"
	@curl -f http://localhost:5432 || echo "$(RED)PostgreSQL is not healthy$(NC)"

# Development setup
setup-dev: check-env
	@echo "$(GREEN)Setting up development environment...$(NC)"
	@make dev-build
	@make dev
	@echo "$(GREEN)Waiting for services to start...$(NC)"
	@sleep 10
	@make migrate
	@echo "$(GREEN)Development environment setup complete!$(NC)"
	@echo "$(YELLOW)To create an admin user, run: make create-admin$(NC)"

# Production setup
setup-prod: check-env
	@echo "$(GREEN)Setting up production environment...$(NC)"
	@make prod-build
	@make prod
	@echo "$(GREEN)Production environment setup complete!$(NC)"

# Monitoring commands
monitoring: check-env
	@echo "$(GREEN)Starting monitoring stack...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f aic_docker/docker-compose.monitoring.yml up -d
	@echo "$(GREEN)Monitoring stack started!$(NC)"
	@echo "$(YELLOW)Prometheus: http://localhost:9090$(NC)"
	@echo "$(YELLOW)Grafana: http://localhost:3001 (admin/admin123)$(NC)"
	@echo "$(YELLOW)AlertManager: http://localhost:9093$(NC)"
	@echo "$(YELLOW)Jaeger: http://localhost:16686$(NC)"
	@echo "$(YELLOW)Kibana: http://localhost:5601$(NC)"

monitoring-down:
	@echo "$(YELLOW)Stopping monitoring stack...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f aic_docker/docker-compose.monitoring.yml down

monitoring-logs:
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f aic_docker/docker-compose.monitoring.yml logs -f

grafana:
	@echo "$(GREEN)Opening Grafana dashboard...$(NC)"
	@open http://localhost:3001 || echo "$(YELLOW)Please open http://localhost:3001 in your browser$(NC)"

prometheus:
	@echo "$(GREEN)Opening Prometheus dashboard...$(NC)"
	@open http://localhost:9090 || echo "$(YELLOW)Please open http://localhost:9090 in your browser$(NC)"
