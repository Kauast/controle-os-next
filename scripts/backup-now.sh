#!/bin/bash
# Backup manual imediato (banco + uploads)
# Uso: bash scripts/backup-now.sh
set -euo pipefail

[[ ! -f .env ]] && { echo "Erro: .env não encontrado"; exit 1; }
source .env

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups

echo "→ Backup do PostgreSQL..."
docker compose exec -T postgres pg_dump \
    -U "${POSTGRES_USER}" \
    "${POSTGRES_DB:-controle_os}" \
    | gzip > "backups/manual_${TIMESTAMP}.sql.gz"
echo "  Salvo em backups/manual_${TIMESTAMP}.sql.gz"

echo "→ Backup dos uploads..."
tar -czf "backups/uploads_${TIMESTAMP}.tar.gz" uploads/ 2>/dev/null || true
echo "  Salvo em backups/uploads_${TIMESTAMP}.tar.gz"

echo "✓ Backup concluído em $(date)"
ls -lh backups/ | tail -5
