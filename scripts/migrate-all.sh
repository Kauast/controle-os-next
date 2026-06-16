#!/usr/bin/env bash
# =============================================================================
# migrate-all.sh — Executa prisma migrate deploy em todos os microservicos
#
# Uso:
#   bash scripts/migrate-all.sh
#   # ou via Makefile:
#   make migrate
#
# O script aguarda o banco de cada servico estar disponivel antes de migrar.
# =============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.microservices.yml"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-dev}"

# Mapeamento: servico -> banco -> porta-host
declare -A SERVICES=(
  [identity]="identity:5433"
  [customer]="customer:5434"
  [chip]="chip:5435"
  [inventory]="inventory:5436"
  [workforce]="workforce:5437"
  [service-order]="service_order:5438"
  [billing]="billing:5439"
  [media]="media:5440"
  [notification]="notification:5441"
)

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[migrate]${NC} $*"; }
warn() { echo -e "${YELLOW}[migrate]${NC} $*"; }
err()  { echo -e "${RED}[migrate]${NC} $*" >&2; }

# Aguarda o banco aceitar conexoes
wait_for_db() {
  local svc="$1"
  local db_name="$2"
  local host_port="$3"
  local port="${host_port#*:}"
  local max_attempts=30
  local attempt=0

  warn "Aguardando banco '${db_name}' (porta ${port})..."

  until docker compose -f "${COMPOSE_FILE}" exec "${svc}-db" \
    pg_isready -U postgres -d "${db_name}" -q 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "${attempt}" -ge "${max_attempts}" ]; then
      err "Timeout aguardando banco '${db_name}' apos ${max_attempts} tentativas."
      exit 1
    fi
    sleep 2
  done

  log "Banco '${db_name}' disponivel."
}

# Executa migrate deploy dentro do container do servico
run_migrate() {
  local svc="$1"
  local container="${svc}-svc"

  log "Executando migrate em '${svc}-svc'..."

  if docker compose -f "${COMPOSE_FILE}" exec "${container}" \
    npx prisma migrate deploy 2>&1; then
    log "Migrate de '${svc}' concluido com sucesso."
  else
    err "Falha no migrate de '${svc}'. Verifique os logs acima."
    exit 1
  fi
}

# =============================================================================
# Main
# =============================================================================

log "Iniciando migrate-all para microservicos controle-os-next..."
echo ""

# Ordem importa: identity primeiro (outros dependem de tokens validos)
ORDERED_SERVICES=(
  "identity"
  "customer"
  "chip"
  "inventory"
  "workforce"
  "service-order"
  "billing"
  "media"
  "notification"
)

for svc in "${ORDERED_SERVICES[@]}"; do
  db_and_port="${SERVICES[$svc]}"
  db_name="${db_and_port%%:*}"
  host_port="${db_and_port##*:}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Servico: ${svc}"

  wait_for_db "${svc}" "${db_name}" "${host_port}"
  run_migrate "${svc}"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Todos os migrates concluidos com sucesso."
