# Controle OS, Estoque e Agenda

Sistema de **ordens de serviço, estoque com QR Code, agenda por equipes e app do técnico** com backend real, autenticação JWT em cookie httpOnly e banco PostgreSQL.

## Stack

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| **Estado** | TanStack Query v5, Zustand v5 |
| **Formulários** | React Hook Form + Zod |
| **Backend** | Fastify 5, Prisma ORM, PostgreSQL 16, Redis 7 |
| **Auth** | JWT em cookie httpOnly/Secure/SameSite=Strict (8h), refresh token (7d) |
| **Infra** | Docker Compose, Nginx (SSL/TLS), Certbot (Let's Encrypt) |
| **Observabilidade** | Prometheus, Grafana, Alertmanager, Uptime Kuma, Node Exporter |
| **Backup** | postgres-backup-local (diário, 7 dias + 4 semanas + 3 meses) |

## Funcionalidades

- 5 perfis com controle de acesso: `ADMIN`, `STOCK`, `TECHNICIAN`, `ATTENDANT`, `FINANCIAL`
- Painel com KPIs em tempo real
- CRUD completo de Clientes, Produtos e Técnicos
- Agenda das equipes com drag & drop de OS
- Estoque: QR Code, entrada/saída, alertas de estoque baixo
- Relatórios por equipe e financeiro (somente admin)
- App do técnico (`/tecnico`): check-in, fotos, assinatura canvas, finalização de OS
- Rate limiting por IP com fallback Redis

---

## Setup local (desenvolvimento)

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose

### 1. Variáveis de ambiente

```bash
# Raiz (Next.js)
cp .env.example .env.local
# Edite .env.local e defina no mínimo:
# BACKEND_URL=http://localhost:3333
# JWT_SECRET=qualquer-valor-para-dev

# Backend
cp backend-senior/.env.example backend-senior/.env
# Edite com DATABASE_URL, REDIS_URL e JWT_SECRET iguais ao .env.local
```

### 2. Subir serviços

```bash
# Terminal 1 — Banco e cache
docker compose -f backend-senior/docker-compose.yml up -d

# Terminal 2 — Backend
cd backend-senior
npm install
npx prisma migrate deploy
npm run seed     # cria usuários demo (executar apenas 1 vez)
npm run dev

# Terminal 3 — Frontend
cd ..
npm install
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### Usuários demo (desenvolvimento)

| E-mail | Senha padrão | Perfil |
|--------|--------------|--------|
| admin@controle.com | definido em `SEED_ADMIN_PASS` | Admin |
| estoque@controle.com | `SEED_STOCK_PASS` | Estoque |
| tecnico@controle.com | `SEED_TECH_PASS` | Técnico |
| atendimento@controle.com | `SEED_ATTENDANT_PASS` | Atendimento |
| financeiro@controle.com | `SEED_FINANCIAL_PASS` | Financeiro |

---

## Deploy em produção (VPS com Docker Compose)

### Pré-requisitos

- VPS Ubuntu 22+ com IP público
- DNS do domínio apontando para a VPS
- Acesso SSH root

### 1. Clonar e configurar

```bash
git clone https://github.com/Kauast/controle-os-next.git /opt/controle-os
cd /opt/controle-os
cp .env.example .env
```

### 2. Variáveis obrigatórias (`.env`)

```bash
# Domínio
DOMAIN=seu-dominio.com

# PostgreSQL — use senhas fortes
POSTGRES_USER=controle_os_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=controle_os

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32)

# JWT — mesmo valor no backend e frontend
JWT_SECRET=$(openssl rand -base64 64)

# Métricas (protege /metrics do backend)
METRICS_TOKEN=$(openssl rand -base64 24)

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)

# Let's Encrypt
CERTBOT_EMAIL=seu@email.com

# Senhas dos usuários demo (para seed manual na primeira instalação)
SEED_ADMIN_PASS=$(openssl rand -base64 16)
SEED_STOCK_PASS=$(openssl rand -base64 16)
SEED_TECH_PASS=$(openssl rand -base64 16)
SEED_ATTENDANT_PASS=$(openssl rand -base64 16)
SEED_FINANCIAL_PASS=$(openssl rand -base64 16)
```

### 3. Setup automático

```bash
sudo bash scripts/setup-vps.sh
```

O script instala Docker, configura firewall, faz build, emite certificado SSL e pergunta se deseja executar o seed.

### 4. Seed manual (primeira instalação ou quando necessário)

```bash
# O seed é idempotente — pula usuários que já existem
docker compose exec backend npm run seed

