#!/bin/bash
# scripts/seed-prod.sh — Seed seguro para produção (executa apenas uma vez)
# Uso: ./scripts/seed-prod.sh [--force]
set -euo pipefail

FORCE="${1:-}"

check_existing() {
  docker compose exec -T backend sh -c \
    'node -e "
      const { PrismaClient } = require(\"@prisma/client\");
      const p = new PrismaClient();
      p.company.count().then(n => { console.log(n); p.\$disconnect(); }).catch(e => { console.error(e); process.exit(1); });
    "'
}

echo ">>> Verificando estado do banco..."
COUNT=$(check_existing 2>/dev/null || echo "0")

if [ "$COUNT" -gt "0" ] && [ "$FORCE" != "--force" ]; then
  echo ">>> Banco já contém $COUNT empresa(s). Seed ignorado."
  echo "    Use --force para forçar o seed mesmo assim."
  exit 0
fi

if [ "$FORCE" = "--force" ]; then
  echo "!!! ATENÇÃO: --force especificado. O seed pode duplicar dados."
  read -r -p "    Confirma? [y/N] " CONFIRM
  [ "$CONFIRM" = "y" ] || { echo "Cancelado."; exit 0; }
fi

echo ">>> Executando seed no container backend..."
docker compose exec -T backend npm run seed
echo ">>> Seed concluído."
