# AI Control System Makefile
# Usage: make <target>

# Variables
PROJECT_NAME = ai-control
DOCKER_COMPOSE_DEV = deployment/docker/docker-compose.dev.yml
DOCKER_COMPOSE_PROD = deployment/docker/docker-compose.prod.yml
ENV_FILE = deployment/docker/.env

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

.PHONY: help dev prod build clean logs shell test lint migrate create-admin create-admin-quick list-admins stress-fullstack-host benchmark-nodes benchmark-fullstack-host clear-data-db

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
	@echo "  make stress-fullstack-host - Full-stack SQLite stress (stack + Postgres, see Makefile target)"
	@echo "  make benchmark-nodes - Security-first catalog + data-plane tests (no live stack)"
	@echo "  make benchmark-fullstack-host - Live all-node data-transfer benchmark (security > speed)"
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
	@echo "  make clear-data-db - Clear app data (keep users) + local data_models/dashboards"
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
	@echo "  make setup-env    - Create .env file from env.example"
	@echo "  make check-structure - Check project structure and paths"

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
	python -m pytest tests/unit/

test-integration:
	@echo "$(GREEN)Running integration tests...$(NC)"
	python -m pytest tests/integration/

test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	python -m pytest --cov=src --cov-report=html

# Test structure commands
test-auth:
	@echo "$(GREEN)Running authentication tests...$(NC)"
	python -m pytest -m auth

test-api:
	@echo "$(GREEN)Running API tests...$(NC)"
	python -m pytest -m api

stress-fullstack-host:
	@echo "$(GREEN)Full-stack stress (requires backend :8000, dashboard-query :8787, Postgres).$(NC)"
	cd src && RUN_FULLSTACK_STRESS=1 BACKEND_STRESS_URL=http://127.0.0.1:8000 DASHBOARD_QUERY_METRICS_URL=http://127.0.0.1:8787 poetry run pytest tests/stress/test_dashboard_sqlite_fullstack_stress.py -v --no-cov --tb=short

benchmark-nodes:
	@echo "$(GREEN)Security-first node catalog + data-plane tests (no live stack).$(NC)"
	cd src && poetry run pytest tests/benchmark/test_node_catalog.py tests/benchmark/test_data_plane_security.py -v --no-cov --tb=short

benchmark-fullstack-host:
	@echo "$(GREEN)Live all-node benchmark (backend :8000). Security over speed.$(NC)"
	cd src && RUN_FULLSTACK_BENCHMARK=1 BACKEND_STRESS_URL=http://127.0.0.1:8000 DASHBOARD_QUERY_URL=http://127.0.0.1:8787 DEVELOPER_API_URL=http://127.0.0.1:8002 poetry run pytest tests/benchmark/test_fullstack_nodes_benchmark.py -v --no-cov --tb=short

# Code quality commands
lint:
	@echo "$(GREEN)Running linting...$(NC)"
	flake8 src tests
	black --check src tests

format:
	@echo "$(GREEN)Formatting code...$(NC)"
	black src tests
	isort src tests

type-check:
	@echo "$(GREEN)Running type checking...$(NC)"
	mypy src

# Database commands
migrate:
	@echo "$(GREEN)Running database migrations...$(NC)"
	poetry run python deployment/scripts/run_migration.py upgrade head

migrate-create:
	@echo "$(GREEN)Creating new migration...$(NC)"
	poetry run python deployment/scripts/run_migration.py revision --autogenerate -m "$(message)"

db-reset:
	@echo "$(RED)Resetting database...$(NC)"
	poetry run python deployment/scripts/run_migration.py downgrade base
	poetry run python deployment/scripts/run_migration.py upgrade head

create-admin:
	@echo "$(GREEN)Creating system administrator...$(NC)"
	@if [ -f deployment/scripts/create_admin.py ]; then \
		python deployment/scripts/create_admin.py; \
	else \
		echo "$(RED)Error: deployment/scripts/create_admin.py not found!$(NC)"; \
		echo "$(YELLOW)Please ensure the script exists in the project root.$(NC)"; \
		exit 1; \
	fi

create-admin-quick:
	@echo "$(GREEN)Creating system administrator with default credentials...$(NC)"
	@if [ -f deployment/scripts/create_admin.py ]; then \
		python deployment/scripts/create_admin.py --login admin --email admin@localhost --password admin123 --username "System Administrator"; \
	else \
		echo "$(RED)Error: deployment/scripts/create_admin.py not found!$(NC)"; \
		echo "$(YELLOW)Please ensure the script exists in the project root.$(NC)"; \
		exit 1; \
	fi

list-admins:
	@echo "$(GREEN)Listing system administrators...$(NC)"
	@if [ -f deployment/scripts/list_admins.py ]; then \
		python deployment/scripts/list_admins.py; \
	else \
		echo "$(RED)Error: deployment/scripts/list_admins.py not found!$(NC)"; \
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
		echo "$(YELLOW)Please copy deployment/docker/env.example to deployment/docker/.env and configure it.$(NC)"; \
		exit 1; \
	fi

