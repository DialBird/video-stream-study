.PHONY: help setup up down restart logs clean db-migrate db-reset minio-setup install dev build test

# Default target
help:
	@echo "Video Stream Study - Makefile Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make setup          - Initial setup (install deps + create .env)"
	@echo "  make install        - Install dependencies with pnpm"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make up             - Start all services (MySQL, MinIO, App)"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - Show logs from all services"
	@echo "  make logs-app       - Show app logs only"
	@echo "  make logs-mysql     - Show MySQL logs only"
	@echo "  make logs-minio     - Show MinIO logs only"
	@echo "  make clean          - Stop services and remove volumes"
	@echo ""
	@echo "Database Commands:"
	@echo "  make db-migrate     - Run database migrations"
	@echo "  make db-reset       - Reset database (drop + migrate)"
	@echo "  make db-shell       - Open MySQL shell"
	@echo ""
	@echo "Storage Commands:"
	@echo "  make minio-setup    - Setup MinIO bucket"
	@echo "  make minio-console  - Open MinIO console URL"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev            - Start development server (local)"
	@echo "  make build          - Build for production"
	@echo "  make test           - Run tests"
	@echo ""

# Setup
setup: install
	@echo "Creating .env file from env.example.txt..."
	@if [ ! -f .env ]; then \
		cp env.example.txt .env; \
		echo ".env file created. Please edit it with your configuration."; \
	else \
		echo ".env file already exists. Skipping..."; \
	fi
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "1. Edit .env file with your configuration"
	@echo "2. Run 'make up' to start Docker services"

install:
	@echo "Installing dependencies..."
	pnpm install

# Docker commands
up:
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo ""
	@echo "Services started!"
	@echo "  App:           http://localhost:3000"
	@echo "  MinIO Console: http://localhost:9001 (minioadmin / minioadmin123)"
	@echo "  MySQL:         localhost:3306"
	@echo ""
	@echo "Run 'make logs' to see logs"

down:
	@echo "Stopping Docker services..."
	docker-compose down

restart:
	@echo "Restarting Docker services..."
	docker-compose restart

logs:
	docker-compose logs -f

logs-app:
	docker-compose logs -f app

logs-mysql:
	docker-compose logs -f mysql

logs-minio:
	docker-compose logs -f minio

clean:
	@echo "Stopping services and removing volumes..."
	docker-compose down -v
	@echo "Cleanup complete!"

# Database commands
db-migrate:
	@echo "Running database migrations..."
	docker-compose exec app pnpm db:push

db-reset:
	@echo "Resetting database..."
	docker-compose exec mysql mysql -uroot -prootpassword -e "DROP DATABASE IF EXISTS video_stream_study; CREATE DATABASE video_stream_study CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@echo "Running migrations..."
	docker-compose exec app pnpm db:push
	@echo "Database reset complete!"

db-shell:
	@echo "Opening MySQL shell..."
	docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study

# Storage commands
minio-setup:
	@echo "Setting up MinIO bucket..."
	docker-compose exec minio mc alias set myminio http://localhost:9000 minioadmin minioadmin123
	docker-compose exec minio mc mb myminio/videos --ignore-existing
	docker-compose exec minio mc anonymous set download myminio/videos
	@echo "MinIO bucket setup complete!"

minio-console:
	@echo "MinIO Console: http://localhost:9001"
	@echo "Username: minioadmin"
	@echo "Password: minioadmin123"

# Development commands (without Docker)
dev:
	@echo "Starting development server..."
	pnpm dev

build:
	@echo "Building for production..."
	pnpm build

test:
	@echo "Running tests..."
	pnpm test
