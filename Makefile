.PHONY: dev up down db-migrate db-reset db-studio db-seed install build logs help

help:
	@echo ""
	@echo "  make install      Install dependencies"
	@echo "  make dev          Start Postgres + run migrations + start Next.js"
	@echo "  make up           Start Docker services only"
	@echo "  make down         Stop Docker services"
	@echo "  make build        Build production"
	@echo "  make db-migrate   Run Prisma migrations"
	@echo "  make db-reset     Reset DB (destructive!)"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make db-seed      Seed DB with test data"
	@echo "  make logs         Tail Postgres logs"
	@echo ""

install:
	npm install

up:
	docker compose up -d

down:
	docker compose down

build:
	npm run build

dev: up
	@echo "Waiting for Postgres..."
	@sleep 2
	npx prisma migrate dev
	npm run dev

db-migrate:
	npx prisma migrate dev

db-reset:
	npx prisma migrate reset --force

db-studio:
	npx prisma studio

db-seed:
	npx tsx prisma/seed.ts

logs:
	docker compose logs -f postgres

generate:
	npx prisma generate
