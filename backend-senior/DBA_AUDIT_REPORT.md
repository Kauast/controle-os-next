# DBA Audit Report — controle-os-next backend-senior

**Data:** 2026-06-12  
**Analista:** DBA Sênior + Arquiteto Backend  
**Versão do schema Prisma auditada:** e214654 (última migração: 20260611000001_add_password_changed_at)

---

## 1. Resumo Executivo

O projeto já possui uma arquitetura bem estruturada com:
- Soft delete implementado via Prisma Client Extension (`$extends`) em todos os modelos críticos
- AuditLog completo com campos `before`, `after`, `ip`, `userAgent`
- Controle de concorrência otimista (`version`) nos modelos principais
- Race condition de estoque **já corrigida** com `SELECT FOR UPDATE` pessimista
- Relacionamento `Technician ↔ User` já implementado
- `Attachment` model já no schema
- `Payment` com cancel fields, `updatedAt`, `version`

Apesar disso, foram identificados **9 problemas** que precisam de correção para produção.

---

## 2. Problemas Encontrados

### 2.1 ÍNDICES AUSENTES — Risco: ALTO

| Modelo | Índice ausente | Impacto |
|---|---|---|
| `ServiceOrder` | `dueDate`, `createdAt`, `scheduledStart`, `scheduledEnd` | Queries de prazo/agenda sem índice causam full table scan |
| `Product` | `name`, `minStock` | Busca por nome e alertas de estoque mínimo lentos |
| `StockMovement` | `userId`, `(type, createdAt)` | Relatórios de movimentação por usuário/tipo sem índice |
| `Client` | `name`, `phone`, `city`, `isBlocked` | Busca por nome/telefone e filtragem de bloqueados sem índice |
| `Payment` | `status`, `dueDate`, `paidAt` | Queries financeiras de cobrança e inadimplência lentas |
| `Chip` | `serviceOrderId`, `installedAt` | Busca de chips por OS e data de instalação sem índice |
| `AuditLog` | `action` | Filtragem de logs por ação sem índice |

**Impacto em produção:** Com 10k+ registros em cada tabela, full table scans causam timeouts visíveis para o usuário.

### 2.2 CAMPOS DE AGENDAMENTO INCOMPLETOS — Risco: MÉDIO

`ServiceOrderSchedule` tem `scheduledDate` (Date) + `scheduledTime` (String), combinação frágil que:
- Não permite comparações temporais nativas (range queries)
- Complica detecção de conflito de agenda
- Impede uso de índice composto em range temporal

**Solução:** Adicionar `scheduledStart DateTime?` e `scheduledEnd DateTime?` diretamente em `ServiceOrder` para compatibilidade retroativa.

### 2.3 SINGLETON DO PRISMA CLIENT AUSENTE — Risco: MÉDIO (dev) / BAIXO (prod)

`prisma.ts` cria novo cliente em cada load do módulo. Em `tsx watch` (dev), múltiplos reloads acumulam conexões sem `$disconnect`. Sem `graceful shutdown`, conexões ficam abertas ao matar o processo.

**Impacto:** Warning de "too many connections" em desenvolvimento com muitos hot-reloads.

### 2.4 LOG DE QUERIES AUSENTE EM DEV — Risco: BAIXO

`log` configurado como `['warn', 'error']` em dev. Sem `'query'`, é impossível debugar N+1 queries durante desenvolvimento.

### 2.5 SEM ATTACHMENT SERVICE — Risco: MÉDIO

O model `Attachment` existe no schema mas não há `attachmentService.ts`. Qualquer upload de arquivo teria que manipular o model diretamente, sem validação de negócio ou soft delete.

### 2.6 PAYMENT SEM CAMPOS `reference` E `description` — Risco: BAIXO

`Payment` tem `notes` mas falta `reference` (referência externa, ex: ID da transação PIX) e `description` (descrição do pagamento). Impossível rastrear payments por referência externa.

### 2.7 `FinancialMovementType` SEM `REVERSAL` — Risco: BAIXO

O enum tem `INCOME, EXPENSE, REFUND, ADJUSTMENT`. Falta `REVERSAL` para estorno contábil explícito (diferente de `REFUND` que é devolução ao cliente).

### 2.8 SEED INCOMPLETO PARA PRODUÇÃO — Risco: BAIXO (informativo)

`seed-users.ts` cria usuários mas sem `Company` obrigatório (campo `companyId`). Pode falhar em banco limpo.

### 2.9 `findUnique` NO SOFT-DELETE EXTENSION — Risco: BAIXO (técnico)

A extensão `findUnique` em `prisma.ts` adiciona `deletedAt = null` ao `where`, mas Prisma rejeita campos extras em `findUnique` quando não fazem parte de um índice único. Isso pode causar erros runtime silenciosos (o catch geral engole a exceção).

---

## 3. Plano de Correção

### Fase 2 — Índices (schema.prisma)
Adicionar todos os `@@index` ausentes listados em 2.1.

### Fase 7 — Agendamento (schema.prisma + service-order.rules.ts)
Adicionar `scheduledStart DateTime?` e `scheduledEnd DateTime?` em `ServiceOrder` com validação `scheduledEnd > scheduledStart`.

### Fase 9 — Financeiro (schema.prisma)
Adicionar `reference String?` e `description String?` em `Payment`.  
Adicionar `REVERSAL` no enum `FinancialMovementType`.

### Fase 10 — Prisma Client (prisma.ts)
Adicionar singleton via `globalThis`, log `'query'` em dev, `graceful shutdown`.

### Fase 8 — Attachment Service
Criar `src/modules/attachment/attachment.service.ts` com `create`, `listByEntity`, `softDelete`.

---

## 4. Arquivos que Serão Alterados

| Arquivo | Tipo de mudança |
|---|---|
| `prisma/schema.prisma` | Índices + novos campos |
| `src/lib/prisma.ts` | Singleton + logs + graceful shutdown |
| `src/modules/service-order/service-order.rules.ts` | Validação scheduledStart/scheduledEnd |
| `src/modules/service-order/service-order.service.ts` | Aceitar scheduledStart/scheduledEnd no create |

## 5. Arquivos que Serão Criados

| Arquivo | Finalidade |
|---|---|
| `src/modules/attachment/attachment.service.ts` | CRUD de anexos com soft delete |
| `src/services/attachmentService.ts` | Re-export para compatibilidade |
| `DBA_TEST_PLAN.md` | Plano de testes manuais |
| `CHANGELOG_DBA_HARDENING.md` | Changelog final |

## 6. Riscos Restantes Após Correção

- **Problema 2.8 (seed):** Requer análise separada do script de seed
- **Problema 2.9 (findUnique):** Requer refactoring do $extends que pode impactar todos os serviços — postergado para fase futura
- Upload físico de arquivos: `attachmentService` cria registro no banco; lógica de armazenamento físico (S3/local) deve ser implementada na camada de controller/route
