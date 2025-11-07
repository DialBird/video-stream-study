.PHONY: help setup up down restart logs clean db-migrate db-reset db-shell db-query db-list-videos db-publish-video db-unpublish-video bypass-auth unbypass-auth check-bypass-auth minio-setup install dev build test

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
	@echo "  make db-shell       - Open MySQL shell (interactive)"
	@echo "  make db-query       - Execute SQL query (usage: make db-query QUERY='SELECT * FROM videos')"
	@echo "  make db-list-videos - List all videos"
	@echo "  make db-publish-video - Publish video (usage: make db-publish-video ID=1)"
	@echo "  make db-unpublish-video - Unpublish video (usage: make db-unpublish-video ID=1)"
	@echo "  make bypass-auth - Enable authentication bypass (DB managed)"
	@echo "  make unbypass-auth - Disable authentication bypass (DB managed)"
	@echo "  make check-bypass-auth - Check current bypass-auth status"
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
	@echo "Database: video_stream_study"
	@echo "User: dbuser"
	@echo ""
	docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study

db-query:
	@if [ -z "$(QUERY)" ]; then \
		echo "Error: QUERY parameter is required"; \
		echo "Usage: make db-query QUERY='SELECT * FROM videos'"; \
		exit 1; \
	fi
	@echo "Executing query: $(QUERY)"
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "$(QUERY)"

db-list-videos:
	@echo "Listing all videos..."
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "SELECT id, title, isPublished, viewCount, createdAt FROM videos ORDER BY createdAt DESC;"

db-publish-video:
	@if [ -z "$(ID)" ]; then \
		echo "Error: ID parameter is required"; \
		echo "Usage: make db-publish-video ID=1"; \
		exit 1; \
	fi
	@echo "Publishing video ID: $(ID)"
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "UPDATE videos SET isPublished = 1 WHERE id = $(ID);"
	@echo "Video $(ID) has been published"

db-unpublish-video:
	@if [ -z "$(ID)" ]; then \
		echo "Error: ID parameter is required"; \
		echo "Usage: make db-unpublish-video ID=1"; \
		exit 1; \
	fi
	@echo "Unpublishing video ID: $(ID)"
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "UPDATE videos SET isPublished = 0 WHERE id = $(ID);"
	@echo "Video $(ID) has been unpublished"

bypass-auth:
	@echo "Enabling authentication bypass..."
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "INSERT INTO settings (\`key\`, \`value\`, \`description\`) VALUES ('BYPASS_AUTH', 'true', 'Enable authentication bypass for development') ON DUPLICATE KEY UPDATE \`value\` = 'true', \`updatedAt\` = NOW();"
	@echo "Authentication bypass has been enabled"
	@echo "Note: You may need to restart the app container for changes to take effect"

unbypass-auth:
	@echo "Disabling authentication bypass..."
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "INSERT INTO settings (\`key\`, \`value\`, \`description\`) VALUES ('BYPASS_AUTH', 'false', 'Enable authentication bypass for development') ON DUPLICATE KEY UPDATE \`value\` = 'false', \`updatedAt\` = NOW();"
	@echo "Authentication bypass has been disabled"
	@echo "Note: You may need to restart the app container for changes to take effect"

check-bypass-auth:
	@echo "Checking authentication bypass status..."
	@docker-compose exec mysql mysql -udbuser -pdbpassword video_stream_study -e "SELECT \`key\`, \`value\`, \`description\`, \`updatedAt\` FROM settings WHERE \`key\` = 'BYPASS_AUTH';" || echo "BYPASS_AUTH setting not found in database"
	@if [ "$$(docker-compose exec -T mysql mysql -udbuser -pdbpassword video_stream_study -se \"SELECT \`value\` FROM settings WHERE \`key\` = 'BYPASS_AUTH'\" 2>/dev/null)" = "true" ]; then \
		echo "Status: ENABLED (from database)"; \
	else \
		echo "Status: DISABLED"; \
	fi

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
