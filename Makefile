# Instinct 2.0 — common tasks.  `make` or `make help` lists everything.
.DEFAULT_GOAL := help
SHELL := /bin/bash
COMPOSE := docker compose

.PHONY: help up down restart logs ps build clean \
        up-all up-discord up-scraper \
        dev-api dev-web web-build install check fmt test shell-web redis-cli

help: ## Show this help
	@grep -hE '^[a-z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'
	@echo ""
	@echo "  Daily loop:  make up   +   make dev-web   (Next dev server on the host)"

## ---- stack -------------------------------------------------------------
up: ## Start the local stack (redis + api) in the background
	$(COMPOSE) up -d
	@echo "  api    -> http://localhost:8000/docs"
	@echo "  redis  -> localhost:6379"

down: ## Stop the stack (keeps the redis volume)
	$(COMPOSE) down --remove-orphans

restart: down up ## Restart the stack

up-all: ## Start every service, including optional profiles
	$(COMPOSE) --profile discord --profile scraper up -d

up-discord: ## Start the Discord bots (needs AUX_BOT_TOKEN / JOB_BOT_TOKEN)
	$(COMPOSE) --profile discord up -d discord

up-scraper: ## Start the scraper in Docker (builds Chromium; usually run locally instead)
	$(COMPOSE) --profile scraper up -d scraper

logs: ## Tail logs from all running services
	$(COMPOSE) logs -f --tail 80

ps: ## Show service status
	$(COMPOSE) ps

web-build: ## Production build of the frontend, as Vercel does it
	cd frontend && bun run build

build: ## Rebuild all images
	$(COMPOSE) build

clean: ## Stop everything and delete volumes (DESTROYS local redis data)
	$(COMPOSE) --profile discord --profile scraper down -v --remove-orphans

## ---- local dev (no containers) -----------------------------------------
dev-api: ## Run the API on the host with reload
	uv run uvicorn instinct.server:app --reload --port 8000

dev-web: ## Run the Next dev server on the host (fast HMR — preferred)
	cd frontend && bun dev

install: ## Install backend (uv) and frontend (bun) dependencies
	uv sync --all-extras --group dev
	cd frontend && bun install

## ---- checks ------------------------------------------------------------
check: ## Verify the backend imports with an empty environment
	@env -i PATH=$$PATH .venv/bin/python -c "\
import sys; sys.path.insert(0,'backend/src'); \
import instinct.server as s; \
print(f'  backend OK — {len(s.app.routes)} routes')"

test: ## Run the test suite
	uv run pytest

fmt: ## Format and lint
	uv run ruff format . && uv run ruff check --fix .
	cd frontend && bun run lint

## ---- shortcuts ---------------------------------------------------------
shell-web: ## Shell into the running api container
	$(COMPOSE) exec web /bin/bash

redis-cli: ## Open redis-cli against the local redis
	$(COMPOSE) exec redis redis-cli
