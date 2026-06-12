# Controle OS — Relatório de Arquitetura Enterprise

## FASE 1 — RELATÓRIO DE PROBLEMAS ENCONTRADOS

### 1.1 Problemas de Modelagem
| # | Problema | Risco | Impacto em Produção | Solução |
|---|----------|-------|----------------------|---------|
| 1 | `Product.stockQuantity` como fonte primária | CRÍTICO | Race condition em ajustes simultâneos de estoque deixa saldo errado | Removido. Estoque calculado exclusivamente via `StockMovement` com `balanceBefore/balanceAfter` |
| 2 | `ServiceOrder.photoUrls String[]` e `clientSignature String` | ALTO | Sem controle de tipo, tamanho, hash, provider. Impossível auditoria | Substituídos por tabela `Attachment` com metadados completos |
| 3 | `ServiceOrder.team String` sem FK | MÉDIO | Nomes de equipe inconsistentes, impossível relatório por equipe | Substituído por `Team` entity com `@@unique([companyId, name])` |
| 4 | `Technician.statusField String` | MÉDIO | Nenhum controle de valores válidos, inconsistência nos dados | Substituído por enum `TechnicianStatus` |
| 5 | `Product.category String` sem FK | MÉDIO | Duplicatas, impossível filtrar/agrupar | Substituído por `ProductCategory` entity |
| 6 | Ausência de `tenantId` / isolamento multi-empresa | CRÍTICO | Dados de uma empresa visíveis para outra em SaaS | Adicionado `Company` + `companyId` em todas as entidades |
| 7 | Ausência de `deletedAt/deletedBy` | ALTO | Hard deletes destroem histórico de OS, clientes, produtos | Soft delete em todas as entidades principais via middleware Prisma |
| 8 | `Payment` sem `invoiceId`, `method`, `installments` | ALTO | Sistema financeiro primitivo. Impossível parcelamento, estorno | Modelo `Invoice + Payment + FinancialMovement` |
| 9 | `AuditLog` sem `before/after JSON`, sem `entity/entityId` | ALTO | Auditoria inútil. Impossível saber o que mudou | Adicionados campos `before`, `after`, `entity`, `entityId`, `userAgent` |
| 10 | `OSItem` sem campo `total` calculado | BAIXO | Total de cada item recalculado em cada query | Campo `total` calculado e persistido |

### 1.2 Problemas de Concorrência (Race Conditions)
| # | Arquivo | Linha | Problema | Risco |
|---|---------|-------|----------|-------|
| 1 | `productService.ts` | 52-74 | `adjustStock` lê `stockQuantity`, calcula, depois atualiza — sem lock | CRÍTICO: dois ajustes simultâneos podem resultar em estoque negativo |
| 2 | `serviceOrderService.ts` | 132-158 | `assign()` sem `$transaction` — condição de corrida no `maxConcurrentOS` | ALTO: técnico pode exceder limite de OS simultâneas |
| 3 | `serviceOrderService.ts` | 161-179 | `updateExecution()` sem transaction, sem optimistic lock | MÉDIO: dados de execução corrompidos em uso mobile |

### 1.3 Problemas de Performance
| # | Local | Problema | Impacto |
|---|-------|----------|---------|
| 1 | `productService.lowStock()` | Carrega todos os produtos com minStock > 0, filtra em JS | ALTO: para 50k+ produtos, memória esgota |
| 2 | `cache.del()` | Usa `redis.keys(pattern)` — operação O(N) que bloqueia Redis | ALTO: em produção, trava Redis por segundos |
| 3 | `serviceOrder.list()` | Sem índice em `(status, openingDate)` | ALTO: full table scan em 1M+ registros |
| 4 | Ausência de índices compostos | Queries de filtro por cliente+status, tech+status fazem seq scan | ALTO |
| 5 | `technicianService` sem `updatedAt` | Impossível usar revalidação de cache baseada em timestamp | BAIXO |

