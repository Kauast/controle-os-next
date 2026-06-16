# Guia de Deploy - Backend Controle OS

Documento técnico sobre deployment, migrações e operações de produção do backend.

## Sumário

1. [Arquitetura de Deploy](#arquitetura-de-deploy)
2. [Fluxo de Inicialização](#fluxo-de-inicialização)
3. [Migrações de Banco de Dados](#migrações-de-banco-de-dados)
4. [Variáveis de Ambiente Obrigatórias](#variáveis-de-ambiente-obrigatórias)
5. [Comados de Deploy em Produção](#comandos-de-deploy-em-produção)
6. [Troubleshooting](#troubleshooting)

---

## Arquitetura de Deploy

### Componentes

A stack de produção é orquestrada via `docker-compose.yml` (raiz do projeto) e consiste em:

| Serviço | Imagem | Função | Pool de Conexão |
|---------|--------|--------|---|
| **postgres** | `postgres:16-alpine` | Banco principal (DDL, dados) | — |
| **pgbouncer** | `bitnami/pgbouncer:1.23.1` | Connection pooling em transaction mode | 25 conexões/usuário |
| **redis** | `redis:7-alpine` | Cache + job queue (BullMQ) | — |
| **backend** | `./backend-senior/Dockerfile` | API Fastify | USA pgbouncer (DATABASE_URL) + direto ao postgres (DIRECT_URL) |
| **frontend** | `./Dockerfile` | Web Next.js | Depende de backend health |
| **nginx** | `nginx:1.25-alpine` | Proxy reverso + SSL | — |
| **prometheus** | `prom/prometheus` | Métricas | — |
| **grafana** | `grafana/grafana` | Visualização de métricas | — |
| **backup** | `prodrigestivill/postgres-backup-local` | Backups automáticos | — |

### Estratégia de Conexão ao Banco

**PgBouncer em Transaction Mode** é crítico para escala:

- **DATABASE_URL** → aponta para **PgBouncer** (porta 5432 interna)
  - Pool: 25 conexões por usuário, transaction mode
  - SEM prepared statements (`?pgbouncer=true`)
  - Usada pela aplicação Fastify (requisições HTTP)

- **DIRECT_URL** → aponta para **PostgreSQL** direto (postgres:5432)
  - Usada APENAS por `prisma migrate deploy` (migrations DDL)
  - Transaction mode NÃO suporta DDL; deve ser direto
  - O Prisma redireciona automaticamente para `directUrl` quando executa migrations

---

## Fluxo de Inicialização

### Serviço One-Shot de Migração (`migrate`)

A partir desta versão, migrações são executadas por um **serviço Docker separado one-shot** (`migrate`), garantindo:

- ✓ Execução UMA VEZ por boot (não N vezes por réplica)
- ✓ Sem race conditions entre réplicas
- ✓ Ordem garantida: postgres → pgbouncer → migrate → backend
- ✓ Falha de migração bloqueia o boot do backend (seguro)
- ✓ Scales bem em clusters/Kubernetes

**Fluxo completo**:

```
┌──────────────────────────────────────────────────────────────┐
│ docker-compose up -d                                         │
├──────────────────────────────────────────────────────────────┤
│ 1. postgres (startup → healthcheck pronto)                   │
│    ├─ Aguarda readiness: pg_isready                          │
│    └─ Volume: postgres_data                                  │
│                                                               │
│ 2. pgbouncer (depends_on: postgres healthy)                  │
│    ├─ Aguarda readiness: nc -z 127.0.0.1 5432               │
│    └─ Pool: 25 conn/usuario, transaction mode               │
│                                                               │
│ 3. migrate ONE-SHOT (depends_on: postgres, pgbouncer healthy)│
│    ├─ Executa: sh -c "npx prisma migrate deploy"            │
│    ├─ Usa DIRECT_URL (postgres direto para DDL)             │
│    ├─ Aplica chain inteira de migrations atomicamente        │
│    ├─ Log: "[...] INFO: ✓ Migrações executadas com sucesso"│
│    ├─ Exit code 0 = sucesso, ≠0 = falha                     │
│    └─ restart: "no" (não reinicia; uma tentativa apenas)    │
│                                                               │
│ 4. backend (depends_on: migrate service_completed_successfully)
│    ├─ Aguarda dependências (pgbouncer, redis)               │
│    ├─ Inicializa aplicação (npm run start)                  │
│    └─ Fastify escuta em :3333                               │
└──────────────────────────────────────────────────────────────┘
```

### Entrypoint Script (`docker-entrypoint.sh`) - Responsabilidades Reduzidas

O backend entrypoint agora **apenas**:

1. Aguarda PostgreSQL, PgBouncer, Redis ficarem prontos
2. Inicia aplicação Fastify

**Removed**: Execução de `npx prisma migrate deploy` (delegada ao serviço `migrate`).

**Preservado**: `exec node dist/server.js` → essencial para graceful shutdown (Node recebe SIGTERM/SIGINT direto como PID 1).

**Fluxo do entrypoint agora**:

```
docker-entrypoint.sh
│
├─ 1. Aguardar PostgreSQL (DIRECT_URL) estar pronto
│    ├─ Timeout: 60 segundos
│    └─ Verifica host:port com netcat
│
├─ 2. Aguardar PgBouncer (DATABASE_URL) estar pronto
│    ├─ Timeout: 30 segundos
│    └─ Verificação via netcat
│
├─ 3. Aguardar Redis (REDIS_URL) estar pronto
│    ├─ Timeout: 30 segundos
│    ├─ Verificação via netcat
│    └─ AVISO (não fatal) se Redis não responder
│
└─ 4. Iniciar Aplicação
     └─ exec node dist/server.js (PID 1 → graceful shutdown garantido)
```

---

## Migrações de Banco de Dados

### Arquitetura (Nova)

**A partir desta versão**: Migrações rodam no serviço **one-shot `migrate`**, ANTES do backend iniciar.

**Fluxo**:

```
┌─ docker-compose.yml ───────────────────────────────────────┐
│                                                              │
│  services:                                                  │
│    postgres → ready                                         │
│    pgbouncer → depends_on postgres healthy                 │
│    migrate → depends_on postgres + pgbouncer healthy       │
│              restart: "no" (one-shot)                      │
│              command: npx prisma migrate deploy            │
│    backend → depends_on migrate completed_successfully     │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**Garantias**:
- Migrations rodam uma única vez por boot
- Sem race conditions (uma réplica não começa antes da outra terminar migrate)
- Ordem: postgres → pgbouncer → migrate (sucesso/falha) → backend
- Em Kubernetes/clusters, cada Pod roda seu próprio migrate (idempotente via Prisma locks)

### State Atual

Migrations estão em `backend-senior/prisma/migrations/`:

```
20240101000000_init/                          # Schema base
20260609000000_add_team_priority_materials/   # Prioridades de equipe
20260609000001_add_client_address_chips/      # Endereços de cliente
20260609000002_add_chip_model/                # Modelo de chip
20260609000003_add_created_by_to_service_order/ # Criado por
20260610000001_add_supervisor_reset_audit/    # Auditoria de reset
20260611000001_add_password_changed_at/       # Password tracking
20260612000000_enterprise_redesign/           # Redesign multi-tenant
20260612000001_dba_senior_hardening/          # Hardening DBA
20260612000002_add_execution_media/           # Mídia de execução
20260613000001_add_refresh_token_table/       # Refresh tokens
20260613000002_add_execution_attachment_ids/  # Attachment IDs
```

Cada migration é um diretório contendo `migration.sql` com DDL idempotente.

### Execução de Migrações

#### Novo Banco (Vazio)

```bash
# Migrations executam automáticamente via serviço 'migrate'
docker-compose up -d

# Verificar status
docker-compose logs migrate
# Deve terminar com: "[...] INFO: ✓ Migrações executadas com sucesso"

# Depois, backend inicia automaticamente
docker-compose logs backend | head -20
```

**Fluxo automático**:
1. Postgres e PgBouncer ficam prontos
2. Serviço `migrate` executa `npx prisma migrate deploy`
   - Cria tabela `_prisma_migrations` (se não existir)
   - Aplica todas as migrations em ordem atomicamente
3. Backend inicia após migrate completar com sucesso (exit code 0)

#### Banco Pré-existente (sem tabela _prisma_migrations)

**Cenário**: Banco criado via `prisma db push` (antigo workflow), já tem tabelas mas `_prisma_migrations` não.

**Problema**: `prisma migrate deploy` tentará recriar tudo e falhará.

**Solução**:

1. **Backup** (sempre):
   ```bash
   docker-compose exec postgres pg_dump -U controle_os_user controle_os > backup-pre-baseline.sql
   ```

2. **Marcar migrations como aplicadas**:
   ```bash
   # Dentro do container backend (migrations já rodaram no serviço migrate)
   docker-compose exec backend npx prisma migrate resolve --applied 20240101000000_init
   docker-compose exec backend npx prisma migrate resolve --applied 20260609000000_add_team_priority_materials
   # ... etc para cada uma já refletida no banco
   ```

3. **Validar**:
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```
   Deve aplicar apenas as NOVAS migrations (20260613000001, 20260613000002).

#### Migração Manual (Dev/Troubleshooting)

Se precisar rodar migrations manualmente:

```bash
# Dentro do container backend
docker-compose exec backend npx prisma migrate deploy

# Ou localmente (dev)
cd backend-senior
npm run migrate:deploy
```

---

## Variáveis de Ambiente Obrigatórias

### Tabela Completa (Production NODE_ENV=production)

| Variável | Origem | Obrigatório | Descrição |
|----------|--------|---|---|
| **NODE_ENV** | docker-compose.yml | Sim | `production` (hardcoded) |
| **PORT** | docker-compose.yml | Sim | `3333` (hardcoded) |
| **DATABASE_URL** | docker-compose.yml | Sim | `postgresql://user:pass@pgbouncer:5432/db?pgbouncer=true` |
| **DIRECT_URL** | docker-compose.yml | Sim | `postgresql://user:pass@postgres:5432/db` |
| **JWT_SECRET** | .env (raiz) | Sim | Gerado: `openssl rand -base64 64` |
| **REDIS_URL** | docker-compose.yml | Sim | `redis://:password@redis:6379` |
| **REDIS_PASSWORD** | .env (raiz) | Sim | Gerado: `openssl rand -base64 32` |
| **ALLOWED_ORIGINS** | docker-compose.yml | Sim | `https://${DOMAIN}` |
| **APP_URL** | docker-compose.yml | **Sim** | `https://${DOMAIN}` (validado em prod) |
| **DOMAIN** | .env (raiz) | Sim | Domínio público (ex: `api.exemplo.com`) |
| **METRICS_TOKEN** | .env (raiz) | Sim | Gerado: `openssl rand -base64 32` |
| **UPLOAD_DIR** | docker-compose.yml | Sim | `/app/uploads` (hardcoded) |
| **UPLOAD_BASE_URL** | docker-compose.yml | Sim | `https://${DOMAIN}/uploads` |
| **STORAGE_PROVIDER** | docker-compose.yml | Não | `local` ou `s3` (default: `local`) |
| **S3_ENDPOINT** | docker-compose.yml | Se s3 | `http://minio:9000` (ou AWS S3) |
| **S3_ACCESS_KEY** | .env (raiz) | Se s3 | MinIO/AWS credentials |
| **S3_SECRET_KEY** | .env (raiz) | Se s3 | MinIO/AWS credentials |
| **S3_BUCKET** | docker-compose.yml | Se s3 | Nome do bucket |
| **S3_PUBLIC_URL** | docker-compose.yml | Se s3 | URL pública do bucket |
| **ANTHROPIC_API_KEY** | .env (raiz) | Sim | Chave da API Anthropic (Claude) |
| **ANTHROPIC_MODEL** | docker-compose.yml | Não | `claude-opus-4-8` (default) |
| **POSTGRES_USER** | .env (raiz) | Sim | Usuário PG (ex: `controle_os_user`) |
| **POSTGRES_PASSWORD** | .env (raiz) | Sim | Senha PG (gerada) |
| **POSTGRES_DB** | docker-compose.yml | Não | `controle_os` (default) |
| **MINIO_ROOT_USER** | .env (raiz) | Se s3 | `minioadmin` |
| **MINIO_ROOT_PASSWORD** | .env (raiz) | Se s3 | Senha MinIO (gerada) |
| **GRAFANA_ADMIN_PASSWORD** | .env (raiz) | Se monitoramento | Senha Grafana (gerada) |
| **SEED_DEFAULT_PASS** | docker-compose.yml (backend) | Para seed manual | Senha do usuário padrão |
| **SEED_ADMIN_PASS** | docker-compose.yml (backend) | Para seed manual | Senha admin |
| **SEED_STOCK_PASS** | docker-compose.yml (backend) | Para seed manual | Senha estoque |
| **SEED_TECH_PASS** | docker-compose.yml (backend) | Para seed manual | Senha técnico |
| **SEED_ATTENDANT_PASS** | docker-compose.yml (backend) | Para seed manual | Senha atendente |
| **SEED_FINANCIAL_PASS** | docker-compose.yml (backend) | Para seed manual | Senha financeiro |

### Onde Estão Documentadas

1. **`.env.example`** (raiz) → Template de .env para produção
2. **`backend-senior/.env.example`** → Backend-specific (DATABASE_URL, DIRECT_URL, etc)
3. **`docker-compose.yml`** → Referência de quem precisa de quem

### Geração de Secrets

```bash
# JWT_SECRET (64 bytes = 88 chars base64)
openssl rand -base64 64

# REDIS_PASSWORD, POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD (32 bytes = 44 chars base64)
openssl rand -base64 32

# METRICS_TOKEN (32 bytes = 44 chars base64)
openssl rand -base64 32
```

---

## Comandos de Deploy em Produção

### Checklist Pré-Deploy

- [ ] Branch main: commits testados e aprovados
- [ ] Backend: `npm test` passa (63 testes)
- [ ] Frontend: `npm run build` sem erros
- [ ] .env preenchido com valores REAIS (não placeholders)
- [ ] Backup do banco ANTES de qualquer mudança: `docker-compose exec postgres pg_dump ... > backup.sql`
- [ ] Health check esperado: `curl https://${DOMAIN}/health`

### 1. Primeiro Deploy (Novo Servidor)

```bash
# SSH no servidor
ssh root@VPS_IP

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker & Docker Compose
apt install -y docker.io docker-compose git

# Iniciar Docker
systemctl start docker && systemctl enable docker

# Clonar código
git clone https://github.com/Kauast/controle-os-next.git /opt/controle-os
cd /opt/controle-os

# Criar .env (base do exemplo)
cp .env.example .env
# EDITAR .env com valores reais (senhas, domínio, chaves)
nano .env

# Subir serviços (compose cuida de build, network, migrations, tudo)
docker-compose up -d

# Verificar status
docker-compose ps
# Deve mostrar: postgres UP, pgbouncer UP, migrate Exited (0), backend UP, ...

# Ver logs de migrate (migrations)
docker-compose logs migrate
# Aguardar até ver: "✓ Migrações executadas com sucesso"

# Ver logs de backend
docker-compose logs backend | tail -20
# Deve mostrar: backend rodando, Fastify escuta em :3333

# Fazer seed manual (DEPOIS de confirmar que backend está UP)
docker-compose exec backend npm run seed
# Responder prompts para confirmar

# Validar
curl https://${DOMAIN}/health
# Deve retornar: {"status":"ok","uptime":...}
```

**Fluxo garantido**:
1. Postgres inicia
2. PgBouncer aguarda Postgres (healthcheck)
3. Serviço `migrate` (one-shot) aguarda postgres + pgbouncer → executa migrations → sai
4. Backend aguarda `migrate` completed_successfully → inicia aplicação
5. Frontend aguarda backend healthy → inicia
6. Nginx aguarda frontend healthy → inicia

### 2. Update/Hotfix (Novo Código)

```bash
cd /opt/controle-os

# Backup do banco
docker-compose exec -T postgres pg_dump -U controle_os_user controle_os > backup-$(date +%Y%m%d-%H%M%S).sql

# Pull novo código
git pull origin main

# Rebuild containers (backend + frontend)
# Serviço 'migrate' roda ANTES do backend, então migrations aplicam automaticamente
docker-compose down
docker-compose up -d --build

# Verificar que migrate completou
docker-compose logs migrate
# Procurar: "✓ Migrações executadas com sucesso"

# Aguardar backend estar pronto
docker-compose logs -f backend
# Procurar: "Fastify escuta em :3333"

# Validar novo código
docker-compose ps  # Todos devem estar UP
curl https://${DOMAIN}/health
# Deve retornar: {"status":"ok","uptime":...}

# Rollback (se algo deu errado)
git revert <commit-sha>
docker-compose down && docker-compose up -d --build
# Migrate roda novamente automaticamente
```

### 3. Seed Manual (Após Nova Instalação)

```bash
# Backend deve estar rodando
docker-compose ps | grep backend

# Executar seed interativo
docker-compose exec backend npm run seed

# Responder prompts (Enter para defaults de .env)
# ✓ Confirma criação de Company padrão
# ✓ Cria usuários com as senhas de SEED_*_PASS
```

Usuários criados:
- `admin@controle.com` (ADMIN)
- `tecnico@controle.com` (TECHNICIAN)
- `estoque@controle.com` (STOCK)
- `atendimento@controle.com` (ATTENDANT)
- `financeiro@controle.com` (FINANCIAL)

### 4. Migração Manual (Edge Case)

Se, por algum motivo, você precisar rodar migrate manualmente:

```bash
# Dentro do backend container (ou backend-senior/ localmente)
docker-compose exec backend npx prisma migrate deploy

# Ou em dev local:
cd backend-senior
npm run migrate:deploy
```

---

## Troubleshooting

### Serviço `migrate` falha: "Timeout aguardando PostgreSQL"

**Causa**: Postgres ou PgBouncer não ficaram prontos em tempo (healthcheck falhando).

**Solução**:

```bash
# Ver logs do migrate
docker-compose logs migrate

# Verificar saúde do postgres
docker-compose ps postgres

# Se postgres está DOWN:
docker-compose logs postgres | tail -50

# Se postgres está UP mas healthcheck falha:
docker-compose exec postgres pg_isready -U controle_os_user

# Reiniciar postgres e pgbouncer
docker-compose restart postgres pgbouncer

# Depois, restart dos serviços migrate + backend
docker-compose restart migrate
docker-compose up -d backend

# Verificar que migrate completou
docker-compose logs migrate
```

### Serviço `migrate` falha: "Erro ao executar migrations"

**Causa**: Schema incompatível, migrations quebradas, ou banco já tem tabelas parcialmente criadas.

**Solução**:

```bash
# Ver erro completo
docker-compose logs migrate | grep -A 20 "ERROR"

# Conectar ao banco manualmente para inspecionar
docker-compose exec postgres psql -U controle_os_user controle_os

# Dentro do psql:
-- Ver se _prisma_migrations existe
\dt "_prisma_migrations"

-- Ver migrations já aplicadas
SELECT migration, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC;

-- Ver schema das tabelas
\dt "ServiceOrder"

-- Se schema está corrompido, considere restaurar backup
```

### Backend não inicia: "Migrate não completou com sucesso"

**Causa**: Serviço `migrate` exitou com código ≠ 0, ou timeout ao aguardar.

**Solução**:

```bash
# Ver status dos serviços
docker-compose ps

# Backend deve estar aguardando migrate:
# STATUS: Created (ou Restarting se restart: unless-stopped)

# Verificar logs do migrate
docker-compose logs migrate

# Se migrate falhou:
# 1. Corrigir o problema no banco (ver seção acima)
# 2. Restart do migrate:
docker-compose restart migrate

# Backend reiniciará automaticamente após migrate completar
docker-compose logs -f backend
```

### "RefreshToken_userId_fkey: Constraint already exists" (durante migrate)

**Causa**: Migration 20260613000001 foi aplicada manualmente antes; nova execução tenta aplicar novamente.

**Solução**:

```bash
# Verificar status da migration
docker-compose exec postgres psql -U controle_os_user controle_os -c \
  "SELECT migration, finished_at FROM \"_prisma_migrations\" WHERE migration LIKE '%refresh_token%';"

# Se já aplicada:
# Opção 1: Migrations são idempotentes — Prisma pulará automaticamente
# Opção 2: Se quiser forçar, resetar via resolve:
docker-compose exec backend npx prisma migrate resolve --rolled-back 20260613000001
docker-compose exec backend npx prisma migrate deploy
```

### Upload de fotos falha

**Causa**: `STORAGE_PROVIDER=s3` mas MinIO não está configurado.

**Solução**:

```bash
# Ver variáveis
docker-compose config | grep -i storage

# Se STORAGE_PROVIDER=s3, garantir que MinIO está rodando
docker-compose ps minio

# Se STORAGE_PROVIDER=local, garantir que pasta /app/uploads tem permissões
docker-compose exec backend ls -la /app/uploads
```

### Certificado SSL expirado

**Causa**: Let's Encrypt cert expirou.

**Solução**:

```bash
# Certbot deve renovar automaticamente a cada 12h
# Para forçar renovação:
docker-compose exec certbot certbot renew --verbose

# Recarregar nginx
docker-compose exec nginx nginx -s reload

# Validar cert
curl -I https://${DOMAIN}  # Ver SSL certificate details
```

---

## Referências

- `docker-compose.yml` - Orquestração de serviços
- `backend-senior/docker-entrypoint.sh` - Script de inicialização
- `backend-senior/Dockerfile` - Imagem backend
- `.env.example` - Template de variáveis
- `docs/INSTALACAO.md` - Guia completo de instalação
- `backend-senior/prisma/migrations/` - Histórico de DDL

---

**Última atualização**: 2026-06-13
**Autor**: Deployment Engineer (Claude Code)
