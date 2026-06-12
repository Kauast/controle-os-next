# Regras de Arquitetura SaaS

## Princípios gerais

1. **Multi-tenant ready** — toda query deve filtrar por `organizationId`
2. **API-first** — nenhuma lógica de negócio no frontend
3. **Stateless backend** — estado de sessão em Redis, não em memória do servidor
4. **Offline-first mobile** — app técnico funciona sem internet para leitura
5. **Auditoria completa** — toda mutação registra quem, quando e o quê

---

## Frontend (Next.js)

### Regras obrigatórias
- Server Components para páginas de listagem (performance + SEO)
- Client Components apenas para interatividade (formulários, modais, gráficos)
- TanStack Query para todo estado servidor — nunca `useState` para dados remotos
- Zustand apenas para estado de UI local (sidebar aberta, filtros ativos, modal visível)
- Zod + React Hook Form em todos os formulários — nunca validação manual

### Estrutura de rotas
```
src/app/
  (auth)/          # Rotas públicas — login, esqueci senha
  (dashboard)/     # Rotas protegidas — requer JWT válido
    dashboard/
    ordens/
    clientes/
    estoque/
    agenda/
    financeiro/
    rastreamento/
    relatorios/
    configuracoes/
  api/             # Route handlers Next.js (BFF layer)
```

### Performance
- Lazy load de gráficos pesados (Recharts, Leaflet)
- Tabelas com virtualização para listas > 100 itens
- Imagens via `next/image` com lazy loading
- Prefetch automático de rotas adjacentes

---

## Backend (Fastify)

### Regras obrigatórias
- Autenticação via JWT — verificado em todo endpoint privado
- Rate limiting por usuário e por IP
- Validação de input com Zod em toda route
- Erros padronizados: `{ code, message, details }`
- Logs estruturados em JSON (nível: info, warn, error)

### Estrutura de módulos
```
backend-senior/
  src/
    modules/
      auth/
      ordens/
      clientes/
      estoque/
      agenda/
      financeiro/
      usuarios/
    shared/
      middleware/
      plugins/
      utils/
    prisma/
```

### Padrão de endpoint
```
GET    /api/ordens          → lista com filtro e paginação
GET    /api/ordens/:id      → detalhes
POST   /api/ordens          → criar
PATCH  /api/ordens/:id      → atualizar
DELETE /api/ordens/:id      → remover (soft delete)
```

---

## Banco de dados (PostgreSQL + Prisma)

### Regras obrigatórias
- Soft delete em todas as entidades principais (`deletedAt DateTime?`)
- `createdAt` e `updatedAt` em todas as tabelas
- `organizationId` indexado em todas as tabelas multi-tenant
- Migrations sempre via Prisma — nunca SQL manual em produção
- Seeds separados por ambiente

### Índices obrigatórios
- `(organizationId, status)` em `OrdemServico`
- `(organizationId, tecnicoId)` em `OrdemServico`
- `(organizationId, clienteId)` em `OrdemServico`
- `(organizationId, data)` em `Agenda`

---

## Cache (Redis)

| Dado | TTL | Estratégia |
|---|---|---|
| Sessão JWT | 24h | Cache-aside |
| Lista de técnicos ativos | 30s | Write-through |
| KPIs do dashboard | 60s | Background refresh |
| Posição dos técnicos | 10s | Pub/Sub |

---

## Segurança

- Senhas com bcrypt (cost factor 12)
- JWT com expiração de 24h + refresh token de 30 dias
- CORS restrito ao domínio da aplicação
- Sanitização de todos os inputs de texto livre
- Nunca expor stack traces na API em produção
- Variáveis de ambiente validadas no startup (Zod)

---

## CI/CD

- Build em Docker multi-stage
- Testes de integração obrigatórios no PR
- Deploy automático em staging em merge para `develop`
- Deploy manual em produção (aprovação obrigatória)
- Rollback via imagem Docker anterior
