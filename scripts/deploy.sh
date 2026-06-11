#!/usr/bin/env bash
#
# Deploy com monitoramento de saúde e rollback automático.
#
# Uso (na VPS, dentro da raiz do projeto):
#   ./scripts/deploy.sh backend
#   ./scripts/deploy.sh frontend
#
# Padrão: backend
set -euo pipefail

SERVICE="${1:-backend}"

case "$SERVICE" in
  backend)
    HEALTH_URL="${HEALTH_URL:-http://localhost:3333/health/ready}"
    HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
    ;;
  frontend)
    HEALTH_URL="${HEALTH_URL:-http://localhost:3000}"
    HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
    ;;
  *)
    echo "Uso: $0 [backend|frontend]"
    exit 1
    ;;
esac

HEALTH_INTERVAL="${HEALTH_INTERVAL:-3}"
COMPOSE="${COMPOSE:-docker compose}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# 1. Guarda a imagem atual para rollback.
PREVIOUS_IMAGE=$($COMPOSE images -q "$SERVICE" 2>/dev/null || true)
log "Imagem atual de '$SERVICE': ${PREVIOUS_IMAGE:-nenhuma}"

rollback() {
  log "❌ Verificação de saúde falhou — iniciando ROLLBACK."
  if [ -n "${PREVIOUS_IMAGE:-}" ]; then
    docker tag "$PREVIOUS_IMAGE" controle-os-${SERVICE}:rollback 2>/dev/null || true
    $COMPOSE up -d --no-deps "$SERVICE"
    log "Revertido para a imagem anterior: $PREVIOUS_IMAGE"
  else
    log "Sem versão anterior — derrubando a versão com defeito."
    $COMPOSE stop "$SERVICE"
  fi
  $COMPOSE logs --tail=50 "$SERVICE" || true
  exit 1
}

# 2. Atualiza código, builda e sobe.
if [ -d .git ]; then
  log "📥 git pull..."
  git pull --ff-only || log "⚠ git pull ignorado"
fi

log "🏗  Buildando '$SERVICE'..."
$COMPOSE build "$SERVICE"

# Backend precisa de migration; frontend não.
if [ "$SERVICE" = "backend" ]; then
  log "🗄  Aplicando migrations (prisma migrate deploy)..."
  $COMPOSE run --rm "$SERVICE" npx prisma migrate deploy || true
fi

log "🚀 Subindo nova versão..."
$COMPOSE up -d --no-deps "$SERVICE"

# 3. Health gate.
log "🔎 Verificando $HEALTH_URL (timeout ${HEALTH_TIMEOUT}s)..."
elapsed=0
until curl -fsS "$HEALTH_URL" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    rollback
  fi
  sleep "$HEALTH_INTERVAL"
  elapsed=$((elapsed + HEALTH_INTERVAL))
  log "  ...aguardando ($elapsed/${HEALTH_TIMEOUT}s)"
done

log "✅ Deploy de '$SERVICE' concluído e saudável."
$COMPOSE ps "$SERVICE"
