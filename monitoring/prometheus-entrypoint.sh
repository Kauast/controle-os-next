#!/bin/sh
# Substitui METRICS_TOKEN_PLACEHOLDER pelo token real antes de iniciar o Prometheus.
# Isso evita gravar o segredo no arquivo de configuração versionado.
set -eu

TOKEN="${METRICS_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "[prometheus-entrypoint] AVISO: METRICS_TOKEN não definido — /metrics sem autenticação"
fi

sed "s/METRICS_TOKEN_PLACEHOLDER/${TOKEN}/g" \
    /etc/prometheus/prometheus.yml > /tmp/prometheus-resolved.yml

exec /bin/prometheus \
  --config.file=/tmp/prometheus-resolved.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time=30d \
  --web.enable-lifecycle \
  "$@"
