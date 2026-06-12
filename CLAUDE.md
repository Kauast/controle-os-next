# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Next.js version

Read `AGENTS.md` before writing any code — this project uses Next.js 15 with breaking changes from older versions.

## Commands

### Frontend (root)
```bash
npm run dev      # dev server on :3000
npm run build    # production build (also type-checks src/)
npm run lint     # eslint
```

### Backend (backend-senior/)
```bash
npm run dev              # tsx watch, hot-reload on :3333
npm run build            # prisma generate + tsc
npm run test             # vitest
npm run test:coverage    # vitest --coverage

npx prisma migrate dev   # apply schema changes + regenerate client
npx prisma generate      # regenerate client without migration
npx prisma studio        # GUI for the database
```

### Seed demo users (run once after first migration)
```bash
cd backend-senior
npx tsx src/lib/seed-users.ts
```

Demo credentials: `admin@controle.com / admin123`, `estoque@controle.com / estoque123`, `tecnico@controle.com / tecnico123`, `atendimento@controle.com / atend123`.

### Full stack startup
```bash
docker-compose up -d postgres redis          # PostgreSQL :5432, Redis :6379
cd backend-senior && npx prisma migrate dev  # first time only
cd backend-senior && npm run dev             # backend :3333
npm run dev                                  # frontend :3000
```

Env files needed: `.env.local` (root) with `BACKEND_URL` and `JWT_SECRET`; `backend-senior/.env` with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT`, `ALLOWED_ORIGINS`.

## Architecture

This is a monorepo with two independent projects:

- **Root** — Next.js 15 App Router frontend
- **`backend-senior/`** — Fastify 5 + Prisma + PostgreSQL backend (separate `package.json`, `tsconfig.json`)

The root `tsconfig.json` **excludes** `backend-senior/` — never put backend files in the root TS path.

### Authentication flow

1. `POST /api/auth/login` (Next.js route) → forwards to backend → sets `auth_token` httpOnly cookie (8h JWT)
2. `middleware.ts` verifies the JWT on every request, redirects unauthenticated users to `/login`
3. `src/app/api/backend/[...path]/route.ts` is an HTTP proxy: all `apiClient` calls from the browser hit `/api/backend/*`, the proxy reads the cookie and forwards as `Authorization: Bearer` to `http://BACKEND_URL/api/*`
4. `src/app/providers.tsx` — on mount, calls `/api/auth/me` and maps the backend role (`ADMIN/STOCK/TECHNICIAN/ATTENDANT/FINANCIAL`) to the frontend role (`admin/estoque/tecnico/atendimento`) via `src/lib/auth.ts:backendRoleToFrontend`

### Data state split

**Real API (React Query via `src/lib/api/client.ts`)**:
- Products → `src/hooks/useProducts.ts` → `GET/POST /api/products`, `PATCH /api/products/:id/stock`
- Technicians → `src/hooks/useTechnicians.ts` → `GET/PUT /api/technicians`, `PATCH /api/technicians/:id/deactivate`
- Clients → `src/hooks/useClients.ts` → full CRUD `/api/clients`
- Service Orders → `src/hooks/useServiceOrders.ts` → `GET/PATCH /api/service-orders`
- Reports → `src/lib/api.ts:fetchTeamReport/fetchFinance` → `GET /api/reports/team|finance`

**Zustand store (`src/store/use-app-store.ts`)**:
- Local dispatch board OS (different schema from the backend's ServiceOrder)
- Material requests and stock movements (no backend endpoint yet)
- Technician execution state: check-in, photos, signature, chip ID

**UI state (`src/store/use-ui-store.ts`)**: active section, dialog open states, mobile sidebar open.

### Role and section access

`src/lib/access.ts` centralises all permission logic. `canAccessSection(section, role)` gates the sidebar navigation. `access.stockWrite(role)`, `access.finance(role)`, etc. gate individual UI elements.

### Frontend type mapping

Backend Prisma models use `id: String (cuid)` and snake_case field names. The frontend hooks map API responses to the local types in `src/lib/types.ts`. Products and Technicians get a numeric `id` (array index) for legacy UI compatibility and carry the real API id in `_apiId?: string`.

### Mobile navigation

Desktop: `<Sidebar>` (fixed `w-[260px]`, `hidden lg:flex`).  
Mobile: `<MobileSidebar>` (Framer Motion slide-in overlay, toggled by `mobileSidebarOpen` in `useUIStore`). The hamburger button is in `<Topbar>` (`lg:hidden`).

### Backend route structure

All routes are registered in `backend-senior/src/server.ts` under `/api/*`:

| Prefix | Router file |
|---|---|
| `/api/auth` | `authRoutes.ts` |
| `/api/clients` | `clientRoutes.ts` |
| `/api/service-orders` | `serviceOrderRoutes.ts` |
| `/api/products` | `productRoutes.ts` |
| `/api/technicians` | `technicianRoutes.ts` |
| `/api/reports` | `reportRoutes.ts` |

All routes except `/api/auth/login` require the `authenticate` middleware (JWT). `POST /api/auth/register` requires `ADMIN` role (`authenticate + authorize('ADMIN')`). Admin-only routes additionally call `authorize('ADMIN')`.

### Prisma schema notes

The schema extends the base models with frontend-specific fields:
- `Product`: `category`, `location`, `minStock Int`, `cost Decimal`
- `Technician`: `phone`, `team`, `statusField` (display status string)

After any schema change, run `npx prisma migrate dev` then `npx prisma generate` from `backend-senior/`.

---

## Identidade no projeto

Você atua simultaneamente como:
- **Head of Product** — pensa em fluxo, KPIs e valor para o usuário
- **Senior UX Designer** — garante densidade, hierarquia e usabilidade
- **SaaS Architect** — mantém padrões técnicos e escalabilidade
- **Principal Frontend Engineer** — implementa com qualidade e consistência

---

## Documentos obrigatórios

Antes de alterar qualquer tela, leia e aplique:

| Arquivo | Conteúdo |
|---|---|
| `docs/ux/design-system.md` | Cores, tipografia, tokens, componentes |
| `docs/ux/ux-rules.md` | Regras de layout e UX obrigatórias |
| `docs/ux/references.md` | Referências visuais por módulo |
| `docs/prd/rb-seguranca-prd.md` | Produto, usuários, fluxo, KPIs |
| `docs/architecture/saas-rules.md` | Padrões técnicos |
| `docs/wireframes/*.md` | Wireframes de cada módulo |

**Esses documentos têm prioridade máxima sobre qualquer outra convenção.**

---

## Protocolo antes de alterar código

1. Leia os documentos relevantes para o módulo
2. Identifique violações das regras de UX na tela atual
3. Compare com a referência visual do módulo (`references.md`)
4. Descreva o problema e a solução proposta
5. Implemente

Para melhorias óbvias (tela vazia, sem filtros, sem KPIs), **não peça confirmação — implemente diretamente**.

---

## Objetivo do produto

Transformar o RB Segurança em um SaaS de nível **ServiceTitan + Linear + Samsara**.

Não criar interfaces genéricas. Toda decisão visual segue o Design System RB.

---

## Regras rápidas de UX

- Nunca criar tela vazia ou com menos de 70% de ocupação
- Todo módulo responde: o que acontece / o que exige atenção / qual ação tomar
- Sempre usar variáveis CSS de `globals.css`, nunca valores hardcoded
- Feedback imediato (toast) para toda ação do usuário

## Fluxo principal do produto

```
Cliente → OS → Despacho → Execução → Material → Financeiro → Relatórios
```

Toda feature deve se encaixar neste fluxo. Não criar telas isoladas sem contexto no fluxo.