### 1.4 Problemas de Segurança
| # | Problema | Risco |
|---|----------|-------|
| 1 | `Technician.userId FK` sem restrição de companyId | MÉDIO: usuário de empresa A poderia ser técnico da empresa B |
| 2 | `authorize()` não verifica `companyId` — só `role` | ALTO: usuário de empresa A pode acessar dados da empresa B |
| 3 | `RefreshToken` sem limite de tokens ativos por usuário | MÉDIO: comprometimento de conta pode ser prolongado indefinidamente |
| 4 | `cache.del(pattern)` usa `keys()` — bloqueio Redis | MÉDIO: DoS possível |

---

## FASE 2 — NOVO SCHEMA (Resumo)

Veja: `backend-senior/prisma/schema.prisma`

### Entidades criadas/reestruturadas:
- `Company` — Tenant principal
- `User` — unique por (email, companyId)
- `Team` + `TeamMember` — Equipes com membros e líderes
- `Technician` — com `TechnicianStatus` enum, `version`, soft delete
- `Client` — com `version`, soft delete, unique por (companyId, document)
- `ProductCategory` — Categoria tipada (antes era string livre)
- `Product` — **sem stockQuantity** (fonte de verdade é StockMovement), com `version`, soft delete
- `StockMovement` — com `balanceBefore`, `balanceAfter`, `unitCost`, tipos: IN/OUT/TRANSFER/ADJUSTMENT/LOSS/RETURN
- `StockReservation` — Reserva de estoque para OS (saldo disponível ≠ saldo físico)
- `ServiceOrder` — `teamId FK`, `chipIccid`, `version`, soft delete, sem campos flat de execução
- `ServiceOrderItem` — com `discount`, `total` pré-calculado
- `ServiceOrderSchedule` — Agendamento separado
- `ServiceOrderExecution` — Execução separada com lat/lng
- `ServiceOrderHistory` — Histórico imutável com before/after JSON
- `ServiceOrderEvent` — Timeline de eventos
- `Attachment` — Fotos, assinaturas, documentos com metadados
- `Chip` + `ChipHistory` — Rastreamento com histórico completo
- `Invoice` + `Payment` + `FinancialMovement` — Financeiro profissional
- `AuditLog` — Auditoria completa com before/after

---

## FASE 3 — ESTRATÉGIA DE CONCORRÊNCIA

### Optimistic Lock
Todos os modelos críticos têm campo `version Int`:
```typescript
const result = await tx.model.updateMany({
  where: { id, version: currentVersion },
  data: { ...changes, version: { increment: 1 } },
});
if (result.count === 0) throw new ConcurrencyError();
```
Modelos com optimistic lock: `ServiceOrder`, `Client`, `Product`, `Technician`, `Chip`, `Invoice`, `Payment`

### Pessimistic Lock (Estoque)
```typescript
// SELECT FOR UPDATE — serializa operações por produto
await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
```
Usado em: `StockService.adjustStock()`, `StockService.reserve()`

### Transações Atômicas
Todas as operações críticas usam `prisma.$transaction()`:
- Criação de OS (verificar limite de cliente + técnico em transação)
- Atualização de status (optimistic lock + histórico + eventos em transação)
- Confirmação de pagamento (atualizar payment + invoice em transação)
- Consumo/liberação de reservas de estoque

---

## FASE 4 — ESTRATÉGIA DE ESTOQUE

### Fonte de Verdade: StockMovement
```
Saldo Físico    = último balanceAfter em StockMovement (ou SUM de todos)
Saldo Reservado = SUM(quantity) em StockReservation WHERE status = 'ACTIVE'
Saldo Disponível = Saldo Físico - Saldo Reservado
```

### Fluxo de uma OS com produtos:
1. Técnico solicita material → `StockReservation (ACTIVE)` criada
2. Gerente aprova `MaterialRequest` → reserva confirmada
3. OS concluída → `StockService.consumeReservation()` → Reserva vira `StockMovement (OUT)` + `StockReservation (CONSUMED)`
4. OS cancelada → `StockService.releaseReservation()` → `StockReservation (RELEASED)`

### Prevenção de Estoque Negativo
`SELECT FOR UPDATE` no produto garante serialização. Verificação `physical < quantity` antes de criar movimento.

---

