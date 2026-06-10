#!/bin/bash
# Obtém/renova o certificado SSL manualmente
# Uso: sudo bash scripts/setup-ssl.sh
set -euo pipefail

[[ ! -f .env ]] && { echo "Erro: .env não encontrado"; exit 1; }
source .env
[[ -z "${DOMAIN:-}"        ]] && { echo "Erro: DOMAIN não definido"; exit 1; }
[[ -z "${CERTBOT_EMAIL:-}" ]] && { echo "Erro: CERTBOT_EMAIL não definido"; exit 1; }

echo "Obtendo certificado para ${DOMAIN}..."

docker run --rm \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    -v "$(pwd)/certbot/letsencrypt:/etc/letsencrypt" \
    certbot/certbot:latest certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}"

echo "Recarregando nginx com SSL..."
docker compose restart nginx
echo "Pronto! https://${DOMAIN}"
