# Controle OS, Estoque e Agenda

Sistema de **ordens de serviço, estoque com QR Code, agenda por equipes e app do técnico** com backend real, autenticação JWT e banco de dados PostgreSQL.

## Stack

### Frontend
- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (componentes em `src/components/ui`)
- **TanStack Query v5** (React Query — estado do servidor)
- **Zustand v5** (estado de UI e fluxos locais)
- **React Hook Form** + **Zod** (formulários e validação)
- **Framer Motion** (animações, sidebar mobile)
- **lucide-react** (ícones)

### Backend
- **Fastify 5** + **TypeScript**
- **Prisma ORM** + **PostgreSQL**
- **Redis** (rate limiting)
- **JWT** em cookie httpOnly (8h)
- **Docker Compose** (4 serviços: postgres, redis, backend, frontend)

## Funcionalidades

- 5 perfis com controle de acesso: `ADMIN`, `STOCK`, `TECHNICIAN`, `ATTENDANT`, `FINANCIAL`
- Painel com indicadores em tempo real (dados do banco)
- CRUD completo de **Clientes**, **Produtos** e **Técnicos** via API REST
- Agenda das equipes com **drag & drop** de OS, calendário mensal e agendamento
- **Estoque**: produtos, QR Code, entrada/saída, alertas de estoque baixo
- **Relatórios por equipe** e **financeiro** (somente admin)
- **Navegação mobile** com sidebar deslizante (menu hambúrguer)
- **App do técnico** (`/tecnico`): check-in, 3 fotos, assinatura em canvas, ID do chip e finalização da OS
- Rate limiting, CORS configurado e helmet no backend

## Rodando localmente

### Pré-requisitos
- Docker e Docker Compose (para PostgreSQL e Redis)
- Node.js 20+

### Variáveis de ambiente

Copie `.env.example` para `.env` na raiz e preencha os valores. Para desenvolvimento local, os valores padrão já funcionam.

**`.env.local`** (raiz — Next.js):
```
BACKEND_URL=http://localhost:3333
JWT_SECRET=controle-os-jwt-secret-mude-em-producao
```

**`backend-senior/.env`**:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/controle_os"
REDIS_URL=redis://localhost:6379
JWT_SECRET=controle-os-jwt-secret-mude-em-producao
PORT=3333
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
SEED_ADMIN_PASS=admin123
SEED_STOCK_PASS=estoque123
SEED_TECH_PASS=tecnico123
SEED_ATTENDANT_PASS=atend123
SEED_FINANCIAL_PASS=financeiro123
```

### Subindo os serviços

```bash
# 1. Banco e cache
docker-compose up -d postgres redis

# 2. Backend
cd backend-senior
npm install
npx prisma migrate deploy      # cria as tabelas
npm run seed                   # cria usuários demo (uma vez)
npm run dev

# 3. Frontend (outra aba)
cd ..
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Usuários demo

| E-mail | Senha | Perfil |
|---|---|---|
| admin@controle.com | admin123 | Admin |
| estoque@controle.com | estoque123 | Estoque |
| tecnico@controle.com | tecnico123 | Técnico |
| atendimento@controle.com | atend123 | Atendimento |
| financeiro@controle.com | financeiro123 | Financeiro |

### Docker Compose (stack completa)

```bash
# Copie e preencha as variáveis antes de subir
cp .env.example .env
# Edite .env com senhas reais e SEED_*_PASS

docker-compose up -d
# O backend já roda migrate + seed automaticamente na inicialização
```

### Deploy em produção

1. Copie `.env.example` para `.env` e gere senhas seguras:
   ```bash
   openssl rand -base64 32  # para POSTGRES_PASSWORD e REDIS_PASSWORD
   openssl rand -base64 64  # para JWT_SECRET
   ```
2. Defina `ALLOWED_ORIGINS` com o domínio real do frontend.
3. Defina `SEED_*_PASS` com as senhas que os usuários vão usar.
4. Execute `docker-compose up -d`.

## Estrutura

```text
controle-os-next/
  src/
    app/               # rotas Next.js (App Router) + API routes
      api/
        auth/          # login, logout, me
        backend/       # proxy reverso → backend Fastify
    components/
      ui/              # shadcn/ui
      layout/          # Sidebar (desktop + mobile), Topbar
      dashboard/       # métricas, agenda, dispatch, fila de OS
      stock/           # estoque e QR
      reports/ finance/ tracking/ teams/ clients/ dialogs/
      tecnico/         # canvas de assinatura
    hooks/             # React Query: useProducts, useTechnicians, useClients, useServiceOrders
    lib/               # tipos, utils, regras de acesso, api client
    store/             # Zustand: use-app-store, use-ui-store
  backend-senior/
    src/
      controllers/     # auth, client, product, technician, serviceOrder, report
      routes/          # Fastify route registration
      services/        # lógica de negócio + Prisma
      lib/             # JWT, seed-users
    prisma/
      schema.prisma    # modelos: User, Client, Product, Technician, ServiceOrder
```
