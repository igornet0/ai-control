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

.PHONY: help dev prod build clean logs shell test lint migrate

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
	@echo "  make test         - Run all tests (backend + frontend)"
	@echo "  make test-backend - Run backend tests only"
	@echo "  make test-frontend - Run frontend tests only"
	@echo "  make test-unit    - Run backend unit tests"
	@echo "  make test-integration - Run backend integration tests"
	@echo "  make test-coverage - Run backend tests with coverage"
	@echo "  make test-frontend-watch - Run frontend tests in watch mode"
	@echo "  make test-frontend-coverage - Run frontend tests with coverage"
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
	@echo "  make clear-tests  - Clear test tasks from database"
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
	@echo "$(BLUE)Backend tests:$(NC)"
	-make test-backend 2>/dev/null || echo "$(YELLOW)Warning: Some backend tests failed$(NC)"
	@echo ""
	@echo "$(BLUE)Frontend tests:$(NC)"
	@make test-frontend
	@echo ""
	@echo "$(GREEN)Test run completed!$(NC)"

test-backend:
	@echo "$(GREEN)Running backend tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend /home/appuser/.local/bin/pytest

test-frontend:
	@echo "$(GREEN)Running frontend tests...$(NC)"
	cd front-ai-control && npm run test

test-unit:
	@echo "$(GREEN)Running unit tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend /home/appuser/.local/bin/pytest tests/unit/

test-integration:
	@echo "$(GREEN)Running integration tests...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend /home/appuser/.local/bin/pytest tests/integration/

test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend /home/appuser/.local/bin/pytest --cov=backend --cov=core --cov-report=html

test-frontend-watch:
	@echo "$(GREEN)Running frontend tests in watch mode...$(NC)"
	cd front-ai-control && npm run test:watch

test-frontend-coverage:
	@echo "$(GREEN)Running frontend tests with coverage...$(NC)"
	cd front-ai-control && npm run test:coverage

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

clear-tests:
	@echo "$(YELLOW)Clearing test tasks from database...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) exec backend python backend/scripts/clear_test_tasks.py

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

# Production setup
setup-prod: check-env
	@echo "$(GREEN)Setting up production environment...$(NC)"
	@make prod-build
	@make prod
	@echo "$(GREEN)Production environment setup complete!$(NC)"
