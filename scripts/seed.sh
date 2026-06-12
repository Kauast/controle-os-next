#!/usr/bin/env bash
# Executa o seed de usuários demo manualmente.
# Use SOMENTE em ambiente de desenvolvimento ou na primeira instalação em produção.
#
# Uso:
#   bash scripts/seed.sh            # via docker compose
#   bash scripts/seed.sh --local    # com tsx local (dev sem Docker)
#
set -euo pipefail

MODE="${1:-}"

if [[ "$MODE" == "--local" ]]; then
  echo "→ Executando seed localmente (tsx)..."
  cd backend-senior
  npx tsx src/lib/seed-users.ts
  exit 0
fi

# Verifica se está em produção para exigir confirmação
if docker compose exec backend sh -c 'echo "$NODE_ENV"' 2>/dev/null | grep -q "production"; then
  echo "⚠️  Você está executando o seed em PRODUÇÃO."
  echo "   Isso cria usuários demo. Se o banco já tem dados reais, isso é desnecessário."
  read -rp "   Confirma? (s/N) " confirm
  [[ "$confirm" != "s" && "$confirm" != "S" ]] && { echo "Cancelado."; exit 0; }
fi

echo "→ Executando seed via docker compose..."
docker compose exec backend npm run seed
echo "✅ Seed concluído."
