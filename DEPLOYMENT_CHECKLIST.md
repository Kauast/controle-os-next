# Checklist de Deployment - Controle OS

Validação pré-deploy e procedimentos pós-deployment.

## Checklist Pré-Deploy

### Código & Testes

- [ ] Branch `main` tem commits aprovados em PR
- [ ] CI/CD passou (lint, typecheck, 63 testes backend, build frontend)
- [ ] Backend: `npm test` passa com verde
- [ ] Frontend: `npm run build` completa sem erros
- [ ] Docker images constroem sem erros (`docker-compose build`)
- [ ] Migrations estão em `backend-senior/prisma/migrations/` (2 novas: refresh_token_table, execution_attachment_ids)

### Ambiente de Produção

- [ ] VPS configurado (Ubuntu 22.04+, 2GB RAM mínimo, 20GB disco)
- [ ] Docker & Docker Compose instalados
- [ ] Domínio DNS apontando para IP do servidor
- [ ] Portas 80, 443, 3001, 3200 liberadas no firewall

### Arquivo .env

- [ ] `.env.example` copiado para `.env`
- [ ] Variáveis obrigatórias preenchidas:
  - [ ] `DOMAIN=seu-dominio.com`
  - [ ] `POSTGRES_PASSWORD` (gerado: `openssl rand -base64 32`)
  - [ ] `REDIS_PASSWORD` (gerado: `openssl rand -base64 32`)
  - [ ] `JWT_SECRET` (gerado: `openssl rand -base64 64`)
  - [ ] `APP_URL=https://seu-dominio.com` (CRÍTICO em produção)
  - [ ] `ANTHROPIC_API_KEY` (chave válida)
  - [ ] `METRICS_TOKEN` (gerado: `openssl rand -base64 32`)
  - [ ] `CERTBOT_EMAIL=seu-email@real.com`
- [ ] Variáveis de seed preenchidas (para `npm run seed` manual):
  - [ ] `SEED_DEFAULT_PASS`
  - [ ] `SEED_ADMIN_PASS`
  - [ ] `SEED_STOCK_PASS`
  - [ ] `SEED_TECH_PASS`
  - [ ] `SEED_ATTENDANT_PASS`
  - [ ] `SEED_FINANCIAL_PASS`
- [ ] `.env` é `.gitignore`'d (nunca commitado)

### Backup Pré-Deployment

- [ ] Backup do banco existente (se upgrade): `docker-compose exec postgres pg_dump -U controle_os_user controle_os > backup-pre-deploy.sql`
- [ ] Backup dos uploads (se local): `tar -czf uploads-backup.tar.gz uploads/`

---

## Procedimento de Deploy

### Primeiro Deploy (Servidor Novo)

```bash
# 1. SSH no servidor
ssh root@VPS_IP

# 2. Clonar código
git clone https://github.com/Kauast/controle-os-next.git /opt/controle-os
cd /opt/controle-os

# 3. Configurar .env
cp .env.example .env
nano .env  # Preencher todas as variáveis obrigatórias

# 4. Rodar setup automático
sudo bash scripts/setup-vps.sh

# Aguardar até ver:
# ✓ "Certificado obtido com sucesso!"
# ✓ "Stack de monitoramento iniciada"
# ✓ Serviço 'migrate' completou (one-shot)
# ✓ Prompt para seed

# 5. Validar migrate completou
docker-compose logs migrate
# Procurar: "✓ Migrações executadas com sucesso"

# 6. Executar seed (responder 's' ao prompt)
# Cria Company padrão + 6 usuários de teste
docker-compose exec backend npm run seed

# 7. Validar aplicação
curl https://seu-dominio.com/health
# Deve retornar: {"status":"ok","uptime":...}
```

### Update (Novo Código)

```bash
cd /opt/controle-os

# 1. Backup
docker-compose exec -T postgres pg_dump -U controle_os_user controle_os > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Pull código
git pull origin main

# 3. Rebuild & restart (serviço 'migrate' cuida de migrations automaticamente)
docker-compose down
docker-compose up -d --build

# 4. Aguardar migrate executar
docker-compose logs migrate
# Procurar: "✓ Migrações executadas com sucesso"

# 5. Aguardar backend estar pronto
docker-compose logs backend | head -30
# Procurar: backend pronto

# 6. Validar
curl https://seu-dominio.com/health
docker-compose ps  # Todos devem estar UP

# 7. Se precisar rollback
git revert <commit>
docker-compose down && docker-compose up -d --build
# Migrate roda novamente automaticamente
```

---

## Checklist Pós-Deploy

### Validação da Aplicação

- [ ] Serviço `migrate` completou: `docker-compose ps` (deve estar Exited 0)
- [ ] Backend rodando: `docker-compose ps backend` (deve estar UP)
- [ ] Frontend carrega: `https://seu-dominio.com`
- [ ] Login funciona (usar email do seed)
- [ ] Health check OK: `curl https://seu-dominio.com/health`
- [ ] SSL válido (cadeado no navegador)
- [ ] API responde: curl headers retornam 200
- [ ] Database connection OK: `docker-compose logs backend | grep "connected"`

