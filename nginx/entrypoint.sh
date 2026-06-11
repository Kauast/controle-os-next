#!/bin/sh
set -e

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "$CERT" ]; then
    echo "[nginx] Certificado SSL encontrado → modo HTTPS"
    envsubst '${DOMAIN} ${METRICS_TOKEN}' < /etc/nginx/templates/app-ssl.conf.template > /etc/nginx/conf.d/default.conf
else
    echo "[nginx] Certificado SSL não encontrado → modo HTTP (execute: ./scripts/setup-ssl.sh)"
    envsubst '${DOMAIN} ${METRICS_TOKEN}' < /etc/nginx/templates/app-http.conf.template > /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
