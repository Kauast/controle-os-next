# Guia de Instalação e Deployment - Controle OS

Este guia cobre a instalação completa do Controle OS em desenvolvimento e produção.

## Índice

1. [Instalação em Desenvolvimento](#instalação-em-desenvolvimento)
2. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
3. [Variáveis de Ambiente](#variáveis-de-ambiente)
4. [Build do App Mobile](#build-do-app-mobile)
5. [Deployment em Produção](#deployment-em-produção)
6. [Docker Compose](#docker-compose)
7. [Backup e Disaster Recovery](#backup-e-disaster-recovery)
8. [Monitoramento](#monitoramento)
9. [Troubleshooting](#troubleshooting)

---

## Instalação em Desenvolvimento

### Pré-requisitos

Você precisa ter instalado:

- **Node.js** 18.17+ e **npm** 10+
- **PostgreSQL** 14+
- **Redis** 6+ (para cache e fila)
- **Git**
- **Android SDK** (se vai compilar APK)

#### Verificar Versões Instaladas

```bash
node --version    # v18.17.0 ou superior
npm --version     # 10.0.0 ou superior
psql --version    # PostgreSQL 14.+ ou superior
redis-cli --version  # redis-cli 6.0+ ou superior
```

### 1. Clone o Repositório

```bash
git clone https://github.com/Kauast/controle-os-next.git
cd controle-os-next
```

### 2. Instale Dependências do Frontend

```bash
npm install
```

Isso instala pacotes de:
- Next.js
- React
- TypeScript
- TailwindCSS
- Capacitor (para mobile)
- E outras dependências

### 3. Instale Dependências do Backend

```bash
cd backend-senior
npm install
```

Instala:
- Fastify
- Prisma
- PostgreSQL driver
- Redis client
- BullMQ (job queue)
- JWT
- E outras

```bash
cd ..
```

Volte para a raiz do projeto.

---

## Configuração do Banco de Dados

### Criar Banco PostgreSQL

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do psql:
CREATE DATABASE controle_os;
CREATE USER controle_os_user WITH PASSWORD 'sua_senha_forte_aqui';
GRANT ALL PRIVILEGES ON DATABASE controle_os TO controle_os_user;
\q
```

Anote o **user** (`controle_os_user`) e **password** — você usará em `.env`.

### Criar Arquivo .env do Backend

```bash
cd backend-senior
cp .env.example .env
```

Edite `.env` com seus dados PostgreSQL:

```env
DATABASE_URL=postgresql://controle_os_user:sua_senha@localhost:5432/controle_os
DIRECT_URL=postgresql://controle_os_user:sua_senha@localhost:5432/controle_os

# Redis
REDIS_URL=redis://:sua_senha_redis@localhost:6379
REDIS_PASSWORD=sua_senha_redis

# JWT
JWT_SECRET=gere_com_openssl_rand_-base64_64
JWT_EXPIRES_IN=8h
JWT_ISSUER=controle-os-api
JWT_AUDIENCE=controle-os-client

# Servidor
PORT=3333
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000

# Armazenamento
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:3333/uploads

# Email (opcional em dev)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=seu_email@example.com
SMTP_PASS=sua_senha_email

# IA (opcional)
ANTHROPIC_API_KEY=sua_chave_anthropic
ANTHROPIC_MODEL=claude-opus-4-8

# Seed (dados iniciais)
SEED_DEFAULT_PASS=senha123
SEED_ADMIN_PASS=admin123
SEED_TECH_PASS=tech123
SEED_STOCK_PASS=stock123
SEED_ATTENDANT_PASS=attendant123
SEED_FINANCIAL_PASS=financial123
```

#### Gerar Senhas Fortes

```bash
# JWT_SECRET (64 bytes base64)
openssl rand -base64 64

# REDIS_PASSWORD (32 bytes base64)
openssl rand -base64 32

# Semelhante para outros secrets
```

### Executar Migrações

```bash
cd backend-senior
npm run migrate:dev
```

Isso:
1. Cria todas as tabelas no PostgreSQL baseado em `schema.prisma`
2. Cria arquivo `.prisma-client` com tipos
3. Mostra histórico de migrações

### Popular com Dados Iniciais (Opcional)

```bash
npm run seed
```

Cria usuários de teste:
- `admin@controle.com` (ADMIN)
- `tecnico@controle.com` (TECHNICIAN)
- `estoque@controle.com` (STOCK)
- `atendimento@controle.com` (ATTENDANT)
- `financeiro@controle.com` (FINANCIAL)

Senhas: Definidas em `SEED_*_PASS` no `.env`.

---

## Variáveis de Ambiente

### Frontend (.env.local)

Na raiz do projeto:

```bash
cp .env.example .env.local
```

Edite se necessário:

```env
# Geralmente deixa-se como está em desenvolvimento
NEXT_PUBLIC_FASTIFY_URL=http://localhost:3333
```

### Mobile (.env.mobile)

```bash
cp .env.mobile.example .env.mobile
```

**Muito importante em produção**: O `NEXT_PUBLIC_FASTIFY_URL` deve ser a URL do backend acessível pelo telefone.

```env
# Em desenvolvimento (LAN local):
NEXT_PUBLIC_FASTIFY_URL=http://192.168.1.100:3333

# Em produção:
NEXT_PUBLIC_FASTIFY_URL=https://api.seu-dominio.com
```

### Backend (.env.example → .env)

Já coberto acima em [Configuração do Banco de Dados](#configuração-do-banco-de-dados).

---

## Build do App Mobile

O app mobile é um híbrido: código React que roda dentro de um container Android nativo via Capacitor.

### Pré-requisitos para Build Android

- **Android SDK** instalado
- **Java Development Kit (JDK)** 11+
- **Gradle** (geralmente vem com SDK)
- **Android Emulator** ou dispositivo Android físico

#### Verificar Instalação

```bash
java -version
gradle --version
```

### Build do Bundle Mobile

```bash
# Na raiz do projeto
npm run build:mobile
```

Isso:
1. Cria build otimizado de Next.js para mobile
2. Gera arquivos estáticos em `.next/`
3. Capacitor copia esses arquivos para a pasta Android

### Sincronizar com Capacitor

```bash
npm run cap:sync android
```

Isso sincroniza:
- Código JavaScript
- Assets
- Plugins do Capacitor

### Compilar APK Debug

```bash
npm run apk:debug
```

Gera: `android/app/build/outputs/apk/debug/app-debug.apk`

Use isso para testar em emulador ou dispositivo.

### Compilar APK Release

```bash
npm run apk:release
```

Gera: `android/app/build/outputs/apk/release/app-release.apk`

**Atenção**: Exige keystore assinado. Veja [Assinatura de APK](#assinatura-de-apk) abaixo.

#### Assinatura de APK

Para distribuir em produção, você precisa assinar o APK:

```bash
# Criar keystore (primeira vez)
keytool -genkey -v -keystore controle-os.keystore \
  -alias controle-os-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Assinar APK release
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore controle-os.keystore \
  android/app/build/outputs/apk/release/app-release.apk \
  controle-os-key

# Otimizar (zipalign)
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release.apk \
  android/app/build/outputs/apk/release/app-release-aligned.apk
```

O arquivo final é `app-release-aligned.apk`.

### Testar APK em Dispositivo

```bash
# Listar dispositivos conectados
adb devices

# Instalar APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Abrir app
adb shell am start -n com.example.controle_os/com.example.controle_os.MainActivity
```

---

## Deployment em Produção

**IMPORTANTE**: Leia `backend-senior/DEPLOY.md` para detalhes técnicos de migrações, entrypoint script e troubleshooting.

### Pré-requisitos

- **VPS ou Servidor** com Ubuntu 22.04+
- **Domínio** com DNS apontando para o IP
- **Docker** e **Docker Compose** instalados
- **Mínimo 2GB RAM** e **20GB disco**
- **Portas 80 e 443** liberadas no firewall

### 1. Configuração Inicial do Servidor

```bash
# SSH no servidor
ssh root@seu-ip-vps

# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências
apt install -y git docker.io docker-compose certbot

# Iniciar Docker
systemctl start docker
systemctl enable docker

# Adicionar seu usuário ao grupo docker (opcional)
usermod -aG docker $USER
```

### 2. Clonar Projeto

```bash
git clone https://github.com/Kauast/controle-os-next.git /opt/controle-os
cd /opt/controle-os
```

### 3. Preparar Arquivo .env

```bash
cp .env.example .env
nano .env
```

Preencha **TODOS** os campos obrigatórios (marcados em DEPLOY.md):

```env
DOMAIN=seu-dominio.com
POSTGRES_PASSWORD=gere_com_openssl_rand_-base64_32
REDIS_PASSWORD=gere_com_openssl_rand_-base64_32
JWT_SECRET=gere_com_openssl_rand_-base64_64
APP_URL=https://seu-dominio.com
ALLOWED_ORIGINS=https://seu-dominio.com
UPLOAD_BASE_URL=https://seu-dominio.com/uploads
ANTHROPIC_API_KEY=sua_chave_anthropic
METRICS_TOKEN=gere_com_openssl_rand_-base64_32
CERTBOT_EMAIL=seu-email@real.com
# SEED_*_PASS: para seed manual (docker-compose exec backend npm run seed)
SEED_DEFAULT_PASS=gere_com_openssl
SEED_ADMIN_PASS=gere_com_openssl
SEED_STOCK_PASS=gere_com_openssl
SEED_TECH_PASS=gere_com_openssl
SEED_ATTENDANT_PASS=gere_com_openssl
SEED_FINANCIAL_PASS=gere_com_openssl
```

**Gerar senhas**:
```bash
# DB/Redis password (32 bytes)
openssl rand -base64 32

# JWT_SECRET (64 bytes)
openssl rand -base64 64

# METRICS_TOKEN (32 bytes)
openssl rand -base64 32
```

---

## Docker Compose

### Arquivo docker-compose.yml

Na raiz do projeto existe um `docker-compose.yml` que orquestra:

- **PostgreSQL**: Banco de dados
- **PgBouncer**: Connection pooling em transaction mode
- **Redis**: Cache e fila
- **Backend Fastify**: API (com entrypoint script robusto)
- **Frontend Next.js**: Web
- **Nginx**: Proxy reverso + SSL
- **Certbot**: SSL automático
- **Grafana**: Monitoramento com Prometheus
- **Backup**: Backups automáticos diários

### Backend Entrypoint Script

O serviço backend usa `docker-entrypoint.sh` que:

1. Aguarda PostgreSQL, PgBouncer e Redis ficarem prontos
2. Executa `npx prisma migrate deploy` com retry automático (3 tentativas)
3. Inicia a aplicação Fastify

**Benefício**: Robusto contra falhas de rede temporárias e race conditions em múltiplas réplicas.

Veja `backend-senior/DEPLOY.md` para detalhes técnicos.

### Subir Aplicação

```bash
cd /opt/controle-os

# Subir serviços (compose cuida de build, network, volumes, tudo)
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs do backend (aguardar "Migrações executadas com sucesso")
docker-compose logs -f backend

# Ver logs do frontend
docker-compose logs -f frontend

# Verificar health da API
curl https://seu-dominio.com/health
```

### Configurar SSL (Primeira Vez)

```bash
# Executar script de setup SSL
./scripts/setup-ssl.sh

# Validar certificado
docker-compose exec nginx certbot certificates

# Recarregar nginx com HTTPS
docker-compose restart nginx
```

### Parar Serviços

```bash
docker-compose down

# Ou stop sem remover:
docker-compose stop
```

### Executar Migrações (Manual)

As migrações executam **automaticamente** no boot via entrypoint script.

Para rodar manualmente (caso necesário):

```bash
# Dentro do container (recomendado)
docker-compose exec backend npx prisma migrate deploy

# Ou em desenvolvimento local (fora do Docker)
cd backend-senior
npm run migrate:deploy
```

**Nota importante**: As migrações usam `DIRECT_URL` (PostgreSQL direto) automaticamente, pois PgBouncer em transaction mode não suporta DDL.

---

## Backup e Disaster Recovery

### Backup do Banco de Dados

#### Manual (Backup Completo)

```bash
# Fazer backup
docker-compose exec postgres pg_dump -U controle_os_user controle_os > backup.sql

# Compactar
gzip backup.sql  # Resulta em backup.sql.gz

# Enviar para armazenamento seguro (AWS S3, Google Cloud, etc)
```

#### Agendado (com cron)

```bash
# Editar crontab
crontab -e

# Adicionar (backup diário às 2 da manhã):
0 2 * * * cd /opt/controle-os && docker-compose exec -T postgres pg_dump -U controle_os_user controle_os | gzip > /backups/backup-$(date +\%Y\%m\%d).sql.gz
```

### Restaurar Backup

```bash
# Descompactar
gunzip backup.sql.gz

# Restaurar
docker-compose exec -T postgres psql -U controle_os_user controle_os < backup.sql

# Reiniciar container backend
docker-compose restart backend-senior
```

### Backup de Uploads

Se usar armazenamento local (`STORAGE_PROVIDER=local`):

```bash
# Copiar pasta de uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz /opt/controle-os/uploads/

# Restaurar
tar -xzf uploads-backup-*.tar.gz -C /opt/controle-os/
```

### Disaster Recovery

Em caso de perda total:

1. **Restaurar servidor**: Preparar nova VPS com Docker
2. **Clonar código**: `git clone ...`
3. **Restaurar .env**: Copiar backup do `.env`
4. **Restaurar DB**: `docker-compose exec -T postgres psql ... < backup.sql`
5. **Restaurar uploads**: Extrair backup de uploads
6. **Reiniciar**: `docker-compose up -d`
7. **Revalidar SSL**: `docker-compose exec nginx certbot renew`

---

## Monitoramento

### Verificar Health da API

```bash
# Health check
curl https://seu-dominio.com/health

# Deve retornar:
# {"status":"ok","uptime":12345}
```

### Métricas (Prometheus)

Acessar em: `https://seu-dominio.com:9090` (com `METRICS_TOKEN`)

```bash
curl -H "Authorization: Bearer YOUR_METRICS_TOKEN" \
  https://seu-dominio.com/metrics
```

### Logs

```bash
# Logs do Backend
docker-compose logs -f backend-senior --tail=100

# Logs do Frontend
docker-compose logs -f controle-os-next --tail=100

# Logs do Nginx
docker-compose logs -f nginx --tail=100

# Salvar logs em arquivo
docker-compose logs > logs-$(date +%Y%m%d-%H%M%S).txt
```

### Grafana (Opcional)

Se configurado com Docker Compose:

1. Acesse `https://seu-dominio.com:3000`
2. Login: `admin` / (GRAFANA_ADMIN_PASSWORD)
3. Dashboards pré-configurados mostram:
   - CPU e memória dos containers
   - Requisições por segundo
   - Erros (5xx)
   - Latência de banco de dados

---

## Troubleshooting

### Problema: Container Backend não inicia

```bash
# Ver logs de erro
docker-compose logs backend-senior

# Causas comuns:
# 1. DATABASE_URL inválida
# 2. Senha PostgreSQL errada
# 3. Porta 3333 já em uso

# Solução:
# 1. Verificar .env
# 2. Parar outro processo: lsof -i :3333
# 3. Rebuild: docker-compose down && docker-compose up -d --build
```

### Problema: Certificado SSL expirado

```bash
# Renovar manualmente
docker-compose exec nginx certbot renew

# Ou automático (recomendado):
# Docker-compose já inclui renovação automática
```

### Problema: Banco de dados lotado

```bash
# Ver tamanho do banco
docker-compose exec postgres psql -U controle_os_user controle_os -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database;"

# Limpar logs antigos (exemplo)
docker-compose exec postgres psql -U controle_os_user controle_os -c "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '1 year';"

# Vacuum para liberar espaço
docker-compose exec postgres psql -U controle_os_user controle_os -c "VACUUM ANALYZE;"
```

### Problema: Memória RAM insuficiente

```bash
# Ver uso
docker stats

# Limpar volumes não usados
docker volume prune

# Aumentar swap (última opção)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

### Problema: Sincronização offline não funciona

```bash
# Verificar se Redis está rodando
docker-compose exec redis redis-cli ping
# Deve retornar: PONG

# Limpar fila (cuidado!)
docker-compose exec redis redis-cli FLUSHDB
```

---

## Performance Tuning

### PostgreSQL

```env
# No .env, ajustar para servidor 2GB RAM:
POSTGRES_MAX_CONNECTIONS=100
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
```

### Redis

Aumentar max memory se necessário:

```bash
docker-compose exec redis redis-cli CONFIG SET maxmemory 256mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Next.js

O build de produção já é otimizado. Mas você pode:

```bash
# Gerar relatório de bundle
npm run build
npm run analyze  # (se tiver plugin)
```

### Nginx

Já configurado com:
- Gzip compression
- HTTP/2
- Keep-alive
- Cache headers

---

## Atualizar para Nova Versão

```bash
cd /opt/controle-os

# 1. BACKUP do banco (sempre)
docker-compose exec -T postgres pg_dump -U controle_os_user controle_os > backup-pre-update-$(date +%Y%m%d-%H%M%S).sql

# 2. Pull código novo
git pull origin main

# 3. Rebuild e suba (migrações rodam automaticamente via entrypoint)
docker-compose down
docker-compose up -d --build

# 4. Aguardar backend ficar pronto
docker-compose logs -f backend
# Procurar por: "INFO: ✓ Migrações executadas com sucesso"
# Depois: Fastify escuta em :3333

# 5. Validar aplicação
docker-compose ps  # Todos devem estar UP
curl https://seu-dominio.com/health

# 6. Se tudo OK:
echo "✓ Update bem-sucedido"

# 7. Se alguma coisa quebrou:
# Restaurar backup anterior
docker-compose down
docker volume rm controle-os_postgres_data
docker-compose exec -T postgres psql -U controle_os_user controle_os < backup-pre-update-*.sql
docker-compose up -d
```

---

## Verificação Pós-Instalação

Após subir produção, verifique:

- [ ] Frontend carrega: `https://seu-dominio.com`
- [ ] Login funciona
- [ ] API responde: `curl https://seu-dominio.com/health`
- [ ] SSL válido: Clique ícone de cadeado no navegador
- [ ] Banco tem dados: Acessar Prisma Studio
- [ ] Uploads funcionam: Criar OS com foto
- [ ] Emails funcionam: Testar reset de senha (se SMTP configurado)
- [ ] Backups rodando: Verificar pasta `/backups/`

---

## Contato e Suporte

Em caso de problemas durante instalação:

- Consulte os logs (`docker-compose logs`)
- Verifique variáveis de ambiente (`.env`)
- Veja a seção Troubleshooting acima
- Entre em contato com suporte técnico

---

**Última atualização**: June 2026
