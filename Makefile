# =============================================================================
# controle-os-next — Makefile para microservicos
# =============================================================================

COMPOSE_BASE := docker compose -f docker-compose.microservices.yml
COMPOSE_DEV  := $(COMPOSE_BASE) -f docker-compose.microservices.override.yml
COMPOSE_PROD := $(COMPOSE_BASE) -f docker-compose.microservices.prod.yml

SERVICES := identity customer chip inventory workforce service-order billing media notification

.PHONY: up down logs build ps clean restart shell migrate seed rabbitmq minio help

## Sobe todos os servicos em background (modo dev, sem hot-reload)
up:
	$(COMPOSE_BASE) up -d

## Sobe com hot-reload (tsx watch via override)
dev:
	$(COMPOSE_DEV) up -d

## Sobe em modo producao
prod:
	$(COMPOSE_PROD) up -d

## Para e remove containers (volumes preservados)
down:
	$(COMPOSE_BASE) down

## Para, remove containers e apaga TODOS os volumes (reset completo)
clean:
	$(COMPOSE_BASE) down -v
	@echo "Volumes removidos. Estado zerado."

## Stream de logs de todos os servicos
logs:
	$(COMPOSE_BASE) logs -f

## Logs de um servico especifico: make logs-svc SVC=identity-svc
logs-svc:
	$(COMPOSE_BASE) logs -f $(SVC)

## Build das imagens (sem cache)
build:
	$(COMPOSE_BASE) build --no-cache

## Status dos containers
ps:
	$(COMPOSE_BASE) ps

## Reinicia todos os servicos
restart:
	$(COMPOSE_BASE) restart

## Abre shell em um servico: make shell SVC=identity-svc
shell:
	$(COMPOSE_BASE) exec $(SVC) sh

## Executa prisma migrate deploy em todos os microservicos sequencialmente
migrate:
	@bash scripts/migrate-all.sh

## Executa seed em todos os servicos que tiverem o script
seed:
	@for svc in $(SERVICES); do \
		echo ">>> Seed: $$svc-svc"; \
		$(COMPOSE_BASE) exec $$svc-svc sh -c "npm run seed 2>/dev/null || echo 'Sem seed em $$svc'"; \
	done

## Abre a UI do RabbitMQ no browser
rabbitmq:
	@echo "Abrindo http://localhost:15672 (admin/admin)"
	@start http://localhost:15672 2>/dev/null || xdg-open http://localhost:15672 2>/dev/null || open http://localhost:15672

## Abre o console do MinIO no browser
minio:
	@echo "Abrindo http://localhost:9001 (minioadmin/minioadmin)"
	@start http://localhost:9001 2>/dev/null || xdg-open http://localhost:9001 2>/dev/null || open http://localhost:9001

## Exibe este menu de ajuda
help:
	@echo ""
	@echo "controle-os-next — Comandos disponiveis:"
	@echo ""
	@echo "  make up          Sobe todos os servicos (dev, sem hot-reload)"
	@echo "  make dev         Sobe com hot-reload (tsx watch)"
	@echo "  make prod        Sobe em modo producao"
	@echo "  make down        Para containers (volumes preservados)"
	@echo "  make clean       Para containers e APAGA volumes"
	@echo "  make logs        Stream de logs de todos os servicos"
	@echo "  make logs-svc    Logs de um servico: make logs-svc SVC=identity-svc"
	@echo "  make build       Rebuild das imagens sem cache"
	@echo "  make ps          Status dos containers"
	@echo "  make restart     Reinicia todos os servicos"
	@echo "  make shell       Shell em um servico: make shell SVC=identity-svc"
	@echo "  make migrate     Prisma migrate deploy em todos os servicos"
	@echo "  make seed        Seed de dados em todos os servicos"
	@echo "  make rabbitmq    Abre RabbitMQ Management UI"
	@echo "  make minio       Abre MinIO Console"
	@echo ""