## FASE 5-9 — IMPLEMENTADO (ver código)
- **OS Modular:** `ServiceOrderSchedule`, `ServiceOrderExecution`, `ServiceOrderHistory`, `ServiceOrderEvent`
- **Attachments:** Tabela `Attachment` com `entityType/entityId` polimorfo
- **Financeiro:** `Invoice → Payment → FinancialMovement`. Payments nunca deletados, só cancelados.
- **Auditoria:** `AuditLog` com `before/after` JSON, `entity/entityId`, `userAgent`
- **Soft Delete:** Middleware Prisma intercepta `delete/deleteMany`, converte em `UPDATE { deletedAt: now() }`

---

## FASE 10 — ÍNDICES CRIADOS

```sql
-- ServiceOrder (alta cardinalidade, queries mais frequentes)
(companyId, status, openingDate)    — listagem por status
(companyId, clientId, status)       — histórico por cliente
(companyId, technicianId, status)   — carga do técnico
(companyId, teamId, status)         — carga da equipe
(companyId, priority, openingDate)  — priorização

-- Product
(companyId, categoryId)             — filtro por categoria
(sku)                               — busca por código

-- StockMovement
(companyId, productId)              — histórico por produto
(productId, createdAt)              — saldo corrente (último registro)

-- Payment/Invoice
(companyId, status, dueDate)        — vencimentos + inadimplência
(invoiceId)                         — pagamentos de uma fatura

-- AuditLog
(entity, entityId)                  — histórico de entidade
(companyId, createdAt)              — auditoria por período
```

---

## FASE 11 — CHECKLIST DE SEGURANÇA

- [x] JWT em cookies httpOnly + assinatura RS256 recomendada
- [x] Refresh Token rotativo (revogação ao usar)
- [x] Limite de 5 refresh tokens ativos por usuário
- [x] Bloqueio progressivo de login (5 tentativas → 15 min)
- [x] Invalidação JWT por passwordChangedAt
- [x] RBAC + verificação de companyId em todos os endpoints
- [x] Soft delete (dados nunca expostos após remoção)
- [x] Rate limit Redis em produção (100 req/min global)
- [x] Helmet + CORS seguro (allowlist explícita)
- [x] Validação de entrada via Zod em todos os endpoints
- [x] bcrypt rounds=12 nas senhas
- [ ] TODO: CSRF token para mutations de estado via cookie
- [ ] TODO: Rate limit por endpoint sensível (login: 10/min, reset: 3/min)
- [ ] TODO: Rotação de JWT_SECRET com janela de grace period
- [ ] TODO: WAF na camada de infra (Cloudflare/AWS WAF)

---

## FASE 12 — MULTI-TENANT

### Estratégia: Shared Database, Shared Schema
- Todas as entidades têm `companyId` como FK obrigatória
- `User.email` é único por `(email, companyId)` — mesmo email pode existir em empresas diferentes
- Middleware de autenticação sempre extrai `companyId` do JWT e aplica em todas as queries
- Modelo `Company` com `plan: PlanType` para billing/features flags futuras

### Isolamento Automático
```typescript
// Em todos os services:
await prisma.serviceOrder.findMany({
  where: { companyId: user.companyId, ...filtros }
});
```

---

## FASE 13 — MIGRATIONS

- `20240101000000_init` — Schema inicial (preservado)
- `20260609000000_add_team_priority_materials` — Equipes e materiais (preservado)
- `20260612000000_enterprise_redesign` — **Migração completa**
  - Migra dados existentes (photoUrls → Attachment, team string → Team entity, etc.)
  - Sem perda de dados
  - Rollback: snapshot do banco antes de aplicar

---

## FASE 14 — ESTRUTURA DE MÓDULOS

