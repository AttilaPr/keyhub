.PHONY: dev up down db-migrate db-reset db-studio db-seed db-generate install build lint typecheck \
       admin-promote admin-demote seed-plans seed-flags logs help

help:
	@echo ""
	@echo "  Development"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make install        Install dependencies"
	@echo "  make dev            Start Postgres + run migrations + start Next.js"
	@echo "  make build          Build production"
	@echo "  make lint           Run ESLint"
	@echo "  make typecheck      Run TypeScript type check (no emit)"
	@echo ""
	@echo "  Docker"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make up             Start Docker services only"
	@echo "  make down           Stop Docker services"
	@echo "  make logs           Tail Postgres logs"
	@echo ""
	@echo "  Database"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make db-migrate     Run Prisma migrations"
	@echo "  make db-reset       Reset DB (destructive!)"
	@echo "  make db-studio      Open Prisma Studio"
	@echo "  make db-seed        Seed DB with test data"
	@echo "  make db-generate    Regenerate Prisma client"
	@echo ""
	@echo "  Admin"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make admin-promote EMAIL=user@example.com   Promote user to SUPER_ADMIN"
	@echo "  make admin-demote  EMAIL=user@example.com   Demote admin to USER"
	@echo "  make seed-plans     Seed default plans (Free/Pro/Team/Enterprise)"
	@echo "  make seed-flags     Seed default feature flags"
	@echo ""

# ── Development ──────────────────────────────────────────

install:
	npm install

dev: up
	@echo "Waiting for Postgres..."
	@sleep 2
	npx prisma migrate dev
	npm run dev

build:
	npm run build

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

# ── Docker ───────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f postgres

# ── Database ─────────────────────────────────────────────

db-migrate:
	npx prisma migrate dev

db-reset:
	npx prisma migrate reset --force

db-studio:
	npx prisma studio

db-seed:
	npx tsx prisma/seed.ts

db-generate:
	npx prisma generate

# ── Admin ────────────────────────────────────────────────

admin-promote:
	@test -n "$(EMAIL)" || (echo "Usage: make admin-promote EMAIL=user@example.com" && exit 1)
	npm run admin:promote -- $(EMAIL)

admin-demote:
	@test -n "$(EMAIL)" || (echo "Usage: make admin-demote EMAIL=user@example.com" && exit 1)
	npm run admin:demote -- $(EMAIL)

seed-plans:
	@echo "Seeding default plans..."
	curl -s -X POST http://localhost:4200/api/admin/plans/seed -H "Cookie: $$(cat .admin-cookie 2>/dev/null)" | head -c 500
	@echo ""

seed-flags:
	@echo "Seeding default feature flags..."
	curl -s -X POST http://localhost:4200/api/admin/flags/seed -H "Cookie: $$(cat .admin-cookie 2>/dev/null)" | head -c 500
	@echo ""
