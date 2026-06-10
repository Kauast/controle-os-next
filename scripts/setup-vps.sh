#!/bin/bash
# ────────────────────────────────────────────────────────────────
#  Controle OS — Setup completo de VPS
#  Uso: sudo bash scripts/setup-vps.sh
# ────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[OK]${NC}  $*"; }
step()  { echo -e "\n${BLUE}══${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC}  $*"; }
error() { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

# ── Pré-requisitos ───────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Execute como root: sudo bash scripts/setup-vps.sh"
[[ ! -f .env ]]   && error ".env não encontrado. Copie .env.example e preencha os valores."

source .env
[[ -z "${DOMAIN:-}"            ]] && error "DOMAIN não definido no .env"
[[ -z "${JWT_SECRET:-}"        ]] && error "JWT_SECRET não definido no .env"
[[ -z "${POSTGRES_PASSWORD:-}" ]] && error "POSTGRES_PASSWORD não definido no .env"
[[ -z "${CERTBOT_EMAIL:-}"     ]] && error "CERTBOT_EMAIL não definido no .env"

step "1/7 — Instalando Docker"
if ! command -v docker &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
          https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
          > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
    info "Docker instalado"
else
    info "Docker já instalado"
fi

step "2/7 — Configurando firewall (UFW)"
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
info "Firewall configurado (SSH + 80 + 443)"

step "3/7 — Criando diretórios"
mkdir -p backups uploads certbot/www certbot/letsencrypt nginx/conf.d
chmod 700 backups
info "Diretórios criados"

step "4/7 — Build e start dos serviços (modo HTTP)"
docker compose build --quiet
docker compose up -d postgres redis
info "Aguardando banco de dados..."
sleep 20

docker compose up -d backend
info "Aguardando backend (pode levar ~60s na primeira vez)..."
sleep 60

docker compose up -d frontend nginx certbot
info "Frontend e Nginx iniciados"

step "5/7 — Obtendo certificado SSL (Let's Encrypt)"
sleep 5

docker run --rm \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    -v "$(pwd)/certbot/letsencrypt:/etc/letsencrypt" \
    certbot/certbot:latest certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}" \
    && info "Certificado obtido com sucesso!" \
    || warn "certbot falhou — verifique se o DNS ${DOMAIN} aponta para este servidor e tente: ./scripts/setup-ssl.sh"

step "6/7 — Reiniciando nginx com SSL"
docker compose restart nginx
info "Nginx recarregado"

step "7/7 — Iniciando backup automático"
docker compose up -d backup
info "Backup diário ativado → ./backups/"

# Cron para backup dos uploads (3h da manhã)
CRON_JOB="0 3 * * * cd $(pwd) && tar -czf backups/uploads-\$(date +\\%Y\\%m\\%d).tar.gz uploads/ 2>&1 | logger -t controle-os-backup"
(crontab -l 2>/dev/null | grep -v "controle-os-backup" | grep -v "uploads-"; echo "$CRON_JOB") | crontab -
info "Cron de backup de uploads configurado"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Controle OS está no ar!                    ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   URL: https://${DOMAIN}$(printf '%*s' $((32-${#DOMAIN})) '')║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Logs:    docker compose logs -f            ║${NC}"
echo -e "${GREEN}║   Status:  docker compose ps                 ║${NC}"
echo -e "${GREEN}║   Backup:  ./scripts/backup-now.sh           ║${NC}"
echo -e "${GREEN}║   Restore: ./scripts/restore.sh              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
