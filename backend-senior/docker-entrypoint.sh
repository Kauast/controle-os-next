#!/bin/sh
# ─── Entrypoint de Inicialização do Backend ─────────────────────────────────────
#
# Responsabilidades:
#   1. Aguardar dependências (PostgreSQL via DIRECT_URL, PgBouncer, Redis)
#   2. Executar migrações de banco com retry e log claro
#   3. Iniciar aplicação Fastify
#
# Variáveis esperadas:
#   - DIRECT_URL: conexão direta ao PostgreSQL (para migrations)
#   - DATABASE_URL: conexão ao PgBouncer (para aplicação)
#   - REDIS_URL: conexão ao Redis
#   - NODE_ENV: environment (production, development, test)
#
# Exit codes:
#   0  - sucesso
#   1  - erro fatal
#   124 - timeout aguardando dependências
# ─────────────────────────────────────────────────────────────────────────────────

set -e

# ─── Configuração ──────────────────────────────────────────────────────────────
TIMEOUT_POSTGRES=60      # segundos para aguardar PostgreSQL
TIMEOUT_PGBOUNCER=30     # segundos para aguardar PgBouncer
TIMEOUT_REDIS=30         # segundos para aguardar Redis
# ───────────────────────────────────────────────────────────────────────────────

log_info() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*" >&2
}

log_warn() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $*" >&2
}

log_error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# ─── Aguardar dependência usando nc (netcat) ──────────────────────────────────

wait_for_service() {
  local host=$1
  local port=$2
  local timeout=$3
  local service_name=${4:-"service"}

  log_info "Aguardando $service_name em $host:$port (timeout: ${timeout}s)..."

  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      log_info "$service_name está pronto (levou ${elapsed}s)."
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  log_error "Timeout aguardando $service_name (${timeout}s excedidos)."
  return 124
}

# ─── Extrair host e porta de URL de conexão ────────────────────────────────────

parse_db_url() {
  # Extrai host e porta de URL PostgreSQL no formato:
  #   postgresql://user:password@host:port/database
  local url="$1"

  # Remove 'postgresql://' e '/database'
  local rest="${url#postgresql://}"
  rest="${rest%/*}"

  # Remove 'user:password@'
  rest="${rest#*@}"

  # Split host:port
  echo "$rest"
}

# ─── Aguardar todas as dependências ───────────────────────────────────────────

wait_for_dependencies() {
  log_info "=== Verificando Dependências ==="

  # PostgreSQL (via DIRECT_URL)
  if [ -z "$DIRECT_URL" ]; then
    log_error "DIRECT_URL não definida. Migrations não podem rodar."
    return 1
  fi

  local pg_hostport=$(parse_db_url "$DIRECT_URL")
  local pg_host="${pg_hostport%:*}"
  local pg_port="${pg_hostport##*:}"

  if ! wait_for_service "$pg_host" "$pg_port" "$TIMEOUT_POSTGRES" "PostgreSQL (DIRECT_URL)"; then
    return 124
  fi

  # PgBouncer (via DATABASE_URL)
  if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL não definida. Aplicação não pode conectar."
    return 1
  fi

  local pb_hostport=$(parse_db_url "$DATABASE_URL")
  local pb_host="${pb_hostport%:*}"
  local pb_port="${pb_hostport##*:}"

  if ! wait_for_service "$pb_host" "$pb_port" "$TIMEOUT_PGBOUNCER" "PgBouncer (DATABASE_URL)"; then
    return 124
  fi

  # Redis
  if [ -z "$REDIS_URL" ]; then
    log_warn "REDIS_URL não definida. Redis será ignorado (opcional)."
  else
    local redis_hostport=$(parse_db_url "$REDIS_URL")
    local redis_host="${redis_hostport%:*}"
    local redis_port="${redis_hostport##*:}"
    redis_port="${redis_port:-6379}"

    if ! wait_for_service "$redis_host" "$redis_port" "$TIMEOUT_REDIS" "Redis"; then
      # Redis é opcional — apenas warn, não falha
      log_warn "Redis não respondeu. Cache/queue não estarão disponíveis."
    fi
  fi

  log_info "=== Todas as Dependências Prontas ==="
  return 0
}

# ─── NOTA: Migrações agora executadas pelo serviço 'migrate' one-shot ────────────
#
# As migrações de banco de dados NÃO são mais executadas neste entrypoint.
# Elas são responsabilidade do serviço Docker 'migrate' que roda ANTES deste
# serviço iniciar (via depends_on: service_completed_successfully).
#
# Fluxo de boot:
#   1. postgres ↓ (pronto)
#   2. pgbouncer ↓ (pronto, depends on postgres)
#   3. migrate (one-shot, executa 'npx prisma migrate deploy' e sai)
#   4. backend (este script, inicia após migrate completar com sucesso)
#
# Benefícios:
#   - Migrations rodam UMA VEZ, não N vezes (uma por réplica)
#   - Sem race conditions com advisory locks do Prisma
#   - Ordem garantida: postgres → pgbouncer → migrate → backend
#   - Scales bem em clusters/Kubernetes

# ─── Iniciar aplicação ────────────────────────────────────────────────────────

start_application() {
  log_info "=== Iniciando Aplicação Fastify ==="

  # exec faz o Node substituir o shell e virar PID 1, recebendo SIGTERM/SIGINT
  # diretamente — essencial para o graceful shutdown do Prisma/Fastify funcionar.
  exec node dist/server.js
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  log_info "Backend Docker Entrypoint iniciado (NODE_ENV=${NODE_ENV:-development})"

  # 1. Aguardar dependências (PostgreSQL, PgBouncer, Redis)
  if ! wait_for_dependencies; then
    log_error "Falha ao aguardar dependências."
    exit 1
  fi

  # 2. Iniciar aplicação
  # NOTA: Migrações já foram executadas pelo serviço 'migrate' (service_completed_successfully)
  start_application
}

# Executar main
main "$@"
