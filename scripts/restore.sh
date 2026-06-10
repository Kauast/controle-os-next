#!/bin/bash
# Restaura backup do PostgreSQL
# Uso: bash scripts/restore.sh backups/manual_20240101_120000.sql.gz
set -euo pipefail

[[ ! -f .env ]] && { echo "Erro: .env não encontrado"; exit 1; }
source .env

BACKUP_FILE="${1:-}"
[[ -z "$BACKUP_FILE" ]] && {
    echo "Uso: bash scripts/restore.sh <arquivo.sql.gz>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh backups/*.sql.gz 2>/dev/null || echo "  Nenhum backup encontrado"
    exit 1
}
[[ ! -f "$BACKUP_FILE" ]] && { echo "Erro: arquivo $BACKUP_FILE não encontrado"; exit 1; }

echo "⚠️  Isso vai SUBSTITUIR o banco ${POSTGRES_DB:-controle_os} pelos dados de:"
echo "   $BACKUP_FILE"
read -rp "Continuar? (s/N) " confirm
[[ "$confirm" != "s" && "$confirm" != "S" ]] && { echo "Cancelado."; exit 0; }

echo "→ Restaurando banco de dados..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB:-controle_os}"

echo "✓ Banco restaurado de $BACKUP_FILE"