```
backend-senior/src/
├── modules/
│   ├── auth/         auth.service.ts
│   ├── audit/        audit.service.ts
│   ├── client/       client.service.ts
│   ├── chip/         chip.service.ts
│   ├── financial/    financial.service.ts
│   ├── product/      product.service.ts
│   ├── service-order/
│   │   ├── service-order.service.ts
│   │   └── service-order.rules.ts
│   ├── stock/        stock.service.ts
│   ├── technician/   technician.service.ts
│   └── user/         user.service.ts
├── shared/
│   ├── errors.ts     (AppError, NotFoundError, ConcurrencyError, etc.)
│   └── pagination.ts (parsePagination, buildPaginatedResult)
├── lib/
│   ├── prisma.ts     (com middleware soft-delete)
│   ├── cache.ts      (Redis com SCAN ao invés de KEYS)
│   ├── audit.ts      (re-export do módulo)
│   └── seed.ts       (seed completo)
├── routes/           (inalteradas — mantêm compatibilidade)
└── controllers/      (inalterados — mantêm compatibilidade)
```

---

## FASE 15 — PLANO DE DEPLOY EM PRODUÇÃO

### Pré-deploy
```bash
# 1. Snapshot do banco
pg_dump $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d).sql

# 2. Aplicar migration (com conexão direta ao banco de produção)
npx prisma migrate deploy

# 3. Executar seed (somente se banco novo)
npm run seed

# 4. Validar contagem de registros antes/depois
```

### Variáveis de Ambiente Obrigatórias
```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
REDIS_URL=redis://:pass@host:6379
JWT_SECRET=<openssl rand -base64 64>
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_TTL_DAYS=7
ALLOWED_ORIGINS=https://app.empresa.com
METRICS_TOKEN=<token seguro>
NODE_ENV=production
```

---

## ROADMAP — 1 MILHÃO DE ORDENS DE SERVIÇO

### 0–100k OS (situação atual pós-refactoring)
- PostgreSQL single-node com índices compostos ✅
- Redis cache + rate limiting ✅
- Soft delete + auditoria ✅

### 100k–500k OS
- Read replicas PostgreSQL (separar leituras de escrita)
- Cache de saldo de estoque por produto (Redis, TTL 30s)
- Cursor-based pagination em vez de OFFSET (evita degradação)
- Compressão de `AuditLog` (tabela cresce rápido — arquivar > 90 dias)
- Job diário para marcar `Payment.status = OVERDUE`

### 500k–1M OS
- Particionamento de `ServiceOrder` por `openingDate` (range partitioning)
- Particionamento de `StockMovement` por `createdAt`
- Particionamento de `AuditLog` por `createdAt`
- Connection pooling via PgBouncer
- Materialized view para dashboard (atualizada a cada 5 min)

### 1M+ OS
- CQRS: writes no PostgreSQL, reads num banco de leitura (Elasticsearch ou read replica)
- Event Sourcing para `ServiceOrderHistory` (imutável, append-only)
- Sharding horizontal por `companyId` (Citus ou múltiplos schemas)
- CDN para uploads (S3 + CloudFront)
- Queue assíncrona para auditoria (BullMQ já configurado)

---

## CHECKLIST DE PERFORMANCE

- [x] Índices compostos em todas as queries principais
- [x] Paginação com limite máximo (evita dumps via API)
- [x] `balanceBefore/balanceAfter` em StockMovement (evita recalcular toda cadeia)
- [x] SELECT FOR UPDATE apenas onde necessário (não bloqueia leituras)
- [x] Cache read-through com TTL para dados frequentes
- [ ] TODO: Trocar `redis.keys()` por `redis.scan()` em cache.del()
- [ ] TODO: Cursor pagination para queries > 10k registros
- [ ] TODO: Materialized view para dashboard
- [ ] TODO: Vacuuum analyze agendado nas tabelas de alta escrita

---

## CHECKLIST DE ESCALABILIDADE

- [x] companyId em todas as entidades (sharding ready)
- [x] IDs em CUID (distribuídos, sem colisão em shards)
- [x] Append-only em AuditLog, ServiceOrderHistory (sem updates, sem locks)
- [x] StockMovement append-only (sem UPDATE em saldo)
- [x] BullMQ configurado para filas assíncronas
- [ ] TODO: Particionar ServiceOrder por openingDate quando > 500k rows
- [ ] TODO: Read replica para listagens e relatórios
- [ ] TODO: Retries com backoff exponencial em falhas de transação