### Funcionalidades Críticas

- [ ] Criar nova Ordem de Serviço (OS)
- [ ] Upload de arquivo/foto (se local storage)
- [ ] Listar OS (multi-tenant scope correto)
- [ ] Usuários conseguem fazer login (JWT/refresh token)
- [ ] Password reset funciona (se SMTP configurado)

### Monitoramento & Observabilidade

- [ ] Prometheus scraping metrics: `docker-compose logs prometheus | grep "scrape"`
- [ ] Grafana acessível: `https://seu-dominio.com:3200` (credenciais no .env)
- [ ] Uptime Kuma acessível: `https://seu-dominio.com:3001`
- [ ] Backups rodando: `ls -la ./backups/` (deve ter arquivos diários)

### Logs

- [ ] Backend logs limpos (sem erros RED): `docker-compose logs backend | tail -50`
- [ ] Nginx logs limpos: `docker-compose logs nginx | tail -50`
- [ ] PostgreSQL rodando: `docker-compose logs postgres | grep "ready to accept"`

### Segurança

- [ ] HTTPS obrigatório (HTTP redireciona para HTTPS)
- [ ] Headers de segurança: `curl -I https://seu-dominio.com | grep -i "strict\|csp\|frame"`
- [ ] `/metrics` requer token: `curl https://seu-dominio.com/metrics` (401 sem token)
- [ ] Nenhum .env commitado: `git ls-files .env` (deve estar limpo)

---

## Troubleshooting Rápido

### Serviço `migrate` falha

```bash
# Ver erro completo
docker-compose logs migrate | tail -100

# Causas comuns:
# 1. Postgres não pronto (healthcheck falhando)
# 2. Schema incompatível ou migrations quebradas
# 3. Permissions insuficientes no banco

# Solução: Verificar postgres e pgbouncer
docker-compose ps postgres pgbouncer
docker-compose logs postgres pgbouncer

# Se postgres está UP, reiniciar migrate
docker-compose restart migrate
```

### Backend não inicia após migrate

```bash
# Ver erro completo
docker-compose logs backend | tail -100

# Verificar que migrate completou com sucesso
docker-compose ps migrate

# Se migrate está Exited 0, backend deve estar UP ou iniciando
# Se migrate está Exited com código ≠ 0, backend não inicia

# Causas comuns (uma vez que migrate completou):
# 1. APP_URL inválida ou ausente
# 2. DATABASE_URL/DIRECT_URL incorretos
# 3. Redis não pronto (only warning, não fatal)

# Reiniciar backend manualmente
docker-compose restart backend
```

### Migrations falhando no serviço `migrate`

```bash
# Ver status das migrations já aplicadas
docker-compose exec postgres psql -U controle_os_user controle_os -c \
  "SELECT migration, finished_at FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 5;"

# Revisar migrate log
docker-compose logs migrate | grep -i "error\|fail"

# Restaurar backup se necessário
docker-compose down
docker-compose exec postgres psql -U controle_os_user controle_os < backup-*.sql
docker-compose up -d
```

### SSL expirado

```bash
# Renovar
docker-compose exec certbot certbot renew --verbose

# Recarregar nginx
docker-compose exec nginx nginx -s reload
```

### Seed não funciona

```bash
# Verificar backend está rodando
docker-compose ps | grep backend

# Executar seed manualmente
docker-compose exec backend npm run seed

# Se falhar, ver logs
docker-compose logs backend | grep -i seed
```

---

## Operações Comuns

### Backup Manual

```bash
# Banco
docker-compose exec -T postgres pg_dump -U controle_os_user controle_os | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Uploads (se local)
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### Restore de Backup

```bash
# DB
gunzip backup-*.sql.gz
docker-compose exec -T postgres psql -U controle_os_user controle_os < backup-*.sql

# Uploads
tar -xzf uploads-backup-*.tar.gz -C ./

# Reiniciar backend
docker-compose restart backend
```

### Ver Logs em Tempo Real

```bash
# Migrations (one-shot)
docker-compose logs migrate --tail=100

# Backend
docker-compose logs -f backend --tail=100

# Todos os serviços
docker-compose logs -f --tail=50

# Filtrar por erro
docker-compose logs | grep -i "error\|fail"
```

### Parar/Iniciar Serviços

```bash
# Parar tudo
docker-compose down

# Ou apenas alguns
docker-compose stop backend frontend

# Iniciar
docker-compose up -d
```

---

## Referências

- **Guia Completo**: `docs/INSTALACAO.md`
- **Deploy Técnico**: `backend-senior/DEPLOY.md`
- **Docker Compose**: `docker-compose.yml`
- **CI/CD**: `.github/workflows/ci.yml`
- **Entrypoint**: `backend-senior/docker-entrypoint.sh`

---

**Última atualização**: 2026-06-13
