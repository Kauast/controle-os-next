# Guia de Produção — Controle OS

## Pré-requisitos

- **VPS** Ubuntu 22.04+ com no mínimo **2 GB RAM**, 20 GB disco
- **Domínio** com DNS tipo A apontando para o IP da VPS
- **Docker** e **Docker Compose** instalados
- **Git**
- Portas **80** e **443** liberadas no firewall

---

## 1. Provisionamento rápido

```bash
# Clone o projeto no servidor
git clone https://github.com/Kauast/controle-os-next.git /opt/controle-os
cd /opt/controle-os

# Crie o .env a partir do template
cp .env.example .env

# Edite o .env com valores reais (veja seção 2)
nano .env

# Suba tudo
docker compose up -d
```

O SSL é gerado automaticamente pelo Certbot. Após a primeira inicialização:

```bash
# Configure o SSL (só na primeira vez)
./scripts/setup-ssl.sh

# Recarregue o nginx para ativar HTTPS
docker compose restart nginx
```

---

## 2. Variáveis de ambiente obrigatórias

Todas as variáveis abaixo devem ser preenchidas no `.env` na raiz do projeto.

| Variável | Obrigatória | Como gerar |
|----------|------------|------------|
| `DOMAIN` | ✅ Sim | Seu domínio (ex: `app.controleos.com.br`) |
| `POSTGRES_USER` | ✅ Sim | Escolha um nome |
| `POSTGRES_PASSWORD` | ✅ Sim | `openssl rand -base64 32` |
| `POSTGRES_DB` | Opcional | Padrão: `controle_os` |
| `REDIS_PASSWORD` | ✅ Sim | `openssl rand -base64 32` |
| `JWT_SECRET` | ✅ Sim | `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` | Opcional | Padrão: `8h` |
| `ALLOWED_ORIGINS` | ✅ Sim | `https://${DOMAIN}` |
| `UPLOAD_BASE_URL` | Opcional | `https://${DOMAIN}/uploads` |
| `METRICS_TOKEN` | ✅ Sim | `openssl rand -base64 24` |
| `CERTBOT_EMAIL` | ✅ Sim | Seu email real (para notificações Let's Encrypt) |
| `GRAFANA_ADMIN_USER` | Opcional | Padrão: `admin` |
| `GRAFANA_ADMIN_PASSWORD` | ✅ Sim | `openssl rand -base64 24` |
| `SMTP_HOST` | Opcional | Servidor SMTP para reset de senha |
| `SMTP_PORT` | Opcional | `587` |
| `SMTP_USER` | Opcional | |
| `SMTP_PASS` | Opcional | |
| `SMTP_FROM` | Opcional | |
| `ANTHROPIC_API_KEY` | Opcional | API key do Claude para triagem automática |
| `ANTHROPIC_MODEL` | Opcional | Padrão: `claude-opus-4-8` |
| `SEED_DEFAULT_PASS` | ✅ Sim | `openssl rand -base64 16` |
| `SEED_ADMIN_PASS` | Opcional | Senha do admin@controle.com |
| `SEED_STOCK_PASS` | Opcional | Senha do estoque@controle.com |
| `SEED_TECH_PASS` | Opcional | Senha do tecnico@controle.com |
| `SEED_ATTENDANT_PASS` | Opcional | Senha do atendimento@controle.com |
| `SEED_FINANCIAL_PASS` | Opcional | Senha do financeiro@controle.com |

> ⚠️ **IMPORTANTE**: Se `SEED_DEFAULT_PASS` não for definido em produção com `NODE_ENV=production`, o container do backend **recusa iniciar**. Isso evita que senhas padrão hardcoded cheguem a produção.

---

## 3. SSL / HTTPS

O Certbot renova automaticamente os certificados a cada 12 horas.

- **Primeira emissão**: `./scripts/setup-ssl.sh`
- **Renovação**: automática (container `certbot`)
- **Verificar status**: `docker compose logs certbot`

O nginx detecta a presença do certificado e alterna entre HTTP (sem certificado) e HTTPS (com certificado) automaticamente.

---

## 4. Deploy Contínuo

### Via GitHub Actions (recomendado)

1. Adicione os seguintes **secrets** no repositório GitHub (Settings → Secrets and variables → Actions):

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP do servidor |
| `VPS_USER` | Usuário SSH (ex: `ubuntu`) |
| `VPS_SSH_KEY` | Chave SSH privada (começa com `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `VPS_SSH_PORT` | Porta SSH (padrão: 22) |

2. Push para `main` dispara automaticamente:
   - `git pull` no servidor
   - `./scripts/deploy.sh backend`
   - `./scripts/deploy.sh frontend`
   - `docker compose restart nginx`

### Manual

```bash
cd /opt/controle-os
git pull --ff-only origin main
./scripts/deploy.sh backend
./scripts/deploy.sh frontend
docker compose restart nginx
```

O script `deploy.sh` faz health check após cada deploy e reverte automaticamente em caso de falha.

---

## 5. Monitoramento

| Ferramenta | URL | Porta |
|-----------|-----|-------|
| **Grafana** | `https://DOMAIN:3200` | 3200 |
| **Uptime Kuma** | `https://DOMAIN:3001` | 3001 |
| **Prometheus** | Interno apenas | — |
| **Métricas** | `https://DOMAIN/metrics` | 443 |

### Dashboards Grafana
- Os datasources e dashboards são provisionados automaticamente
- Login Grafana: `admin` / senha definida em `GRAFANA_ADMIN_PASSWORD`

### Alertas
O Alertmanager está configurado com regras para:
- Taxa de erro 5xx > 5%
- Latência P95 > 1s
- Banco de dados ou Redis indisponíveis
- Disco quase cheio (>85%)

Os receivers precisam ser configurados em `monitoring/alertmanager.yml`. Opções disponíveis:
- **Uptime Kuma** (webhook push URL)
- **Slack** (webhook URL)
- **Email** (SMTP)

O endpoint `/metrics` é protegido com token (`METRICS_TOKEN`) e acessível via header `x-metrics-token`.

---

## 6. Backup e Restauração

### Backup automático
- **Frequência**: Diário (configurável via `SCHEDULE` no docker-compose)
- **Retenção**: 7 diários, 4 semanais, 3 mensais
- **Local**: diretório `./backups/`

### Restaurar um backup

```bash
cd /opt/controle-os
docker compose exec -T postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB backups/backup-latest.sql.gz
```

---

## 7. Segurança

### Checklist de hardening

- [x] **JWT em httpOnly cookie / Bearer token** com 8h de expiração
- [x] **Refresh tokens** com rotação e revogação
- [x] **Account lockout** após 5 tentativas de login (15 minutos)
- [x] **Rate limiting** por IP (100 req/min global, limites específicos em login/senha)
- [x] **Helmet** com HSTS (`max-age=31536000`) em produção
- [x] **CORS** restrito às origens configuradas
- [x] **Validação Zod** em todas as entradas
- [x] **Prisma ORM** — todas as queries são parameterizadas
- [x] **Logs estruturados** com redação de secrets (Pino)
- [x] **Senhas hasheadas** com bcrypt (12 rounds)
- [x] **JWT invalidado** quando a senha é alterada
- [x] **Magic bytes** verificados em uploads de arquivos
- [x] **Métricas** protegidas com token
- [x] **Server tokens off** no nginx

### CSRF
Este projeto usa **Bearer tokens** para autenticação de API. Cookies não são usados para sessão. Como o header `Authorization` deve ser explicitamente adicionado pelo cliente, ataques CSRF tradicionais não se aplicam. Nenhum token anti-CSRF é necessário.

### Rotação de credenciais
- As senhas seed são configuradas via `SEED_*_PASS` e nunca usam o valor hardcoded em produção
- O `JWT_SECRET` é gerado por `openssl rand -base64 64` e nunca compartilhado
- As senhas de banco e Redis são independentes e geradas aleatoriamente

---

## 8. Troubleshooting

### SSL não gera
```bash
docker compose logs certbot
./scripts/setup-ssl.sh  # tenta novamente
```

### Nginx não sobe
```bash
docker compose logs nginx
# Verifique se o DOMAIN está definido no .env
docker compose config | grep DOMAIN
```

### Backend não inicia
```bash
docker compose logs backend
# Problemas comuns:
# - JWT_SECRET não definido
# - SEED_DEFAULT_PASS não definido ou usando valor hardcoded
# - DATABASE_URL incorreto
```

### Disco cheio
```bash
# Limpar logs do Docker
docker system prune -a --volumes

# Limpar backups antigos
ls -lh backups/
rm backups/*.sql.gz  # remova os mais antigos manualmente
```

### Health check falhando
```bash
# Backend
curl http://localhost:3333/health/ready

# Frontend
curl -I http://localhost:3000

# Banco
docker compose exec postgres pg_isready -U $POSTGRES_USER
```

---

## 9. Comandos úteis

```bash
# Ver status de todos os serviços
docker compose ps

# Logs em tempo real de um serviço
docker compose logs -f backend
docker compose logs -f nginx

# Reiniciar um serviço específico
docker compose restart backend

# Aplicar migrations manualmente
docker compose exec backend npx prisma migrate deploy

# Acessar o banco
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Atualizar todas as imagens
docker compose pull
docker compose up -d --build

# Backup manual
docker compose exec backup sh -c "backup-now"

# Ver uso de disco
df -h /opt/controle-os
du -sh backups/ uploads/
```