setup-env:
	@echo "$(GREEN)Setting up environment file...$(NC)"
	@if [ ! -f $(ENV_FILE) ]; then \
		cp deployment/docker/env.example $(ENV_FILE); \
		echo "$(GREEN)Created $(ENV_FILE) from env.example$(NC)"; \
		echo "$(YELLOW)Please edit $(ENV_FILE) and configure your settings$(NC)"; \
	else \
		echo "$(YELLOW)$(ENV_FILE) already exists$(NC)"; \
	fi

# Health check
health:
	@echo "$(GREEN)Checking service health...$(NC)"
	@curl -f http://localhost:8000/health || echo "$(RED)Backend is not healthy$(NC)"
	@curl -f http://localhost:3000 || echo "$(RED)Frontend is not healthy$(NC)"
	@curl -f http://localhost:6379 || echo "$(RED)Redis is not healthy$(NC)"
	@curl -f http://localhost:5432 || echo "$(RED)PostgreSQL is not healthy$(NC)"

# Development setup
setup-dev: setup-env
	@echo "$(GREEN)Setting up development environment...$(NC)"
	@make dev-build
	@make dev
	@echo "$(GREEN)Waiting for services to start...$(NC)"
	@sleep 10
	@make migrate
	@echo "$(GREEN)Development environment setup complete!$(NC)"
	@echo "$(YELLOW)To create an admin user, run: make create-admin$(NC)"

# Production setup
setup-prod: setup-env
	@echo "$(GREEN)Setting up production environment...$(NC)"
	@make prod-build
	@make prod
	@echo "$(GREEN)Production environment setup complete!$(NC)"

# Monitoring commands
monitoring: check-env
	@echo "$(GREEN)Starting monitoring stack...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f deployment/docker/docker-compose.monitoring.yml up -d
	@echo "$(GREEN)Monitoring stack started!$(NC)"
	@echo "$(YELLOW)Prometheus: http://localhost:9090$(NC)"
	@echo "$(YELLOW)Grafana: http://localhost:3001 (admin/admin123)$(NC)"
	@echo "$(YELLOW)AlertManager: http://localhost:9093$(NC)"
	@echo "$(YELLOW)Jaeger: http://localhost:16686$(NC)"
	@echo "$(YELLOW)Kibana: http://localhost:5601$(NC)"

monitoring-down:
	@echo "$(YELLOW)Stopping monitoring stack...$(NC)"
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f deployment/docker/docker-compose.monitoring.yml down

monitoring-logs:
	docker-compose -f $(DOCKER_COMPOSE_DEV) -f deployment/docker/docker-compose.monitoring.yml logs -f

grafana:
	@echo "$(GREEN)Opening Grafana dashboard...$(NC)"
	@open http://localhost:3001 || echo "$(YELLOW)Please open http://localhost:3001 in your browser$(NC)"

prometheus:
	@echo "$(GREEN)Opening Prometheus dashboard...$(NC)"
	@open http://localhost:9090 || echo "$(YELLOW)Please open http://localhost:9090 in your browser$(NC)"

# Project structure check
check-structure:
	@echo "$(GREEN)Checking project structure and paths...$(NC)"
	@echo ""
	@echo "$(BLUE)Checking Docker Compose files:$(NC)"
	@if [ -f $(DOCKER_COMPOSE_DEV) ]; then echo "✅ $(DOCKER_COMPOSE_DEV) exists"; else echo "❌ $(DOCKER_COMPOSE_DEV) missing"; fi
	@if [ -f $(DOCKER_COMPOSE_PROD) ]; then echo "✅ $(DOCKER_COMPOSE_PROD) exists"; else echo "❌ $(DOCKER_COMPOSE_PROD) missing"; fi
	@if [ -f deployment/docker/docker-compose.monitoring.yml ]; then echo "✅ docker-compose.monitoring.yml exists"; else echo "❌ docker-compose.monitoring.yml missing"; fi
	@echo ""
	@echo "$(BLUE)Checking environment files:$(NC)"
	@if [ -f deployment/docker/env.example ]; then echo "✅ env.example exists"; else echo "❌ env.example missing"; fi
	@if [ -f $(ENV_FILE) ]; then echo "✅ $(ENV_FILE) exists"; else echo "❌ $(ENV_FILE) missing (run: make setup-env)"; fi
	@echo ""
	@echo "$(BLUE)Checking source directories:$(NC)"
	@if [ -d src ]; then echo "✅ src/ directory exists"; else echo "❌ src/ directory missing"; fi
	@if [ -d tests ]; then echo "✅ tests/ directory exists"; else echo "❌ tests/ directory missing"; fi
	@echo ""
	@echo "$(BLUE)Checking scripts:$(NC)"
	@if [ -f deployment/scripts/create_admin.py ]; then echo "✅ create_admin.py exists"; else echo "❌ create_admin.py missing"; fi
	@if [ -f deployment/scripts/list_admins.py ]; then echo "✅ list_admins.py exists"; else echo "❌ list_admins.py missing"; fi
	@echo ""
	@echo "$(BLUE)Checking Alembic:$(NC)"
	@if [ -f src/infrastructure/database/migrations/alembic.ini ]; then echo "✅ alembic.ini exists"; else echo "❌ alembic.ini missing"; fi
	@echo ""
	@echo "$(GREEN)Structure check complete!$(NC)"


clear-data-db:
	@echo "$(RED)Clearing application data (users are kept)...$(NC)"
	cd src && poetry run python scripts/clear_data.py --env dev --yes