# Ou use o helper:
bash scripts/seed.sh
```

> **Atenção:** O seed nunca é executado automaticamente em produção. O comando de produção é apenas `prisma migrate deploy && npm run start`.

### 5. SSL e renovação

O Certbot renova automaticamente via cronjob interno. Para emitir manualmente:

```bash
bash scripts/setup-ssl.sh
```

### 6. Monitoramento

| Serviço | URL |
|---------|-----|
| App | `https://DOMAIN` |
| Uptime Kuma | `https://DOMAIN:3001` |
| Grafana | `https://DOMAIN:3200` |

> Para segurança adicional, restrinja as portas 3001 e 3200 por IP no firewall:
> ```bash
> ufw allow from SEU_IP to any port 3001
> ufw allow from SEU_IP to any port 3200
> ufw delete allow 3001/tcp
> ufw delete allow 3200/tcp
> ```

### 7. Backup e restore

**Backup automático** — diário às 00:00, retendo:
- 7 dias
- 4 semanas
- 3 meses

Backups em: `./backups/`

**Backup manual imediato:**
```bash
bash scripts/backup-now.sh
```

**Restore:**
```bash
# Lista backups disponíveis
ls -lh backups/*.sql.gz

# Restaura (confirma antes de sobrescrever)
bash scripts/restore.sh backups/ARQUIVO.sql.gz
```

---

## CI/CD (GitHub Actions)

O workflow em `.github/workflows/ci.yml` executa em todo push/PR:

1. **Backend** — typecheck + testes (Vitest)
2. **Frontend** — typecheck + build (Next.js)
3. **Docker** — build das imagens + validação do `docker-compose.yml`
4. **Security** — verifica se `.env` está sendo rastreado pelo git

O deploy para VPS está em `.github/workflows/deploy.yml` (precisa dos secrets abaixo).

### Secrets necessários no GitHub

| Secret | Descrição |
|--------|-----------|
| `VPS_HOST` | IP ou hostname da VPS |
| `VPS_USER` | Usuário SSH (ex.: `deploy`) |
| `VPS_SSH_KEY` | Chave privada SSH |
| `VPS_SSH_PORT` | Porta SSH (padrão: 22) |

---

## Estrutura do projeto

```
controle-os-next/
├── src/                        # Frontend Next.js
│   ├── app/
│   │   ├── api/auth/           # BFF: login (cookie httpOnly), logout, me
│   │   ├── api/backend/        # Proxy para Fastify
│   │   └── login/, tecnico/, ...
│   ├── components/             # UI por domínio
│   ├── hooks/                  # TanStack Query hooks
│   ├── lib/                    # tipos, utils, regras de acesso
│   └── store/                  # Zustand stores
├── backend-senior/             # API Fastify
│   ├── src/
│   │   ├── controllers/        # auth, client, product, serviceOrder, ...
│   │   ├── routes/             # registro de rotas Fastify
│   │   ├── services/           # lógica de negócio + Prisma
│   │   ├── lib/                # prisma, cache, metrics, health, logger
│   │   ├── middlewares/        # authenticate, authorize
│   │   └── plugins/            # observability
│   └── prisma/schema.prisma    # modelos do banco
├── nginx/                      # Config Nginx + templates SSL/HTTP
├── monitoring/                 # Prometheus, Alertmanager, alerts.yml, Grafana
├── scripts/                    # deploy.sh, setup-vps.sh, backup, restore, seed
├── backups/                    # Backups PostgreSQL (não commitados)
├── docker-compose.yml          # Stack de produção completa
└── Dockerfile                  # Imagem frontend Next.js (standalone)
```

---

## Checklist de produção

- [ ] `.env` criado com senhas fortes (nunca commitar)
- [ ] `DOMAIN` apontando para a VPS no DNS
- [ ] `CERTBOT_EMAIL` válido para alertas de renovação SSL
- [ ] `JWT_SECRET` com pelo menos 64 chars aleatórios
- [ ] `METRICS_TOKEN` definido (protege `/metrics`)
- [ ] `GRAFANA_ADMIN_PASSWORD` forte definido
- [ ] Seed executado manualmente na primeira instalação
- [ ] Firewall UFW ativo (portas 22, 80, 443, 3001, 3200)
- [ ] Portas 3001 e 3200 restritas por IP se uso interno apenas
- [ ] Backup testado: `bash scripts/backup-now.sh` + restore verificado
- [ ] Grafana configurado com datasource Prometheus
- [ ] Uptime Kuma com monitor do health endpoint
- [ ] Alertmanager com webhook ou email configurado em `monitoring/alertmanager.yml`
- [ ] Logs com rotação configurados (já no docker-compose.yml)
- [ ] `docker compose ps` — todos os containers `Up (healthy)`
